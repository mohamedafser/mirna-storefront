"use server";

import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { mergeGuestLines } from "@/lib/cart/customer-cart";
import { GUEST_CART_FIELD, sanitizeLines } from "@/lib/cart/rules";
import { createClient } from "@/lib/supabase/server";
import { getCustomerOrNull } from "./dal";
import { isGoogleEnabled, oauthCallbackUrl, setOAuthState } from "./oauth";
import {
  clearOtpCookies,
  newBinding,
  readOtpFlow,
  readResetToken,
  requestCode,
  resetPasswordWithToken,
  setOtpFlow,
  setResetToken,
  verifyCode,
  type OtpFlow,
} from "./otp-flow";
import { LOGIN_NOTICE, REDIRECT_PARAM, safeAccountRedirect } from "./redirect";
import {
  hasErrors,
  normalizeCode,
  normalizeEmail,
  readProfile,
  readSignUp,
  validateCode,
  validateEmail,
  validateLogin,
  validateNewPassword,
  validateProfile,
  validateSignUp,
  type FieldErrors,
  type ProfileInput,
} from "./validation";

/**
 * Customer auth Server Actions. Each one validates its input again (never
 * trust the client) and maps Supabase errors to safe message keys
 * (messages.auth.errors); technical details are only logged.
 */

export type FormError =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "accountInactive"
  | "staffAccount"
  | "passwordWeak"
  | "linkExpired"
  | "codeIncorrect"
  | "codeExpired"
  | "codeLocked"
  | "resetExpired"
  | "googleCancelled"
  | "googleFailed"
  | "googleUnavailable"
  | "signedOut"
  | "tooManyAttempts"
  | "network"
  | "unexpected";

function localeFrom(formData: FormData): Locale {
  // Server Actions can't read root params, so the locale is posted and re-validated.
  const value = formData.get("locale");
  return isLocale(value) ? value : defaultLocale;
}

function readJson(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || value.length === 0 || value.length > 20_000) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Errors every auth call can return; null when the caller should map it. */
function commonError(error: AuthError, context: string): FormError | null {
  // auth-js also reports HTTP 5xx as "retryable"; only status 0 means the
  // request never reached Supabase.
  if (isAuthRetryableFetchError(error) && !error.status) return "network";
  if (error.status === 429 || error.code?.startsWith("over_")) return "tooManyAttempts";
  console.error(`[auth] ${context} failed`, { code: error.code, status: error.status });
  return null;
}

/** The visitor is told how long to wait: see waitMessage() in form-controls. */
export interface RateLimit {
  retryAfter: number | null;
}

/**
 * Starts a code flow and moves on to the page for entering the code, or says
 * why it can't. The answer is the same whether or not the email has an account,
 * so neither this nor the limits reveal which emails are registered.
 */
async function startCodeFlow(
  locale: Locale,
  flow: OtpFlow,
  details?: { password: string; fullName: string },
): Promise<{ error: FormError; retryAfter: number | null }> {
  const result = await requestCode({ flow, locale, ...details });
  if (result.status === "unavailable") return { error: "unexpected", retryAfter: null };
  if (result.status === "rate_limited") {
    return { error: "tooManyAttempts", retryAfter: result.retryAfter };
  }
  await setOtpFlow(flow);
  redirect(localizedHref(locale, routes.verifyCode));
}

// ---------------------------------------------------------------------------
// Sign in / sign out
// ---------------------------------------------------------------------------

export interface SignInState {
  error: FormError | null;
  fieldErrors: FieldErrors<"email" | "password">;
  email: string;
  retryAfter?: number | null;
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const locale = localeFrom(formData);
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  const fieldErrors = validateLogin(email, password);
  if (hasErrors(fieldErrors)) return { error: null, fieldErrors, email };
  const fail = (error: FormError): SignInState => ({ error, fieldErrors: {}, email });
  if (password.length > 256) return fail("invalidCredentials");

  const supabase = await createClient();

