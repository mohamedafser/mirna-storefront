import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { cacheLife } from "next/cache";
import Link from "next/link";
import type { ReactNode } from "react";
import { countryName } from "@/components/addresses/address-format";
import { LocaleSwitcher } from "@/components/navigation/locale-switcher";
import { Container } from "@/components/ui/container";
import { localizedHref, routes } from "@/config/navigation";
import { getNavCategories } from "@/lib/catalogue/queries";
import { format } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { getStoreContact, SOCIAL_NAMES, telHref, whatsappHref } from "@/lib/store/contact";
import { siteConfig } from "@/config/site";
import { Brand } from "./brand";
import { FooterWordmark } from "./footer-wordmark";

// Cached so the static shell can include the year (Cache Components forbids
// reading the clock during prerender outside a cache scope).
async function currentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

const linkClassName =
  "inline-flex min-h-9 items-center text-header-foreground/70 underline-offset-4 transition-colors hover:text-header-foreground hover:underline";

function FooterColumn({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <nav aria-labelledby={id}>
      <h2 id={id} className="caps text-[0.6875rem] font-medium">
        {title}
      </h2>
      <ul className="mt-5 grid gap-0.5 text-sm">{children}</ul>
    </nav>
  );
}

/**
 * Storefront footer, on the header's burgundy colours (they follow Light /
 * Dark / System). Only real things are shown:
 * - links to routes that exist (no Shipping / Returns / FAQ / legal pages
 *   yet, so none are listed);
 * - contact details and social profiles only when an admin has published
 *   them (getStoreContact: mirna-admin Settings → Contact information);
 * - no newsletter: there is no subscription flow.
 * Layout: four equal columns: brand (logo, tagline, social) | Shop |
 * Customer | Contact; then copyright and language, then the large wordmark
 * on the bottom edge (FooterWordmark: rises in on scroll, fills on hover).
 * Tablets: two by two. Phones: brand, the two link columns side by side,
 * contact, then the bar.
 */
export async function Footer() {
  const [locale, messages, year, { contact }, categories] = await Promise.all([
    getLocale(),
    getMessages(),
    currentYear(),
    getStoreContact(),
    // Same cached call as the header's menu: no extra request.
    getNavCategories(),
  ]);
  const t = messages.footer;
  const href = (path: string) => localizedHref(locale, path);
  const hasContact = Boolean(
    contact.email || contact.phone || contact.whatsapp || contact.address.length > 0,
  );

  const shop = [
    ...categories.map((category) => ({
      label: category.name,
      href: href(routes.category(category.slug)),
    })),
    { label: t.allProducts, href: href(routes.products) },
    { label: messages.nav.categories, href: href(routes.categories) },
  ];
  const customer = [
    { label: messages.nav.account, href: href(routes.account) },
    { label: t.orders, href: href(routes.orders) },
    { label: messages.nav.wishlist, href: href(routes.wishlist) },
    { label: messages.nav.about, href: href(routes.about) },
    { label: messages.nav.contact, href: href(routes.contact) },
  ];

  return (
    <footer className="site-footer mt-auto border-t border-header-border bg-header pb-safe text-header-foreground">
      <Container size="wide" className="pt-16 sm:pt-24">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          {/* Brand statement */}
          <div className="max-w-md">
            <Link
              href={href(routes.home)}
              aria-label={messages.nav.homeLink}
              className="inline-flex min-h-11 items-center"
            >
              <Brand name={messages.site.name} size="lg" />
            </Link>
            <p className="caps mt-4 text-xs tracking-[0.2em] text-header-foreground/70">
              {t.tagline}
            </p>
            {contact.social.length > 0 && (
              <ul aria-label={t.follow} className="mt-8 flex flex-wrap gap-2">
                {contact.social.map((profile) => (
                  <li key={profile.platform}>
                    <a
                      href={profile.href}
                      rel="noopener noreferrer"
                      target="_blank"
                      className="caps inline-flex min-h-9 items-center border border-header-border px-3.5 text-[0.625rem] text-header-foreground/80 transition-colors hover:border-header-foreground hover:text-header-foreground"
                    >
                      {SOCIAL_NAMES[profile.platform]}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Links: side by side on phones, their own columns from lg */}
          <div className="grid grid-cols-2 gap-8 sm:gap-12 lg:contents">
            <FooterColumn id="footer-shop" title={t.shop}>
              {shop.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </FooterColumn>
            <FooterColumn id="footer-customer" title={t.customer}>
              {customer.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </FooterColumn>
          </div>
          {/* Contact: only what an admin has published */}
          {hasContact && (
            <address className="grid content-start gap-0.5 text-sm not-italic">
              <h2 className="caps mb-4 text-[0.6875rem] font-medium">{t.contactTitle}</h2>
              {contact.email && (
                <a href={`mailto:${contact.email}`} className={`${linkClassName} gap-3`}>
                  <Mail aria-hidden strokeWidth={1.5} className="size-4 shrink-0" />
                  <span className="break-all">{contact.email}</span>
                </a>
              )}
              {contact.phone && (
                <a href={telHref(contact.phone)} className={`${linkClassName} gap-3`}>
                  <Phone aria-hidden strokeWidth={1.5} className="size-4 shrink-0" />
                  {/* Phone numbers stay LTR inside Arabic text. */}
                  <span dir="ltr">{contact.phone}</span>
                </a>
              )}
              {contact.whatsapp && (
                <a
                  href={whatsappHref(contact.whatsapp)}
                  rel="noopener noreferrer"
                  target="_blank"
                  aria-label={`${t.whatsapp}: ${contact.whatsapp}`}
                  className={`${linkClassName} gap-3`}
                >
                  <MessageCircle aria-hidden strokeWidth={1.5} className="size-4 shrink-0" />
                  <span dir="ltr">{contact.whatsapp}</span>
                </a>
              )}
              {contact.address.length > 0 && (
                <p className="flex gap-3 py-2 text-header-foreground/70">
                  <MapPin aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {contact.address.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                    {contact.countryCode && (
                      <span className="block">{countryName(contact.countryCode, locale)}</span>
                    )}
                  </span>
                </p>
              )}
            </address>
          )}
        </div>

        <div className="mt-16 flex flex-col-reverse gap-6 border-t border-header-border pt-6 sm:mt-20 sm:flex-row sm:items-center sm:justify-between">
          <p className="caps text-[0.625rem] text-header-foreground/60">
            {format(t.copyright, { year })}
          </p>
          <LocaleSwitcher tone="inverse" className="self-start sm:self-auto" />
        </div>
      </Container>

      {/* The brand, very large on the footer's bottom edge (decorative): its
          letters rise in on scroll and fill from the bottom on hover. Its
          height also keeps the floating WhatsApp button clear of the bar above. */}
      <Container size="wide" className="mt-10 sm:mt-14">
        <FooterWordmark text={siteConfig.name} />
      </Container>
    </footer>
  );
}
