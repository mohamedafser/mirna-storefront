import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { mergeGuestLines } from "@/lib/cart/customer-cart";
import { takeOAuthState } from "@/lib/auth/oauth";
import { GOOGLE_ERROR, safeAccountRedirect } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Google sign-in returns to, through Supabase (signInWithGoogle in
 * lib/auth/actions.ts starts it). Supabase has already found or created the
 * user: an email that has an account gets the Google identity linked to it, so
 * customers keep their orders, wishlist and details, and there is no duplicate.
 *
 * Exchanging the code needs the PKCE verifier cookie set when sign-in began, so
 * a code only works in the browser that asked for it. Then the same rule as
 * password sign-in applies: only active customers keep a storefront session.
 * Failures return to the page the visitor came from with a friendly message;
 * Supabase and Google details are only logged.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/[lang]/auth/callback">) {
  const { lang } = await ctx.params;
  const locale = isLocale(lang) ? lang : defaultLocale;
  const params = request.nextUrl.searchParams;

  const state = await takeOAuthState();
  const returnPage = localizedHref(locale, state?.from === "signup" ? routes.signup : routes.login);
  const fail = (code: string) => redirect(`${returnPage}?error=${code}`);

  const oauthError = params.get("error");
  if (oauthError) {
    // "Cancel" on Google's screen. Supabase passes it through in one of these.
    const cancelled = `${oauthError} ${params.get("error_code")} ${params.get("error_description")}`;
    if (cancelled.includes("access_denied")) return fail(GOOGLE_ERROR.cancelled);
    console.error("[auth] Google sign-in refused", {
      error: oauthError,
      code: params.get("error_code"),
    });
    return fail(GOOGLE_ERROR.failed);
  }

  const code = params.get("code");
  if (!code) return fail(GOOGLE_ERROR.failed);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Reloading this page reuses a spent code; that visitor is already signed in.
    const { data: existing } = await supabase.auth.getClaims();
    if (existing?.claims.sub) redirect(localizedHref(locale, routes.account));
    console.error("[auth] Google code exchange failed", { code: error.code, status: error.status });
    return fail(GOOGLE_ERROR.failed);
  }

  // Authorize before letting the session stand. RLS only returns their own row.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();
  const denial = profileError
    ? GOOGLE_ERROR.failed
    : !profile?.is_active
      ? GOOGLE_ERROR.inactive
      : profile.role !== "CUSTOMER"
        ? GOOGLE_ERROR.staff
        : null;
  if (denial) {
    if (profileError) console.error("[auth] profile lookup failed", { code: profileError.code });
    await supabase.auth.signOut({ scope: "local" });
    return fail(denial);
  }

  // Neither of these may block sign-in. The picture updates next time, and the
  // browser merges its guest cart again after the redirect.
  const { error: syncError } = await supabase.rpc("sync_google_profile");
  if (syncError) console.error("[auth] Google profile sync failed", { code: syncError.code });
  try {
    await mergeGuestLines(supabase, data.user.id, state?.cart ?? []);
  } catch (cartError) {
    console.error("[auth] guest cart merge failed", cartError);
  }

  redirect(safeAccountRedirect(state?.next, locale));
}
