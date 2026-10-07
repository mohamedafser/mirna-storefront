/**
 * Public Supabase settings. These are safe in the browser: access is enforced
 * by RLS. The service role key must NEVER be read here or in any module that
 * can be bundled for the client — the storefront does not use it at all.
 *
 * `process.env.NEXT_PUBLIC_*` must be referenced literally so Next.js can
 * inline the values into the client bundle.
 */
export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // The "anon" JWT key or the newer "publishable" key (sb_publishable_…); the
  // second name matches mirna-admin's .env so one value can serve both apps.
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }

  return { url, anonKey };
}
