import "server-only";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { Locale } from "@/config/i18n";

/**
 * The storefront's side of email codes. mirna-admin holds the SMTP settings and
 * the service role key, so it generates, sends and checks them
 * (POST /api/auth/otp); this file calls it, and keeps the visitor's place in two
 * httpOnly cookies. Passwords and reset tokens never reach the browser's script,
 * and codes only exist on the admin server and in the customer's mailbox.
 */

export type OtpPurpose = "signup" | "recovery";

/** Which code the visitor is entering. `binding` ties that code to this browser. */
export interface OtpFlow {
  email: string;
  purpose: OtpPurpose;
  binding: string;
}

const FLOW_COOKIE = "mirna-otp";
const FLOW_MAX_AGE = 60 * 60; // seconds: as long as the hourly resend limit
const RESET_COOKIE = "mirna-reset";
const RESET_MAX_AGE = 10 * 60; // seconds: the token's own lifetime (migration 046)

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export function newBinding(): string {
  return randomBytes(32).toString("base64url");
}

export async function setOtpFlow(flow: OtpFlow): Promise<void> {
  (await cookies()).set(FLOW_COOKIE, JSON.stringify(flow), cookieOptions(FLOW_MAX_AGE));
}

export async function readOtpFlow(): Promise<OtpFlow | null> {
  const value = (await cookies()).get(FLOW_COOKIE)?.value;
  if (!value) return null;
  try {
    const { email, purpose, binding } = JSON.parse(value) as Partial<OtpFlow>;
    if (typeof email !== "string" || typeof binding !== "string") return null;
    if (purpose !== "signup" && purpose !== "recovery") return null;
    return { email, purpose, binding };
  } catch {
    return null;
  }
}

/** Grants the password form after a recovery code; replaces the code's cookie. */
export async function setResetToken(token: string): Promise<void> {
  const store = await cookies();
  store.delete(FLOW_COOKIE);
  store.set(RESET_COOKIE, token, cookieOptions(RESET_MAX_AGE));
}

export async function readResetToken(): Promise<string | null> {
  return (await cookies()).get(RESET_COOKIE)?.value ?? null;
}

export async function clearOtpCookies(): Promise<void> {
  const store = await cookies();
  store.delete(FLOW_COOKIE);
  store.delete(RESET_COOKIE);
}

/** For the per-IP limit. Set by the hosting platform's proxy. */
async function clientIp(): Promise<string | null> {
  const list = await headers();
  const ip = list.get("x-real-ip") ?? list.get("x-forwarded-for")?.split(",")[0];
  return ip?.trim() || null;
}

type Unavailable = { status: "unavailable" };

async function callAdmin<T>(body: object): Promise<T | Unavailable> {
  const adminUrl = process.env.ADMIN_URL;
  const secret = process.env.AUTH_OTP_SECRET;
  if (!adminUrl || !secret) {
    console.error("[auth] email codes need ADMIN_URL and AUTH_OTP_SECRET");
    return { status: "unavailable" };
  }
  try {
    const url = new URL("/api/auth/otp", adminUrl);
    // Passwords travel in this request.
    if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
      console.error("[auth] ADMIN_URL must use https in production");
      return { status: "unavailable" };
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(`[auth] email code service failed: HTTP ${response.status}`);
      return { status: "unavailable" };
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(
      "[auth] email code service unreachable",
      error instanceof Error ? error.name : "unknown",
    );
    return { status: "unavailable" };
  }
}

export type RequestResult =
  { status: "sent" } | { status: "rate_limited"; retryAfter: number } | Unavailable;

export async function requestCode(input: {
  flow: OtpFlow;
  locale: Locale;
  resend?: boolean;
  password?: string;
  fullName?: string;
}): Promise<RequestResult> {
  return callAdmin<RequestResult>({
    action: "request",
    purpose: input.flow.purpose,
    email: input.flow.email,
    binding: input.flow.binding,
    locale: input.locale,
    ip: await clientIp(),
    resend: input.resend ?? false,
    password: input.password,
    fullName: input.fullName,
  });
}

export type VerifyResult =
  | { status: "invalid" | "expired" | "locked" }
  | { status: "ok"; purpose: "signup"; sessionTokenHash: string | null }
  | { status: "ok"; purpose: "recovery"; resetToken: string }
  | Unavailable;

export async function verifyCode(flow: OtpFlow, code: string): Promise<VerifyResult> {
  return callAdmin<VerifyResult>({ action: "verify", ...flow, code });
}

export type ResetResult = { status: "ok" | "expired" | "weak_password" } | Unavailable;

export async function resetPasswordWithToken(
  resetToken: string,
  password: string,
): Promise<ResetResult> {
  return callAdmin<ResetResult>({ action: "reset", resetToken, password });
}
