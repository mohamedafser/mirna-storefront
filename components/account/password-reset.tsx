"use client";

import { MailCheck } from "lucide-react";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/auth/form-controls";
import { requestPasswordReset, type ResetRequestState } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";

const initialState: ResetRequestState = { error: null, fieldErrors: {}, email: "", sent: false };

/**
 * "Email me a reset link" for the signed-in customer's own address, so they
 * don't have to leave their account and type it on /forgot-password. The
 * link opens /reset-password, which returns to the profile page.
 */
export function PasswordReset({ email }: { email: string }) {
  const { locale, messages } = useI18n();
  const t = messages.account;
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  if (state.sent && !pending) {
    return (
      <p role="status" className="flex items-start gap-3 text-sm">
        <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{format(t.resetLinkSent, { email: `⁨${email}⁩` })}</span>
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="email" value={email} />
      {!pending && state.error && <FormMessage>{messages.auth.errors[state.error]}</FormMessage>}
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
