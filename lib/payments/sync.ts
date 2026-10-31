import "server-only";

/**
 * Asks mirna-admin to sync one PaymentIntent now (POST /api/stripe/sync),
 * for when Stripe already reports it paid but the webhook hasn't arrived.
 * Only the id is sent; mirna-admin re-reads it from Stripe with its own key
 * and applies it like a webhook, so the storefront never decides that an
 * order is paid. Needs ADMIN_URL and PAYMENTS_SYNC_SECRET (same value as in
 * mirna-admin); without them it does nothing and the webhook stays the only
 * path. Returns whether the sync ran.
 */
export async function requestPaymentSync(paymentIntentId: string): Promise<boolean> {
  const adminUrl = process.env.ADMIN_URL;
  const secret = process.env.PAYMENTS_SYNC_SECRET;
  if (!adminUrl || !secret) return false;

  try {
    const response = await fetch(new URL("/api/stripe/sync", adminUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ payment_intent_id: paymentIntentId }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error(`[payments] admin sync failed: HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      "[payments] admin sync unreachable",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
