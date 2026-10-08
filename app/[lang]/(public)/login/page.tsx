import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell, FormSkeleton } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { routes } from "@/config/navigation";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return pageMetadata({
    locale,
    path: routes.login,
    siteName: messages.site.name,
    title: messages.auth.loginTitle,
    description: messages.auth.loginSubtitle,
    index: false,
  });
}

// Static shell; signed-in visitors are sent to /account by proxy.ts.
export default async function LoginPage() {
  const messages = await getMessages();
  return (
    <AuthShell title={messages.auth.loginTitle} subtitle={messages.auth.loginSubtitle}>
      {/* The form reads ?redirect= and ?error= (useSearchParams), so it streams in. */}
      <Suspense fallback={<FormSkeleton label={messages.common.loading} />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
