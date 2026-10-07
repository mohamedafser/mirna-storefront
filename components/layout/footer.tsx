import { cacheLife } from "next/cache";
import Link from "next/link";
import type { ReactNode } from "react";
import { LocaleSwitcher } from "@/components/navigation/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { localizedHref, routes } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { format } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";

// Cached so the static shell can include the year (Cache Components forbids
// reading the clock during prerender outside a cache scope).
async function currentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

function FooterColumn({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="caps text-[0.6875rem] font-medium">{title}</h2>
      <ul className="mt-5 grid gap-1 text-sm">{children}</ul>
    </div>
  );
}

const linkClassName =
  "inline-flex min-h-9 items-center text-muted-foreground transition-colors hover:text-foreground";

export async function Footer() {
  const [locale, messages, year] = await Promise.all([getLocale(), getMessages(), currentYear()]);
  const t = messages.footer;
  const href = (path: string) => localizedHref(locale, path);
  const { email, phone } = siteConfig.contact;

  return (
    <footer className="mt-auto border-t bg-card pb-safe">
      <Container size="wide" className="pt-16 pb-10 sm:pt-20">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.3fr]">
          {/* About: brand line, tagline, contact and social (empty until real). */}
          <div className="max-w-sm">
            <h2 className="caps text-[0.6875rem] font-medium">{messages.site.name}</h2>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{t.tagline}</p>
            <div className="mt-5 grid gap-1 text-sm">
              {email || phone ? (
                <>
                  {email && (
                    <a href={`mailto:${email}`} className={linkClassName}>
                      {email}
                    </a>
                  )}
                  {phone && (
                    <a href={`tel:${phone}`} dir="ltr" className={linkClassName}>
                      {phone}
                    </a>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">{t.contactSoon}</p>
              )}
              {siteConfig.social.length > 0 ? (
                <ul aria-label={t.follow} className="mt-2 flex flex-wrap gap-4">
                  {siteConfig.social.map((profile) => (
                    <li key={profile.href}>
                      <a
                        href={profile.href}
                        rel="noopener"
                        target="_blank"
                        className={linkClassName}
                      >
                        {profile.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">{t.socialSoon}</p>
              )}
            </div>
          </div>

          <FooterColumn title={t.shop}>
            <li>
              <Link href={href(routes.products)} className={linkClassName}>
                {messages.nav.shop}
              </Link>
            </li>
            <li>
              <Link href={href(routes.categories)} className={linkClassName}>
                {messages.nav.categories}
              </Link>
            </li>
            <li>
              <Link href={href(routes.about)} className={linkClassName}>
                {messages.nav.about}
              </Link>
            </li>
            <li>
              <Link href={href(routes.contact)} className={linkClassName}>
                {messages.nav.contact}
              </Link>
            </li>
          </FooterColumn>

          {/* Support pages don't exist yet: listed, not linked, so nothing 404s. */}
          <FooterColumn title={t.support}>
            {[t.help, t.shipping, t.returns].map((label) => (
              <li key={label} className="flex min-h-9 flex-wrap items-center gap-2">
                <span className="text-muted-foreground">{label}</span>
                <Badge>{messages.common.comingSoon}</Badge>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title={t.language}>
            <li>
              <LocaleSwitcher />
            </li>
          </FooterColumn>
        </div>

        <div className="mt-16 border-t pt-8">
          <p className="caps text-[0.625rem] text-muted-foreground">
            {format(t.copyright, { year })}
          </p>
        </div>
      </Container>
    </footer>
  );
}
