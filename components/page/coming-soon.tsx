import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { SectionHeading } from "@/components/home/section-heading";
import { buttonClassName } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { getLocale, getMessages } from "@/lib/i18n/server";

/**
 * Page title + "coming soon" panel for routes whose content arrives in a
 * later phase (Shop, Categories, About, Contact, Account, Cart).
 */
export async function ComingSoonPage({
  icon,
  title,
  description,
  emptyTitle,
  emptyBody,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <Container className="py-16 sm:py-24">
      <SectionHeading as="h1" id="page-title" title={title} subtitle={description} />
      <div className="mt-12 border bg-card px-6 sm:mt-16">
        <StatusState
          icon={icon}
          title={emptyTitle}
          description={emptyBody}
          className="py-16 sm:py-24"
          action={
            <Link
              href={localizedHref(locale, routes.home)}
              className={buttonClassName({ variant: "outline" })}
            >
              {messages.common.backToHome}
            </Link>
          }
        />
      </div>
    </Container>
  );
}
