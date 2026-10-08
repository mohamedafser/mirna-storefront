"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "@/lib/auth/actions";
import { readProfile, validateProfile, type ProfileInput } from "@/lib/auth/validation";
import { useI18n } from "@/lib/i18n/client";
import { FormMessage, SubmitButton, TextField, useClientValidation } from "./form-controls";

/**
 * Edits the customer's own name and phone. Email, role and status are not
 * editable here; the Server Action writes only these two columns.
 */
export function ProfileForm({ initial }: { initial: ProfileInput }) {
  const { messages } = useI18n();
  const t = messages.account;
  const errors = messages.auth.errors;
  const [state, action, pending] = useActionState(updateProfile, {
    error: null,
    fieldErrors: {},
    values: initial,
    saved: false,
  } satisfies ProfileState);
  const { clientErrors, onSubmit } = useClientValidation(
    (data) => validateProfile(readProfile(data)),
    pending,
  );
  const fieldErrors = clientErrors ?? state.fieldErrors;

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-5">
      {!pending && state.error && <FormMessage>{errors[state.error]}</FormMessage>}
      {!pending && !clientErrors && state.saved && (
        <FormMessage tone="success">{t.saved}</FormMessage>
      )}

      <TextField
        label={t.name}
        name="fullName"
        autoComplete="name"
        required
        maxLength={200}
        defaultValue={state.values.fullName}
        error={fieldErrors.fullName && errors[fieldErrors.fullName]}
      />
      <TextField
        label={t.phone}
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        dir="ltr"
        maxLength={32}
        defaultValue={state.values.phone}
        hint={t.phoneHint}
        error={fieldErrors.phone && errors[fieldErrors.phone]}
      />

      <SubmitButton
        pending={pending}
        label={t.save}
        pendingLabel={t.saving}
        className="sm:w-auto sm:justify-self-start"
      />
    </form>
  );
}
