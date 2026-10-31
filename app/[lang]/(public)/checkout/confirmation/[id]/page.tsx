import { CircleAlert, CircleCheck, CircleSlash, LoaderCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { countryName, regionName } from "@/components/addresses/address-format";
import { CartReload } from "@/components/cart/cart-reload";
import { PaymentStatusPoller } from "@/components/payments/payment-status-poller";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageSkeleton } from "@/components/ui/skeleton";
import { localizedHref, routes } from "@/config/navigation";
import { requireCustomer } from "@/lib/auth/dal";
import { formatDateTime, formatPrice, toIntlLocale } from "@/lib/format";
import { format } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { getOrderPaymentView, type PaymentState } from "@/lib/payments/queries";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/uuid";

type Props = PageProps<"/[lang]/checkout/confirmation/[id]">;

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getMessages();
  return { title: messages.checkout.confirmation.title, robots: { index: false, follow: false } };
}

interface Snapshot {
  full_name?: string;
  phone?: string;
  street?: string | null;
  building?: string | null;
  city?: string;
  state_region?: string | null;
  country_code?: string;
  postal_code?: string | null;
}

/**
 * Confirmation for an order just placed. Read with the customer's session:
 * RLS (orders_select_own_or_admin) plus the user_id filter mean only the
 * customer's own order loads; any other id is a 404. Not an order history.
 *
 * Paid online: the payment status shown is the one Stripe's verified webhook
 * stored (never the browser's report). While it's on its way the page shows
 * "confirming" and checks again; a payment that didn't go through offers to
 * try again.
 */
async function Confirmation({ params }: { params: Props["params"] }) {
  const [locale, messages, { id }] = await Promise.all([getLocale(), getMessages(), params]);
  const t = messages.checkout.confirmation;
  const p = messages.payment.confirmation;
  const customer = await requireCustomer(locale);
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, total::text, currency_code, shipping_address_snapshot, created_at,
       items:order_items(id, product_name, variant_label, sku, quantity, total_price::text)`,
    )
    .eq("id", id)
    .eq("user_id", customer.id)
    .maybeSingle();
  if (error) {
    console.error("[checkout] confirmation lookup failed", error.code);
    throw new Error("Unable to load order");
  }
  if (!order) notFound();
  const payment = await getOrderPaymentView(order.id);

  const money = (amount: string) =>
    formatPrice(amount as Intl.StringNumericLiteral, locale, order.currency_code);
  const number = new Intl.NumberFormat(toIntlLocale(locale), { useGrouping: false }).format(
    order.order_number,
  );
  const address = order.shipping_address_snapshot as Snapshot;
  const items = order.items as unknown as {
    id: string;
    product_name: string;
    variant_label: string | null;
    sku: string;
    quantity: number;
    total_price: string;
  }[];

  return (
    <div className="mx-auto grid max-w-2xl gap-8">
      <CartReload />
      <div className="text-center">
        <PaymentHeading state={payment.state} />
        <h1 id="page-title" className="caps mt-6 text-sm font-medium">
          {payment.state === "none" ? t.title : p.titles[payment.state]}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {format(payment.state === "none" ? t.body : p.bodies[payment.state], {
            number: `#${number}`,
          })}
        </p>
        {payment.state === "confirming" && (
          <PaymentStatusPoller orderId={order.id} slowMessage={p.slow} />
        )}
        {payment.canPay && (
          <Link
            href={localizedHref(locale, routes.orderPayment(order.id))}
            className={buttonClassName({ className: "mt-6" })}
          >
            {payment.state === "failed" ? p.retry : p.payNow}
          </Link>
        )}
      </div>

      <Card className="p-6 sm:p-8">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t.orderNumber}</dt>
            <dd className="mt-1 font-medium">#{number}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t.placedOn}</dt>
            <dd className="mt-1">{formatDateTime(order.created_at, locale)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t.status}</dt>
            <dd className="mt-1">
              {payment.state === "none" ? t.statusPending : messages.payment.status[payment.state]}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t.deliverTo}</dt>
            <dd className="mt-1 grid gap-0.5">
              <span>{address.full_name}</span>
              <span className="text-muted-foreground">
                {[address.street, address.building].filter(Boolean).join(", ")}
              </span>
              <span className="text-muted-foreground">
                {[
                  address.city,
                  regionName(
                    {
                      region: address.state_region ?? null,
                      countryCode: address.country_code ?? "",
                    },
                    messages.addresses,
                  ),
                  address.country_code && countryName(address.country_code, locale),
                ]
                  .filter(Boolean)
                  .join(locale === "ar" ? "، " : ", ")}
              </span>
              <span dir="ltr" className="justify-self-start text-muted-foreground">
                {address.phone}
              </span>
            </dd>
          </div>
        </dl>

        <h2 className="caps mt-8 mb-3 text-xs font-medium">{t.items}</h2>
        <ul className="border-t text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 border-b py-3">
              <span>
                {item.product_name} <span className="text-muted-foreground">× {item.quantity}</span>
                {item.variant_label && (
                  <span className="block text-xs text-muted-foreground">
                    <bdi>{item.variant_label}</bdi>
                  </span>
                )}
              </span>
              <span className="tabular-nums">{money(item.total_price)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between gap-4 text-base font-semibold">
          <span>{messages.checkout.total}</span>
          <span className="tabular-nums">{money(order.total)}</span>
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          {payment.state === "none" ? t.next : p.next}
        </p>
      </Card>

      <div className="flex flex-col-reverse justify-center gap-3 sm:flex-row">
        <Link
          href={localizedHref(locale, routes.order(order.id))}
          className={buttonClassName({ variant: "outline" })}
        >
          {t.viewOrder}
        </Link>
        <Link href={localizedHref(locale, routes.products)} className={buttonClassName()}>
          {t.continueShopping}
        </Link>
      </div>
    </div>
  );
}

/** Icon for the payment outcome (the original check when not paid online). */
function PaymentHeading({ state }: { state: PaymentState }) {
  const className = "mx-auto size-10";
  if (state === "confirming") {
    return <LoaderCircle aria-hidden strokeWidth={1.25} className={`${className} animate-spin`} />;
  }
  if (state === "awaiting" || state === "failed" || state === "unavailable") {
    return <CircleAlert aria-hidden strokeWidth={1.25} className={`${className} text-warning`} />;
  }
  if (state === "cancelled" || state === "expired") {
    return <CircleSlash aria-hidden strokeWidth={1.25} className={`${className} text-error`} />;
  }
  return <CircleCheck aria-hidden strokeWidth={1.25} className={`${className} text-success`} />;
}

export default async function ConfirmationPage({ params }: Props) {
  const messages = await getMessages();
  return (
    <Container className="py-12 sm:py-20">
      <Suspense fallback={<PageSkeleton label={messages.common.loading} />}>
        <Confirmation params={params} />
      </Suspense>
    </Container>
  );
}
