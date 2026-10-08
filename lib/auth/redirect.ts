import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";

/** Query parameter carrying the account page a signed-out visitor tried to open. */
export const REDIRECT_PARAM = "redirect";

/**
 * Returns `target` only if it is a same-origin path inside this locale's
 * account area or checkout; otherwise the account home. Prevents open
 * redirects via ?redirect= and ?next=.
 */
export function safeAccountRedirect(target: unknown, locale: Locale): string {
  const fallback = localizedHref(locale, routes.account);
  if (typeof target !== "string") return fallback;
  const allowed = [fallback, localizedHref(locale, routes.checkout)].some(
    (base) => target === base || target.startsWith(`${base}/`) || target.startsWith(`${base}?`),
  );
  if (!allowed || target.includes("//") || target.includes("\\")) return fallback;
  return target;
}

/** Flows handled by the email-link endpoint (app/[lang]/auth/confirm). */
export type EmailLinkFlow = "signup" | "recovery";

/**
 * Absolute URL that Supabase emails link back to. Built from
 * NEXT_PUBLIC_SITE_URL, never from the request's Host header, so a forged
 * Host can't redirect reset links elsewhere. The origin must also be in
 * Supabase → Auth → URL Configuration → Redirect URLs.
 */
export function emailLinkUrl(locale: Locale, flow: EmailLinkFlow): string {
  const url = new URL(localizedHref(locale, routes.authConfirm), siteConfig.url);
  url.searchParams.set("flow", flow);
  return url.href;
}

/** Value of ?error= on /login and /forgot-password after an invalid or expired email link. */
export const LINK_ERROR = "link-expired";
