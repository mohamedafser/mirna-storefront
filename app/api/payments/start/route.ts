import { jsonRoute } from "@/lib/api/json-route";
import { startPayment } from "@/lib/payments/actions";

/** POST { orderId } → StartPaymentResult (client secret for the Payment Element). */
export const POST = jsonRoute((body) => startPayment(body.orderId));
