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
import { loadCustomerCart } from "@/lib/cart/customer-cart";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

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
 * Everything personal: the customer (DAL), their saved cart priced from the
 * current products, and their addresses. Signed-out visitors never get here
 * (proxy.ts sends them to /login?redirect=/checkout).
 */
async function CheckoutContent({ searchParams }: { searchParams: Props["searchParams"] }) {
  const [locale, messages, { address: requested }] = await Promise.all([
    getLocale(),
    getMessages(),
    searchParams,
  ]);
  const t = messages.checkout;
  const customer = await requireCustomer(locale);
  const [{ summary }, addresses] = await Promise.all([
    loadCustomerCart(customer.id),
    listAddresses(customer.id),
  ]);

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
  if (summary.items.some((item) => !item.available) || summary.totals.length !== 1) {
    return block(
      CircleAlert,
      t.unavailableTitle,
      summary.totals.length > 1 ? t.errors.mixedCurrency : t.unavailableBody,
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

  // Preselect: the address just added (?address=), else the default, else the first.
  const selected =
    addresses.find((a) => a.id === requested) ?? addresses.find((a) => a.isDefault) ?? addresses[0];

  return (
    <CheckoutForm
      // Next.js may keep this page mounted between visits: a newly added
      // address (?address=) must reset the selection.
      key={selected.id}
      addresses={addresses}
      initialAddressId={selected.id}
      items={summary.items}
      total={summary.totals[0]}
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
