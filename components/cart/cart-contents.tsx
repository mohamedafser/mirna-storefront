"use client";

import { CircleAlert, ImageOff, ShoppingBag, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/auth/form-controls";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { getCartView, type CartError } from "@/lib/cart/actions";
import { readSeenPrices, writeSeenPrices } from "@/lib/cart/storage";
import { formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { format, plural } from "@/lib/i18n/messages";
import { compareAmounts } from "@/lib/money";
import { cn } from "@/lib/utils/cn";
import type { CartItem, CartSummary } from "@/types/domain";
import { useCart } from "./cart-provider";
import { QuantityStepper } from "./quantity-stepper";

const money = (amount: string, locale: Parameters<typeof formatPrice>[1], currency: string) =>
  formatPrice(amount as Intl.StringNumericLiteral, locale, currency);

/**
 * The cart page body. Lines come from the cart (browser or account); every
 * name, image, price, subtotal and total comes from the server's current
 * product data (getCartView), re-fetched whenever the lines change.
 */
export function CartContents() {
  const { locale, messages } = useI18n();
  const t = messages.cart;
  const cart = useCart();
  const [summary, setSummary] = useState<CartSummary | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removedCount, setRemovedCount] = useState(0);
  /** productId → the price the visitor saw before it changed. */
  const [priceChanges, setPriceChanges] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<CartError | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const request = useRef(0);

  const linesKey = JSON.stringify(cart.lines);

  useEffect(() => {
    if (!cart.ready) return;
    const id = ++request.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state for the server request below
    setLoading(true);
    getCartView(cart.signedIn ? [] : (JSON.parse(linesKey) as unknown))
      .then((view) => {
        if (id !== request.current) return; // a newer request is on its way
        if (!view.ok) {
          setLoadFailed(true);
          return;
        }
        setLoadFailed(false);
        setSummary(view.summary);

        const { removed, items } = view.summary;
        if (removed.length > 0) {
          setRemovedCount((count) => count + removed.length);
          cart.applyView({
            signedIn: view.signedIn,
            lines: view.lines.filter((line) => !removed.includes(line.productId)),
          });
        } else if (view.signedIn !== cart.signedIn) {
          cart.applyView(view);
        }

        // "Price changed" hints: compare with the last price this browser saw.
        const seen = readSeenPrices();
        const changed: Record<string, string> = {};
        for (const item of items) {
          const before = seen[item.productId];
          if (before && compareAmounts(before, item.price) !== 0) changed[item.productId] = before;
        }
        setPriceChanges((previous) => {
          const kept = Object.fromEntries(
            Object.entries(previous).filter(([productId]) =>
              items.some((item) => item.productId === productId),
            ),
          );
          return { ...kept, ...changed };
        });
        writeSeenPrices(Object.fromEntries(items.map((item) => [item.productId, item.price])));
      })
      .catch(() => {
        if (id === request.current) setLoadFailed(true);
      })
      .finally(() => {
        if (id === request.current) setLoading(false);
      });
    // `cart` is read for its latest functions; the request depends on the lines.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready, cart.signedIn, linesKey, attempt]);

  async function mutate(key: string, change: () => Promise<CartError | null>) {
    if (busy) return;
    setBusy(key);
    setActionError(null);
    const error = await change();
    setActionError(error);
    setBusy(null);
  }

  if (!cart.ready || (!summary && !loadFailed)) {
    return <CartSkeleton label={t.loading} />;
  }

  if (loadFailed && !summary) {
    return (
      <StatusState
        icon={CircleAlert}
        tone="error"
        title={t.loadError}
        action={
          <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            {messages.common.retry}
          </Button>
        }
      />
    );
  }

  const items = summary?.items ?? [];
  const notices = (
    <>
      {removedCount > 0 && (
        <FormMessage>{plural(locale, removedCount, t.removedNotice)}</FormMessage>
      )}
      {actionError && <FormMessage>{t.errors[actionError]}</FormMessage>}
    </>
  );

  if (items.length === 0 || cart.lines.length === 0) {
    return (
      <div className="grid gap-6">
        {notices}
        <div className="border bg-card px-6">
          <StatusState
            icon={ShoppingBag}
            title={t.emptyTitle}
            description={t.emptyBody}
            className="py-16 sm:py-24"
            action={
              <Link
                href={localizedHref(locale, routes.products)}
                className={buttonClassName({ variant: "primary" })}
              >
                {t.continueShopping}
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const totals = summary?.totals ?? [];
  const totalCount = totals.reduce((count, total) => count + total.itemCount, 0);

  return (
    <div className="grid gap-6">
      {notices}
      {loadFailed && <FormMessage>{t.loadError}</FormMessage>}
      {Object.keys(priceChanges).length > 0 && (
        <p role="status" className="border border-warning/40 px-4 py-3 text-sm text-warning">
          {t.pricesChanged}
        </p>
      )}

      <div
        className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12"
        aria-busy={loading}
      >
        <section aria-labelledby="cart-items">
          <h2 id="cart-items" className="sr-only">
            {t.items}
          </h2>
          <ul className={cn("border-t transition-opacity", loading && "opacity-60")}>
            {items.map((item) => (
              <CartRow
                key={item.productId}
                item={item}
                previousPrice={priceChanges[item.productId]}
                busy={busy === item.productId}
                disabled={busy !== null}
                onQuantity={(quantity) =>
                  mutate(item.productId, () => cart.setQuantity(item.productId, quantity))
                }
                onRemove={() => mutate(item.productId, () => cart.remove(item.productId))}
              />
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Link
              href={localizedHref(locale, routes.products)}
              className="text-sm underline underline-offset-4 hover:opacity-70"
            >
              {t.continueShopping}
            </Link>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 aria-hidden />
              {t.clear}
            </Button>
          </div>
        </section>

        <aside
          aria-labelledby="cart-summary"
          className="border bg-card p-6 sm:p-8 lg:sticky lg:top-[calc(var(--header-h)+2rem)]"
        >
          <h2 id="cart-summary" className="caps text-xs font-medium">
            {t.summary}
          </h2>
          <dl className="mt-6 grid gap-3 text-sm">
            {totals.map((total) => (
              <div key={total.currencyCode} className="grid gap-3">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {t.subtotal} ({plural(locale, total.itemCount, t.itemCount)})
                  </dt>
                  <dd className="tabular-nums">
                    {money(total.amount, locale, total.currencyCode)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t pt-3 text-base font-semibold">
                  <dt>{t.total}</dt>
                  <dd className="tabular-nums">
                    {money(total.amount, locale, total.currencyCode)}
                  </dd>
                </div>
              </div>
            ))}
            {totalCount === 0 && (
              <div className="flex justify-between gap-4 text-base font-semibold">
                <dt>{t.total}</dt>
                <dd>—</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">{t.pricesNote}</p>
          {/* Checkout is for signed-in customers; guests sign in first and come back. */}
          {totalCount > 0 && items.every((item) => item.available) ? (
            <Link
              href={
                cart.signedIn
                  ? localizedHref(locale, routes.checkout)
                  : `${localizedHref(locale, routes.login)}?redirect=${encodeURIComponent(localizedHref(locale, routes.checkout))}`
              }
              className={buttonClassName({ size: "lg", className: "mt-6 w-full" })}
            >
              {cart.signedIn ? messages.checkout.proceed : messages.checkout.signInToCheckout}
            </Link>
          ) : (
            <p className="mt-6 border-y py-4 text-center text-sm text-muted-foreground">
              {messages.checkout.unavailableBody}
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            {cart.signedIn ? t.savedToAccount : t.savedOnDevice}
          </p>
        </aside>
      </div>

      <Modal
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={t.clearTitle}
        description={t.clearBody}
        dismissible={busy === null}
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={busy !== null} onClick={() => setConfirmClear(false)}>
            {t.cancel}
          </Button>
          <Button
            disabled={busy !== null}
            aria-busy={busy === "clear"}
            onClick={async () => {
              await mutate("clear", cart.clear);
              setConfirmClear(false);
            }}
          >
            {t.clearConfirm}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function CartRow({
  item,
  previousPrice,
  busy,
  disabled,
  onQuantity,
  onRemove,
}: {
  item: CartItem;
  previousPrice?: string;
  busy: boolean;
  disabled: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const { locale, messages } = useI18n();
  const t = messages.cart;
  const href = localizedHref(locale, routes.product(item.slug));

  return (
    <li
      aria-busy={busy}
      className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 border-b py-6 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:gap-x-6"
    >
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className="relative row-span-2 aspect-[2/3] overflow-hidden bg-brand-soft sm:row-span-1"
      >
        {item.image ? (
          <Image
            src={item.image.url}
            alt=""
            fill
            sizes="112px"
            className={cn("object-cover", !item.available && "opacity-50")}
          />
        ) : (
          <ImageOff
            aria-hidden
            strokeWidth={1.25}
            className="absolute inset-0 m-auto size-6 text-muted-foreground"
          />
        )}
      </Link>

      <div className="min-w-0">
        <h3 className="text-sm font-medium">
          <Link href={href} className="hover:underline hover:underline-offset-4">
            {item.name}
          </Link>
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t.sku}: <span dir="ltr">{item.sku}</span>
        </p>
        <p className="mt-2 text-sm">
          <span className="sr-only">{t.price}: </span>
          {money(item.price, locale, item.currencyCode)}
          {item.compareAtPrice && (
            <del className="ms-2 text-xs text-muted-foreground">
              {money(item.compareAtPrice, locale, item.currencyCode)}
            </del>
          )}
        </p>
        {previousPrice && (
          <p className="mt-1 text-xs text-warning">
            {format(t.priceChanged, { price: money(previousPrice, locale, item.currencyCode) })}
          </p>
        )}
        {!item.available && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge tone="warning">{t.unavailable}</Badge>
            {t.unavailableNote}
          </p>
        )}
      </div>

      <div className="col-start-2 flex flex-wrap items-center justify-between gap-3 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end sm:justify-start">
        <QuantityStepper
          value={item.quantity}
          onChange={onQuantity}
          label={format(t.quantityFor, { name: item.name })}
          disabled={disabled}
        />
        <p className="text-sm font-medium tabular-nums">
          <span className="sr-only">{t.subtotal}: </span>
          {item.available ? money(item.subtotal, locale, item.currencyCode) : "—"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="-me-4"
          disabled={disabled}
          aria-label={format(t.removeItem, { name: item.name })}
          onClick={onRemove}
        >
          <Trash2 aria-hidden />
          {t.remove}
        </Button>
      </div>
    </li>
  );
}

function CartSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="grid gap-6">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="grid grid-cols-[5.5rem_1fr] gap-4 sm:grid-cols-[7rem_1fr]">
            <Skeleton className="aspect-[2/3]" />
            <div className="grid content-start gap-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2.5 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
