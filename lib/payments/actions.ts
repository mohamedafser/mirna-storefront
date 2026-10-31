"use server";

import type Stripe from "stripe";
import { getCustomerOrNull } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/uuid";
import { stripeAmount } from "./amount";
import { getStripe, isStripeError } from "./stripe";

/**
 * Starts (or resumes) paying one of the customer's own orders and returns
 * the PaymentIntent's client secret for the Payment Element.
 *
 * Nothing about the amount comes from the browser: the order id is the only
 * input. order_payment_state() (mirna-admin migration 044) checks the order
 * is the session's customer's, still payable, and returns its total in minor
 * units, computed in the database from the stored order. The PaymentIntent
 * carries the order id in its metadata, which the webhook checks before
 * anything is marked paid.
 *
 * Duplicates: a live PaymentIntent is reused (a retry after a declined card
 * uses the same one, as Stripe recommends), and creation uses a per-order
 * idempotency key, so two tabs or a double click get the same PaymentIntent.
 * attach_payment_intent() also refuses a second live payment for an order.
 */

export type StartPaymentError =
  "signedOut" | "notFound" | "notPayable" | "expired" | "unavailable" | "unexpected";

export type StartPaymentResult =
  | { status: "ready"; clientSecret: string }
  /** Paid or being confirmed: show the confirmation page. */
  | { status: "done" }
  | { status: "error"; error: StartPaymentError };

const REUSABLE: readonly Stripe.PaymentIntent.Status[] = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
];
const SUBMITTED: readonly Stripe.PaymentIntent.Status[] = [
  "processing",
  "succeeded",
  "requires_capture",
];

type OrderState = {
  order_id: string;
  order_number: number;
  order_status: string;
  payment_status: string | null;
  currency_code: string;
  currency_decimals: number | null;
  amount_minor: number | null;
  payment_due_at: string | null;
  payable: boolean;
  payment_intent_id: string | null;
  customer_email: string | null;
};

async function readState(orderId: string): Promise<OrderState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("order_payment_state", { p_order_id: orderId });
  if (error) throw new Error(`order_payment_state failed: ${error.code} ${error.message}`);
  return data[0] ?? null;
}

/** An existing PaymentIntent, if it really is this order's, for its exact amount. */
function matches(intent: Stripe.PaymentIntent, state: OrderState, amount: number): boolean {
  return (
    intent.metadata?.order_id === state.order_id &&
    intent.amount === amount &&
    intent.currency === state.currency_code.toLowerCase()
  );
}

/**
 * The customer's Stripe Customer (email, name, phone), so the Dashboard's
 * payments list and Customers page show who paid, and receipts and refunds
 * are linked to them. Found by email and our user id (metadata), else
 * created; the idempotency key stops two tabs creating two. Optional: on a
 * Stripe error the payment goes ahead without one (receipt_email is still
 * set), as before.
 */
async function stripeCustomerId(
  stripe: Stripe,
  customer: { id: string; email: string | null; fullName: string | null; phone: string | null },
): Promise<string | undefined> {
  if (!customer.email) return undefined;
  try {
    const existing = await stripe.customers.list({ email: customer.email, limit: 20 });
    const match = existing.data.find((c) => c.metadata?.user_id === customer.id);
    if (match) return match.id;
    const created = await stripe.customers.create(
      {
        email: customer.email,
        name: customer.fullName ?? undefined,
        phone: customer.phone ?? undefined,
        metadata: { user_id: customer.id },
      },
      { idempotencyKey: `mirna-customer-${customer.id}` },
    );
    return created.id;
  } catch (error) {
    console.error(
      "[payments] Stripe customer lookup failed",
      isStripeError(error) ? `${error.code ?? "-"} ${error.message}` : error,
    );
    return undefined;
  }
}

function resume(intent: Stripe.PaymentIntent): StartPaymentResult {
  if (SUBMITTED.includes(intent.status)) return { status: "done" };
  if (REUSABLE.includes(intent.status) && intent.client_secret) {
    return { status: "ready", clientSecret: intent.client_secret };
  }
  return { status: "error", error: "notPayable" };
}

