import { SearchX } from "lucide-react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { getLocale, getMessages } from "@/lib/i18n/server";

/** Localized 404 body (inside the storefront header/footer). */
export async function NotFoundContent() {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4 py-12">
      <StatusState
        icon={SearchX}
        headingLevel="h1"
        title={messages.errors.notFoundTitle}
        description={messages.errors.notFoundBody}
        action={
          <>
            <Link href={localizedHref(locale, routes.home)} className={buttonClassName()}>
              {messages.common.backToHome}
            </Link>
            <Link
              href={localizedHref(locale, routes.products)}
              className={buttonClassName({ variant: "outline" })}
            >
              {messages.nav.shop}
            </Link>
          </>
        }
      />
    </div>
  );
}
