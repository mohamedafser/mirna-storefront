"use server";

import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomerOrNull } from "./dal";
import { clearRecovery, isRecoveryFor } from "./recovery";
import { emailLinkUrl, REDIRECT_PARAM, safeAccountRedirect } from "./redirect";
import {
  hasErrors,
  normalizeEmail,
  readProfile,
  readSignUp,
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
  | "emailTaken"
  | "passwordWeak"
  | "samePassword"
  | "signupDisabled"
  | "linkExpired"
  | "signedOut"
  | "tooManyAttempts"
  | "network"
  | "unexpected";

function localeFrom(formData: FormData): Locale {
  // Server Actions can't read root params, so the locale is posted and re-validated.
  const value = formData.get("locale");
  return isLocale(value) ? value : defaultLocale;
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

// ---------------------------------------------------------------------------
// Sign in / sign out
// ---------------------------------------------------------------------------

export interface SignInState {
  error: FormError | null;
  fieldErrors: FieldErrors<"email" | "password">;
  email: string;
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
      case "email_not_confirmed":
        return fail("emailNotConfirmed");
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

  redirect(safeAccountRedirect(formData.get(REDIRECT_PARAM), locale));
}

export async function signOut(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);

  const supabase = await createClient();
  // scope "local": ends this device's session and clears its auth cookies.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) console.error("[auth] sign-out failed", { code: error.code, status: error.status });
  await clearRecovery();

  redirect(localizedHref(locale, routes.home));
}

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------

export interface SignUpState {
  error: FormError | null;
  fieldErrors: FieldErrors<"fullName" | "email" | "password" | "confirmPassword">;
  /** Echoed back so the form keeps them after a failed submit (never passwords). */
  values: { fullName: string; email: string };
  /** Set when a confirmation email was sent (email confirmation enabled). */
  sentTo: string | null;
}

export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const locale = localeFrom(formData);
  const input = readSignUp(formData);
  const values = { fullName: input.fullName, email: input.email };
  const fail = (error: FormError): SignUpState => ({
    error,
    fieldErrors: {},
    values,
    sentTo: null,
  });

  const fieldErrors = validateSignUp(input);
  if (hasErrors(fieldErrors)) return { error: null, fieldErrors, values, sentTo: null };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // The on_auth_user_created trigger (mirna-admin) copies full_name into
      // a new `profiles` row with role CUSTOMER. Role is never taken from
      // metadata, so nothing sent here can choose it.
      data: { full_name: input.fullName },
      emailRedirectTo: emailLinkUrl(locale, "signup"),
    },
  });

  if (error) {
    switch (error.code) {
      case "user_already_exists":
      case "email_exists":
        return fail("emailTaken");
      case "weak_password":
        return fail("passwordWeak");
      case "signup_disabled":
      case "email_provider_disabled":
        return fail("signupDisabled");
      case "email_address_invalid":
        return { ...fail("unexpected"), error: null, fieldErrors: { email: "emailInvalid" } };
    }
    return fail(commonError(error, "sign-up") ?? "unexpected");
  }

  // Email confirmation disabled: Supabase signs the customer straight in.
  if (data.session) redirect(localizedHref(locale, routes.account));

  // Confirmation enabled: a link was emailed. For an address that already
  // has an account Supabase returns the same response without sending one,
  // so this message doesn't reveal which emails are registered.
  return { error: null, fieldErrors: {}, values, sentTo: input.email };
}

// ---------------------------------------------------------------------------
// Forgot / reset password
// ---------------------------------------------------------------------------

export interface ResetRequestState {
  error: FormError | null;
  fieldErrors: FieldErrors<"email">;
  email: string;
  sent: boolean;
}

export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const locale = localeFrom(formData);
  const email = normalizeEmail(formData.get("email"));

  const fieldErrors = validateEmail(email);
  if (hasErrors(fieldErrors)) return { error: null, fieldErrors, email, sent: false };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: emailLinkUrl(locale, "recovery"),
  });

  if (error) {
    const mapped = commonError(error, "reset request");
    if (mapped) return { error: mapped, fieldErrors: {}, email, sent: false };
    // Anything else is shown as "sent" too, so the response never reveals
    // whether the address has an account (the error is logged above).
  }
  return { error: null, fieldErrors: {}, email, sent: true };
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

  // Only a session opened from a reset link may set a password this way.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId || !(await isRecoveryFor(userId))) return fail("linkExpired");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    switch (error.code) {
      case "same_password":
        return fail("samePassword");
      case "weak_password":
        return fail("passwordWeak");
      case "session_not_found":
      case "session_expired":
      case "reauthentication_needed":
        return fail("linkExpired");
    }
    return fail(commonError(error, "password update") ?? "unexpected");
  }

  await clearRecovery();
  // Sign out every other device that may still hold the old password's sessions.
  const { error: othersError } = await supabase.auth.signOut({ scope: "others" });
  if (othersError)
    console.error("[auth] sign-out of other sessions failed", { code: othersError.code });

  redirect(`${localizedHref(locale, routes.account)}?updated=password`);
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
