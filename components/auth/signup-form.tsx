"use client";

import Link from "next/link";
import { useActionState } from "react";
import { localizedHref, routes } from "@/config/navigation";
import { signUp, type SignUpState } from "@/lib/auth/actions";
import { readSignUp, validateSignUp } from "@/lib/auth/validation";
import { useI18n } from "@/lib/i18n/client";
import { authLinkClassName } from "./auth-shell";
import { GoogleSignIn } from "./google-sign-in";
import {
  FormMessage,
  PasswordField,
  SubmitButton,
  TextField,
  useClientValidation,
  useFormErrorText,
} from "./form-controls";

const initialState: SignUpState = {
  error: null,
  fieldErrors: {},
  values: { fullName: "", email: "" },
  retryAfter: null,
};

/**
 * Customer sign-up: name, email, password, then a code emailed to verify the
 * address (the action moves on to that page). The account is always created as
 * a CUSTOMER by the database; the form has no role field.
 */
export function SignupForm() {
  const { locale, messages } = useI18n();
  const t = messages.auth;
  const errorText = useFormErrorText();
  const [state, action, pending] = useActionState(signUp, initialState);
  const { clientErrors, onSubmit } = useClientValidation(
    (data) => validateSignUp(readSignUp(data)),
    pending,
  );
  const fieldErrors = clientErrors ?? state.fieldErrors;
  const error = (key: keyof typeof fieldErrors) => {
    const code = fieldErrors[key];
    return code && t.errors[code];
  };

  return (
    <div className="grid gap-5">
      <GoogleSignIn from="signup" />
      <form action={action} onSubmit={onSubmit} noValidate className="grid gap-5">
        <input type="hidden" name="locale" value={locale} />

        {state.error && !pending && (
          <FormMessage>{errorText(state.error, state.retryAfter)}</FormMessage>
        )}

        <TextField
          label={t.fullName}
          name="fullName"
          autoComplete="name"
          required
          maxLength={200}
          defaultValue={state.values.fullName}
          error={error("fullName")}
        />
        <TextField
          label={t.email}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          required
          maxLength={254}
          defaultValue={state.values.email}
          error={error("email")}
        />
        <PasswordField
          label={t.password}
          name="password"
          autoComplete="new-password"
          required
          maxLength={256}
          hint={t.passwordHint}
          error={error("password")}
        />
        <PasswordField
          label={t.confirmPassword}
          name="confirmPassword"
          autoComplete="new-password"
          required
          maxLength={256}
          error={error("confirmPassword")}
        />

        <SubmitButton pending={pending} label={t.createAccount} pendingLabel={t.creatingAccount} />

        <p className="text-center text-sm text-muted-foreground">
          {t.haveAccount}{" "}
          <Link href={localizedHref(locale, routes.login)} className={authLinkClassName}>
            {t.signInLink}
          </Link>
        </p>
      </form>
    </div>
  );
}
