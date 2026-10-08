import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Address } from "@/types/domain";
import { MAX_ADDRESSES } from "./validation";

/**
 * Reads the signed-in customer's addresses with their own session, so RLS
 * (addresses_select_own_or_admin) applies. The explicit user_id filter keeps
 * the query to the customer's rows even for a session RLS would allow more.
 * Callers pass the id from the DAL (requireCustomer), never from the client.
 */

export const ADDRESS_SELECT =
  "id, full_name, phone, street, building, city, state_region, country_code, postal_code, is_default";

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface AddressRow {
  id: string;
  full_name: string;
  phone: string;
  street: string | null;
  building: string | null;
  city: string;
  state_region: string | null;
  country_code: string;
  postal_code: string | null;
  is_default: boolean;
}

export function toAddress(row: AddressRow): Address {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    line1: row.street ?? "",
    line2: row.building,
    city: row.city,
    region: row.state_region,
    countryCode: row.country_code,
    postalCode: row.postal_code,
    isDefault: row.is_default,
  };
}

function fail(context: string, error: { code?: string; message?: string }): never {
  console.error(`[addresses] ${context} failed`, error.code, error.message);
  throw new Error("Unable to load addresses");
}

/** Default first, then newest. */
export async function listAddresses(userId: string, client?: Supabase): Promise<Address[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("addresses")
    .select(ADDRESS_SELECT)
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_ADDRESSES);
  if (error) fail("list", error);
  return data.map(toAddress);
}

export async function getAddress(userId: string, id: string): Promise<Address | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("addresses")
    .select(ADDRESS_SELECT)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("get", error);
  return data ? toAddress(data) : null;
}