  // 1. Authenticate. "Wrong password" and "no such user" share one message
  //    (no account enumeration).
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    switch (error.code) {
      case "invalid_credentials":
        return fail("invalidCredentials");
      // Only returned after the password was verified, so it reveals nothing
      // to someone who doesn't already know the credentials.
      case "email_not_confirmed": {
        const started = await startCodeFlow(locale, {
          email,
          purpose: "signup",
          binding: newBinding(),
        });
        return started.retryAfter
          ? { ...fail(started.error), retryAfter: started.retryAfter }
          : fail("emailNotConfirmed");
      }
      case "user_banned":
        return fail("accountInactive");
    }
    return fail(commonError(error, "sign-in") ?? "unexpected");
  }

  // 2. Authorize before letting the session stand: only active customers keep
  //    a storefront session. Staff accounts use mirna-admin.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  const denial: FormError | null = profileError
    ? "unexpected"
    : !profile?.is_active
      ? "accountInactive"
      : profile.role !== "CUSTOMER"
        ? "staffAccount"
        : null;

  if (denial) {
    if (profileError) console.error("[auth] profile lookup failed", { code: profileError.code });
    await supabase.auth.signOut({ scope: "local" });
    return fail(denial);
  }

  // Supabase only blocks unverified accounts while "Confirm email" is on, so
  // the rule doesn't depend on that setting. Accounts confirmed before email
  // codes (or created with confirmation off) have this date already.
  if (!data.user.email_confirmed_at) {
    await supabase.auth.signOut({ scope: "local" });
    const started = await startCodeFlow(locale, {
      email,
      purpose: "signup",
      binding: newBinding(),
    });
    return started.retryAfter
      ? { ...fail(started.error), retryAfter: started.retryAfter }
      : fail("emailNotConfirmed");
  }

  // 3. Merge this browser's guest cart now, so the page we redirect to (e.g.
  //    checkout, rendered on the server) already sees it. The browser also
  //    syncs after the redirect; the merge is idempotent. Best effort: a
  //    failure here must not block sign-in.
  try {
    await mergeGuestLines(
      supabase,
      data.user.id,
      sanitizeLines(readJson(formData.get(GUEST_CART_FIELD))),
    );
  } catch (cartError) {
    console.error("[auth] guest cart merge failed", cartError);
  }

  redirect(safeAccountRedirect(formData.get(REDIRECT_PARAM), locale));
}

export async function signOut(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);

  const supabase = await createClient();
  // scope "local": ends this device's session and clears its auth cookies.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) console.error("[auth] sign-out failed", { code: error.code, status: error.status });
  await clearOtpCookies();

  redirect(localizedHref(locale, routes.home));
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

export interface GoogleSignInState {
  error: FormError | null;
}

/**
 * Sends the visitor to Google, through Supabase (which holds the client secret).
 * It also stores the PKCE verifier in a cookie, so the code that comes back only
 * works in this browser. app/[lang]/auth/callback finishes the sign-in.
 */
export async function signInWithGoogle(
  _prev: GoogleSignInState,
  formData: FormData,
): Promise<GoogleSignInState> {
  const locale = localeFrom(formData);
  const next = safeAccountRedirect(formData.get(REDIRECT_PARAM), locale);

  const supabase = await createClient();
  const { data: session } = await supabase.auth.getClaims();
  if (session?.claims.sub) redirect(next);

  if (!(await isGoogleEnabled())) return { error: "googleUnavailable" };

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: oauthCallbackUrl(locale),
      // Always ask which account, so signing out on a shared computer holds:
      // otherwise Google signs the same person straight back in.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    return { error: (error && commonError(error, "Google sign-in")) ?? "googleFailed" };
  }

  await setOAuthState({
    next,
    from: formData.get("from") === "signup" ? "signup" : "login",
    cart: sanitizeLines(readJson(formData.get(GUEST_CART_FIELD))),
  });
  redirect(data.url);
}

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------

export interface SignUpState extends RateLimit {
  error: FormError | null;
  fieldErrors: FieldErrors<"fullName" | "email" | "password" | "confirmPassword">;
  /** Echoed back so the form keeps them after a failed submit (never passwords). */
  values: { fullName: string; email: string };
}

/**
 * The account stays unusable until its email is verified with the code. Whether
 * the email is already registered isn't revealed here: the visitor always moves
 * on to the code page, and an existing account just gets no code and no changes.
 */
export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const locale = localeFrom(formData);
  const input = readSignUp(formData);
  const values = { fullName: input.fullName, email: input.email };

  const fieldErrors = validateSignUp(input);
  if (hasErrors(fieldErrors)) return { error: null, fieldErrors, values, retryAfter: null };

  const started = await startCodeFlow(
    locale,
    { email: input.email, purpose: "signup", binding: newBinding() },
    { password: input.password, fullName: input.fullName },
  );
  return { ...started, fieldErrors: {}, values };
}

// ---------------------------------------------------------------------------
// Email codes
// ---------------------------------------------------------------------------

export interface VerifyCodeState {
  error: FormError | null;
  fieldErrors: FieldErrors<"code">;
}

