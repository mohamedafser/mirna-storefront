import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { countryName, regionName } from "@/components/addresses/address-format";
import { CartReload } from "@/components/cart/cart-reload";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageSkeleton } from "@/components/ui/skeleton";
import { localizedHref, routes } from "@/config/navigation";
import { requireCustomer } from "@/lib/auth/dal";
import { formatDateTime, formatPrice, toIntlLocale } from "@/lib/format";
import { format } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
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
 */
async function Confirmation({ params }: { params: Props["params"] }) {
  const [locale, messages, { id }] = await Promise.all([getLocale(), getMessages(), params]);
  const t = messages.checkout.confirmation;
  const customer = await requireCustomer(locale);
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, total::text, currency_code, shipping_address_snapshot, created_at,
       items:order_items(id, product_name, sku, quantity, total_price::text)`,
    )
    .eq("id", id)
    .eq("user_id", customer.id)
    .maybeSingle();
  if (error) {
    console.error("[checkout] confirmation lookup failed", error.code);
    throw new Error("Unable to load order");
  }
  if (!order) notFound();

  const money = (amount: string) =>
    formatPrice(amount as Intl.StringNumericLiteral, locale, order.currency_code);
  const number = new Intl.NumberFormat(toIntlLocale(locale), { useGrouping: false }).format(
    order.order_number,
  );
  const address = order.shipping_address_snapshot as Snapshot;
  const items = order.items as unknown as {
    id: string;
    product_name: string;
    sku: string;
    quantity: number;
    total_price: string;
  }[];

  return (
    <div className="mx-auto grid max-w-2xl gap-8">
      <CartReload />
      <div className="text-center">
        <CircleCheck aria-hidden strokeWidth={1.25} className="mx-auto size-10 text-success" />
        <h1 id="page-title" className="caps mt-6 text-sm font-medium">
          {t.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {format(t.body, { number: `#${number}` })}
        </p>
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
            <dd className="mt-1">{t.statusPending}</dd>
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
              </span>
              <span className="tabular-nums">{money(item.total_price)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between gap-4 text-base font-semibold">
          <span>{messages.checkout.total}</span>
          <span className="tabular-nums">{money(order.total)}</span>
        </p>
        <p className="mt-6 text-sm text-muted-foreground">{t.next}</p>
      </Card>

      <div className="text-center">
        <Link href={localizedHref(locale, routes.products)} className={buttonClassName()}>
          {t.continueShopping}
        </Link>
      </div>
    </div>
  );
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
