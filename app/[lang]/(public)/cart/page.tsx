import type { Metadata } from "next";
import { CartContents } from "@/components/cart/cart-contents";
import { SectionHeading } from "@/components/home/section-heading";
import { Container } from "@/components/ui/container";
import { routes } from "@/config/navigation";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.cart;
  return pageMetadata({
    locale,
    path: routes.cart,
    siteName: messages.site.name,
    title: t.title,
    description: t.description,
    index: false,
  });
}

// Static shell. The cart lives in the browser (guests) or the account
// (customers), so CartContents loads and prices it on the client through
// Server Actions; nothing personal is prerendered or cached.
export default async function CartPage() {
  const t = (await getMessages()).cart;
  return (
    <Container className="py-16 sm:py-24">
      <SectionHeading as="h1" id="page-title" title={t.title} />
      <div className="mt-12 sm:mt-16">
        <CartContents />
      </div>
    </Container>
  );
}
