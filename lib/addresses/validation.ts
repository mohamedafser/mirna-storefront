// Address form rules, shared by the client form (instant feedback) and the
// Server Action (authoritative). Lengths match the `addresses` check
// constraints (mirna-admin migration 008). Error values are keys into
// messages.addresses.errors.

import { addressCountries, addressRules } from "@/config/region";
import { isValidPhone, normalizeName, normalizePhone } from "@/lib/auth/validation";

/** Most addresses one customer can save. */
export const MAX_ADDRESSES = 20;

export const ADDRESS_LIMITS = {
  fullName: 200,
  phone: 32,
  line1: 200, // addresses.street
  line2: 150, // addresses.building
  city: 100,
  region: 100, // addresses.state_region
  postalCode: 20,
} as const;

export type AddressFieldError =
  | "required"
  | "tooLong"
  | "phoneInvalid"
  | "countryInvalid"
  | "regionInvalid"
  | "postalCodeInvalid";

export interface AddressInput {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  isDefault: boolean;
}

export type AddressFieldErrors = Partial<Record<keyof AddressInput, AddressFieldError>>;

const text = (data: FormData, key: string) => normalizeName(data.get(key));

export function readAddress(data: FormData): AddressInput {
  return {
    fullName: text(data, "fullName"),
    phone: normalizePhone(data.get("phone")),
    line1: text(data, "line1"),
    line2: text(data, "line2"),
    city: text(data, "city"),
    region: text(data, "region"),
    country: text(data, "country").toUpperCase(),
    postalCode: text(data, "postalCode").toUpperCase(),
    isDefault: data.get("isDefault") === "on",
  };
}

const POSTAL_CODE_PATTERN = /^[A-Z0-9][A-Z0-9 -]{1,18}[A-Z0-9]$/;

export function validateAddress(input: AddressInput): AddressFieldErrors {
  const errors: AddressFieldErrors = {};
  const required = (key: keyof typeof ADDRESS_LIMITS) => {
    const value = input[key];
    if (!value) errors[key] = "required";
    else if (value.length > ADDRESS_LIMITS[key]) errors[key] = "tooLong";
  };
  const optional = (key: keyof typeof ADDRESS_LIMITS) => {
    if (input[key].length > ADDRESS_LIMITS[key]) errors[key] = "tooLong";
  };

  required("fullName");
  if (!input.phone) errors.phone = "required";
  else if (!isValidPhone(input.phone)) errors.phone = "phoneInvalid";
  required("line1");
  optional("line2");
  required("city");

  // Country: only markets the store serves (ISO 3166-1 alpha-2).
  if (!addressCountries.includes(input.country)) errors.country = "countryInvalid";
  const rules = addressRules[input.country];

  // State/Emirate: from the fixed list where the country has one (UAE).
  if (rules?.subdivisions) {
    if (!input.region) errors.region = "required";
    else if (!rules.subdivisions.some((s) => s.value === input.region)) {
      errors.region = "regionInvalid";
    }
  } else {
    optional("region");
  }

  if (!input.postalCode) {
    if (rules?.postalCodeRequired) errors.postalCode = "required";
  } else if (
    input.postalCode.length > ADDRESS_LIMITS.postalCode ||
    !POSTAL_CODE_PATTERN.test(input.postalCode)
  ) {
    errors.postalCode = "postalCodeInvalid";
  }

  return errors;
}
