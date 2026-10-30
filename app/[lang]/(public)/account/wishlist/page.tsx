import type { Metadata } from "next";
import { AccountSubpage } from "@/components/account/account-subpage";
import { WishlistContents } from "@/components/wishlist/wishlist-contents";
import { routes } from "@/config/navigation";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.wishlist;
  return pageMetadata({
    locale,
    path: routes.wishlist,
    siteName: messages.site.name,
    title: t.title,
    description: t.description,
    index: false,
  });
}

// Static shell, open to guests (proxy.ts lets this one account page through).
// The wishlist lives in the browser (guests) or the account (customers), so
// WishlistContents loads it on the client through Server Actions; nothing
// personal is prerendered or cached.
export default async function WishlistPage() {
  const messages = await getMessages();
  const t = messages.wishlist;
  return (
    <AccountSubpage title={t.title} subtitle={t.description}>
      <WishlistContents />
    </AccountSubpage>
  );
}
