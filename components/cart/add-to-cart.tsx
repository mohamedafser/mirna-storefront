"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { seenPriceKey, useCurrency } from "@/components/currency/currency-provider";
import { useProductPurchase } from "@/components/product/product-purchase";
import { Button } from "@/components/ui/button";
import { localizedHref, routes } from "@/config/navigation";
import { lookupPrice, minorToDecimal, payable, type PriceRow } from "@/lib/currency/money";
import { toIntlLocale } from "@/lib/format";
import type { CartError } from "@/lib/cart/actions";
import { lineKey } from "@/lib/cart/rules";
import { rememberPrice } from "@/lib/cart/storage";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { useCart } from "./cart-provider";
import { QuantityStepper } from "./quantity-stepper";

type Result = { key: string; error: CartError | null } | { key: string; missing: true };

/**
 * Quantity + "Add to cart" on the product page. For a product with variants
 * the chosen variant is added (inside <ProductPurchaseProvider>). Every option
 * is required: until all are chosen nothing is added, the missing options are
 * marked and the first one is focused; a sold-out
 * variant can't be added. The server checks the product / variant is still
 * active and available before anything is stored; once added, the cart drawer
 * opens. The result (added, or why not) is also announced in a live region.
 *
 * Without an admin-set price in the visitor's currency (for the chosen
 * variant, or the simple product) there's no button: the item isn't sold in
 * that currency, and the server would refuse it too.
 */
export function AddToCart({
  productId,
  productName,
  prices,
  available = true,
}: {
  productId: string;
  productName: string;
  /** Admin-set prices per currency; the shown one is remembered so the cart can say if it changes. */
  prices: readonly PriceRow[];
  /** A simple product's availability (yes/no); variants use the chosen variant's. */
  available?: boolean;
}) {
  const { locale, messages } = useI18n();
  const t = messages.cart;
  const { add, setDrawerOpen } = useCart();
  const { currency } = useCurrency();
  const purchase = useProductPurchase();
  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  const variant = purchase?.variant ?? null;
  const line = { productId, variantId: variant?.id ?? null };
  const key = lineKey(line);
  const soldOut = purchase ? Boolean(variant && !purchase.available) : !available;
  // Options still missing: the button looks and is announced as disabled
  // (aria-disabled, not `disabled`), but stays focusable and clickable so a
  // click can say what's missing and highlight it.
  const incomplete = Boolean(purchase && !variant);
  const hintId = useId();
  // Once the exact item is known: is it sold in this currency?
  const price =
    currency && !incomplete ? lookupPrice(prices, currency.code, variant?.id ?? null) : null;
  const notSold = !incomplete && !price;

  function onAdd() {
    if (pending || soldOut || notSold) return;
    if (purchase && !variant) {
      setResult({ key, missing: true });
      purchase.revealMissing();
      return;
    }
    setResult(null);
    startTransition(async () => {
      const error = await add(line, quantity);
      setResult({ key, error });
      if (!error) {
        setQuantity(1);
        if (price && currency)
          rememberPrice(
            seenPriceKey(currency.code, key),
            minorToDecimal(payable(price), currency.decimals),
          );
        setDrawerOpen(true);
      }
    });
  }

  // A message belongs to the choice it was made for.
  const shown = result?.key === key ? result : null;
  const list = new Intl.ListFormat(toIntlLocale(locale), { type: "conjunction" });

  return (
    <div className="mt-8 border-y py-6">
      {notSold ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {format(messages.catalogue.notAvailableIn, { currency: currency?.code ?? "" })}
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <span className="caps text-[0.6875rem] font-medium" aria-hidden>
              {t.quantity}
            </span>
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              label={format(t.quantityFor, { name: productName })}
              disabled={pending || soldOut}
            />
          </div>
          <Button
            size="lg"
            className="min-w-48 flex-1 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-brand"
            onClick={onAdd}
            disabled={pending || soldOut}
            aria-disabled={incomplete || undefined}
            aria-describedby={incomplete ? hintId : undefined}
            aria-busy={pending}
          >
            {pending && <LoaderCircle aria-hidden className="animate-spin" />}
            {soldOut ? messages.product.soldOut : pending ? t.adding : t.addToCart}
          </Button>
        </div>
      )}

      {incomplete && !(shown && "missing" in shown) && purchase && (
        <p id={hintId} className="mt-4 text-sm text-muted-foreground">
          {format(messages.product.selectOptions, {
            options: list.format(purchase.missing.map((option) => option.name)),
          })}
        </p>
      )}

      <div aria-live="polite" className="empty:hidden">
        {shown &&
          !pending &&
          ("missing" in shown ? (
            <p id={hintId} className="mt-4 flex items-start gap-2 text-sm text-error">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {format(messages.product.selectOptions, {
                options: list.format(purchase?.missing.map((option) => option.name) ?? []),
              })}
            </p>
          ) : shown.error ? (
            <p className="mt-4 flex items-start gap-2 text-sm text-error">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t.errors[shown.error]}
            </p>
          ) : (
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-success">
              <CircleCheck aria-hidden className="size-4 shrink-0" />
              {t.added}
              <Link
                href={localizedHref(locale, routes.cart)}
                className="font-medium text-foreground underline underline-offset-4 hover:opacity-70"
              >
                {t.viewCart}
              </Link>
            </p>
          ))}
      </div>
    </div>
  );
}
