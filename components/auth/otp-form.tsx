"use client";

import { useActionState, useEffect, useState } from "react";
import {
  resendCode,
  submitCode,
  type ResendCodeState,
  type VerifyCodeState,
} from "@/lib/auth/actions";
import { normalizeCode, validateCode } from "@/lib/auth/validation";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import {
  FormMessage,
  SubmitButton,
  TextField,
  useClientValidation,
  useFormErrorText,
} from "./form-controls";

const RESEND_COOLDOWN = 60; // seconds; mirna-admin enforces the real limit (migration 046)

const initialVerify: VerifyCodeState = { error: null, fieldErrors: {} };
const initialResend: ResendCodeState = { error: null, sent: false, retryAfter: null };

function CodeForm() {
  const { locale, messages } = useI18n();
  const t = messages.auth;
  const [state, action, pending] = useActionState(submitCode, initialVerify);
  const { clientErrors, onSubmit } = useClientValidation(
    (data) => validateCode(normalizeCode(data.get("code"))),
    pending,
  );
  const fieldError = (clientErrors ?? state.fieldErrors).code;

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      {state.error && !pending && <FormMessage>{t.errors[state.error]}</FormMessage>}
      <TextField
        label={t.codeLabel}
        name="code"
        type="text"
        // Lets phones offer the code straight from the email notification.
        autoComplete="one-time-code"
        inputMode="numeric"
        dir="ltr"
        required
        autoFocus
        // Room for a pasted "123 456".
        maxLength={12}
        style={{ textAlign: "center", letterSpacing: "0.4em", fontVariantNumeric: "tabular-nums" }}
        error={fieldError && t.errors[fieldError]}
      />
      <SubmitButton pending={pending} label={t.verify} pendingLabel={t.verifying} />
    </form>
  );
}

/** Enter the emailed code, or ask for another once the cooldown has passed. */
export function OtpForm() {
  const { locale, messages } = useI18n();
  const t = messages.auth;
  const errorText = useFormErrorText();
  const [seconds, setSeconds] = useState(RESEND_COOLDOWN);
  // A new code makes any message about the previous one out of date.
  const [codeFormKey, setCodeFormKey] = useState(0);

  const [state, action, pending] = useActionState(
    async (previous: ResendCodeState, formData: FormData) => {
      const next = await resendCode(previous, formData);
      if (next.sent) setCodeFormKey((key) => key + 1);
      if (next.sent || next.retryAfter) setSeconds(next.retryAfter ?? RESEND_COOLDOWN);
      return next;
    },
    initialResend,
  );

  const counting = seconds > 0;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  return (
    <div className="grid gap-5">
      <CodeForm key={codeFormKey} />

      <form action={action} className="grid gap-3">
        <input type="hidden" name="locale" value={locale} />
        {!pending && state.sent && <FormMessage tone="success">{t.codeResent}</FormMessage>}
        {!pending && state.error && (
          <FormMessage>{errorText(state.error, state.retryAfter)}</FormMessage>
        )}
        <SubmitButton
          pending={pending || counting}
          label={t.resendCode}
          pendingLabel={counting && !pending ? format(t.resendIn, { seconds }) : t.resending}
          variant="outline"
          spinner={pending}
        />
      </form>
    </div>
  );
}
