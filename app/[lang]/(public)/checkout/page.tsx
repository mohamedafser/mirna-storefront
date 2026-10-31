import { CircleAlert, MapPin, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { SectionHeading } from "@/components/home/section-heading";
import { buttonClassName } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { listAddresses } from "@/lib/addresses/queries";
import { requireCustomer } from "@/lib/auth/dal";
import { currencyForCountry } from "@/config/currency";
import { loadCustomerCart } from "@/lib/cart/customer-cart";
import { getCurrencies, getRequestCurrency } from "@/lib/currency/server";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";
import { getPaymentOptions } from "@/lib/payments/queries";
import { getCheckoutShipping } from "@/lib/shipping/queries";

type Props = PageProps<"/[lang]/checkout">;

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return pageMetadata({
    locale,
    path: routes.checkout,
    siteName: messages.site.name,
    title: messages.checkout.title,
    description: messages.checkout.description,
    index: false,
  });
}

/**
 * Everything personal: the customer (DAL), their addresses, and their saved
 * cart priced in the checkout currency. Signed-out visitors never get here
 * (proxy.ts sends them to /login?redirect=/checkout).
 *
 * Currency: the delivery address's country's currency (when the store sells
 * in it), since delivery is priced in it (mirna-admin migration 037); else
 * the visitor's current one. Delivery options are quoted by the database for
 * that address, cart and currency on every render, so changing the address
 * (?address=) or the cart re-quotes them.
 *
 * Payment: while the store takes payments online (mirna-admin Payments),
 * placing the order leads to the card / Apple Pay step; a currency online
 * payment isn't enabled for can't be ordered in.
 */
async function CheckoutContent({ searchParams }: { searchParams: Props["searchParams"] }) {
  const [locale, messages, { address: requested }] = await Promise.all([
    getLocale(),
    getMessages(),
    searchParams,
  ]);
  const t = messages.checkout;
  const customer = await requireCustomer(locale);
  const [addresses, { currency: chosen }, currencies] = await Promise.all([
    listAddresses(customer.id),
    getRequestCurrency(),
    getCurrencies(),
  ]);
  // Preselect: the address just added (?address=), else the default, else the first.
  const selected =
    addresses.find((a) => a.id === requested) ?? addresses.find((a) => a.isDefault) ?? addresses[0];
  const fromAddress = currencies.find(
    (option) => option.code === currencyForCountry(selected?.countryCode),
  );
  const currency = fromAddress ?? chosen;
  const { summary } = await loadCustomerCart(customer.id, currency);

  const block = (
    icon: typeof ShoppingBag,
    title: string,
    body: string,
    href: string,
    label: string,
  ) => (
    <div className="border bg-card px-6">
      <StatusState
        icon={icon}
        title={title}
        description={body}
        className="py-16 sm:py-24"
        action={
          <Link href={href} className={buttonClassName()}>
            {label}
          </Link>
        }
      />
    </div>
  );

  // Rule: at least one item, and every item orderable.
  if (summary.items.length === 0) {
    return block(
      ShoppingBag,
      t.emptyTitle,
      t.emptyBody,
      localizedHref(locale, routes.products),
      messages.cart.continueShopping,
    );
  }
  // Items not sold in the delivery country's currency don't block the page:
  // the customer can still see delivery to that address, or pick another one.
  const pricesMissing = summary.items.some((item) => item.priceMissing);
  if (
    summary.items.some((item) => !item.available && !item.priceMissing) ||
    (!pricesMissing && summary.totals.length !== 1)
  ) {
    return block(
      CircleAlert,
      t.unavailableTitle,
      t.unavailableBody,
      localizedHref(locale, routes.cart),
      t.reviewCart,
    );
  }
  // Rule: a delivery address.
  if (addresses.length === 0) {
    return block(
      MapPin,
      t.noAddressTitle,
      t.noAddressBody,
      `${localizedHref(locale, routes.newAddress)}?returnTo=checkout`,
      t.addAddress,
    );
  }

  const [shipping, paymentOptions] = await Promise.all([
    currency ? getCheckoutShipping(selected.id, currency.code) : ({ status: "error" } as const),
    getPaymentOptions(),
  ]);
  const checkoutCurrency = summary.totals[0]?.currencyCode ?? currency?.code ?? "";
  const payment = !paymentOptions.enabled
    ? "offline"
    : paymentOptions.currencies.includes(checkoutCurrency)
      ? "online"
      : "unavailable";

  return (
    <CheckoutForm
      // Next.js may keep this page mounted between visits: a newly added
      // address (?address=) must reset the selection.
      key={selected.id}
      addresses={addresses}
      initialAddressId={selected.id}
      items={summary.items}
      total={summary.totals[0] ?? { currencyCode: currency?.code ?? "", amount: "0", itemCount: 0 }}
      pricesMissing={pricesMissing}
      decimals={summary.currency?.decimals ?? 2}
      shipping={shipping}
      payment={payment}
      // New per page view: retrying this exact checkout can't create two orders.
      checkoutKey={crypto.randomUUID()}
    />
  );
}

export default async function CheckoutPage({ searchParams }: Props) {
  const messages = await getMessages();
  const t = messages.checkout;
  return (
    <Container className="py-12 sm:py-20">
      <SectionHeading as="h1" id="page-title" title={t.title} subtitle={t.description} />
      <div className="mt-10 sm:mt-14">
        <Suspense fallback={<PageSkeleton label={t.loading} />}>
          <CheckoutContent searchParams={searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}
