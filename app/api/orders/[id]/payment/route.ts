import { getCustomerOrNull } from "@/lib/auth/dal";
import { getOrderPaymentView } from "@/lib/payments/queries";
import { isUuid } from "@/lib/utils/uuid";

/**
 * GET /api/orders/[id]/payment — the payment status of one of the signed-in
 * customer's own orders, as JSON (used by the confirmation page while it
 * waits, and usable by any client).
 *
 * The status is the server's: read from the database (RLS: own orders only)
 * and, if Stripe already reports the payment as succeeded, synced through
 * mirna-admin first, so `confirmed` is true as soon as Stripe has the money.
 * Query parameters such as ?redirect_status=succeeded are never trusted.
 *
 * 200 { ok: true, orderId, state, paid, confirmed, orderStatus, canPay, dueAt, method }
 * 401 { ok: false, error: "unauthorized" } · 404 { ok: false, error: "not_found" }
 */

const json = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

const PAID_STATES = new Set(["paid", "partiallyRefunded", "refunded"]);

export async function GET(_request: Request, ctx: RouteContext<"/api/orders/[id]/payment">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return json({ ok: false, error: "not_found" }, 404);
  const customer = await getCustomerOrNull();
  if (!customer) return json({ ok: false, error: "unauthorized" }, 401);

  try {
    const view = await getOrderPaymentView(id);
    // Not the customer's order, or one not paid online.
    if (view.state === "none" && view.orderStatus === null) {
      return json({ ok: false, error: "not_found" }, 404);
    }
    const paid = PAID_STATES.has(view.state);
    return json({
      ok: true,
      orderId: id,
      state: view.state,
      paid,
      // The order is confirmed once its payment is in (orders.status CONFIRMED or later).
      confirmed: paid && view.orderStatus !== "PENDING" && view.orderStatus !== "CANCELLED",
      orderStatus: view.orderStatus,
      canPay: view.canPay,
      dueAt: view.dueAt,
      method: view.method,
    });
  } catch (error) {
    console.error(
      "[payments] status endpoint failed",
      error instanceof Error ? error.message : error,
    );
    return json({ ok: false, error: "unavailable" }, 503);
  }
}
