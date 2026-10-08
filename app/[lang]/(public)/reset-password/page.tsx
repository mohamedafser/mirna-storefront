import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell, FormSkeleton } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { buttonClassName } from "@/components/ui/button";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { getCurrentCustomer } from "@/lib/auth/dal";
import { isRecoveryFor } from "@/lib/auth/recovery";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return pageMetadata({
    locale,
    path: routes.resetPassword,
    siteName: messages.site.name,
    title: messages.auth.resetTitle,
    description: messages.auth.resetSubtitle,
    index: false,
  });
}

/**
 * The form appears only for a session opened from a reset email
 * (app/[lang]/auth/confirm); anyone else, including an expired or reused
 * link, sees "invalid or expired" with a way to request a new one.
 */
async function ResetGate() {
  const [locale, messages, user] = await Promise.all([
    getLocale(),
    getMessages(),
    getCurrentCustomer(),
  ]);
  if (user && (await isRecoveryFor(user.id))) return <ResetPasswordForm />;

  const t = messages.auth;
  return (
    <StatusState
      icon={LinkIcon}
      title={t.linkInvalidTitle}
      description={t.linkInvalidBody}
      className="py-4"
      action={
        <Link
          href={localizedHref(locale, routes.forgotPassword)}
          className={buttonClassName({ variant: "primary" })}
        >
          {t.requestNewLink}
        </Link>
      }
    />
  );
}

export default async function ResetPasswordPage() {
  const messages = await getMessages();
  return (
    <AuthShell title={messages.auth.resetTitle} subtitle={messages.auth.resetSubtitle}>
      {/* Reads the session, so it streams in behind the static shell. */}
      <Suspense fallback={<FormSkeleton label={messages.common.loading} />}>
        <ResetGate />
      </Suspense>
    </AuthShell>
  );
}
