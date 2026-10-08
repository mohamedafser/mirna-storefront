import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/**
 * Refreshes the Supabase session cookie for this request (used by proxy.ts)
 * and returns the verified user id, if any. Visitors without a session cookie
 * cost nothing here: no network call is made. If Supabase can't be reached
 * the visitor is treated as signed out (the account pages re-check anyway).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Cache-Control headers that stop CDNs caching responses with auth cookies.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Must run immediately after creating the client: verifies the JWT and
  // refreshes it if expired.
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    userId = data?.claims.sub ?? null;
  } catch (error) {
    console.error("[auth] session check failed", error);
  }

  return { response, userId };
}

/** Redirect that keeps any refreshed auth cookies/headers from `from`. */
export function redirectPreservingSession(from: NextResponse, to: URL): NextResponse {
  const redirect = NextResponse.redirect(to);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  const cacheControl = from.headers.get("Cache-Control");
  if (cacheControl) redirect.headers.set("Cache-Control", cacheControl);
  return redirect;
}
