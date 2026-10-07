"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { StatusState } from "@/components/ui/states";
import { localizedHref, routes } from "@/config/navigation";
import { useI18n } from "@/lib/i18n/client";

/** Body of the error boundaries. Generic message only: details are never shown. */
export function ErrorView({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { locale, messages } = useI18n();

  useEffect(() => {
    // Replace with an error-reporting service in a later phase.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4 py-12">
      <StatusState
        icon={TriangleAlert}
        tone="error"
        headingLevel="h1"
        title={messages.errors.unexpectedTitle}
        description={messages.errors.unexpectedBody}
        action={
          <>
            <Button onClick={() => retry()}>{messages.common.retry}</Button>
            {/* Plain <a>: a full reload recovers even if client state is broken. */}
            <a
              href={localizedHref(locale, routes.home)}
              className={buttonClassName({ variant: "outline" })}
            >
              {messages.common.backToHome}
            </a>
          </>
        }
      />
    </div>
  );
}
