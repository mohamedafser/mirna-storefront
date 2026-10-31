/**
 * POSTs JSON to one of the storefront's Route Handlers (lib/api/json-route.ts)
 * and returns the parsed JSON. Throws on a network failure or a non-2xx
 * status, like a failed Server Action call, so callers' error handling is
 * unchanged.
 */
export async function postJson<T>(path: string, body: object): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${path} failed: HTTP ${response.status}`);
  return (await response.json()) as T;
}
