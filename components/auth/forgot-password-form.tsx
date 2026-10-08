"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { buttonClassName } from "@/components/ui/button";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { requestPasswordReset, type ResetRequestState } from "@/lib/auth/actions";
import { LINK_ERROR } from "@/lib/auth/redirect";
import { normalizeEmail, validateEmail } from "@/lib/auth/validation";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { authLinkClassName } from "./auth-shell";
import { FormMessage, SubmitButton, TextField, useClientValidation } from "./form-controls";

const initialState: ResetRequestState = { error: null, fieldErrors: {}, email: "", sent: false };

/**
 * Requests a password-reset email. The confirmation never says whether the
 * address has an account. Arriving with ?error=link-expired (an old or used
 * reset link) shows that message above the form.
 */
export function ForgotPasswordForm() {
  const { locale, messages } = useI18n();
  const t = messages.auth;
  const searchParams = useSearchParams();
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);
  const { clientErrors, onSubmit } = useClientValidation(
    (data) => validateEmail(normalizeEmail(data.get("email"))),
    pending,
  );
  const fieldErrors = clientErrors ?? state.fieldErrors;
  const formError =
    state.error ?? (searchParams.get("error") === LINK_ERROR ? "linkExpired" : null);

  if (state.sent) {
    return (
      <StatusState
        icon={MailCheck}
        title={t.checkEmailTitle}
        description={<p role="status">{format(t.resetSent, { email: state.email })}</p>}
        className="py-4"
        action={
          <Link
            href={localizedHref(locale, routes.login)}
            className={buttonClassName({ variant: "outline" })}
          >
            {t.backToSignIn}
          </Link>
        }
      />
    );
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />

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

      <SubmitButton pending={pending} label={t.sendLink} pendingLabel={t.sending} />

      <p className="text-center text-sm">
        <Link href={localizedHref(locale, routes.login)} className={authLinkClassName}>
          {t.backToSignIn}
        </Link>
      </p>
    </form>
  );
}
