"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale, type Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { getCustomerOrNull } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/uuid";
import { getAddress, listAddresses } from "./queries";
import {
  MAX_ADDRESSES,
  readAddress,
  validateAddress,
  type AddressFieldErrors,
  type AddressInput,
} from "./validation";

/**
 * Address book Server Actions.
 *
 * Ownership: the owner is always the verified session's customer (DAL), never
 * a user_id from the form. Every query also filters on that id, and RLS
 * (addresses_*_own policies) re-checks it in the database.
 *
 * One default: the partial unique index addresses_one_default_per_user_idx
 * makes a second default impossible; setDefault() clears the old default
 * before marking the new one so that index is never hit in normal use.
 */

export type AddressError = "signedOut" | "notFound" | "limitReached" | "unexpected";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function localeFrom(formData: FormData): Locale {
  const value = formData.get("locale");
  return isLocale(value) ? value : defaultLocale;
}

function logError(context: string, error: { code?: string; message?: string }) {
  console.error(`[addresses] ${context} failed`, error.code, error.message);
}

/** Makes `id` the customer's only default address. */
async function setDefault(supabase: Supabase, userId: string, id: string): Promise<boolean> {
  // Check the target first, so an unknown id never clears the current default.
  const { data: target, error: targetError } = await supabase
    .from("addresses")
    .select("id")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (targetError) logError("find address", targetError);
  if (!target) return false;

  for (let attempt = 0; attempt < 2; attempt++) {
    const { error: clearError } = await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("is_default", true)
      .neq("id", id);
    if (clearError) {
      logError("clear default", clearError);
      return false;
    }
    const { error } = await supabase
      .from("addresses")
      .update({ is_default: true })
      .eq("user_id", userId)
      .eq("id", id)
      .select("id")
      .single();
    if (!error) return true;
    // 23505: another request set a default in between; clear it and retry once.
    if (error.code !== "23505") {
      logError("set default", error);
      return false;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

export interface AddressFormState {
  error: AddressError | null;
  fieldErrors: AddressFieldErrors;
  values: AddressInput | null;
}

export async function saveAddress(
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const locale = localeFrom(formData);
  const values = readAddress(formData);
  const fail = (error: AddressError): AddressFormState => ({ error, fieldErrors: {}, values });

  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId ? rawId : null;
  if (id !== null && !isUuid(id)) return fail("notFound");

  const fieldErrors = validateAddress(values);
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors, values };

  const customer = await getCustomerOrNull();
  if (!customer) return fail("signedOut");

  const supabase = await createClient();
  // Only these columns are written; user_id comes from the session and
  // is_default goes through setDefault().
  const row = {
    full_name: values.fullName,
    phone: values.phone,
    street: values.line1,
    building: values.line2 || null,
    city: values.city,
    state_region: values.region || null,
    country_code: values.country,
    postal_code: values.postalCode || null,
  };

  let savedId: string;
  try {
    let wasDefault = false;
    let makeDefault = values.isDefault;

    if (id === null) {
      const existing = await listAddresses(customer.id, supabase);
      if (existing.length >= MAX_ADDRESSES) return fail("limitReached");
      // The first address is the default automatically.
      makeDefault ||= existing.length === 0;
      const { data, error } = await supabase
        .from("addresses")
        .insert({ ...row, user_id: customer.id, is_default: false })
        .select("id")
        .single();
      if (error) {
        logError("insert", error);
        return fail("unexpected");
      }
      savedId = data.id;
    } else {
      const current = await getAddress(customer.id, id);
      if (!current) return fail("notFound");
      wasDefault = current.isDefault;
      const { error } = await supabase
        .from("addresses")
        .update(row)
        .eq("user_id", customer.id)
        .eq("id", id)
        .select("id")
        .single();
      if (error) {
        logError("update", error);
        return fail("unexpected");
      }
      savedId = id;
    }

    if (makeDefault && !wasDefault) {
      if (!(await setDefault(supabase, customer.id, savedId))) return fail("unexpected");
    } else if (!makeDefault && wasDefault) {
      const { error } = await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", customer.id)
        .eq("id", savedId);
      if (error) {
        logError("unset default", error);
        return fail("unexpected");
      }
    }
  } catch {
    return fail("unexpected");
  }

  // Added from checkout: go back there with the new address selected.
  if (formData.get("returnTo") === "checkout") {
    redirect(`${localizedHref(locale, routes.checkout)}?address=${savedId}`);
  }
  redirect(`${localizedHref(locale, routes.addresses)}?saved=1`);
}

// ---------------------------------------------------------------------------
// List actions: delete, default
// ---------------------------------------------------------------------------

export type AddressActionResult = { ok: true } | { ok: false; error: AddressError };

export async function deleteAddress(id: unknown): Promise<AddressActionResult> {
  if (!isUuid(id)) return { ok: false, error: "notFound" };
  const customer = await getCustomerOrNull();
  if (!customer) return { ok: false, error: "signedOut" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("addresses")
    .delete()
    .eq("user_id", customer.id)
    .eq("id", id)
    .select("is_default")
    .maybeSingle();
  if (error) {
    logError("delete", error);
    return { ok: false, error: "unexpected" };
  }
  if (!data) return { ok: false, error: "notFound" };

  // Deleting the default promotes the newest remaining address.
  if (data.is_default) {
    try {
      const [next] = await listAddresses(customer.id, supabase);
      if (next) await setDefault(supabase, customer.id, next.id);
    } catch {
      // The address is deleted; the customer can pick a default themselves.
    }
  }

  refresh();
  return { ok: true };
}

export async function setDefaultAddress(
  id: unknown,
  makeDefault: unknown,
): Promise<AddressActionResult> {
  if (!isUuid(id) || typeof makeDefault !== "boolean") return { ok: false, error: "notFound" };
  const customer = await getCustomerOrNull();
  if (!customer) return { ok: false, error: "signedOut" };

  const supabase = await createClient();
  let ok: boolean;
  if (makeDefault) {
    ok = await setDefault(supabase, customer.id, id);
  } else {
    const { error } = await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", customer.id)
      .eq("id", id)
      .select("id")
      .single();
    if (error) logError("unset default", error);
    ok = !error;
  }

  refresh();
  return ok ? { ok: true } : { ok: false, error: "unexpected" };
}
