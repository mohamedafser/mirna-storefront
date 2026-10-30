import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/auth/auth-shell";
import { AddressForm } from "@/components/addresses/address-form";
import { AccountSubpage, BackLink } from "@/components/account/account-subpage";
import { Card } from "@/components/ui/card";
import { localizedHref, routes } from "@/config/navigation";
import { activeRegion } from "@/config/region";
import { listAddresses } from "@/lib/addresses/queries";
import { MAX_ADDRESSES } from "@/lib/addresses/validation";
import { requireCustomer } from "@/lib/auth/dal";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return pageMetadata({
    locale,
    path: routes.newAddress,
    siteName: messages.site.name,
    title: messages.addresses.newTitle,
    description: messages.addresses.description,
    index: false,
  });
}

async function NewAddress({ searchParams }: { searchParams: Props["searchParams"] }) {
  const [locale, { returnTo }] = await Promise.all([getLocale(), searchParams]);
  const customer = await requireCustomer(locale);
  const existing = await listAddresses(customer.id);
  const fromCheckout = returnTo === "checkout";
  // Full address book: back to where the customer came from (saveAddress
  // enforces the limit too).
  if (existing.length >= MAX_ADDRESSES) {
    redirect(localizedHref(locale, fromCheckout ? routes.checkout : routes.addresses));
  }

  return (
    <AddressForm
      returnTo={fromCheckout ? "checkout" : undefined}
      initial={{
        // Prefilled from the profile; the customer can change both.
        fullName: customer.fullName ?? "",
        phone: customer.phone ?? "",
        line1: "",
        line2: "",
        city: "",
        region: "",
        country: activeRegion.countryCode,
        postalCode: "",
        isDefault: existing.length === 0,
      }}
    />
  );
}

type Props = PageProps<"/[lang]/account/addresses/new">;

/** Opened from checkout (?returnTo=checkout): the back link leads there. */
async function NewAddressBack({ searchParams }: { searchParams: Props["searchParams"] }) {
  const [locale, messages, { returnTo }] = await Promise.all([
    getLocale(),
    getMessages(),
    searchParams,
  ]);
  return returnTo === "checkout" ? (
    <BackLink href={localizedHref(locale, routes.checkout)} label={messages.checkout.title} />
  ) : (
    <BackLink href={localizedHref(locale, routes.addresses)} label={messages.addresses.title} />
  );
}

export default async function NewAddressPage({ searchParams }: Props) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.addresses;
  return (
    <AccountSubpage
      title={t.newTitle}
      back={
        // searchParams are request data: rendered in their own boundary.
        <Suspense
          fallback={<BackLink href={localizedHref(locale, routes.addresses)} label={t.title} />}
        >
          <NewAddressBack searchParams={searchParams} />
        </Suspense>
      }
      narrow
    >
      <Card className="p-6 sm:p-8">
        <Suspense fallback={<FormSkeleton label={t.loading} fields={6} />}>
          <NewAddress searchParams={searchParams} />
        </Suspense>
      </Card>
    </AccountSubpage>
  );
}
