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
import { Brand } from "./brand";

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
 * Layout: brand + contact | Shop | Customer, then language and copyright.
 * Phones: brand, then the two link columns side by side, then the bar.
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
      <Container size="wide" className="pt-16 pb-8 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="max-w-sm">
            <Link
              href={href(routes.home)}
              aria-label={messages.nav.homeLink}
              className="inline-flex min-h-11 items-center"
            >
              <Brand name={messages.site.name} size="lg" />
            </Link>
            <p className="mt-5 text-sm leading-relaxed text-pretty text-header-foreground/70">
              {t.tagline}
            </p>

            {hasContact && (
              <address className="mt-8 grid gap-1 text-sm not-italic">
                <h2 className="caps mb-2 text-[0.6875rem] font-medium">{t.contactTitle}</h2>
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

            {contact.social.length > 0 && (
              <ul aria-label={t.follow} className="mt-6 flex flex-wrap gap-x-5">
                {contact.social.map((profile) => (
                  <li key={profile.platform}>
                    <a
                      href={profile.href}
                      rel="noopener noreferrer"
                      target="_blank"
                      className={linkClassName}
                    >
                      {SOCIAL_NAMES[profile.platform]}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
        </div>

        <div className="mt-16 flex flex-col-reverse gap-6 border-t border-header-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="caps text-[0.625rem] text-header-foreground/60">
            {format(t.copyright, { year })}
          </p>
          <LocaleSwitcher tone="inverse" className="self-start sm:self-auto" />
        </div>
      </Container>
    </footer>
  );
}
