import { Info } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/page/coming-soon";
import { routes } from "@/config/navigation";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.pages.about;
  return pageMetadata({
    locale,
    path: routes.about,
    siteName: messages.site.name,
    title: t.title,
    description: t.description,
  });
}

// Placeholder until real company content is provided.
export default async function AboutPage() {
  const t = (await getMessages()).pages.about;
  return (
    <ComingSoonPage
      icon={Info}
      title={t.title}
      description={t.description}
      emptyTitle={t.emptyTitle}
      emptyBody={t.emptyBody}
    />
  );
}
