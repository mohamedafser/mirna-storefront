import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/auth/auth-shell";
import { AddressForm } from "@/components/addresses/address-form";
import { AccountSubpage } from "@/components/addresses/address-page";
import { Card } from "@/components/ui/card";
import { localizedHref, routes } from "@/config/navigation";
import { getAddress } from "@/lib/addresses/queries";
import { requireCustomer } from "@/lib/auth/dal";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { isUuid } from "@/lib/utils/uuid";

type Props = PageProps<"/[lang]/account/addresses/[id]/edit">;

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getMessages();
  return { title: messages.addresses.editTitle, robots: { index: false, follow: false } };
}

/** Only the customer's own address loads (user_id filter + RLS); anything else is a 404. */
async function EditAddress({ params }: { params: Props["params"] }) {
  const [locale, { id }] = await Promise.all([getLocale(), params]);
  const customer = await requireCustomer(locale);
  const address = isUuid(id) ? await getAddress(customer.id, id) : null;
  if (!address) notFound();

  return (
    <AddressForm
      id={address.id}
      initial={{
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2 ?? "",
        city: address.city,
        region: address.region ?? "",
        country: address.countryCode,
        postalCode: address.postalCode ?? "",
        isDefault: address.isDefault,
      }}
    />
  );
}

export default async function EditAddressPage({ params }: Props) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.addresses;
  return (
    <AccountSubpage
      title={t.editTitle}
      back={{ href: localizedHref(locale, routes.addresses), label: t.title }}
      narrow
    >
      <Card className="p-6 sm:p-8">
        <Suspense fallback={<FormSkeleton label={t.loading} fields={6} />}>
          <EditAddress params={params} />
        </Suspense>
      </Card>
    </AccountSubpage>
  );
}
