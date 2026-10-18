import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { commissioningResponse } from "../_shared/commissioning.ts";

// Previous implementation is retained in Git history, not executable in production.
Deno.serve(commissioningResponse);
