import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/**
 * Cookie-less Supabase client for PUBLIC catalogue reads on the server.
 *
 * It always runs as the `anon` role, so RLS limits it to what any visitor may
 * see: active categories, active products and their images (policies in
 * mirna-admin/supabase/migrations/…_rls_policies.sql). Inventory, profiles,
 * addresses and orders are not readable by anon.
 *
 * Because it never reads the request's cookies, results are identical for
 * every visitor and safe to cache ("use cache"). Anything user-specific must
 * use the session client in server.ts instead.
 */
export function createPublicClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