export async function submitCode(
  _prev: VerifyCodeState,
  formData: FormData,
): Promise<VerifyCodeState> {
  const locale = localeFrom(formData);
  const code = normalizeCode(formData.get("code"));
  const fieldErrors = validateCode(code);
  if (hasErrors(fieldErrors)) return { error: null, fieldErrors };
  const fail = (error: FormError): VerifyCodeState => ({ error, fieldErrors: {} });

  const flow = await readOtpFlow();
  if (!flow) return fail("codeExpired");

  const result = await verifyCode(flow, code);
  switch (result.status) {
    case "invalid":
      return fail("codeIncorrect");
    case "expired":
      return fail("codeExpired");
    case "locked":
      return fail("codeLocked");
    case "unavailable":
      return fail("unexpected");
  }

  if (result.purpose === "recovery") {
    await setResetToken(result.resetToken);
    redirect(localizedHref(locale, routes.resetPassword));
  }

  await clearOtpCookies();
  let signedIn = false;
  if (result.sessionTokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: result.sessionTokenHash,
      type: "magiclink",
    });
    if (error) console.error("[auth] sign-in after verification failed", { code: error.code });
    signedIn = !error;
  }
  redirect(
    signedIn
      ? localizedHref(locale, routes.account)
      : `${localizedHref(locale, routes.login)}?notice=${LOGIN_NOTICE.emailVerified}`,
  );
}

export interface ResendCodeState extends RateLimit {
  error: FormError | null;
  sent: boolean;
}

export async function resendCode(
  _prev: ResendCodeState,
  formData: FormData,
): Promise<ResendCodeState> {
  const flow = await readOtpFlow();
  if (!flow) return { error: "codeExpired", sent: false, retryAfter: null };

  const result = await requestCode({ flow, locale: localeFrom(formData), resend: true });
  if (result.status === "unavailable")
    return { error: "unexpected", sent: false, retryAfter: null };
  if (result.status === "rate_limited") {
    return { error: "tooManyAttempts", sent: false, retryAfter: result.retryAfter };
  }
  await setOtpFlow(flow); // Another hour to enter it.
  return { error: null, sent: true, retryAfter: null };
}

// ---------------------------------------------------------------------------
// Forgot / reset password
// ---------------------------------------------------------------------------

export interface ResetRequestState extends RateLimit {
  error: FormError | null;
  fieldErrors: FieldErrors<"email">;
  email: string;
}

export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const locale = localeFrom(formData);
  const email = normalizeEmail(formData.get("email"));

  const fieldErrors = validateEmail(email);
  if (hasErrors(fieldErrors)) return { error: null, fieldErrors, email, retryAfter: null };

  const started = await startCodeFlow(locale, {
    email,
    purpose: "recovery",
    binding: newBinding(),
  });
  return { ...started, fieldErrors: {}, email };
}

export interface NewPasswordState {
  error: FormError | null;
  fieldErrors: FieldErrors<"password" | "confirmPassword">;
}

export async function updatePassword(
  _prev: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  const locale = localeFrom(formData);
  const password = String(formData.get("password") ?? "");
  const fieldErrors = validateNewPassword(password, String(formData.get("confirmPassword") ?? ""));
  if (hasErrors(fieldErrors)) return { error: null, fieldErrors };
  const fail = (error: FormError): NewPasswordState => ({ error, fieldErrors: {} });

  // Only what a correct code handed out may set a password this way.
  const resetToken = await readResetToken();
  if (!resetToken) return fail("resetExpired");

  const result = await resetPasswordWithToken(resetToken, password);
  switch (result.status) {
    case "expired":
      await clearOtpCookies();
      return fail("resetExpired");
    case "weak_password":
      return fail("passwordWeak");
    case "unavailable":
      return fail("unexpected");
  }

  await clearOtpCookies();
  // Every session has ended on the server; this clears this browser's cookies,
  // if it was signed in. Best effort, as that session no longer works anyway.
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) console.warn("[auth] local sign-out after reset failed", { code: error.code });

  redirect(`${localizedHref(locale, routes.login)}?notice=${LOGIN_NOTICE.passwordChanged}`);
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface ProfileState {
  error: FormError | null;
  fieldErrors: FieldErrors<keyof ProfileInput>;
  values: ProfileInput;
  saved: boolean;
}

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const values = readProfile(formData);
  const fieldErrors = validateProfile(values);
  if (hasErrors(fieldErrors)) return { error: null, fieldErrors, values, saved: false };
  const fail = (error: FormError): ProfileState => ({
    error,
    fieldErrors: {},
    values,
    saved: false,
  });

  const customer = await getCustomerOrNull();
  if (!customer) return fail("signedOut");

  // Only full_name and phone are written; role and is_active are never part
  // of the update. RLS limits it to the caller's own row and the
  // profiles_guard_update trigger rejects privileged changes regardless.
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: values.fullName, phone: values.phone || null })
    .eq("id", customer.id)
    // .single() turns "no row updated" (e.g. blocked by RLS) into an error.
    .select("id")
    .single();

  if (error) {
    console.error("[auth] profile update failed", { code: error.code });
    return fail("unexpected");
  }

  refresh();
  return { error: null, fieldErrors: {}, values, saved: true };
}
