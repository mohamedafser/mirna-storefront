import { ChevronRight, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountSubpage } from "@/components/addresses/address-page";
import { Pagination } from "@/components/catalogue/pagination";
import { OrderItemImage } from "@/components/orders/order-item-image";
import { OrderStatusBadge } from "@/components/orders/order-status";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { requireCustomer } from "@/lib/auth/dal";
import { formatDateTime, formatPrice, toIntlLocale } from "@/lib/format";
import { format, plural } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { listCustomerOrders } from "@/lib/orders/queries";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return pageMetadata({
    locale,
    path: routes.orders,
    siteName: messages.site.name,
    title: messages.orders.title,
    description: messages.orders.description,
    index: false,
  });
}

function pageParam(value: string | string[] | undefined): number {
  const page = Number.parseInt(Array.isArray(value) ? (value[0] ?? "") : (value ?? ""), 10);
  return Number.isFinite(page) && page > 0 && page <= 10_000 ? page : 1;
}

/** Reads the session and the customer's own orders (RLS), so it streams in. */
async function OrderHistory({
  searchParams,
}: {
  searchParams: PageProps<"/[lang]/account/orders">["searchParams"];
}) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.orders;
  const customer = await requireCustomer(locale);
  const page = pageParam((await searchParams).page);
  const result = await listCustomerOrders(customer.id, page);

  const listPath = localizedHref(locale, routes.orders);
  const pageHref = (target: number) => (target > 1 ? `${listPath}?page=${target}` : listPath);
  // Past the last page: go to the last one.
  if (result.orders.length === 0 && result.total > 0) redirect(pageHref(result.pageCount));

  if (result.total === 0) {
    return (
      <Card className="px-6">
        <StatusState
          icon={Package}
          title={t.emptyTitle}
          description={t.emptyBody}
          className="py-16"
          action={
            <Link href={localizedHref(locale, routes.products)} className={buttonClassName()}>
              {t.startShopping}
            </Link>
          }
        />
      </Card>
    );
  }

  const numberFormat = new Intl.NumberFormat(toIntlLocale(locale), { useGrouping: false });
  return (
    <>
      <ul aria-label={t.listLabel} className="grid gap-4">
        {result.orders.map((order) => {
          const number = `#${numberFormat.format(order.orderNumber)}`;
          const hidden = order.lineCount - order.previews.length;
          return (
            <li key={order.id}>
              <Card className="relative transition-colors hover:border-foreground/40">
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 p-5 sm:p-6">
                  <div className="min-w-0">
                    <h2 className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      {/* The whole card is clickable through this link. */}
                      <Link
                        href={localizedHref(locale, routes.order(order.id))}
                        aria-label={format(t.viewOrderLabel, { number })}
                        className="text-sm font-semibold tabular-nums after:absolute after:inset-0"
                      >
                        {format(t.orderNumber, { number })}
                      </Link>
                      <OrderStatusBadge status={order.status} t={t} />
                    </h2>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {format(t.placedOn, {
                        date: formatDateTime(order.createdAt, locale, { dateStyle: "medium" }),
                      })}
                      {" · "}
                      {plural(locale, order.itemCount, t.itemCount)}
                    </p>
                  </div>
                  <p className="text-end">
                    <span className="block text-xs text-muted-foreground">{t.total}</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatPrice(order.total, locale, order.currencyCode)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3 border-t px-5 py-4 sm:px-6">
                  <ul className="flex min-w-0 flex-1 items-center gap-2" aria-hidden>
                    {order.previews.map((item) => (
                      <li key={item.id}>
                        <OrderItemImage image={item.image} sizes="40px" className="w-10" />
                      </li>
                    ))}
                    {hidden > 0 && (
                      <li dir="ltr" className="text-xs text-muted-foreground tabular-nums">
                        {format(t.moreItems, { count: numberFormat.format(hidden) })}
                      </li>
                    )}
                  </ul>
                  <span aria-hidden className="caps flex items-center gap-1 text-[0.625rem]">
                    {t.viewOrder}
                    <ChevronRight className="size-3.5 rtl:-scale-x-100" />
                  </span>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <Pagination
        href={pageHref}
        page={result.page}
        pageCount={result.pageCount}
        t={messages.catalogue}
      />
    </>
  );
}

export default async function OrdersPage({ searchParams }: PageProps<"/[lang]/account/orders">) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.orders;
  return (
    <AccountSubpage
      title={t.title}
      subtitle={t.description}
      back={{ href: localizedHref(locale, routes.account), label: t.backToAccount }}
      narrow
    >
      <Suspense fallback={<PageSkeleton label={t.loading} />}>
        <OrderHistory searchParams={searchParams} />
      </Suspense>
    </AccountSubpage>
  );
}
