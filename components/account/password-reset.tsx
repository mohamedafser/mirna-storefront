"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, useFormErrorText } from "@/components/auth/form-controls";
import { requestPasswordReset, type ResetRequestState } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/client";

const initialState: ResetRequestState = {
  error: null,
  fieldErrors: {},
  email: "",
  retryAfter: null,
};

/**
 * "Email me a code" for the signed-in customer's own address, so they don't
 * have to leave their account and type it on /forgot-password. Continues on the
 * code page, then /reset-password, then signing in with the new password.
 */
export function PasswordReset({ email }: { email: string }) {
  const { locale, messages } = useI18n();
  const t = messages.account;
  const errorText = useFormErrorText();
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="email" value={email} />
      {!pending && state.error && (
        <FormMessage>{errorText(state.error, state.retryAfter)}</FormMessage>
      )}
      <SubmitButton
        pending={pending}
        label={t.sendResetLink}
        pendingLabel={t.sendingResetLink}
        variant="outline"
        className="sm:w-auto sm:justify-self-start"
      />
    </form>
  );
}
