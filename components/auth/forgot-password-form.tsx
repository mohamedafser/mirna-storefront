"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { localizedHref, routes } from "@/config/navigation";
import { requestPasswordReset, type ResetRequestState } from "@/lib/auth/actions";
import { LINK_ERROR } from "@/lib/auth/redirect";
import { normalizeEmail, validateEmail } from "@/lib/auth/validation";
import { useI18n } from "@/lib/i18n/client";
import { authLinkClassName } from "./auth-shell";
import {
  FormMessage,
  SubmitButton,
  TextField,
  useClientValidation,
  useFormErrorText,
} from "./form-controls";

const initialState: ResetRequestState = {
  error: null,
  fieldErrors: {},
  email: "",
  retryAfter: null,
};

/**
 * Asks for a password-reset code, then moves on to the code page, which never
 * says whether the address has an account. Arriving with ?error=link-expired
 * (an old reset link) shows that message above the form.
 */
export function ForgotPasswordForm() {
  const { locale, messages } = useI18n();
  const t = messages.auth;
  const searchParams = useSearchParams();
  const errorText = useFormErrorText();
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);
  const { clientErrors, onSubmit } = useClientValidation(
    (data) => validateEmail(normalizeEmail(data.get("email"))),
    pending,
  );
  const fieldErrors = clientErrors ?? state.fieldErrors;
  const formError =
    state.error ?? (searchParams.get("error") === LINK_ERROR ? "linkExpired" : null);

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />

      {formError && !pending && <FormMessage>{errorText(formError, state.retryAfter)}</FormMessage>}

      <TextField
        label={t.email}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        dir="ltr"
        required
        maxLength={254}
        defaultValue={state.email}
        error={fieldErrors.email && t.errors[fieldErrors.email]}
      />

      <SubmitButton pending={pending} label={t.sendCode} pendingLabel={t.sending} />

      <p className="text-center text-sm">
        <Link href={localizedHref(locale, routes.login)} className={authLinkClassName}>
          {t.backToSignIn}
        </Link>
      </p>
    </form>
  );
}
