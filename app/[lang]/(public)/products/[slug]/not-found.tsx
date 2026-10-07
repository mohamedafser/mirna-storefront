import { PackageX } from "lucide-react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { getLocale, getMessages } from "@/lib/i18n/server";

/** Unknown, inactive or malformed product slug (notFound() in the page). */
export default async function ProductNotFound() {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.product;
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4 py-12">
      <StatusState
        icon={PackageX}
        headingLevel="h1"
        title={t.notFoundTitle}
        description={t.notFoundBody}
        action={
          <>
            <Link href={localizedHref(locale, routes.products)} className={buttonClassName()}>
              {t.backToProducts}
            </Link>
            <Link
              href={localizedHref(locale, routes.home)}
              className={buttonClassName({ variant: "outline" })}
            >
              {messages.common.backToHome}
            </Link>
          </>
        }
      />
    </div>
  );
}
