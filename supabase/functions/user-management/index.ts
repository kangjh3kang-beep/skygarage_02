import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    switch (action) {
      case "list": {
        const page = parseInt(url.searchParams.get("page") || "1");
        const perPage = parseInt(url.searchParams.get("per_page") || "50");

        const { data, error } = await supabase.auth.admin.listUsers({
          page,
          perPage,
        });

        if (error) return jsonResponse({ error: error.message }, 400);

        const users = data.users.map((u) => ({
          id: u.id,
          email: u.email,
          phone: u.phone,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at,
          role: u.role,
          app_metadata: u.app_metadata,
          user_metadata: u.user_metadata,
        }));

        return jsonResponse({ users, total: data.users.length });
      }

      case "get": {
        const userId = url.searchParams.get("user_id");
        if (!userId) return jsonResponse({ error: "user_id is required" }, 400);

        const { data, error } = await supabase.auth.admin.getUserById(userId);
        if (error) return jsonResponse({ error: error.message }, 400);

        return jsonResponse({
          id: data.user.id,
          email: data.user.email,
          phone: data.user.phone,
          created_at: data.user.created_at,
          last_sign_in_at: data.user.last_sign_in_at,
          email_confirmed_at: data.user.email_confirmed_at,
          role: data.user.role,
          app_metadata: data.user.app_metadata,
          user_metadata: data.user.user_metadata,
        });
      }

      case "create": {
        const body = await req.json();
        const { email, password, user_metadata } = body;

        if (!email || !password) {
          return jsonResponse({ error: "email and password are required" }, 400);
        }

        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: user_metadata || {},
        });

        if (error) return jsonResponse({ error: error.message }, 400);

        return jsonResponse({ id: data.user.id, email: data.user.email, message: "User created" });
      }

      case "update-email": {
        const body = await req.json();
        const { user_id, email } = body;

        if (!user_id || !email) {
          return jsonResponse({ error: "user_id and email are required" }, 400);
        }

        const { data, error } = await supabase.auth.admin.updateUserById(user_id, { email });
        if (error) return jsonResponse({ error: error.message }, 400);

        return jsonResponse({ id: data.user.id, email: data.user.email, message: "Email updated" });
      }

      case "update-password": {
        const body = await req.json();
        const { user_id, password } = body;

        if (!user_id || !password) {
          return jsonResponse({ error: "user_id and password are required" }, 400);
        }

        if (password.length < 6) {
          return jsonResponse({ error: "Password must be at least 6 characters" }, 400);
        }

        const { data, error } = await supabase.auth.admin.updateUserById(user_id, { password });
        if (error) return jsonResponse({ error: error.message }, 400);

        return jsonResponse({ id: data.user.id, message: "Password updated" });
      }

      case "delete": {
        const body = await req.json();
        const { user_id } = body;

        if (!user_id) return jsonResponse({ error: "user_id is required" }, 400);

        const { error } = await supabase.auth.admin.deleteUser(user_id);
        if (error) return jsonResponse({ error: error.message }, 400);

        return jsonResponse({ message: "User deleted" });
      }

      case "approve-request": {
        const body = await req.json();
        const { request_id, approver_id } = body;

        if (!request_id || !approver_id) {
          return jsonResponse({ error: "request_id and approver_id are required" }, 400);
        }

        // Verify approver is super_admin
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", approver_id)
          .eq("role", "super_admin")
          .maybeSingle();

        if (!roleData) {
          return jsonResponse({ error: "Only super_admin can approve requests" }, 403);
        }

        // Get the request
        const { data: request, error: reqError } = await supabase
          .from("credential_change_requests")
          .select("*")
          .eq("id", request_id)
          .eq("status", "pending")
          .maybeSingle();

        if (reqError || !request) {
          return jsonResponse({ error: "Request not found or already processed" }, 404);
        }

        // Check if expired
        if (new Date(request.expires_at) < new Date()) {
          await supabase
            .from("credential_change_requests")
            .update({ status: "rejected", rejected_reason: "Expired" })
            .eq("id", request_id);
          return jsonResponse({ error: "Request has expired" }, 400);
        }

        // Execute the change based on type
        let execError: string | null = null;

        switch (request.change_type) {
          case "email_change": {
            const { error } = await supabase.auth.admin.updateUserById(
              request.target_user_id,
              { email: request.new_value }
            );
            if (error) execError = error.message;
            break;
          }
          case "password_reset": {
            const { error } = await supabase.auth.admin.updateUserById(
              request.target_user_id,
              { password: request.new_value }
            );
            if (error) execError = error.message;
            break;
          }
          case "user_create": {
            const meta = JSON.parse(request.new_value || "{}");
            const { error } = await supabase.auth.admin.createUser({
              email: request.target_user_email,
              password: meta.password,
              email_confirm: true,
              user_metadata: { display_name: meta.display_name || "" },
            });
            if (error) execError = error.message;
            break;
          }
          case "user_delete": {
            if (request.target_user_id) {
              const { error } = await supabase.auth.admin.deleteUser(request.target_user_id);
              if (error) execError = error.message;
            }
            break;
          }
        }

        if (execError) {
          return jsonResponse({ error: "Failed to execute: " + execError }, 500);
        }

        // Update request status
        await supabase
          .from("credential_change_requests")
          .update({
            status: "approved",
            approver_id: approver_id,
            approved_at: new Date().toISOString(),
            new_value: request.change_type === "password_reset" ? "[cleared]" : request.new_value,
          })
          .eq("id", request_id);

        return jsonResponse({ message: "Request approved and executed" });
      }

      case "reject-request": {
        const body = await req.json();
        const { request_id, approver_id, reason } = body;

        if (!request_id || !approver_id) {
          return jsonResponse({ error: "request_id and approver_id are required" }, 400);
        }

        // Verify approver is super_admin
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", approver_id)
          .eq("role", "super_admin")
          .maybeSingle();

        if (!roleData) {
          return jsonResponse({ error: "Only super_admin can reject requests" }, 403);
        }

        await supabase
          .from("credential_change_requests")
          .update({
            status: "rejected",
            approver_id: approver_id,
            approved_at: new Date().toISOString(),
            rejected_reason: reason || "",
            new_value: "[cleared]",
          })
          .eq("id", request_id);

        return jsonResponse({ message: "Request rejected" });
      }

      case "check-super-admin": {
        const userId = url.searchParams.get("user_id");
        if (!userId) return jsonResponse({ error: "user_id is required" }, 400);

        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "super_admin")
          .maybeSingle();

        return jsonResponse({ is_super_admin: !!data });
      }

      default:
        return jsonResponse({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: "Internal server error", details: String(err) }, 500);
  }
});
