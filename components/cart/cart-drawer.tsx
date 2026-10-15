"use client";

import { CircleAlert, CircleCheck, ShoppingBag, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/auth/form-controls";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { getCartView, type CartError } from "@/lib/cart/actions";
import { lineKey } from "@/lib/cart/rules";
import { formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { format, plural } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { CartItem, CartSummary } from "@/types/domain";
import { useCart } from "./cart-provider";
import { QuantityStepper } from "./quantity-stepper";
import { VariantOptions } from "./variant-options";
import { ImagePlaceholder } from "@/components/catalogue/image-placeholder";

const money = (amount: string, locale: Parameters<typeof formatPrice>[1], currency: string) =>
  formatPrice(amount as Intl.StringNumericLiteral, locale, currency);

/**
 * The cart drawer, opened from the header bag and after Add to cart. Like the
 * cart page, every name, price and total comes from the server's current
 * product and variant data (getCartView), re-fetched while it is open and the
 * lines change. Quantities can be changed and items removed here; the full
 * cart page and checkout are one tap away.
 */
export function CartDrawer() {
  const { locale, messages } = useI18n();
  const t = messages.cart;
  const cart = useCart();
  const { drawerOpen: open, setDrawerOpen } = cart;
  const [summary, setSummary] = useState<CartSummary | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<CartError | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** The add whose "Added" banner was already seen (closing the drawer dismisses it). */
  const [dismissed, setDismissed] = useState(0);
  const request = useRef(0);
  const onOpenChange = (next: boolean) => {
    if (!next) setDismissed(cart.lastAdded?.id ?? 0);
    setDrawerOpen(next);
  };
  const close = () => onOpenChange(false);

  const linesKey = JSON.stringify(cart.lines);

  useEffect(() => {
    if (!open || !cart.ready) return;
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
        const { removed } = view.summary;
        if (removed.length > 0) {
          cart.applyView({
            signedIn: view.signedIn,
            lines: view.lines.filter((line) => !removed.includes(lineKey(line))),
          });
        } else if (view.signedIn !== cart.signedIn) {
          cart.applyView(view);
        }
      })
      .catch(() => {
        if (id === request.current) setLoadFailed(true);
      })
      .finally(() => {
        if (id === request.current) setLoading(false);
      });
    // `cart` is read for its latest functions; the request depends on the lines.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cart.ready, cart.signedIn, linesKey, attempt]);

  // Close on browser back/forward, so the modal can't outlive its page.
  useEffect(() => {
    if (!open) return;
    const onPopState = () => setDrawerOpen(false);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [open, setDrawerOpen]);

  async function mutate(key: string, change: () => Promise<CartError | null>) {
    if (busy) return;
    setBusy(key);
    setActionError(null);
    setActionError(await change());
    setBusy(null);
  }

  // Only lines still in the cart (a removal shows at once, before the re-price).
  const keys = new Set(cart.lines.map(lineKey));
  const items = (summary?.items ?? []).filter((item) => keys.has(item.key));
  const totals = summary?.totals ?? [];
  const checkoutReady =
    items.length > 0 && totals.length > 0 && items.every((item) => item.available);
  const added =
    cart.lastAdded && cart.lastAdded.id > dismissed && keys.has(cart.lastAdded.key)
      ? cart.lastAdded
      : null;

  let body;
  if (!cart.ready || (!summary && !loadFailed)) {
    body = <DrawerSkeleton label={t.loading} />;
  } else if (loadFailed && !summary) {
    body = (
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
  } else if (cart.lines.length === 0 || items.length === 0) {
    body = (
      <StatusState
        icon={ShoppingBag}
        title={t.emptyTitle}
        description={t.emptyBody}
        className="py-16"
        action={
          <Link
            href={localizedHref(locale, routes.products)}
            onClick={close}
            className={buttonClassName({ variant: "primary" })}
          >
            {t.continueShopping}
          </Link>
        }
      />
    );
  } else {
    body = (
      <ul className={cn("transition-opacity", loading && "opacity-60")} aria-busy={loading}>
        {items.map((item) => (
          <DrawerRow
            key={item.key}
            item={item}
            highlight={added?.key === item.key ? added.id : null}
            busy={busy === item.key}
            disabled={busy !== null}
            onNavigate={close}
            onQuantity={(quantity) => mutate(item.key, () => cart.setQuantity(item, quantity))}
            onRemove={() => mutate(item.key, () => cart.remove(item))}
          />
        ))}
      </ul>
    );
  }

  const checkoutHref = cart.signedIn
    ? localizedHref(locale, routes.checkout)
    : `${localizedHref(locale, routes.login)}?redirect=${encodeURIComponent(localizedHref(locale, routes.checkout))}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} label={t.title} side="end" wide>
      <div className="flex h-[var(--header-h)] shrink-0 items-center justify-between border-b ps-6 pe-2">
        <h2 className="caps text-xs font-medium">
          {t.title}
          {cart.count > 0 && (
            <span className="ms-2 font-normal tracking-normal normal-case text-muted-foreground">
              ({plural(locale, cart.count, t.itemCount)})
            </span>
          )}
        </h2>
        <Button variant="ghost" size="icon" aria-label={t.closeCart} onClick={close}>
          <X aria-hidden strokeWidth={1.5} />
        </Button>
      </div>

      {added && (
        <p
          key={added.id}
          role="status"
          className="flex animate-cart-item-in items-center gap-2 border-b bg-brand-soft px-6 py-3 text-sm text-brand-soft-foreground"
        >
          <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
          {t.added}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-6">
        {actionError && (
          <div className="pt-4">
            <FormMessage>{t.errors[actionError]}</FormMessage>
          </div>
        )}
        {body}
      </div>

      {items.length > 0 && (
        <div className="grid gap-3 border-t p-6">
          {totals.map((total) => (
            <p
              key={total.currencyCode}
              className="flex justify-between gap-4 text-base font-semibold"
            >
              <span>{t.subtotal}</span>
              <span className="tabular-nums">
                {money(total.amount, locale, total.currencyCode)}
              </span>
            </p>
          ))}
          <p className="text-xs text-muted-foreground">{t.subtotalNote}</p>
          {checkoutReady ? (
            <Link
              href={checkoutHref}
              onClick={close}
              className={buttonClassName({ size: "lg", className: "w-full" })}
            >
              {cart.signedIn ? messages.checkout.proceed : messages.checkout.signInToCheckout}
            </Link>
          ) : (
            <p className="border-y py-3 text-center text-sm text-muted-foreground">
              {messages.checkout.unavailableBody}
            </p>
          )}
          <Link
            href={localizedHref(locale, routes.cart)}
            onClick={close}
            className={buttonClassName({ variant: "outline", size: "lg", className: "w-full" })}
          >
            {t.viewCart}
          </Link>
        </div>
      )}
    </Sheet>
  );
}

function DrawerRow({
  item,
  highlight,
  busy,
  disabled,
  onNavigate,
  onQuantity,
  onRemove,
}: {
  item: CartItem;
  /** The add's id when this line was just added (replays the highlight). */
  highlight: number | null;
  busy: boolean;
  disabled: boolean;
  onNavigate: () => void;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const { locale, messages } = useI18n();
  const t = messages.cart;
  const href = localizedHref(locale, routes.product(item.slug));

  return (
    <li
      aria-busy={busy}
      className="relative grid animate-cart-item-in grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 border-b py-5 last:border-b-0"
    >
      {highlight !== null && (
        <span
          key={highlight}
          aria-hidden
          className="pointer-events-none absolute inset-x-[-1.5rem] inset-y-0 animate-cart-flash bg-brand-soft/60"
        />
      )}
      <Link
        href={href}
        onClick={onNavigate}
        tabIndex={-1}
        aria-hidden
        className="relative aspect-[2/3] overflow-hidden bg-brand-soft"
      >
        {item.image ? (
          <Image
            src={item.image.url}
            alt=""
            fill
            sizes="72px"
            className={cn("object-cover", !item.available && "opacity-50")}
          />
        ) : (
          <ImagePlaceholder wordmark={false} />
        )}
      </Link>

      <div className="relative min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-medium">
            <Link
              href={href}
              onClick={onNavigate}
              className="hover:underline hover:underline-offset-4"
            >
              {item.name}
            </Link>
          </h3>
          <p className="shrink-0 text-sm tabular-nums">
            <span className="sr-only">{t.subtotal}: </span>
            {item.available ? money(item.subtotal, locale, item.currencyCode) : "—"}
          </p>
        </div>
        <VariantOptions options={item.options} />
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="sr-only">{t.price}: </span>
          {money(item.price, locale, item.currencyCode)}
          {item.compareAtPrice && (
            <del className="ms-2">{money(item.compareAtPrice, locale, item.currencyCode)}</del>
          )}
        </p>
        {item.needsOptions ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="warning">{t.optionsNeeded}</Badge>
          </p>
        ) : (
          !item.available && (
            <p className="mt-2 text-xs">
              <Badge tone="warning">{t.unavailable}</Badge>
            </p>
          )
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <QuantityStepper
            value={item.quantity}
            onChange={onQuantity}
            label={format(t.quantityFor, { name: item.name })}
            disabled={disabled}
            className="h-9 [&_button]:size-9"
          />
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={format(t.removeItem, { name: item.name })}
            onClick={onRemove}
            className="-me-3"
          >
            <Trash2 aria-hidden strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    </li>
  );
}

function DrawerSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-6 py-5">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="grid grid-cols-[4.5rem_1fr] gap-4">
          <Skeleton className="aspect-[2/3]" />
          <div className="grid content-start gap-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
