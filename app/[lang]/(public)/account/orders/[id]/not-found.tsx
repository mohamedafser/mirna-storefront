import { SearchX } from "lucide-react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { getLocale, getMessages } from "@/lib/i18n/server";

// notFound() from the order page: a malformed id, or an order that isn't the
// signed-in customer's (RLS hides it, so it looks the same as a missing one).
export default async function OrderNotFound() {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.orders;
  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4 py-12">
      <StatusState
        icon={SearchX}
        headingLevel="h1"
        title={t.notFoundTitle}
        description={t.notFoundBody}
        action={
          <Link href={localizedHref(locale, routes.orders)} className={buttonClassName()}>
            {t.backToOrders}
          </Link>
        }
      />
    </div>
  );
}
