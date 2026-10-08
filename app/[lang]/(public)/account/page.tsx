import { ShieldAlert, UserRoundX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { FormMessage } from "@/components/auth/form-controls";
import { ProfileForm } from "@/components/auth/profile-form";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SectionHeading } from "@/components/home/section-heading";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageSkeleton } from "@/components/ui/skeleton";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { getCustomerAccess, requireUser } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/messages";
import { pageMetadata } from "@/lib/seo";

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

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card className="p-6 sm:p-8">
      <section aria-labelledby={id}>
        <h2 id={id} className="caps mb-6 text-xs font-medium">
          {title}
        </h2>
        {children}
      </section>
    </Card>
  );
}

/**
 * Everything personal. proxy.ts already sent signed-out visitors to /login;
 * this re-checks on the server (DAL) and only an active CUSTOMER sees data.
 */
async function AccountContent({
  searchParams,
}: {
  searchParams: PageProps<"/[lang]/account">["searchParams"];
}) {
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

  const { updated } = await searchParams;
  const details: { label: string; value: ReactNode; ltr?: boolean }[] = [
    { label: t.name, value: user.fullName || t.notProvided },
    { label: t.email, value: user.email ?? t.notProvided, ltr: Boolean(user.email) },
    { label: t.phone, value: user.phone || t.notProvided, ltr: Boolean(user.phone) },
    { label: t.status, value: <Badge tone="success">{t.customerActive}</Badge> },
    ...(user.createdAt
      ? [
          {
            label: t.memberSince,
            value: formatDateTime(user.createdAt, locale, { dateStyle: "long" }),
          },
        ]
      : []),
  ];

  return (
    <div className="grid gap-6">
      <p className="text-center text-sm">
        {user.fullName ? format(t.greeting, { name: user.fullName }) : t.greetingFallback}
      </p>
      {updated === "password" && <FormMessage tone="success">{t.passwordUpdated}</FormMessage>}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section id="account-details" title={t.detailsTitle}>
          <dl className="grid gap-4 text-sm">
            {details.map(({ label, value, ltr }) => (
              <div key={label} className="grid gap-1 border-b pb-4 last:border-b-0 last:pb-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                {/* Emails and phone numbers stay LTR inside Arabic text. */}
                <dd className="break-words">{ltr ? <span dir="ltr">{value}</span> : value}</dd>
              </div>
            ))}
          </dl>
          <SignOutButton className="mt-8" />
        </Section>

        <div className="grid gap-6">
          <Section id="account-orders" title={messages.orders.manageTitle}>
            <p className="text-sm text-muted-foreground">{messages.orders.manageBody}</p>
            <Link
              href={localizedHref(locale, routes.orders)}
              className={buttonClassName({ variant: "outline", className: "mt-6" })}
            >
              {messages.orders.manage}
            </Link>
          </Section>
          <Section id="account-edit" title={t.editTitle}>
            <p className="-mt-2 mb-6 text-sm text-muted-foreground">{t.editSubtitle}</p>
            <ProfileForm initial={{ fullName: user.fullName ?? "", phone: user.phone ?? "" }} />
          </Section>
          <Section id="account-addresses" title={messages.addresses.manageTitle}>
            <p className="text-sm text-muted-foreground">{messages.addresses.manageBody}</p>
            <Link
              href={localizedHref(locale, routes.addresses)}
              className={buttonClassName({ variant: "outline", className: "mt-6" })}
            >
              {messages.addresses.manage}
            </Link>
          </Section>
          <Section id="account-password" title={t.passwordTitle}>
            <p className="text-sm text-muted-foreground">{t.passwordBody}</p>
            <Link
              href={localizedHref(locale, routes.forgotPassword)}
              className={buttonClassName({ variant: "outline", className: "mt-6" })}
            >
              {t.changePassword}
            </Link>
          </Section>
        </div>
      </div>
    </div>
  );
}

export default async function AccountPage({ searchParams }: PageProps<"/[lang]/account">) {
  const messages = await getMessages();
  const t = messages.account;
  return (
    <Container className="py-16 sm:py-24">
      <SectionHeading as="h1" id="page-title" title={t.title} subtitle={t.description} />
      <div className="mx-auto mt-12 max-w-5xl sm:mt-16">
        {/* Reads the session, so it streams in behind the static page title. */}
        <Suspense fallback={<PageSkeleton label={t.loading} />}>
          <AccountContent searchParams={searchParams} />
        </Suspense>
      </div>
    </Container>
  );
}
