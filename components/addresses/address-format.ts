import { addressRules } from "@/config/region";
import type { Locale } from "@/config/i18n";
import type { Messages } from "@/lib/i18n/messages";
import type { Address } from "@/types/domain";

/** Localised country name from its ISO code ("AE" → "United Arab Emirates" / "الإمارات العربية المتحدة"). */
export function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Stored state/emirate value shown in the UI language (emirates are stored in English). */
export function regionName(
  address: Pick<Address, "region" | "countryCode">,
  t: Messages["addresses"],
) {
  if (!address.region) return null;
  const subdivision = addressRules[address.countryCode]?.subdivisions?.find(
    (s) => s.value === address.region,
  );
  return subdivision
    ? (t.subdivisions[subdivision.code as keyof typeof t.subdivisions] ?? address.region)
    : address.region;
}
