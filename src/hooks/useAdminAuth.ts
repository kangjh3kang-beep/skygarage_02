import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";
import { trustedAdminRole } from "../lib/admin-role";
export function useAdminAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let generation = 0;
    async function sync(next: User | null) {
      const version = ++generation;
      setUser(next);
      setIsAdmin(false);
      setLoading(!!next);
      if (!next) return;
      try {
        const [{ data, error }, assurance] = await Promise.all([
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", next.id)
            .maybeSingle(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);
        if (active && generation === version)
          setIsAdmin(
            trustedAdminRole(data, error) === "super_admin" &&
              assurance.data?.currentLevel === "aal2",
          );
      } catch {
        if (active && generation === version) setIsAdmin(false);
      } finally {
        if (active && generation === version) setLoading(false);
      }
    }
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) void sync(data.session?.user || null);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (active) void sync(session?.user || null);
      }, 0);
    });
    return () => {
      active = false;
      ++generation;
      data.subscription.unsubscribe();
    };
  }, []);
  return { user, isAdmin, loading };
}
