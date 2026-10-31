import "server-only";
import Stripe from "stripe";

/**
 * Stripe client for the storefront's server: it only creates and reads
 * PaymentIntents for the signed-in customer's own orders. The key is read
 * from STRIPE_SECRET_KEY (no NEXT_PUBLIC_ prefix, so it never reaches a
 * browser bundle); a restricted key with "PaymentIntents: write" is enough.
 * Webhooks, refunds and cancellations are handled by mirna-admin.
 * Returns null when it isn't configured (online payment then unavailable).
 */
let client: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  client = key
    ? new Stripe(key, {
        maxNetworkRetries: 2,
        timeout: 20_000,
        appInfo: { name: "mirna-storefront" },
      })
    : null;
  return client;
}

export function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}
