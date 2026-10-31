import "server-only";

/**
 * POST Route Handler returning plain JSON (`Content-Type: application/json`),
 * for data the browser fetches (cart, wishlist, payment). The handler gets
 * the parsed JSON body and returns the same result object as the matching
 * Server Action, with status 200; the business logic stays in that function.
 *
 * Server Actions are protected by Next.js against cross-site calls; these
 * routes check it themselves: the request must come from this site (Origin)
 * and be JSON, so another site can't trigger them with a visitor's cookies.
 *
 * 403 { ok: false, error: "forbidden" } · 415 "unsupportedMediaType" · 400 "invalidBody"
 */

type Body = Record<string, unknown>;

export function json(body: object, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function jsonRoute(handler: (body: Body) => Promise<object>) {
  return async function POST(request: Request): Promise<Response> {
    if (!sameOrigin(request)) return json({ ok: false, error: "forbidden" }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      return json({ ok: false, error: "unsupportedMediaType" }, 415);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalidBody" }, 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json({ ok: false, error: "invalidBody" }, 400);
    }
    return json(await handler(body as Body));
  };
}
