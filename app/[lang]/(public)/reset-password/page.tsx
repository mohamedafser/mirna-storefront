import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell, FormSkeleton } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { buttonClassName } from "@/components/ui/button";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { readResetToken } from "@/lib/auth/otp-flow";
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
 * The form appears only after a correct reset code (which sets the token's
 * cookie, for 10 minutes). Anyone else is sent to request one. mirna-admin
 * checks the token itself when the form is submitted, and it works only once.
 */
async function ResetGate() {
  const [locale, messages, token] = await Promise.all([
    getLocale(),
    getMessages(),
    readResetToken(),
  ]);
  if (token) return <ResetPasswordForm />;

  const t = messages.auth;
  return (
    <StatusState
      icon={KeyRound}
      title={t.resetMissingTitle}
      description={t.resetMissingBody}
      className="py-4"
      action={
        <Link
          href={localizedHref(locale, routes.forgotPassword)}
          className={buttonClassName({ variant: "primary" })}
        >
          {t.requestNewCode}
        </Link>
      }
    />
  );
}

export default async function ResetPasswordPage() {
  const messages = await getMessages();
  return (
    <AuthShell title={messages.auth.resetTitle} subtitle={messages.auth.resetSubtitle}>
      {/* Reads a cookie, so it streams in behind the static shell. */}
      <Suspense fallback={<FormSkeleton label={messages.common.loading} />}>
        <ResetGate />
      </Suspense>
    </AuthShell>
  );
}
