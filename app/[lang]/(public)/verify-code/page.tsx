import { MailQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { authLinkClassName, AuthShell, FormSkeleton } from "@/components/auth/auth-shell";
import { OtpForm } from "@/components/auth/otp-form";
import { buttonClassName } from "@/components/ui/button";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { readOtpFlow } from "@/lib/auth/otp-flow";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { format } from "@/lib/i18n/messages";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return pageMetadata({
    locale,
    path: routes.verifyCode,
    siteName: messages.site.name,
    title: messages.auth.verifyTitle,
    description: messages.auth.verifySubtitle,
    index: false,
  });
}

/**
 * Which code is being entered comes from an httpOnly cookie set when it was
 * requested (lib/auth/otp-flow.ts), never from the URL.
 */
async function VerifyGate() {
  const [locale, messages, flow] = await Promise.all([getLocale(), getMessages(), readOtpFlow()]);
  const t = messages.auth;

  if (!flow) {
    return (
      <StatusState
        icon={MailQuestion}
        title={t.verifyMissingTitle}
        description={t.verifyMissingBody}
        className="py-4"
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={localizedHref(locale, routes.signup)}
              className={buttonClassName({ variant: "outline" })}
            >
              {t.signupAgain}
            </Link>
            <Link
              href={localizedHref(locale, routes.forgotPassword)}
              className={buttonClassName({ variant: "outline" })}
            >
              {t.requestNewCode}
            </Link>
          </div>
        }
      />
    );
  }

  const isSignup = flow.purpose === "signup";
  return (
    <div className="grid gap-5">
      <p role="status" className="text-sm text-muted-foreground">
        {format(isSignup ? t.verifySignupBody : t.verifyRecoveryBody, {
          email: `⁨${flow.email}⁩`,
        })}
      </p>
      <OtpForm />
      <p className="text-center text-sm">
        <Link
          href={localizedHref(locale, isSignup ? routes.signup : routes.forgotPassword)}
          className={authLinkClassName}
        >
          {t.startOver}
        </Link>
      </p>
    </div>
  );
}

export default async function VerifyCodePage() {
  const messages = await getMessages();
  return (
    <AuthShell title={messages.auth.verifyTitle} subtitle={messages.auth.verifySubtitle}>
      {/* Reads a cookie, so it streams in behind the static shell. */}
      <Suspense fallback={<FormSkeleton label={messages.common.loading} fields={1} />}>
        <VerifyGate />
      </Suspense>
    </AuthShell>
  );
}
