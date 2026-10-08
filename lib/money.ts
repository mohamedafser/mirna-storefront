/**
 * Decimal-safe money helpers. Amounts stay decimal strings end to end
 * (PostgreSQL NUMERIC(14,3) via the money_amount domain, selected with
 * `::text`). Comparisons use BigInt minor units, never floating point.
 * Display goes through formatPrice() in lib/format.ts.
 */

/** money_amount is NUMERIC(14, 3): 11 integer digits, 3 decimals. */
const MAX_INTEGER_DIGITS = 11;
const DB_SCALE = 3;

/** Accepts Arabic-Indic / Persian digits and the Arabic decimal separator. */
export function normalizeNumberInput(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/[\s,٬]/g, "");
}

/**
 * Parses a non-negative decimal amount that fits money_amount. Returns the
 * canonical decimal string (no leading zeros), or null when the input is
 * empty, negative, non-numeric, NaN, too large or has more than 3 decimals.
 */
export function parseAmount(raw: string): string | null {
  const input = normalizeNumberInput(raw);
  if (!/^\d+(\.\d+)?$/.test(input)) return null;
  const [rawInteger, fraction = ""] = input.split(".");
  const integer = rawInteger.replace(/^0+(?=\d)/, "");
  if (integer.length > MAX_INTEGER_DIGITS || fraction.length > DB_SCALE) return null;
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${integer}.${trimmed}` : integer;
}

/** Minor units at the database scale: "12.5" → 12500n. */
function toMinor(amount: string): bigint {
  const [integer, fraction = ""] = amount.split(".");
  return BigInt(integer + fraction.padEnd(DB_SCALE, "0").slice(0, DB_SCALE));
}

/** -1, 0 or 1, like a sort comparator. Both values must be decimal strings. */
export function compareAmounts(a: string, b: string): number {
  const [x, y] = [toMinor(a), toMinor(b)];
  return x === y ? 0 : x < y ? -1 : 1;
}

/** Decimal string from minor units: 12500 → "12.5". */
function fromMinor(minor: bigint): string {
  const digits = minor.toString().padStart(DB_SCALE + 1, "0");
  const integer = digits.slice(0, -DB_SCALE);
  const fraction = digits.slice(-DB_SCALE).replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer;
}

/** amount × quantity, exactly: ("19.99", 3) → "59.97". */
export function multiplyAmount(amount: string, quantity: number): string {
  return fromMinor(toMinor(amount) * BigInt(quantity));
}

/** Exact sum of decimal strings: ["0.1", "0.2"] → "0.3". */
export function sumAmounts(amounts: readonly string[]): string {
  return fromMinor(amounts.reduce((total, amount) => total + toMinor(amount), BigInt(0)));
}
