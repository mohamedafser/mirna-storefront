"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { localizedHref, routes } from "@/config/navigation";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { LINK_ERROR, REDIRECT_PARAM } from "@/lib/auth/redirect";
import { normalizeEmail, validateLogin } from "@/lib/auth/validation";
import { useI18n } from "@/lib/i18n/client";
import { authLinkClassName } from "./auth-shell";
import {
  FormMessage,
  PasswordField,
  SubmitButton,
  TextField,
  useClientValidation,
} from "./form-controls";

const initialState: SignInState = { error: null, fieldErrors: {}, email: "" };

/** Email + password sign-in. Reads ?redirect= and ?error= from the URL. */
export function LoginForm() {
  const { locale, messages } = useI18n();
  const t = messages.auth;
  const searchParams = useSearchParams();
  const [state, action, pending] = useActionState(signIn, initialState);
  const { clientErrors, onSubmit } = useClientValidation(
    (data) => validateLogin(normalizeEmail(data.get("email")), String(data.get("password") ?? "")),
    pending,
  );

  const fieldErrors = clientErrors ?? state.fieldErrors;
  // A failed confirmation link (from /auth/confirm) shows until the first submit.
  const formError =
    state.error ?? (searchParams.get("error") === LINK_ERROR ? "linkExpired" : null);

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name={REDIRECT_PARAM} value={searchParams.get(REDIRECT_PARAM) ?? ""} />

      {formError && !pending && <FormMessage>{t.errors[formError]}</FormMessage>}

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

      <div className="grid gap-2">
        <PasswordField
          label={t.password}
          name="password"
          autoComplete="current-password"
          required
          maxLength={256}
          error={fieldErrors.password && t.errors[fieldErrors.password]}
        />
        <Link
          href={localizedHref(locale, routes.forgotPassword)}
          className="justify-self-end text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {t.forgotLink}
        </Link>
      </div>

      <SubmitButton pending={pending} label={t.signIn} pendingLabel={t.signingIn} />

      <p className="text-center text-sm text-muted-foreground">
        {t.noAccount}{" "}
        <Link href={localizedHref(locale, routes.signup)} className={authLinkClassName}>
          {t.createOne}
        </Link>
      </p>
    </form>
  );
}
