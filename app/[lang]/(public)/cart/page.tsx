import { ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/page/coming-soon";
import { routes } from "@/config/navigation";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.pages.cart;
  return pageMetadata({
    locale,
    path: routes.cart,
    siteName: messages.site.name,
    title: t.title,
    description: t.description,
    index: false,
  });
}

// Header entry point only. The cart arrives in Phase 9.
export default async function CartPage() {
  const t = (await getMessages()).pages.cart;
  return (
    <ComingSoonPage
      icon={ShoppingCart}
      title={t.title}
      description={t.description}
      emptyTitle={t.emptyTitle}
      emptyBody={t.emptyBody}
    />
  );
}
