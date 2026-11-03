import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountSection, AccountSubpage } from "@/components/account/account-subpage";
import { PasswordReset } from "@/components/account/password-reset";
import { ProfileForm } from "@/components/auth/profile-form";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/navigation";
import { requireCustomer } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.account;
  return pageMetadata({
    locale,
    path: routes.profile,
    siteName: messages.site.name,
    title: t.profileTitle,
    description: t.profileDescription,
    index: false,
  });
}

/** Reads the session (DAL: active customers only), so it streams in. */
async function Profile() {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.account;
  const customer = await requireCustomer(locale);

  return (
    <div className="grid gap-6">
      <AccountSection id="profile-details" title={t.editTitle} description={t.editSubtitle}>
        <dl className="mb-6 grid gap-4 border-b pb-6 text-sm sm:grid-cols-2">
          <div className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">{t.email}</dt>
            <dd className="break-words">
              {customer.email ? <span dir="ltr">{customer.email}</span> : t.notProvided}
            </dd>
          </div>
          {customer.createdAt && (
            <div className="grid gap-0.5">
              <dt className="text-xs text-muted-foreground">{t.memberSince}</dt>
              <dd>{formatDateTime(customer.createdAt, locale, { dateStyle: "long" })}</dd>
            </div>
          )}
        </dl>
        <ProfileForm initial={{ fullName: customer.fullName ?? "", phone: customer.phone ?? "" }} />
      </AccountSection>

      {customer.email && (
        <AccountSection id="profile-password" title={t.passwordTitle} description={t.passwordBody}>
          <PasswordReset email={customer.email} />
        </AccountSection>
      )}

      <AccountSection id="profile-sign-out" title={t.signOutTitle} description={t.signOutBody}>
        <SignOutButton />
      </AccountSection>
    </div>
  );
}

export default async function ProfilePage() {
  const messages = await getMessages();
  const t = messages.account;
  return (
    <AccountSubpage title={t.profileTitle} subtitle={t.profileDescription} narrow>
      <Suspense fallback={<PageSkeleton label={t.loading} />}>
        <Profile />
      </Suspense>
    </AccountSubpage>
  );
}
