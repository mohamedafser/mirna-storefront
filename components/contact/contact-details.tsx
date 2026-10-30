import {
  ArrowUpRight,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Share2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { countryName } from "@/components/addresses/address-format";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusState } from "@/components/ui/states";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { toIntlLocale } from "@/lib/format";
import { getLocale, getMessages } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";
import {
  getStoreContact,
  hasContactDetails,
  SOCIAL_NAMES,
  telHref,
  whatsappHref,
  WEEKDAYS,
  type StoreContact,
} from "@/lib/store/contact";
import { cn } from "@/lib/utils/cn";
import { RetryButton } from "./retry-button";

const external = { target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * One way to reach the store, as a whole-card link: icon, caps label, the
 * value (number or address), a one-line note and the action. The first
 * (WhatsApp, when published) is set on the dark brand panel.
 */
function ChannelCard({
  icon: Icon,
  label,
  value,
  note,
  action,
  href,
  newTab,
  featured = false,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  note: string;
  action: string;
  href: string;
  /** Screen-reader suffix for links that open a new tab. */
  newTab?: string;
  featured?: boolean;
}) {
  return (
    <a
      href={href}
      {...(newTab ? external : {})}
      className={cn(
        "group flex h-full flex-col border p-6 transition-colors sm:p-7",
        featured
          ? "border-transparent bg-[#291113] text-[#faf7f3] hover:bg-[#3a1a1d]"
          : "bg-card hover:border-foreground/40",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <Icon aria-hidden strokeWidth={1.25} className="size-6" />
        <ArrowUpRight
          aria-hidden
          className="size-4 opacity-60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
        />
      </div>
      <h3 className="caps mt-8 text-[0.6875rem] font-medium opacity-70">{label}</h3>
      <p className="mt-2 text-lg font-medium break-words">{value}</p>
      <p className={cn("mt-1 text-sm", featured ? "opacity-70" : "text-muted-foreground")}>
        {note}
      </p>
      <span className="caps mt-auto inline-flex items-center gap-2 pt-6 text-[0.6875rem] font-medium underline-offset-4 group-hover:underline">
        {action}
        {newTab && <span className="sr-only"> {newTab}</span>}
      </span>
    </a>
  );
}

/** Bordered side panel: icon + caps title, then content. */
function Panel({
  icon: Icon,
  title,
  id,
  children,
}: {
  icon: LucideIcon;
  title: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border bg-card p-6 sm:p-7">
      <h2 id={id} className="caps flex items-center gap-3 text-[0.6875rem] font-medium">
        <Icon aria-hidden strokeWidth={1.25} className="size-5" />
        {title}
      </h2>
      <div className="mt-5 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

/** "09:00" → "9:00 AM" / "٩:٠٠ ص" in the visitor's language (no timezone shift). */
function timeLabel(value: string, locale: Locale): string {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(Date.UTC(2024, 0, 1, hours, minutes));
}

function BusinessHours({
  hours,
  locale,
  t,
}: {
  hours: NonNullable<StoreContact["hours"]>;
  locale: Locale;
  t: Messages["pages"]["contact"];
}) {
  // 2024-01-01 was a Monday; names come from Intl in the visitor's language.
  const weekday = new Intl.DateTimeFormat(toIntlLocale(locale), {
    weekday: "long",
    timeZone: "UTC",
  });
  return (
    <Panel icon={Clock} title={t.hours} id="contact-hours">
      <dl className="divide-y">
        {WEEKDAYS.map((day, index) => {
          const value = hours[day];
          return (
            <div key={day} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt>{weekday.format(Date.UTC(2024, 0, 1 + index))}</dt>
              <dd className={value ? "text-end tabular-nums" : "text-end text-muted-foreground"}>
                {value ? (
                  <bdi>
                    {timeLabel(value.open, locale)} – {timeLabel(value.close, locale)}
                  </bdi>
                ) : (
                  t.closed
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Panel>
  );
}

/** Orders live in the account: shown with the details and on their own. */
function OrderHelp({ locale, t }: { locale: Locale; t: Messages["pages"]["contact"] }) {
  return (
    <Panel icon={Package} title={t.orderHelpTitle} id="contact-orders">
      <p className="text-muted-foreground">{t.orderHelpBody}</p>
      <Link
        href={localizedHref(locale, routes.orders)}
        className={buttonClassName({ variant: "outline", size: "sm", className: "mt-5" })}
      >
        {t.orderHelpAction}
      </Link>
    </Panel>
  );
}

/** Loading state matching the details layout. */
export function ContactDetailsSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="p-6 sm:p-7">
            <Skeleton className="size-6" />
            <Skeleton className="mt-8 h-2.5 w-20" />
            <Skeleton className="mt-3 h-4 w-48 max-w-full" />
            <Skeleton className="mt-2 h-3 w-32" />
          </Card>
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

/**
 * The published contact details (mirna-admin Settings → Contact information):
 * ways to reach the store as large cards (WhatsApp first), then hours, social
 * profiles and order help beside them. Only configured channels are shown;
 * nothing published shows an empty state, and a failed read shows an error
 * with a retry.
 */
export async function ContactDetails() {
  const [locale, messages, { status, contact }] = await Promise.all([
    getLocale(),
    getMessages(),
    getStoreContact(),
  ]);
  const t = messages.pages.contact;

  if (status === "error" || !hasContactDetails(contact)) {
    const failed = status === "error";
    return (
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <Card className="px-6">
          <StatusState
            icon={failed ? TriangleAlert : Mail}
            tone={failed ? "error" : undefined}
            title={failed ? t.errorTitle : t.emptyTitle}
            description={failed ? t.errorBody : t.emptyBody}
            className="py-16 sm:py-20"
            action={
              failed ? (
                <RetryButton label={messages.common.retry} />
              ) : (
                <Link
                  href={localizedHref(locale, routes.home)}
                  className={buttonClassName({ variant: "outline" })}
                >
                  {messages.common.backToHome}
                </Link>
              )
            }
          />
        </Card>
        <OrderHelp locale={locale} t={t} />
      </div>
    );
  }

  const addressLines = [
    ...contact.address,
    ...(contact.countryCode ? [countryName(contact.countryCode, locale)] : []),
  ];
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLines.join(", "))}`;
  const channels = [
    contact.whatsapp && (
      <ChannelCard
        key="whatsapp"
        featured
        icon={MessageCircle}
        label={t.whatsapp}
        value={<bdi dir="ltr">{contact.whatsapp}</bdi>}
        note={t.whatsappNote}
        action={t.whatsappAction}
        href={whatsappHref(contact.whatsapp)}
        newTab={t.newTab}
      />
    ),
    contact.email && (
      <ChannelCard
        key="email"
        icon={Mail}
        label={t.email}
        value={<bdi dir="ltr">{contact.email}</bdi>}
        note={t.emailNote}
        action={t.emailAction}
        href={`mailto:${contact.email}`}
      />
    ),
    contact.phone && (
      <ChannelCard
        key="phone"
        icon={Phone}
        label={t.phone}
        // Phone numbers stay LTR inside Arabic text.
        value={<bdi dir="ltr">{contact.phone}</bdi>}
        note={t.phoneNote}
        action={t.phoneAction}
        href={telHref(contact.phone)}
      />
    ),
    addressLines.length > 0 && (
      <ChannelCard
        key="address"
        icon={MapPin}
        label={t.address}
        value={
          <address className="text-base not-italic">
            {addressLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        }
        note={t.addressNote}
        action={t.directions}
        href={mapsHref}
        newTab={t.newTab}
      />
    ),
  ].filter(Boolean);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
      <section aria-labelledby="contact-channels" className="min-w-0">
        <h2 id="contact-channels" className="sr-only">
          {t.channelsTitle}
        </h2>
        {channels.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {channels.map((card, index) => (
              <li
                key={index}
                // An odd card out spans the row instead of leaving a gap.
                className={cn(channels.length % 2 === 1 && index === 0 && "sm:col-span-2")}
              >
                {card}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4">
        {contact.hours && <BusinessHours hours={contact.hours} locale={locale} t={t} />}
        <OrderHelp locale={locale} t={t} />
        {contact.social.length > 0 && (
          <Panel icon={Share2} title={t.social} id="contact-social">
            <ul className="flex flex-wrap gap-2">
              {contact.social.map((profile) => (
                <li key={profile.platform}>
                  <a
                    href={profile.href}
                    {...external}
                    className={buttonClassName({ variant: "outline", size: "sm" })}
                  >
                    {SOCIAL_NAMES[profile.platform]}
                    <ArrowUpRight aria-hidden className="rtl:-scale-x-100" />
                    <span className="sr-only"> {t.newTab}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
