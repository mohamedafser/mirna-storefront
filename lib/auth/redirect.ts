import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";

/** Query parameter carrying the account page a signed-out visitor tried to open. */
export const REDIRECT_PARAM = "redirect";

/**
 * Returns `target` only if it is a same-origin path inside this locale's
 * account area, checkout or a product page (e.g. back to write a review);
 * otherwise the account home. Prevents open
 * redirects via ?redirect= and ?next=.
 */
export function safeAccountRedirect(target: unknown, locale: Locale): string {
  const fallback = localizedHref(locale, routes.account);
  if (typeof target !== "string") return fallback;
  const allowed = [
    fallback,
    localizedHref(locale, routes.checkout),
    localizedHref(locale, routes.products),
  ].some(
    (base) => target === base || target.startsWith(`${base}/`) || target.startsWith(`${base}?`),
  );
  if (!allowed || target.includes("//") || target.includes("\\")) return fallback;
  return target;
}

/** Value of ?error= on /login and /forgot-password after an invalid or expired email link. */
export const LINK_ERROR = "link-expired";

/** Value of ?error= on /login and /signup after Google sign-in (app/[lang]/auth/callback). */
export const GOOGLE_ERROR = {
  cancelled: "google-cancelled",
  failed: "google-failed",
  staff: "google-staff",
  inactive: "google-inactive",
} as const;

/** The messages.auth.errors key for each of those. */
export const GOOGLE_ERROR_MESSAGE = {
  [GOOGLE_ERROR.cancelled]: "googleCancelled",
  [GOOGLE_ERROR.failed]: "googleFailed",
  [GOOGLE_ERROR.staff]: "staffAccount",
  [GOOGLE_ERROR.inactive]: "accountInactive",
} as const;

/** Value of ?notice= on /login: why the visitor was sent to sign in. */
export const LOGIN_NOTICE = {
  passwordChanged: "password-changed",
  emailVerified: "verified",
} as const;
