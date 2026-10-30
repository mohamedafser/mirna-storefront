import { ChevronRight, Package, ShieldAlert, UserRoundX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  AccountHeader,
  AccountSection,
  sectionLinkClassName,
} from "@/components/account/account-subpage";
import { countryName, regionName } from "@/components/addresses/address-format";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { OrderStatusBadge } from "@/components/orders/order-status";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { listAddresses } from "@/lib/addresses/queries";
import { getCustomerAccess, requireUser } from "@/lib/auth/dal";
import { formatDateTime, formatPrice, toIntlLocale } from "@/lib/format";
import { format, plural } from "@/lib/i18n/messages";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { listCustomerOrders } from "@/lib/orders/queries";
import { pageMetadata } from "@/lib/seo";

const RECENT_ORDERS = 3;

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.account;
  return pageMetadata({
    locale,
    path: routes.account,
    siteName: messages.site.name,
    title: t.title,
    description: t.description,
    index: false,
  });
}

/**
 * The account overview: greeting, recent orders, default address and
 * profile at a glance, each linking to its own page (the account menu has
 * them all too). proxy.ts already sent signed-out visitors to /login; this
 * re-checks on the server (DAL) and only an active CUSTOMER sees data.
 */
async function Overview() {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.account;
  const user = await requireUser(locale);
  const access = getCustomerAccess(user);

  if (access !== "granted") {
    // Staff or deactivated account: nothing from the profile is shown.
    return (
      <Card className="px-6">
        <StatusState
          icon={access === "staff" ? ShieldAlert : UserRoundX}
          title={access === "staff" ? t.staffTitle : t.inactiveTitle}
          description={access === "staff" ? t.staffBody : t.inactiveBody}
          className="py-16"
          action={<SignOutButton />}
        />
      </Card>
    );
  }

  const [orders, addresses] = await Promise.all([
    listCustomerOrders(user.id, 1),
    listAddresses(user.id),
  ]);
  const recent = orders.orders.slice(0, RECENT_ORDERS);
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const numberFormat = new Intl.NumberFormat(toIntlLocale(locale), { useGrouping: false });
  const o = messages.orders;
  const listSeparator = locale === "ar" ? "، " : ", ";

  return (
    <div className="grid gap-6">
      <p className="text-xl sm:text-2xl">
        {user.fullName ? format(t.greeting, { name: user.fullName }) : t.greetingFallback}
      </p>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <AccountSection
          id="account-orders"
          title={t.recentOrdersTitle}
          action={
            orders.total > 0 && (
              <Link href={localizedHref(locale, routes.orders)} className={sectionLinkClassName}>
                {t.viewAllOrders}
              </Link>
            )
          }
        >
          {recent.length === 0 ? (
            <StatusState
              icon={Package}
              title={o.emptyTitle}
              description={t.noOrdersBody}
              className="py-6"
              action={
                <Link href={localizedHref(locale, routes.products)} className={buttonClassName()}>
                  {o.startShopping}
                </Link>
              }
            />
          ) : (
            <ul aria-label={o.listLabel} className="-my-4 divide-y">
              {recent.map((order) => {
                const number = `#${numberFormat.format(order.orderNumber)}`;
                return (
                  <li key={order.id} className="relative flex items-center gap-4 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        {/* The whole row is clickable through this link. */}
                        <Link
                          href={localizedHref(locale, routes.order(order.id))}
                          aria-label={format(o.viewOrderLabel, { number })}
                          className="text-sm font-semibold tabular-nums after:absolute after:inset-0"
                        >
                          {format(o.orderNumber, { number })}
                        </Link>
                        <OrderStatusBadge status={order.status} t={o} />
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(order.createdAt, locale, { dateStyle: "medium" })}
                        {" · "}
                        {plural(locale, order.itemCount, o.itemCount)}
                      </p>
                    </div>
                    <p className="text-sm font-medium tabular-nums">
                      {formatPrice(order.total, locale, order.currencyCode)}
                    </p>
                    <ChevronRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </AccountSection>

        <div className="grid gap-6">
          <AccountSection
            id="account-profile"
            title={t.profileTitle}
            action={
              <Link href={localizedHref(locale, routes.profile)} className={sectionLinkClassName}>
                {t.editProfile}
              </Link>
            }
          >
            <dl className="grid gap-3 text-sm">
              {[
                { label: t.name, value: user.fullName },
                { label: t.email, value: user.email, ltr: true },
                { label: t.phone, value: user.phone, ltr: true },
              ].map(({ label, value, ltr }) => (
                <div key={label} className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  {/* Emails and phone numbers stay LTR inside Arabic text. */}
                  <dd className="break-words">
                    {value ? ltr ? <span dir="ltr">{value}</span> : value : t.notProvided}
                  </dd>
                </div>
              ))}
            </dl>
          </AccountSection>

          <AccountSection
            id="account-address"
            title={t.defaultAddressTitle}
            action={
              addresses.length > 0 && (
                <Link
                  href={localizedHref(locale, routes.addresses)}
                  className={sectionLinkClassName}
                >
                  {t.manageAddresses}
                </Link>
              )
            }
            description={defaultAddress ? undefined : t.noAddressBody}
          >
            {defaultAddress ? (
              <>
                <address className="grid gap-0.5 text-sm not-italic">
                  <span className="font-medium">{defaultAddress.fullName}</span>
                  <span className="text-muted-foreground">
                    {[defaultAddress.line1, defaultAddress.line2]
                      .filter(Boolean)
                      .join(listSeparator)}
                  </span>
                  <span className="text-muted-foreground">
                    {[
                      defaultAddress.city,
                      regionName(defaultAddress, messages.addresses),
                      countryName(defaultAddress.countryCode, locale),
                    ]
                      .filter(Boolean)
                      .join(listSeparator)}
                  </span>
                </address>
                <p className="mt-3 text-xs text-muted-foreground">
                  {plural(locale, addresses.length, t.addressesCount)}
                </p>
              </>
            ) : (
              <Link
                href={localizedHref(locale, routes.newAddress)}
                className={buttonClassName({ variant: "outline" })}
              >
                {t.addAddress}
              </Link>
            )}
          </AccountSection>
        </div>
      </div>
    </div>
  );
}

/** "Signed in as …" under the page title. */
async function SignedInAs() {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const user = await requireUser(locale);
  // Isolated so an email stays LTR inside Arabic text.
  return user.email
    ? format(messages.account.signedInAs, { email: `\u2068${user.email}\u2069` })
    : messages.account.description;
}

export default async function AccountPage() {
  const messages = await getMessages();
  const t = messages.account;
  return (
    <div className="grid gap-8">
      <AccountHeader
        title={t.title}
        subtitle={
          <Suspense fallback={t.description}>
            <SignedInAs />
          </Suspense>
        }
      />
      {/* Reads the session, so it streams in behind the static page title. */}
      <Suspense fallback={<PageSkeleton label={t.loading} />}>
        <Overview />
      </Suspense>
    </div>
  );
}
