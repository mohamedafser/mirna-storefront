import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { countryName, regionName } from "@/components/addresses/address-format";
import { AccountSubpage } from "@/components/addresses/address-page";
import { OrderItemImage } from "@/components/orders/order-item-image";
import { OrderProgress, OrderStatusBadge } from "@/components/orders/order-status";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/skeleton";
import { localizedHref, routes } from "@/config/navigation";
import { requireCustomer } from "@/lib/auth/dal";
import { formatDateTime, formatPrice, toIntlLocale } from "@/lib/format";
import { format } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { getCustomerOrder } from "@/lib/orders/queries";
import { isUuid } from "@/lib/utils/uuid";

type Props = PageProps<"/[lang]/account/orders/[id]">;

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getMessages();
  return { title: messages.orders.title, robots: { index: false, follow: false } };
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <section aria-labelledby={id}>
        <h2 id={id} className="caps mb-5 text-xs font-medium">
          {title}
        </h2>
        {children}
      </section>
    </Card>
  );
}

/**
 * One of the customer's orders, exactly as stored: items, prices and totals
 * from order_items / orders, the address from the checkout snapshot. The id
 * in the URL is only a lookup key: the query is limited to the session's user
 * (and RLS), so anyone else's order is a 404. Images are the products'
 * current ones, when still on sale.
 */
async function OrderDetail({ params }: { params: Props["params"] }) {
  const [locale, messages, { id }] = await Promise.all([getLocale(), getMessages(), params]);
  const t = messages.orders;
  const customer = await requireCustomer(locale);
  if (!isUuid(id)) notFound();
  const order = await getCustomerOrder(customer.id, id);
  if (!order) notFound();

  const money = (amount: Intl.StringNumericLiteral) =>
    formatPrice(amount, locale, order.currencyCode);
  const number = `#${new Intl.NumberFormat(toIntlLocale(locale), { useGrouping: false }).format(order.orderNumber)}`;
  const date = (value: string) => formatDateTime(value, locale);
  const address = order.address;
  const separator = locale === "ar" ? "، " : ", ";
  const addressLines = [
    address.street,
    [address.building, address.apartment].filter(Boolean).join(separator),
    address.area,
    [
      address.city,
      regionName(
        { region: address.state_region ?? null, countryCode: address.country_code ?? "" },
        messages.addresses,
      ),
    ]
      .filter(Boolean)
      .join(separator),
    [address.country_code && countryName(address.country_code, locale), address.postal_code]
      .filter(Boolean)
      .join(" "),
  ].filter(Boolean);

  // Stored amounts only; discount and tax rows appear when they apply.
  const nonZero = (amount: string) => /[1-9]/.test(amount);
  const totals: [label: string, value: string][] = [
    [t.subtotal, money(order.subtotal)],
    ...(nonZero(order.discount)
      ? [[t.discount, `−${money(order.discount)}`] as [string, string]]
      : []),
    [t.shipping, money(order.shipping)],
    ...(nonZero(order.tax) ? [[t.tax, money(order.tax)] as [string, string]] : []),
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold tabular-nums">
              {format(t.detailTitle, { number })}
            </h2>
            <OrderStatusBadge status={order.status} t={t} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {format(t.placedOn, { date: date(order.createdAt) })}
            {order.updatedAt !== order.createdAt && (
              <>
                {" · "}
                {format(t.lastUpdated, { date: date(order.updatedAt) })}
              </>
            )}
          </p>
        </div>
      </div>

      <Section id="order-status" title={t.statusLabel}>
        <OrderProgress status={order.status} t={t} />
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Section id="order-items" title={t.items}>
          <ul className="-my-4 divide-y">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-4 py-4">
                {item.image ? (
                  <Link
                    href={localizedHref(locale, routes.product(item.image.slug))}
                    tabIndex={-1}
                    aria-hidden
                    className="w-16 shrink-0 sm:w-20"
                  >
                    <OrderItemImage image={item.image} sizes="80px" />
                  </Link>
                ) : (
                  <OrderItemImage image={null} sizes="80px" className="w-16 sm:w-20" />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm sm:flex-row sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <h3 className="font-medium">
                      {item.image ? (
                        <Link
                          href={localizedHref(locale, routes.product(item.image.slug))}
                          className="hover:underline hover:underline-offset-4"
                        >
                          <bdi>{item.name}</bdi>
                        </Link>
                      ) : (
                        <bdi>{item.name}</bdi>
                      )}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.sku}: <span dir="ltr">{item.sku}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(t.quantity, { count: item.quantity })}
                      {" · "}
                      {format(t.unitPrice, { price: money(item.unitPrice) })}
                    </p>
                  </div>
                  <p className="font-medium whitespace-nowrap tabular-nums sm:text-end">
                    {money(item.totalPrice)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <div className="grid gap-6">
          <Section id="order-summary" title={t.summary}>
            <dl className="grid gap-3 text-sm">
              {totals.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t pt-3 text-base font-semibold">
                <dt>{t.total}</dt>
                <dd className="tabular-nums">{money(order.total)}</dd>
              </div>
            </dl>
          </Section>

          <Section id="order-address" title={t.deliveryAddress}>
            <address className="grid gap-0.5 text-sm not-italic">
              <span className="font-medium">
                <bdi>{address.full_name}</bdi>
              </span>
              {addressLines.map((line) => (
                <span key={line} className="text-muted-foreground">
                  <bdi>{line}</bdi>
                </span>
              ))}
              {address.phone && (
                <span dir="ltr" className="mt-1 justify-self-start text-muted-foreground">
                  {address.phone}
                </span>
              )}
            </address>
            {address.additional_instructions && (
              <p className="mt-4 border-t pt-4 text-sm">
                <span className="block text-xs text-muted-foreground">{t.instructions}</span>
                <span dir="auto">{address.additional_instructions}</span>
              </p>
            )}
          </Section>
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {t.snapshotNote}
      </p>
      <p className="text-sm">
        {t.help}{" "}
        <Link
          href={localizedHref(locale, routes.contact)}
          className="underline underline-offset-4 hover:text-muted-foreground"
        >
          {t.contactUs}
        </Link>
      </p>
    </div>
  );
}

export default async function OrderPage({ params }: Props) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.orders;
  return (
    <AccountSubpage
      title={t.title}
      back={{ href: localizedHref(locale, routes.orders), label: t.backToOrders }}
    >
      <Suspense fallback={<PageSkeleton label={t.loadingOrder} />}>
        <OrderDetail params={params} />
      </Suspense>
    </AccountSubpage>
  );
}
