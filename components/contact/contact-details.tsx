import {
  ArrowUpRight,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
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
import {
  getStoreContact,
  hasContactDetails,
  SOCIAL_NAMES,
  telHref,
  whatsappHref,
  WEEKDAYS,
  type StoreContact,
} from "@/lib/store/contact";
import { RetryButton } from "./retry-button";

/** One contact channel: icon, caps label, the value and an optional action link. */
function Channel({
  icon: Icon,
  label,
  children,
  action,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="flex gap-4 p-5 sm:p-6">
      <Icon
        aria-hidden
        strokeWidth={1.25}
        className="mt-0.5 size-5 shrink-0 text-muted-foreground"
      />
      <div className="min-w-0 flex-1">
        <h2 className="caps text-[0.6875rem] font-medium text-muted-foreground">{label}</h2>
        <div className="mt-2 text-sm leading-relaxed">{children}</div>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </Card>
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
  labels,
}: {
  hours: NonNullable<StoreContact["hours"]>;
  locale: Locale;
  labels: { title: string; closed: string };
}) {
  // 2024-01-01 was a Monday; names come from Intl in the visitor's language.
  const weekday = new Intl.DateTimeFormat(toIntlLocale(locale), {
    weekday: "long",
    timeZone: "UTC",
  });
  return (
    <Channel icon={Clock} label={labels.title}>
      <dl className="grid gap-y-2">
        {WEEKDAYS.map((day, index) => {
          const value = hours[day];
          return (
            <div key={day} className="flex items-baseline justify-between gap-4">
              <dt>{weekday.format(Date.UTC(2024, 0, 1 + index))}</dt>
              <dd className={value ? "text-end tabular-nums" : "text-end text-muted-foreground"}>
                {value ? (
                  <bdi>
                    {timeLabel(value.open, locale)} – {timeLabel(value.close, locale)}
                  </bdi>
                ) : (
                  labels.closed
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Channel>
  );
}

/** Loading state matching the details layout. */
export function ContactDetailsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="mt-12 grid gap-4 sm:mt-16 lg:grid-cols-2">
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i} className="flex gap-4 p-5 sm:p-6">
          <Skeleton className="size-5 shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-3 h-3 w-48 max-w-full" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/**
 * The published contact details (mirna-admin Settings → Contact information).
 * Only configured channels are shown; nothing published shows an empty state,
 * and a failed read shows an error with a retry.
 */
export async function ContactDetails() {
  const [locale, messages, { status, contact }] = await Promise.all([
    getLocale(),
    getMessages(),
    getStoreContact(),
  ]);
  const t = messages.pages.contact;

  if (status === "error") {
    return (
      <Card className="mt-12 px-6 sm:mt-16">
        <StatusState
          icon={TriangleAlert}
          tone="error"
          title={t.errorTitle}
          description={t.errorBody}
          className="py-16 sm:py-24"
          action={<RetryButton label={messages.common.retry} />}
        />
      </Card>
    );
  }

  if (!hasContactDetails(contact)) {
    return (
      <Card className="mt-12 px-6 sm:mt-16">
        <StatusState
          icon={Mail}
          title={t.emptyTitle}
          description={t.emptyBody}
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
      </Card>
    );
  }

  const addressLines = [
    ...contact.address,
    ...(contact.countryCode ? [countryName(contact.countryCode, locale)] : []),
  ];
  const mapsHref =
    addressLines.length > 0
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLines.join(", "))}`
      : null;
  const external = { target: "_blank", rel: "noopener noreferrer" } as const;
  const actionClassName = buttonClassName({ variant: "outline", size: "sm" });
  const newTab = <span className="sr-only"> {t.newTab}</span>;

  return (
    <div className="mt-12 grid items-start gap-4 sm:mt-16 lg:grid-cols-2">
      <div className="grid gap-4">
        {contact.email && (
          <Channel
            icon={Mail}
            label={t.email}
            action={
              <a href={`mailto:${contact.email}`} className={actionClassName}>
                {t.emailAction}
              </a>
            }
          >
            <bdi dir="ltr" className="break-all">
              {contact.email}
            </bdi>
          </Channel>
        )}
        {contact.phone && (
          <Channel
            icon={Phone}
            label={t.phone}
            action={
              <a href={telHref(contact.phone)} className={actionClassName}>
                {t.phoneAction}
              </a>
            }
          >
            {/* Phone numbers stay LTR inside Arabic text. */}
            <bdi dir="ltr">{contact.phone}</bdi>
          </Channel>
        )}
        {contact.whatsapp && (
          <Channel
            icon={MessageCircle}
            label={t.whatsapp}
            action={
              <a href={whatsappHref(contact.whatsapp)} {...external} className={actionClassName}>
                {t.whatsappAction}
                <ArrowUpRight aria-hidden className="rtl:-scale-x-100" />
                {newTab}
              </a>
            }
          >
            <bdi dir="ltr">{contact.whatsapp}</bdi>
          </Channel>
        )}
        {addressLines.length > 0 && (
          <Channel
            icon={MapPin}
            label={t.address}
            action={
              mapsHref && (
                <a href={mapsHref} {...external} className={actionClassName}>
                  {t.directions}
                  <ArrowUpRight aria-hidden className="rtl:-scale-x-100" />
                  {newTab}
                </a>
              )
            }
          >
            <address className="not-italic">
              {addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </Channel>
        )}
      </div>

      {(contact.hours || contact.social.length > 0) && (
        <div className="grid gap-4">
          {contact.hours && (
            <BusinessHours
              hours={contact.hours}
              locale={locale}
              labels={{ title: t.hours, closed: t.closed }}
            />
          )}
          {contact.social.length > 0 && (
            <Channel icon={Share2} label={t.social}>
              <ul className="flex flex-wrap gap-2">
                {contact.social.map((profile) => (
                  <li key={profile.platform}>
                    <a href={profile.href} {...external} className={actionClassName}>
                      {SOCIAL_NAMES[profile.platform]}
                      <ArrowUpRight aria-hidden className="rtl:-scale-x-100" />
                      {newTab}
                    </a>
                  </li>
                ))}
              </ul>
            </Channel>
          )}
        </div>
      )}
    </div>
  );
}
