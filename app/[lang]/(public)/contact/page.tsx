import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactDetails, ContactDetailsSkeleton } from "@/components/contact/contact-details";
import { PageHero } from "@/components/page/page-hero";
import { Container } from "@/components/ui/container";
import { routes } from "@/config/navigation";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.pages.contact;
  return pageMetadata({
    locale,
    path: routes.contact,
    siteName: messages.site.name,
    title: t.title,
    description: t.description,
  });
}

/**
 * Contact page: the details an admin published in mirna-admin (Settings →
 * Contact information). Nothing is hardcoded; see getStoreContact().
 */
export default async function ContactPage() {
  const messages = await getMessages();
  const t = messages.pages.contact;
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.headline} lead={t.description} />
      <Container className="py-12 sm:py-20">
        <Suspense fallback={<ContactDetailsSkeleton label={messages.common.loading} />}>
          <ContactDetails />
        </Suspense>
      </Container>
    </>
  );
}
