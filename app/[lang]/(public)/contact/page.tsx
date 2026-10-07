import { Mail } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/page/coming-soon";
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

// Placeholder until real contact details are provided (config/site.ts).
export default async function ContactPage() {
  const t = (await getMessages()).pages.contact;
  return (
    <ComingSoonPage
      icon={Mail}
      title={t.title}
      description={t.description}
      emptyTitle={t.emptyTitle}
      emptyBody={t.emptyBody}
    />
  );
}
