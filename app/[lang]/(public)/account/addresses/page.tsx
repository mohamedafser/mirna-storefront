import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountSubpage } from "@/components/addresses/address-page";
import { AddressList } from "@/components/addresses/address-list";
import { PageSkeleton } from "@/components/ui/skeleton";
import { localizedHref, routes } from "@/config/navigation";
import { listAddresses } from "@/lib/addresses/queries";
import { MAX_ADDRESSES } from "@/lib/addresses/validation";
import { requireCustomer } from "@/lib/auth/dal";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return pageMetadata({
    locale,
    path: routes.addresses,
    siteName: messages.site.name,
    title: messages.addresses.title,
    description: messages.addresses.description,
    index: false,
  });
}

/** Reads the session and the customer's own addresses (RLS), so it streams in. */
async function AddressBook({
  searchParams,
}: {
  searchParams: PageProps<"/[lang]/account/addresses">["searchParams"];
}) {
  const locale = await getLocale();
  const customer = await requireCustomer(locale);
  const [addresses, { saved }] = await Promise.all([listAddresses(customer.id), searchParams]);
  return (
    <AddressList
      addresses={addresses}
      canAdd={addresses.length < MAX_ADDRESSES}
      saved={saved === "1"}
    />
  );
}

export default async function AddressesPage({
  searchParams,
}: PageProps<"/[lang]/account/addresses">) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.addresses;
  return (
    <AccountSubpage
      title={t.title}
      subtitle={t.description}
      back={{ href: localizedHref(locale, routes.account), label: t.backToAccount }}
    >
      <Suspense fallback={<PageSkeleton label={t.loading} />}>
        <AddressBook searchParams={searchParams} />
      </Suspense>
    </AccountSubpage>
  );
}