export async function startPayment(orderId: unknown): Promise<StartPaymentResult> {
  if (!isUuid(orderId)) return { status: "error", error: "notFound" };
  const customer = await getCustomerOrNull();
  if (!customer) return { status: "error", error: "signedOut" };
  const stripe = getStripe();
  if (!stripe || !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    console.error("[payments] STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing");
    return { status: "error", error: "unavailable" };
  }

  try {
    const state = await readState(orderId);
    if (!state || state.payment_status === null) return { status: "error", error: "notFound" };
    if (["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "PROCESSING"].includes(state.payment_status)) {
      return { status: "done" };
    }
    if (!state.payable) {
      const overdue = state.payment_due_at !== null && new Date(state.payment_due_at) <= new Date();
      return { status: "error", error: overdue ? "expired" : "notPayable" };
    }
    const amount = stripeAmount(state.currency_code, state.currency_decimals, state.amount_minor);
    if (amount === null) {
      console.error(
        `[payments] order ${orderId}: ${state.currency_code} decimals don't match Stripe's`,
      );
      return { status: "error", error: "unavailable" };
    }

    if (state.payment_intent_id) {
      let intent = await stripe.paymentIntents.retrieve(state.payment_intent_id);
      if (!matches(intent, state, amount)) {
        console.error(`[payments] order ${orderId}: linked PaymentIntent doesn't match the order`);
        return { status: "error", error: "unexpected" };
      }
      // Created before customers were attached: attach one while it can still change.
      if (!intent.customer && REUSABLE.includes(intent.status)) {
        const stripeCustomer = await stripeCustomerId(stripe, customer);
        if (stripeCustomer) {
          intent = await stripe.paymentIntents.update(intent.id, { customer: stripeCustomer });
        }
      }
      return resume(intent);
    }

    const stripeCustomer = await stripeCustomerId(stripe, customer);

    const intent = await stripe.paymentIntents.create(
      {
        amount,
        currency: state.currency_code.toLowerCase(),
        // Cards, Apple Pay / Google Pay and anything else switched on in
        // the Stripe Dashboard that supports this currency; 3D Secure is
        // requested by Stripe whenever the card or regulation needs it.
        automatic_payment_methods: { enabled: true },
        description: `Mirna order #${state.order_number}`,
        customer: stripeCustomer,
        receipt_email: state.customer_email ?? customer.email ?? undefined,
        metadata: {
          order_id: state.order_id,
          order_number: String(state.order_number),
          user_id: customer.id,
        },
      },
      // v2: the parameters gained `customer` (a key replayed with different
      // parameters is an error at Stripe).
      { idempotencyKey: `mirna-order-${state.order_id}-v2` },
    );

    const supabase = await createClient();
    const { error } = await supabase.rpc("attach_payment_intent", {
      p_order_id: state.order_id,
      p_payment_intent_id: intent.id,
      p_amount_minor: amount,
      p_currency_code: state.currency_code,
      p_livemode: intent.livemode,
    });
    if (error) {
      if (error.message === "payment_in_progress") {
        // Another tab linked a different one first: use that, drop this one.
        const latest = await readState(orderId);
        if (latest?.payment_intent_id && latest.payment_intent_id !== intent.id) {
          await stripe.paymentIntents.cancel(intent.id).catch(() => undefined);
          return resume(await stripe.paymentIntents.retrieve(latest.payment_intent_id));
        }
      }
      if (error.message === "order_not_payable") return { status: "error", error: "notPayable" };
      console.error("[payments] attach failed", error.code, error.message);
      return { status: "error", error: "unexpected" };
    }
    return resume(intent);
  } catch (error) {
    // Below Stripe's minimum charge for the currency (e.g. AED 2.00).
    if (isStripeError(error) && error.code === "amount_too_small") {
      console.error(`[payments] order ${orderId}: total below Stripe's minimum charge`);
      return { status: "error", error: "unavailable" };
    }
    console.error(
      "[payments] start failed",
      isStripeError(error) ? `${error.type} ${error.code ?? "-"} ${error.message}` : error,
    );
    return { status: "error", error: "unexpected" };
  }
}
