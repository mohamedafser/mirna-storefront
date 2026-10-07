import type { Locale } from "@/config/i18n";
import { toIntlLocale } from "@/lib/format";
import type en from "@/messages/en.json";

/** Shape of every messages/<locale>.json file; English is the reference. */
export type Messages = typeof en;

// Each locale must provide the full English key set (checked at compile time).
export const messageLoaders: Record<Locale, () => Promise<Messages>> = {
  en: () => import("@/messages/en.json").then((m) => m.default),
  ar: () => import("@/messages/ar.json").then((m) => m.default),
};

/** Replaces `{name}` placeholders: format("Hi {name}", { name: "Sara" }). */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

type PluralForms = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>;

/**
 * Picks the plural form for `count` with Intl.PluralRules (Arabic has six
 * forms, English two) and fills `{count}`. A `zero` form, when present, is
 * used for 0 in every language ("No products yet").
 */
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  const rule = count === 0 && forms.zero ? "zero" : new Intl.PluralRules(locale).select(count);
  return format(forms[rule] ?? forms.other, {
    count: new Intl.NumberFormat(toIntlLocale(locale)).format(count),
  });
}
