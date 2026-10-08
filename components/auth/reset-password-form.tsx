"use client";

import Link from "next/link";
import { useActionState } from "react";
import { localizedHref, routes } from "@/config/navigation";
import { updatePassword, type NewPasswordState } from "@/lib/auth/actions";
import { validateNewPassword } from "@/lib/auth/validation";
import { useI18n } from "@/lib/i18n/client";
import { authLinkClassName } from "./auth-shell";
import { FormMessage, PasswordField, SubmitButton, useClientValidation } from "./form-controls";

const initialState: NewPasswordState = { error: null, fieldErrors: {} };

/** New password form, shown only to a session opened from a reset link. */
export function ResetPasswordForm() {
  const { locale, messages } = useI18n();
  const t = messages.auth;
  const [state, action, pending] = useActionState(updatePassword, initialState);
  const { clientErrors, onSubmit } = useClientValidation(
    (data) =>
      validateNewPassword(
        String(data.get("password") ?? ""),
        String(data.get("confirmPassword") ?? ""),
      ),
    pending,
  );
  const fieldErrors = clientErrors ?? state.fieldErrors;

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />

      {state.error && !pending && (
        <FormMessage>
          {t.errors[state.error]}
          {state.error === "linkExpired" && (
            <>
              {" "}
              <Link
                href={localizedHref(locale, routes.forgotPassword)}
                className={authLinkClassName}
              >
                {t.requestNewLink}
              </Link>
            </>
          )}
        </FormMessage>
      )}

      <PasswordField
        label={t.newPassword}
        name="password"
        autoComplete="new-password"
        required
        maxLength={256}
        hint={t.passwordHint}
        error={fieldErrors.password && t.errors[fieldErrors.password]}
      />
      <PasswordField
        label={t.confirmPassword}
        name="confirmPassword"
        autoComplete="new-password"
        required
        maxLength={256}
        error={fieldErrors.confirmPassword && t.errors[fieldErrors.confirmPassword]}
      />

      <SubmitButton pending={pending} label={t.savePassword} pendingLabel={t.saving} />
    </form>
  );
}
