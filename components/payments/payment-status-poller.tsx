"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const INTERVAL_MS = 3000;
const MAX_CHECKS = 20;

/**
 * While a payment is being confirmed, asks the server for its status
 * (GET /api/orders/[id]/payment) every few seconds for about a minute. That
 * endpoint confirms the order as soon as Stripe reports it paid; once the
 * state changes, the page re-renders from the server. The status shown is
 * always the server's: this only asks again.
 */
export function PaymentStatusPoller({
  orderId,
  slowMessage,
}: {
  orderId: string;
  slowMessage: string;
}) {
  const router = useRouter();
  const [checks, setChecks] = useState(0);

  useEffect(() => {
    if (checks >= MAX_CHECKS) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/payment`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as { ok?: boolean; state?: string };
        if (body.ok && body.state !== "confirming") {
          router.refresh();
          return;
        }
      } catch {
        // Offline or aborted: try again on the next tick.
      }
      setChecks((count) => count + 1);
    }, INTERVAL_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [checks, orderId, router]);

  return checks >= MAX_CHECKS ? (
    <p role="status" className="mt-3 text-sm text-muted-foreground">
      {slowMessage}
    </p>
  ) : null;
}
