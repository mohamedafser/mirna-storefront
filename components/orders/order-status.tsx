import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils/cn";
import type { OrderStatus } from "@/types/domain";

const TONES: Record<OrderStatus, "neutral" | "primary" | "success" | "error"> = {
  PENDING: "neutral",
  CONFIRMED: "primary",
  PROCESSING: "primary",
  SHIPPED: "primary",
  DELIVERED: "success",
  CANCELLED: "error",
  REFUNDED: "neutral",
};

/** The normal path of an order; CANCELLED / REFUNDED leave it. */
const STEPS = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export function OrderStatusBadge({ status, t }: { status: OrderStatus; t: Messages["orders"] }) {
  return <Badge tone={TONES[status]}>{t.status[status]}</Badge>;
}

/**
 * Where the order is on its way to the customer. Read-only: the status is
 * changed by the store (mirna-admin), never here. Stacked on phones, a row
 * from `sm` up; the row follows the reading direction.
 */
export function OrderProgress({ status, t }: { status: OrderStatus; t: Messages["orders"] }) {
  if (status === "CANCELLED" || status === "REFUNDED") {
    return (
      <p className="border-s-2 border-error/60 ps-4 text-sm text-muted-foreground">
        {status === "CANCELLED" ? t.cancelledNote : t.refundedNote}
      </p>
    );
  }

  const current = STEPS.indexOf(status);
  return (
    <ol aria-label={t.progressLabel} className="grid gap-3 sm:grid-cols-5 sm:gap-2">
      {STEPS.map((step, index) => {
        const done = index < current || status === "DELIVERED";
        const isCurrent = index === current;
        const state = done ? t.stepDone : isCurrent ? t.stepCurrent : null;
        return (
          <li
            key={step}
            aria-current={isCurrent ? "step" : undefined}
            className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2"
          >
            <span className="flex w-full items-center gap-2 max-sm:w-auto">
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.625rem]",
                  done || isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                aria-hidden
                className={cn(
                  "hidden h-px flex-1 sm:block",
                  index === STEPS.length - 1 && "sm:hidden",
                  index < current ? "bg-primary" : "bg-border",
                )}
              />
            </span>
            <span
              className={cn(
                "text-xs",
                isCurrent ? "font-semibold" : done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t.status[step]}
              {state && <span className="sr-only"> ({state})</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
