import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell, FormSkeleton } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { routes } from "@/config/navigation";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return pageMetadata({
    locale,
    path: routes.forgotPassword,
    siteName: messages.site.name,
    title: messages.auth.forgotTitle,
    description: messages.auth.forgotSubtitle,
    index: false,
  });
}

// Static shell; the form reads ?error= (an expired reset link) on the client.
export default async function ForgotPasswordPage() {
  const messages = await getMessages();
  return (
    <AuthShell title={messages.auth.forgotTitle} subtitle={messages.auth.forgotSubtitle}>
      <Suspense fallback={<FormSkeleton label={messages.common.loading} fields={1} />}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
