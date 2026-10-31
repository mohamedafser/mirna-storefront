"use client";

import { CircleAlert, Heart, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/auth/form-controls";
import { ImagePlaceholder } from "@/components/catalogue/image-placeholder";
import { ProductPrice } from "@/components/catalogue/product-price";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClassName } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { useI18n } from "@/lib/i18n/client";
import { format, plural } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import { postJson } from "@/lib/api/client";
import type { WishlistError, WishlistView } from "@/lib/wishlist/actions";
import type { WishlistItem } from "@/types/domain";
import { useWishlist } from "./wishlist-provider";
import { wishlistSignInHref } from "./wishlist-sign-in-prompt";

/**
 * The wishlist page body. Ids come from the wishlist (browser or account);
 * every name, image, price and availability comes from the server's current
 * product rows (getWishlistView). Products that are no longer sold are
 * dropped with a notice. Removing only hides the row (no reload); a new id
 * (another tab, the sign-in merge) loads the list again.
 */
export function WishlistContents() {
  const { locale, messages } = useI18n();
  const t = messages.wishlist;
  const wishlist = useWishlist();
  const [items, setItems] = useState<WishlistItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removedCount, setRemovedCount] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<WishlistError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const request = useRef(0);
  const loaded = useRef<{ signedIn: boolean; ids: Set<string> } | null>(null);

  const idsKey = JSON.stringify(wishlist.ids);

  useEffect(() => {
    if (!wishlist.ready) return;
    const ids = JSON.parse(idsKey) as string[];
    // Only removals since the last load: the shown rows are filtered below.
    const known = loaded.current;
    if (known && known.signedIn === wishlist.signedIn && ids.every((id) => known.ids.has(id))) {
      return;
    }
    const id = ++request.current;
    setLoading(true);
    postJson<WishlistView>("/api/wishlist/view", { ids: wishlist.signedIn ? [] : ids })
      .then((view) => {
        if (id !== request.current) return; // a newer request is on its way
        if (!view.ok) {
          setLoadFailed(true);
          return;
        }
        setLoadFailed(false);
        setItems(view.items);
        loaded.current = { signedIn: view.signedIn, ids: new Set(view.ids) };
        if (view.removed > 0) setRemovedCount((count) => count + view.removed);
        if (view.removed > 0 || view.signedIn !== wishlist.signedIn) wishlist.applyView(view);
      })
      .catch(() => {
        if (id === request.current) setLoadFailed(true);
      })
      .finally(() => {
        if (id === request.current) setLoading(false);
      });
    // `wishlist` is read for its latest functions; the request depends on the ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wishlist.ready, wishlist.signedIn, idsKey, attempt]);

  async function remove(productId: string) {
    if (busy) return;
    setBusy(productId);
    setActionError(null);
    setActionError(await wishlist.remove(productId));
    setBusy(null);
  }

  if (!wishlist.ready || (!items && !loadFailed)) {
    return <WishlistSkeleton label={t.loading} />;
  }

  if (loadFailed && !items) {
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

  const saved = new Set(wishlist.ids);
  const shown = (items ?? []).filter((item) => saved.has(item.productId));

  const notices = (
    <>
      {!wishlist.signedIn && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border bg-card px-5 py-4">
          <p className="text-sm text-muted-foreground">{t.guestNotice}</p>
          <Link href={wishlistSignInHref(locale)} className={buttonClassName({ size: "sm" })}>
            {t.signIn}
          </Link>
        </div>
      )}
      {removedCount > 0 && (
        <FormMessage>{plural(locale, removedCount, t.removedNotice)}</FormMessage>
      )}
      {actionError && <FormMessage>{t.errors[actionError]}</FormMessage>}
      {loadFailed && <FormMessage>{t.loadError}</FormMessage>}
    </>
  );

  if (shown.length === 0) {
    return (
      <div className="grid gap-6">
        {notices}
        <div className="border bg-card px-6">
          <StatusState
            icon={Heart}
            title={t.emptyTitle}
            description={t.emptyBody}
            className="py-16 sm:py-24"
            action={
              <Link href={localizedHref(locale, routes.products)} className={buttonClassName()}>
                {t.startShopping}
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {notices}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {plural(locale, shown.length, t.itemCount)}
      </p>
      <ul
        aria-label={t.listLabel}
        aria-busy={loading}
        className={cn(
          "grid grid-cols-1 gap-x-4 gap-y-10 transition-opacity min-[22rem]:grid-cols-2 sm:gap-x-6 lg:grid-cols-4",
          loading && "opacity-60",
        )}
      >
        {shown.map((item) => (
          <WishlistTile
            key={item.productId}
            item={item}
            busy={busy === item.productId}
            disabled={busy !== null}
            onRemove={() => remove(item.productId)}
          />
        ))}
      </ul>
      <Link
        href={localizedHref(locale, routes.products)}
        className="justify-self-start text-sm underline underline-offset-4 hover:opacity-70"
      >
        {t.continueShopping}
      </Link>
    </div>
  );
}

function WishlistTile({
  item,
  busy,
  disabled,
  onRemove,
}: {
  item: WishlistItem;
  busy: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  const { locale, messages } = useI18n();
  const t = messages.wishlist;
  const href = localizedHref(locale, routes.product(item.slug));

  return (
    <li aria-busy={busy} className="flex min-w-0 flex-col">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className="relative block aspect-[2/3] overflow-hidden bg-brand-soft"
      >
        {item.image ? (
          <Image
            src={item.image.url}
            alt=""
            fill
            sizes="(min-width: 1024px) 22vw, 50vw"
            className={cn("object-cover", !item.available && "opacity-60")}
          />
        ) : (
          <ImagePlaceholder />
        )}
      </Link>
      <div className="mt-4 flex flex-1 flex-col px-1">
        <h2 className="caps line-clamp-2 text-[0.6875rem] leading-relaxed font-medium break-words">
          <Link href={href} className="hover:underline hover:underline-offset-4">
            {item.name}
          </Link>
        </h2>
        <ProductPrice prices={item.prices} align="start" className="mt-2" />
        <p className="mt-2">
          {item.available ? (
            <Badge tone="success">{t.inStock}</Badge>
          ) : (
            <Badge tone="warning">{t.outOfStock}</Badge>
          )}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-4">
          <Link
            href={href}
            className="caps text-[0.625rem] font-medium underline underline-offset-4 hover:opacity-70"
          >
            {item.hasVariants && item.available ? t.chooseOptions : t.viewProduct}
          </Link>
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
      </div>
    </li>
  );
}

function WishlistSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="grid grid-cols-1 gap-x-4 gap-y-10 min-[22rem]:grid-cols-2 sm:gap-x-6 lg:grid-cols-4"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[2/3]" />
          <Skeleton className="mt-4 h-2.5 w-3/4" />
          <Skeleton className="mt-3 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
