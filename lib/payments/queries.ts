import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "./stripe";
import { requestPaymentSync } from "./sync";

/**
 * Online payment, as the customer sees it (mirna-admin migration 044). Read
 * with the customer's session: order_payment_state() and the payments table
 * only return their own orders. Stripe is asked directly (server-side) only
 * to tell "you haven't paid" from "your payment is being confirmed" while a
 * webhook is on its way; nothing read here ever marks an order as paid —
 * only mirna-admin's verified webhooks do.
 */

export interface PaymentOptions {
  /** Orders placed now must be paid online. */
  enabled: boolean;
  /** Currencies online payment accepts while enabled. */
  currencies: string[];
}

/** Missing function / column: migration 044 isn't applied yet. */
function isMissing(error: { code?: string } | null): boolean {
  return ["PGRST202", "42883", "42703", "PGRST200", "PGRST205", "42P01"].includes(
    error?.code ?? "",
  );
}

export async function getPaymentOptions(): Promise<PaymentOptions> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkout_payment_options");
  if (error) {
    if (!isMissing(error)) console.error("[payments] options failed", error.code, error.message);
    return { enabled: false, currencies: [] };
  }
  const row = data[0];
  return { enabled: row?.enabled ?? false, currencies: row?.currencies ?? [] };
}

export type PaymentState =
  /** Not paid online (placed before 044 or while online payment was off). */
  | "none"
  | "awaiting"
  /** Submitted; Stripe / the webhook hasn't confirmed it yet. */
  | "confirming"
  | "failed"
  | "paid"
  | "partiallyRefunded"
  | "refunded"
  | "cancelled"
  /** Unpaid past its deadline (about to be cancelled). */
  | "expired"
  /** Can't be paid online right now (the store switched it off meanwhile). */
  | "unavailable";

export interface PaymentView {
  state: PaymentState;
  /** orders.status (CONFIRMED once paid); null when the order isn't paid online. */
  orderStatus: string | null;
  /** The customer can (still) pay or retry now. */
  canPay: boolean;
  dueAt: string | null;
  method: { brand: string | null; last4: string | null; wallet: string | null } | null;
}

const NONE: PaymentView = {
  state: "none",
  orderStatus: null,
  canPay: false,
  dueAt: null,
  method: null,
};

/**
 * `sync`: when Stripe already reports the payment as succeeded but the
 * database doesn't know yet (webhook delayed or not configured), ask
 * mirna-admin to sync it now and read again, so the order is confirmed
 * without waiting. Done once per call.
 */
export async function getOrderPaymentView(
  orderId: string,
  { sync = true }: { sync?: boolean } = {},
): Promise<PaymentView> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("order_payment_state", { p_order_id: orderId });
  if (error) {
    if (isMissing(error)) return NONE;
    console.error("[payments] state failed", error.code, error.message);
    throw new Error("Unable to load payment");
  }
  const row = data[0];
  if (!row || row.payment_status === null) return NONE;

  const { data: payment } = await supabase
    .from("payments")
    .select("card_brand, card_last4, wallet")
    .eq("order_id", orderId)
    .in("status", ["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "PROCESSING"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const method = payment
    ? { brand: payment.card_brand, last4: payment.card_last4, wallet: payment.wallet }
    : null;
  const view = (state: PaymentState): PaymentView => ({
    state,
    orderStatus: row.order_status,
    canPay: row.payable && (state === "awaiting" || state === "failed"),
    dueAt: row.payment_due_at,
    method,
  });

  switch (row.payment_status) {
    case "PAID":
      return view("paid");
    case "PARTIALLY_REFUNDED":
      return view("partiallyRefunded");
    case "REFUNDED":
      return view("refunded");
    case "CANCELLED":
      return view("cancelled");
    case "PROCESSING":
      return view("confirming");
  }
  if (row.order_status === "CANCELLED") return view("cancelled");

  // PENDING / FAILED: has the customer just paid (webhook still on its way)?
  const stripe = getStripe();
  if (row.payment_intent_id && stripe) {
    try {
      const intent = await stripe.paymentIntents.retrieve(row.payment_intent_id);
      if (
        intent.metadata?.order_id === orderId &&
        ["processing", "succeeded", "requires_capture"].includes(intent.status)
      ) {
        // Paid at Stripe: have mirna-admin apply it now, then show the result.
        if (sync && intent.status !== "processing" && (await requestPaymentSync(intent.id))) {
          return getOrderPaymentView(orderId, { sync: false });
        }
        return view("confirming");
      }
    } catch (stripeError) {
      console.error("[payments] intent lookup failed", stripeError);
    }
  }
  if (!row.payable) {
    const overdue = row.payment_due_at !== null && new Date(row.payment_due_at) <= new Date();
    return view(overdue ? "expired" : "unavailable");
  }
  return view(row.payment_status === "FAILED" ? "failed" : "awaiting");
}
