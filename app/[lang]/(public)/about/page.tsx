import { Gem, Languages, type LucideIcon, Coins, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page/page-hero";
import { buttonClassName } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { localizedHref, routes } from "@/config/navigation";
import { toIntlLocale } from "@/lib/format";
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

/**
 * About Mirna: story, what customers can expect, and a way onward (shop or
 * contact). Static copy from messages.pages.about; it only promises what the
 * storefront actually does (bilingual, local currency, accounts).
 */
export default async function AboutPage() {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.pages.about;
  const number = new Intl.NumberFormat(toIntlLocale(locale), { minimumIntegerDigits: 2 });
  const values: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: Gem, ...t.values.curated },
    { icon: Languages, ...t.values.language },
    { icon: Coins, ...t.values.currency },
    { icon: UserRound, ...t.values.account },
  ];

  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.headline} lead={t.lead} />

      <Container className="py-16 sm:py-24">
        <section
          aria-labelledby="about-story"
          className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-20"
        >
          <h2
            id="about-story"
            className="font-display text-2xl leading-tight font-medium text-balance sm:text-3xl"
          >
            {t.storyTitle}
          </h2>
          <div className="grid gap-5 text-base leading-relaxed text-pretty text-muted-foreground">
            <p>{t.storyBody1}</p>
            <p>{t.storyBody2}</p>
          </div>
        </section>

        <section aria-labelledby="about-values" className="mt-20 sm:mt-28">
          <h2 id="about-values" className="caps text-xs font-medium">
            {t.valuesTitle}
          </h2>
          <ul className="mt-8 grid border-s border-t sm:grid-cols-2 lg:grid-cols-4">
            {values.map(({ icon: Icon, title, body }, index) => (
              <li key={title} className="flex flex-col border-e border-b bg-card p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <Icon aria-hidden strokeWidth={1.25} className="size-6" />
                  <span aria-hidden className="text-xs text-muted-foreground tabular-nums">
                    {number.format(index + 1)}
                  </span>
                </div>
                <h3 className="mt-8 font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </section>
      </Container>

      {/* Always the dark brand panel (both themes): the inverse buttons are made for it. */}
      <section aria-labelledby="about-cta" className="bg-[#291113] text-[#faf7f3]">
        <Container className="flex flex-col gap-8 py-16 sm:py-20 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <h2
              id="about-cta"
              className="font-display text-2xl leading-tight font-medium text-balance sm:text-3xl"
            >
              {t.ctaTitle}
            </h2>
            <p className="mt-4 text-sm leading-relaxed opacity-80 sm:text-base">{t.ctaBody}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={localizedHref(locale, routes.products)}
              className={buttonClassName({ variant: "inverse", size: "lg" })}
            >
              {t.ctaShop}
            </Link>
            <Link
              href={localizedHref(locale, routes.contact)}
              className={buttonClassName({ variant: "outline-inverse", size: "lg" })}
            >
              {messages.nav.contact}
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
