import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { markRecovery } from "@/lib/auth/recovery";
import { LINK_ERROR, type EmailLinkFlow } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: ReadonlySet<string> = new Set<EmailOtpType>(["signup", "email", "recovery"]);

/**
 * Landing point for Supabase email links (sign-up confirmation and password
 * reset). Supports both link styles:
 *   - ?code=…                       the default PKCE link ({{ .ConfirmationURL }});
 *                                   must be opened in the browser that asked for it
 *   - ?token_hash=…&type=recovery    a custom email template; works in any browser
 * On success the session cookie is set and the visitor continues to the
 * account (or the reset form). Invalid, expired or reused links never show
 * Supabase details: they go back to the right page with a friendly message.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/[lang]/auth/confirm">) {
  const { lang } = await ctx.params;
  const locale = isLocale(lang) ? lang : defaultLocale;
  const params = request.nextUrl.searchParams;

  const tokenHash = params.get("token_hash");
  const otpType = params.get("type");
  const code = params.get("code");
  const flow: EmailLinkFlow =
    otpType === "recovery" || params.get("flow") === "recovery" ? "recovery" : "signup";

  const failurePage = localizedHref(
    locale,
    flow === "recovery" ? routes.forgotPassword : routes.login,
  );
  const fail = () => redirect(`${failurePage}?error=${LINK_ERROR}`);

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

  if (flow === "recovery") {
    await markRecovery(userId);
    redirect(localizedHref(locale, routes.resetPassword));
  }
  redirect(localizedHref(locale, routes.account));
}
