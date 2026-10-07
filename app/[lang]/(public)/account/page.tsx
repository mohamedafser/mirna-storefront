import { UserRound } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/page/coming-soon";
import { routes } from "@/config/navigation";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.pages.account;
  return pageMetadata({
    locale,
    path: routes.account,
    siteName: messages.site.name,
    title: t.title,
    description: t.description,
    index: false,
  });
}

// Header entry point only. Phase 8 adds /login, /register, /forgot-password and the real account area.
export default async function AccountPage() {
  const t = (await getMessages()).pages.account;
  return (
    <ComingSoonPage
      icon={UserRound}
      title={t.title}
      description={t.description}
      emptyTitle={t.emptyTitle}
      emptyBody={t.emptyBody}
    />
  );
}
