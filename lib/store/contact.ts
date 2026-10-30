import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
/** "HH:MM" in the store's timezone; a close earlier than open = past midnight. */
export type DayHours = { open: string; close: string } | null;

export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "snapchat",
  "x",
  "youtube",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** Brand names, shown as-is in every language. */
export const SOCIAL_NAMES: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  x: "X",
  youtube: "YouTube",
};

/** The store's published contact details; every field is only set when configured. */
export interface StoreContact {
  email: string | null;
  phone: string | null;
  /** International format ("+971 50 …"), for wa.me links. */
  whatsapp: string | null;
  /** Address lines (street, building, city / emirate, postal code), in order. */
  address: string[];
  /** ISO country of the address, shown localised. */
  countryCode: string | null;
  /** All seven days (null = closed), or null when hours aren't published. */
  hours: Record<Weekday, DayHours> | null;
  /** Configured profiles only, in SOCIAL_PLATFORMS order. */
  social: { platform: SocialPlatform; href: string }[];
}

export interface StoreContactResult {
  /** "error" = the details couldn't be loaded (not the same as none published). */
  status: "ok" | "error";
  contact: StoreContact;
}

export const NO_CONTACT: StoreContact = {
  email: null,
  phone: null,
  whatsapp: null,
  address: [],
  countryCode: null,
  hours: null,
  social: [],
};

export function hasContactDetails(contact: StoreContact): boolean {
  return Boolean(
    contact.email ||
    contact.phone ||
    contact.whatsapp ||
    contact.address.length > 0 ||
    contact.hours ||
    contact.social.length > 0,
  );
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Hours as published, or null if the value isn't the expected shape. */
function parseHours(value: unknown): Record<Weekday, DayHours> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const hours = {} as Record<Weekday, DayHours>;
  for (const day of WEEKDAYS) {
    const entry = source[day];
    if (entry === null) {
      hours[day] = null;
      continue;
    }
    const { open, close } = (entry ?? {}) as { open?: unknown; close?: unknown };
    if (typeof open !== "string" || typeof close !== "string") return null;
    if (!TIME.test(open) || !TIME.test(close)) return null;
    hours[day] = { open, close };
  }
  return hours;
}

/** https links only; anything else is dropped rather than rendered. */
function safeLink(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/**
 * STORE_WHATSAPP_NUMBER (environment) stands in while no WhatsApp number is
 * published, so the floating button, footer and Contact page always agree.
 */
function withWhatsAppFallback(contact: StoreContact): StoreContact {
  const fallback = process.env.STORE_WHATSAPP_NUMBER?.trim();
  return contact.whatsapp || !fallback ? contact : { ...contact, whatsapp: fallback };
}

/**
 * Contact details an admin published in mirna-admin (Settings → Contact
 * information), read through store_contact() (mirna-admin migration 030: the
 * published subset of store_settings only, never tax, fees or notification
 * settings, and no row while unpublished). Nothing is hardcoded or invented.
 *
 * Cached for minutes, so admin edits reach the storefront within a few
 * minutes. A failed read reports "error" and is cached only for seconds (like
 * the hero), so the Contact page can say so and the footer just hides contact
 * details. Before 030 is applied the function is missing: same as unpublished.
 */
export async function getStoreContact(): Promise<StoreContactResult> {
  "use cache";
  cacheLife("minutes");
  cacheTag("store-settings");

  const { data, error } = await createPublicClient().rpc("store_contact");
  if (error) {
    // PGRST202: the function doesn't exist yet (030 not applied).
    if (error.code === "PGRST202")
      return { status: "ok", contact: withWhatsAppFallback(NO_CONTACT) };
    console.error("[store] contact lookup failed", error.code, error.message);
    // Short, but not under the 5-minute expire that would make it a dynamic hole.
    cacheLife({ stale: 30, revalidate: 15, expire: 300 });
    return { status: "error", contact: withWhatsAppFallback(NO_CONTACT) };
  }
  const row = data[0];
  if (!row) return { status: "ok", contact: withWhatsAppFallback(NO_CONTACT) };

  const locality = [row.city, row.state_region, row.postal_code].filter(Boolean).join(", ");
  const address = [row.address_line1, row.address_line2, locality].filter((line): line is string =>
    Boolean(line),
  );
  const social = SOCIAL_PLATFORMS.flatMap((platform) => {
    const href = safeLink(row[`social_${platform}`]);
    return href ? [{ platform, href }] : [];
  });
  return {
    status: "ok",
    contact: withWhatsAppFallback({
      email: row.contact_email,
      phone: row.contact_phone,
      whatsapp: row.contact_whatsapp,
      address,
      countryCode: address.length > 0 ? row.country_code : null,
      hours: parseHours(row.business_hours),
      social,
    }),
  };
}

/** Digits (and a leading +) for tel: links. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** wa.me link: country code and number, digits only. */
export function whatsappHref(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
