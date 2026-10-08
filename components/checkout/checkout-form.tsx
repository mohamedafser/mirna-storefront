"use client";

import { LoaderCircle, MapPinPlus, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { countryName, regionName } from "@/components/addresses/address-format";
import { FormMessage } from "@/components/auth/form-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { localizedHref, routes } from "@/config/navigation";
import { placeOrder, type CheckoutState } from "@/lib/checkout/actions";
import { formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { Address, CartItem } from "@/types/domain";

const sectionTitle = "caps mb-5 text-xs font-medium";

/**
 * Address choice, item review, summary and "Place order". Everything shown
 * was priced on the server; the form posts only the address id, the checkout
 * key and the total shown, and the database re-checks all of it.
 */
export function CheckoutForm({
  addresses,
  initialAddressId,
  items,
  total,
  checkoutKey,
}: {
  addresses: Address[];
  initialAddressId: string | null;
  items: CartItem[];
  total: { currencyCode: string; amount: string };
  checkoutKey: string;
}) {
  const { locale, messages } = useI18n();
  const t = messages.checkout;
  const router = useRouter();
  const [state, action, pending] = useActionState(placeOrder, {
    error: null,
  } satisfies CheckoutState);
  const [addressId, setAddressId] = useState(initialAddressId);
  const submitted = useRef(false);
  const money = (amount: string) =>
    formatPrice(amount as Intl.StringNumericLiteral, locale, total.currencyCode);

  // The cart changed under us: reload the server-priced summary.
  useEffect(() => {
    submitted.current = false;
    if (state.error === "cartChanged" || state.error === "cartUnavailable") router.refresh();
  }, [state, router]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // One submission at a time: ignore double clicks and Enter repeats.
    if (pending || submitted.current || !addressId) {
      event.preventDefault();
      return;
    }
    submitted.current = true;
  }

  return (
    <form
      action={action}
      onSubmit={onSubmit}
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="checkoutKey" value={checkoutKey} />
      <input type="hidden" name="expectedTotal" value={total.amount} />

      <div className="grid gap-10">
        <fieldset className="min-w-0">
          <legend className={sectionTitle}>{t.addressTitle}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {addresses.map((address) => {
              const region = regionName(address, messages.addresses);
              const checked = address.id === addressId;
              return (
                <label
                  key={address.id}
                  className={cn(
                    "flex cursor-pointer gap-3 border bg-card p-4 text-sm transition-colors",
                    checked ? "border-foreground" : "hover:border-input",
                  )}
                >
                  <input
                    type="radio"
                    name="addressId"
                    value={address.id}
                    checked={checked}
                    onChange={() => setAddressId(address.id)}
                    className="mt-0.5 size-5 shrink-0 accent-foreground"
                  />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {address.fullName}
                      {address.isDefault && (
                        <Badge tone="primary">{messages.addresses.defaultBadge}</Badge>
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      {[address.line1, address.line2].filter(Boolean).join(", ")}
                    </span>
                    <span className="text-muted-foreground">
                      {[address.city, region, countryName(address.countryCode, locale)]
                        .filter(Boolean)
                        .join(locale === "ar" ? "، " : ", ")}
                    </span>
                    <span dir="ltr" className="justify-self-start text-muted-foreground">
                      {address.phone}
                    </span>
                  </span>
                </label>
              );
            })}
            <Link
              href={`${localizedHref(locale, routes.newAddress)}?returnTo=checkout`}
              className="flex min-h-24 items-center justify-center gap-2 border border-dashed p-4 text-sm hover:border-foreground"
            >
              <MapPinPlus aria-hidden className="size-4" />
              {t.addAddress}
            </Link>
          </div>
        </fieldset>

        <section aria-labelledby="checkout-items">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="checkout-items" className={sectionTitle}>
              {t.reviewTitle}
            </h2>
            <Link
              href={localizedHref(locale, routes.cart)}
              className="text-sm underline underline-offset-4 hover:opacity-70"
            >
              {t.editCart}
            </Link>
          </div>
          <ul className="border-t">
            {items.map((item) => (
              <li key={item.productId} className="flex gap-4 border-b py-4">
                <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden bg-brand-soft">
                  {item.image && (
                    <Image src={item.image.url} alt="" fill sizes="56px" className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{item.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {messages.cart.sku}: <span dir="ltr">{item.sku}</span>
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {format(t.quantity, { count: item.quantity })} × {money(item.price)}
                  </p>
                </div>
                <p className="text-sm font-medium tabular-nums">{money(item.subtotal)}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside
        aria-labelledby="checkout-summary"
        className="border bg-card p-6 sm:p-8 lg:sticky lg:top-[calc(var(--header-h)+2rem)]"
      >
        <h2 id="checkout-summary" className={sectionTitle}>
          {t.summaryTitle}
        </h2>
        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t.subtotal}</dt>
            <dd className="tabular-nums">{money(total.amount)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t.shipping}</dt>
            <dd>{t.shippingPending}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t pt-3 text-base font-semibold">
            <dt>{t.total}</dt>
            <dd className="tabular-nums">{money(total.amount)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">{t.shippingNote}</p>

        <div aria-live="polite" className="mt-6 empty:hidden">
          {state.error && !pending && (
            <FormMessage>
              {t.errors[state.error]}
              {state.error === "cartUnavailable" && (
                <>
                  {" "}
                  <Link
                    href={localizedHref(locale, routes.cart)}
                    className="font-medium underline underline-offset-4"
                  >
                    {t.reviewCart}
                  </Link>
                </>
              )}
            </FormMessage>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="mt-6 w-full"
          disabled={pending || !addressId}
          aria-busy={pending}
        >
          {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Lock aria-hidden />}
          {pending ? t.placing : t.placeOrder}
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">{t.paymentNote}</p>
      </aside>
    </form>
  );
}
