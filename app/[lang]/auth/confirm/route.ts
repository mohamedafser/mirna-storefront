import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { LINK_ERROR } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: ReadonlySet<string> = new Set<EmailOtpType>(["signup", "email"]);

/**
 * Landing point for confirmation links that Supabase emailed before sign-up
 * moved to email codes, so that those already sent keep working. Supports both
 * link styles:
 *   - ?code=…                       the default PKCE link ({{ .ConfirmationURL }});
 *                                   must be opened in the browser that asked for it
 *   - ?token_hash=…&type=signup     a custom email template; works in any browser
 * Old password-reset links no longer work: a password only changes after an
 * emailed code (lib/auth/otp-flow.ts), so they go to request a code instead.
 * Invalid, expired or reused links never show Supabase details.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/[lang]/auth/confirm">) {
  const { lang } = await ctx.params;
  const locale = isLocale(lang) ? lang : defaultLocale;
  const params = request.nextUrl.searchParams;

  const tokenHash = params.get("token_hash");
  const otpType = params.get("type");
  const code = params.get("code");

  if (otpType === "recovery" || params.get("flow") === "recovery") {
    redirect(`${localizedHref(locale, routes.forgotPassword)}?error=${LINK_ERROR}`);
  }
  const fail = () => redirect(`${localizedHref(locale, routes.login)}?error=${LINK_ERROR}`);

  // Supabase reports expired/used links as ?error=…&error_code=otp_expired.
  if (params.has("error") || params.has("error_code")) return fail();

  const supabase = await createClient();
  let userId: string | undefined;

  if (tokenHash && otpType && OTP_TYPES.has(otpType)) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    });
    if (error) console.error("[auth] link verification failed", { code: error.code });
    userId = data.user?.id;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("[auth] code exchange failed", { code: error.code });
    userId = data.user?.id;
  }

  if (!userId) return fail();
  redirect(localizedHref(locale, routes.account));
}
