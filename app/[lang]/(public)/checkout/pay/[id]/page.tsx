import { CircleSlash, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CartReload } from "@/components/cart/cart-reload";
import { SectionHeading } from "@/components/home/section-heading";
import { PaymentForm } from "@/components/payments/payment-form";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { requireCustomer } from "@/lib/auth/dal";
import { formatDateTime, formatPrice, toIntlLocale } from "@/lib/format";
import { format } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { getCustomerOrder } from "@/lib/orders/queries";
import { getOrderPaymentView } from "@/lib/payments/queries";
import { isUuid } from "@/lib/utils/uuid";

type Props = PageProps<"/[lang]/checkout/pay/[id]">;

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getMessages();
  return { title: messages.payment.title, robots: { index: false, follow: false } };
}

/**
 * Pay for an order just placed, or retry after a declined card. Only the
 * signed-in customer's own order loads (RLS + user_id filter); anything
 * else is a 404. Orders that are paid, being confirmed or not paid online
 * go to the confirmation page; cancelled or expired ones say so.
 */
async function Pay({ params }: { params: Props["params"] }) {
  const [locale, messages, { id }] = await Promise.all([getLocale(), getMessages(), params]);
  const t = messages.payment;
  const customer = await requireCustomer(locale);
  if (!isUuid(id)) notFound();
  const [order, payment] = await Promise.all([
    getCustomerOrder(customer.id, id),
    getOrderPaymentView(id),
  ]);
  if (!order) notFound();

  const confirmation = localizedHref(locale, routes.orderConfirmation(order.id));
  if (!payment.canPay && !["cancelled", "expired", "unavailable"].includes(payment.state)) {
    redirect(confirmation);
  }

  const money = (amount: Intl.StringNumericLiteral) =>
    formatPrice(amount, locale, order.currencyCode);
  const number = `#${new Intl.NumberFormat(toIntlLocale(locale), { useGrouping: false }).format(order.orderNumber)}`;

  if (!payment.canPay) {
    const body =
      payment.state === "unavailable"
        ? t.unavailableBody
        : payment.state === "expired"
          ? t.expiredBody
          : t.cancelledBody;
    return (
      <Card className="mx-auto max-w-xl px-6">
        <StatusState
          icon={payment.state === "unavailable" ? Clock : CircleSlash}
          headingLevel="h1"
          title={format(payment.state === "unavailable" ? t.unavailableTitle : t.cancelledTitle, {
            number,
          })}
          description={body}
          className="py-14"
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={localizedHref(locale, routes.order(order.id))}
                className={buttonClassName({ variant: "outline" })}
              >
                {messages.checkout.confirmation.viewOrder}
              </Link>
              <Link href={localizedHref(locale, routes.contact)} className={buttonClassName()}>
                {messages.orders.contactUs}
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
      <CartReload />
      <section aria-labelledby="payment-title" className="border bg-card p-6 sm:p-8">
        <h2 id="payment-title" className="caps mb-2 text-xs font-medium">
          {t.methodTitle}
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {payment.state === "failed" ? t.retryBody : t.methodBody}
        </p>
        <PaymentForm
          orderId={order.id}
          amountLabel={money(order.total)}
          confirmationHref={confirmation}
        />
      </section>

      <aside
        aria-labelledby="payment-summary"
        className="border bg-card p-6 sm:p-8 lg:sticky lg:top-[calc(var(--header-h)+2rem)]"
      >
        <h2 id="payment-summary" className="caps mb-5 text-xs font-medium">
          {format(t.summaryTitle, { number })}
        </h2>
        <ul className="grid gap-3 border-b pb-4 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4">
              <span className="min-w-0">
                <bdi>{item.name}</bdi>{" "}
                <span className="text-muted-foreground">× {item.quantity}</span>
                {item.variantLabel && (
                  <span className="block text-xs text-muted-foreground">
                    <bdi>{item.variantLabel}</bdi>
                  </span>
                )}
              </span>
              <span className="tabular-nums">{money(item.totalPrice)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{messages.orders.subtotal}</dt>
            <dd className="tabular-nums">{money(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{messages.orders.shipping}</dt>
            <dd className="tabular-nums">
              {order.shippingMethod?.freeApplied ? messages.checkout.free : money(order.shipping)}
            </dd>
          </div>
          {/[1-9]/.test(order.tax) && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{messages.orders.tax}</dt>
              <dd className="tabular-nums">{money(order.tax)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t pt-3 text-base font-semibold">
            <dt>{messages.orders.total}</dt>
            <dd className="tabular-nums">{money(order.total)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          {format(messages.checkout.currencyNote, { currency: order.currencyCode })}
        </p>
        {payment.dueAt && (
          <p className="mt-4 flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground">
            <Clock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {format(t.dueBy, { date: formatDateTime(payment.dueAt, locale) })}
          </p>
        )}
      </aside>
    </div>
  );
}

export default async function PayPage({ params }: Props) {
  const messages = await getMessages();
  const t = messages.payment;
  return (
    <Container className="py-12 sm:py-20">
      <SectionHeading as="h1" id="page-title" title={t.title} subtitle={t.description} />
      <div className="mt-10 sm:mt-14">
        <Suspense fallback={<PageSkeleton label={t.loading} />}>
          <Pay params={params} />
        </Suspense>
      </div>
    </Container>
  );
}
