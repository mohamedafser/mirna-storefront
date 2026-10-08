"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { localizedHref, routes } from "@/config/navigation";
import type { CartError } from "@/lib/cart/actions";
import { rememberPrice } from "@/lib/cart/storage";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { useCart } from "./cart-provider";
import { QuantityStepper } from "./quantity-stepper";

/**
 * Quantity + "Add to cart" on the product page. The server checks that the
 * product is still active and available before anything is stored; the
 * result (added, or why not) is announced in a live region.
 */
export function AddToCart({
  productId,
  productName,
  price,
}: {
  productId: string;
  productName: string;
  /** Shown price, remembered so the cart can say if it changes later. */
  price: string;
}) {
  const { locale, messages } = useI18n();
  const t = messages.cart;
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState<{ error: CartError | null } | null>(null);
  const [pending, startTransition] = useTransition();

  function onAdd() {
    if (pending) return;
    setResult(null);
    startTransition(async () => {
      const error = await add(productId, quantity);
      setResult({ error });
      if (!error) {
        setQuantity(1);
        rememberPrice(productId, price);
      }
    });
  }

  return (
    <div className="mt-8 border-y py-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <span className="caps text-[0.6875rem] font-medium" aria-hidden>
            {t.quantity}
          </span>
          <QuantityStepper
            value={quantity}
            onChange={setQuantity}
            label={format(t.quantityFor, { name: productName })}
            disabled={pending}
          />
        </div>
        <Button
          size="lg"
          className="min-w-48 flex-1"
          onClick={onAdd}
          disabled={pending}
          aria-busy={pending}
        >
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          {pending ? t.adding : t.addToCart}
        </Button>
      </div>

      <div aria-live="polite" className="empty:hidden">
        {result &&
          !pending &&
          (result.error ? (
            <p className="mt-4 flex items-start gap-2 text-sm text-error">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t.errors[result.error]}
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
