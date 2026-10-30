"use client";

import { LoaderCircle, MapPinPlus, Lock, RotateCw, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { countryName, regionName } from "@/components/addresses/address-format";
import { FormMessage } from "@/components/auth/form-controls";
import { useCart } from "@/components/cart/cart-provider";
import { QuantityStepper } from "@/components/cart/quantity-stepper";
import { VariantOptions } from "@/components/cart/variant-options";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/components/currency/currency-provider";
import { Button } from "@/components/ui/button";
import { localizedHref, routes } from "@/config/navigation";
import type { CartError } from "@/lib/cart/actions";
import { placeOrder, type CheckoutState } from "@/lib/checkout/actions";
import { formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { Address, CartItem, CheckoutShipping, ShippingOption } from "@/types/domain";
import { ImagePlaceholder } from "@/components/catalogue/image-placeholder";

const sectionTitle = "caps mb-5 text-xs font-medium";

/**
 * Address choice, delivery method, item review, summary and "Place order".
 * Everything shown was priced on the server; the form posts only the address
 * id, the checkout key, the currency, the delivery method and the total shown
 * (delivery included), and the database re-checks all of it. The order is
 * placed in that currency (locked from here on).
 *
 * Prices and delivery follow the delivery address's country: choosing another
 * address reloads the page re-quoted for it (in its country's currency, which
 * the header then shows too). Delivery to a country without an active
 * shipping configuration can't be ordered.
 *
 * Quantities can be changed here: each change is saved to the customer's
 * cart, then the page is re-priced on the server (the total posted with the
 * order always matches what is shown).
 */
export function CheckoutForm({
  addresses,
  initialAddressId,
  items,
  total,
  decimals,
  shipping,
  pricesMissing,
  checkoutKey,
}: {
  addresses: Address[];
  initialAddressId: string | null;
  items: CartItem[];
  total: { currencyCode: string; amount: string };
  /** The order currency's decimals (currencies.decimals). */
  decimals: number;
  /** Delivery options quoted for the selected address (see getCheckoutShipping). */
  shipping: CheckoutShipping;
  /**
   * Some items have no price in this currency (the delivery country's): the
   * page still shows delivery to the address, but can't be ordered.
   */
  pricesMissing: boolean;
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
  const cart = useCart();
  const [updating, startUpdate] = useTransition();
  const [quantityError, setQuantityError] = useState<CartError | null>(null);
  const [navigating, startNavigate] = useTransition();
  const { currency, setCurrency } = useCurrency();
  const money = (amount: string) =>
    formatPrice(amount as Intl.StringNumericLiteral, locale, total.currencyCode, decimals);

  const options = shipping.status === "ready" ? shipping.options : [];
  // Standard first (the database orders them); kept across re-quotes while offered.
  const [methodId, setMethodId] = useState(options[0]?.methodId ?? null);
  const method = options.find((option) => option.methodId === methodId) ?? options[0] ?? null;
  const busy = updating || navigating;
  const canOrder = !pricesMissing && (shipping.status === "legacy" || method !== null);
  const country = addresses.find((address) => address.id === addressId)?.countryCode;

  // The header shows the currency this checkout is priced in.
  useEffect(() => {
    if (currency && currency.code !== total.currencyCode) {
      setCurrency(total.currencyCode, "address");
    }
  }, [currency, total.currencyCode, setCurrency]);

  function chooseAddress(address: Address) {
    setAddressId(address.id);
    // Re-quote delivery (and re-price in that country's currency) on the server.
    startNavigate(() => router.replace(`?address=${address.id}`, { scroll: false }));
  }

  // The cart or delivery changed under us: reload the server-priced summary.
  useEffect(() => {
    submitted.current = false;
    if (
      state.error === "cartChanged" ||
      state.error === "cartUnavailable" ||
      state.error === "shippingChanged"
    ) {
      router.refresh();
    }
  }, [state, router]);

  function changeQuantity(item: CartItem, quantity: number) {
    setQuantityError(null);
    startUpdate(async () => {
      const error = await cart.setQuantity(item, quantity);
      setQuantityError(error);
      // Re-price on the server; "Place order" waits until the new total is shown.
      startUpdate(() => router.refresh());
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // One submission at a time: ignore double clicks and Enter repeats.
    if (pending || busy || submitted.current || !addressId || !canOrder) {
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
      <input type="hidden" name="expectedTotal" value={method?.orderTotal ?? total.amount} />
      <input type="hidden" name="currencyCode" value={total.currencyCode} />

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
                    onChange={() => chooseAddress(address)}
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

        {shipping.status !== "legacy" && (
          <fieldset
            className={cn("min-w-0 transition-opacity", busy && "opacity-60")}
            aria-busy={busy}
          >
            <legend className={sectionTitle}>{t.deliveryTitle}</legend>
            {shipping.status === "error" ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border bg-card p-4 text-sm">
                <p className="text-muted-foreground">{t.deliveryError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => startNavigate(() => router.refresh())}
                >
                  <RotateCw aria-hidden />
                  {t.retry}
                </Button>
              </div>
            ) : options.length === 0 ? (
              <div className="flex gap-3 border bg-card p-4 text-sm" role="status">
                <Truck aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {format(t.deliveryUnavailableTitle, {
                      country: country ? countryName(country, locale) : "",
                    })}
                  </p>
                  <p className="mt-1 text-muted-foreground">{t.deliveryUnavailableBody}</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {options.map((option) => (
                  <DeliveryOption
                    key={option.methodId}
                    option={option}
                    checked={option.methodId === method?.methodId}
                    disabled={busy || pending}
                    onChange={() => setMethodId(option.methodId)}
                    money={money}
                  />
                ))}
              </div>
            )}
          </fieldset>
        )}

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
          {quantityError && (
            <div className="mt-4">
              <FormMessage>{messages.cart.errors[quantityError]}</FormMessage>
            </div>
          )}
          <ul className={cn("border-t transition-opacity", busy && "opacity-60")} aria-busy={busy}>
            {items.map((item) => (
              <li key={item.key} className="flex gap-4 border-b py-4">
                <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden bg-brand-soft">
                  {item.image ? (
                    <Image src={item.image.url} alt="" fill sizes="56px" className="object-cover" />
                  ) : (
                    <ImagePlaceholder wordmark={false} />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{item.name}</p>
                  <VariantOptions options={item.options} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {messages.cart.sku}: <span dir="ltr">{item.sku}</span>
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {item.priceMissing
                      ? format(t.notSoldIn, { currency: total.currencyCode })
                      : money(item.price)}
                  </p>
                  <QuantityStepper
                    className="mt-3"
                    value={item.quantity}
                    onChange={(quantity) => changeQuantity(item, quantity)}
                    max={item.maxQuantity}
                    label={format(messages.cart.quantityFor, { name: item.name })}
                    disabled={busy || pending}
                  />
                </div>
                <p className="text-sm font-medium tabular-nums">
                  {item.priceMissing ? "—" : money(item.subtotal)}
                </p>
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
        <dl
          className={cn("grid gap-3 text-sm transition-opacity", busy && "opacity-60")}
          aria-busy={busy}
        >
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t.subtotal}</dt>
            <dd className="tabular-nums">{pricesMissing ? "—" : money(total.amount)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">
              {method ? `${t.shipping} · ${t.methods[method.code]}` : t.shipping}
            </dt>
            <dd className="tabular-nums">
              {shipping.status === "legacy"
                ? t.shippingPending
                : method
                  ? method.isFree || !/[1-9]/.test(method.amount)
                    ? t.free
                    : money(method.amount)
                  : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t pt-3 text-base font-semibold">
            <dt>{t.total}</dt>
            <dd className="tabular-nums">
              {pricesMissing ? "—" : money(method?.orderTotal ?? total.amount)}
            </dd>
          </div>
        </dl>
        {shipping.status === "legacy" && (
          <p className="mt-3 text-xs text-muted-foreground">{t.shippingNote}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {format(t.currencyNote, { currency: total.currencyCode })}
        </p>

        {pricesMissing && (
          <div className="mt-6">
            <FormMessage>
              {format(t.pricesMissingAtAddress, {
                currency: total.currencyCode,
                country: country ? countryName(country, locale) : "",
              })}{" "}
              <Link
                href={localizedHref(locale, routes.cart)}
                className="font-medium underline underline-offset-4"
              >
                {t.reviewCart}
              </Link>
            </FormMessage>
          </div>
        )}

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
          disabled={pending || busy || !addressId || !canOrder}
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

/** One delivery method: name, estimate, charge (or free) and the free-delivery hint. */
function DeliveryOption({
  option,
  checked,
  disabled,
  onChange,
  money,
}: {
  option: ShippingOption;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  money: (amount: string) => string;
}) {
  const { messages } = useI18n();
  const t = messages.checkout;
  const free = option.isFree || !/[1-9]/.test(option.amount);
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 border bg-card p-4 text-sm transition-colors",
        checked ? "border-foreground" : "hover:border-input",
        disabled && "cursor-default",
      )}
    >
      <input
        type="radio"
        name="shippingMethodId"
        value={option.methodId}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-0.5 size-5 shrink-0 accent-foreground"
      />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 font-medium">
          {t.methods[option.code]}
          <span className="tabular-nums">
            {option.isFree && (
              <s className="me-1.5 font-normal text-muted-foreground">{money(option.baseAmount)}</s>
            )}
            {free ? t.free : money(option.amount)}
          </span>
        </span>
        <span className="text-muted-foreground">
          {deliveryDays(t, option.minDays, option.maxDays)}
        </span>
        {option.isFree ? (
          <span className="text-xs text-muted-foreground">{t.freeApplied}</span>
        ) : (
          option.freeRemaining && (
            <span className="text-xs text-muted-foreground">
              {format(t.freeRemaining, { amount: money(option.freeRemaining) })}
            </span>
          )
        )}
      </span>
    </label>
  );
}

/** "Same day", "1 day", "3 days", "3–5 days". */
function deliveryDays(
  t: { deliveryDays: { sameDay: string; one: string; other: string; range: string } },
  min: number,
  max: number,
): string {
  if (min !== max) return format(t.deliveryDays.range, { min, max });
  if (min === 0) return t.deliveryDays.sameDay;
  return min === 1 ? t.deliveryDays.one : format(t.deliveryDays.other, { count: min });
}
