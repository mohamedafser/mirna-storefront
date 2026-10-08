"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  useClientValidation,
} from "@/components/auth/form-controls";
import { buttonClassName } from "@/components/ui/button";
import { localizedHref, routes } from "@/config/navigation";
import { addressCountries, addressRules } from "@/config/region";
import { saveAddress, type AddressFormState } from "@/lib/addresses/actions";
import {
  ADDRESS_LIMITS,
  readAddress,
  validateAddress,
  type AddressInput,
} from "@/lib/addresses/validation";
import { useI18n } from "@/lib/i18n/client";
import { countryName } from "./address-format";

/**
 * Add / edit form. Validates on the client for instant feedback; the Server
 * Action validates again and decides the owner from the session. There is no
 * user field: the form can't choose whose address it saves.
 */
export function AddressForm({
  id,
  initial,
  returnTo,
}: {
  id?: string;
  initial: AddressInput;
  /** "checkout": saving returns to checkout with this address selected. */
  returnTo?: "checkout";
}) {
  const { locale, messages } = useI18n();
  const t = messages.addresses;
  const [state, action, pending] = useActionState(saveAddress, {
    error: null,
    fieldErrors: {},
    values: null,
  } satisfies AddressFormState);
  const { clientErrors, onSubmit } = useClientValidation(
    (data) => validateAddress(readAddress(data)),
    pending,
  );
  const values = state.values ?? initial;
  const [country, setCountry] = useState(values.country);
  const subdivisions = addressRules[country]?.subdivisions;
  const fieldErrors = clientErrors ?? state.fieldErrors;
  const error = (key: keyof AddressInput) => {
    const code = fieldErrors[key];
    return code && t.errors[code];
  };

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      {id && <input type="hidden" name="id" value={id} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      {state.error && !pending && <FormMessage>{t.errors[state.error]}</FormMessage>}

      <TextField
        label={t.fullName}
        name="fullName"
        autoComplete="shipping name"
        required
        maxLength={ADDRESS_LIMITS.fullName}
        defaultValue={values.fullName}
        error={error("fullName")}
      />
      <TextField
        label={t.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="shipping tel"
        dir="ltr"
        required
        maxLength={ADDRESS_LIMITS.phone}
        defaultValue={values.phone}
        hint={t.phoneHint}
        error={error("phone")}
      />

      <SelectField
        label={t.country}
        name="country"
        autoComplete="shipping country"
        value={country}
        onChange={(event) => setCountry(event.target.value)}
        error={error("country")}
      >
        {addressCountries.map((code) => (
          <option key={code} value={code}>
            {countryName(code, locale)}
          </option>
        ))}
      </SelectField>

      <TextField
        label={t.line1}
        name="line1"
        autoComplete="shipping address-line1"
        required
        maxLength={ADDRESS_LIMITS.line1}
        defaultValue={values.line1}
        hint={t.line1Hint}
        error={error("line1")}
      />
      <TextField
        label={t.line2}
        name="line2"
        autoComplete="shipping address-line2"
        maxLength={ADDRESS_LIMITS.line2}
        defaultValue={values.line2}
        hint={t.line2Hint}
        error={error("line2")}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={t.city}
          name="city"
          autoComplete="shipping address-level2"
          required
          maxLength={ADDRESS_LIMITS.city}
          defaultValue={values.city}
          error={error("city")}
        />
        {subdivisions ? (
          <SelectField
            // Remount when the country changes so the previous choice is dropped.
            key={country}
            label={t.regionEmirate}
            name="region"
            autoComplete="shipping address-level1"
            required
            defaultValue={subdivisions.some((s) => s.value === values.region) ? values.region : ""}
            error={error("region")}
          >
            <option value="" disabled>
              {t.selectRegion}
            </option>
            {subdivisions.map((subdivision) => (
              <option key={subdivision.code} value={subdivision.value}>
                {t.subdivisions[subdivision.code as keyof typeof t.subdivisions] ??
                  subdivision.value}
              </option>
            ))}
          </SelectField>
        ) : (
          <TextField
            key={country}
            label={t.region}
            name="region"
            autoComplete="shipping address-level1"
            maxLength={ADDRESS_LIMITS.region}
            defaultValue={values.region}
            error={error("region")}
          />
        )}
      </div>

      <TextField
        label={t.postalCode}
        name="postalCode"
        autoComplete="shipping postal-code"
        dir="ltr"
        maxLength={ADDRESS_LIMITS.postalCode}
        defaultValue={values.postalCode}
        hint={t.postalCodeHint}
        error={error("postalCode")}
      />

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={values.isDefault}
          className="size-5 shrink-0 accent-foreground"
        />
        {t.isDefault}
      </label>

      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={localizedHref(locale, returnTo === "checkout" ? routes.checkout : routes.addresses)}
          className={buttonClassName({ variant: "outline", size: "lg" })}
        >
          {t.cancel}
        </Link>
        <SubmitButton
          pending={pending}
          label={t.save}
          pendingLabel={t.saving}
          className="sm:w-auto"
        />
      </div>
    </form>
  );
}
