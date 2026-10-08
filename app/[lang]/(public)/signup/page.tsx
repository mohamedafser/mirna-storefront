import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { routes } from "@/config/navigation";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return pageMetadata({
    locale,
    path: routes.signup,
    siteName: messages.site.name,
    title: messages.auth.signupTitle,
    description: messages.auth.signupSubtitle,
    index: false,
  });
}

// Static shell; signed-in visitors are sent to /account by proxy.ts.
export default async function SignupPage() {
  const messages = await getMessages();
  return (
    <AuthShell title={messages.auth.signupTitle} subtitle={messages.auth.signupSubtitle}>
      <SignupForm />
    </AuthShell>
  );
}
