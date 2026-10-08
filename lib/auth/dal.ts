import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { Locale } from "@/config/i18n";
import { localizedHref, routes } from "@/config/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CurrentCustomer } from "@/types/domain";

/**
 * Data Access Layer: the server-side authorization boundary for customer
 * accounts. proxy.ts only does an optimistic "is there a session?" redirect;
 * every account page and Server Action re-checks here, and RLS re-checks
 * every query in the database.
 *
 * Role and status always come from `profiles` (read under RLS, which only
 * returns the caller's own row), never from the client or user metadata.
 * Memoised per request, so a page and its children share one auth check.
 */
export const getCurrentCustomer = cache(async (): Promise<CurrentCustomer | null> => {
  // Session checks compare token expiry with the current time, so they must
  // always run at request time (never during prerendering).
  await connection();
  const supabase = await createClient();

  // Verifies the JWT signature (not just decodes the cookie).
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims.sub) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, phone, role, is_active, created_at")
    .eq("id", auth.claims.sub)
    .maybeSingle();

  if (error) {
    // Supabase unreachable or misconfigured: fail closed and let the error
    // boundary show a generic retry screen (details are logged, not shown).
    console.error("[auth] failed to load profile", { code: error.code });
    throw new Error("Unable to load account");
  }

  return {
    id: auth.claims.sub,
    email: typeof auth.claims.email === "string" ? auth.claims.email : null,
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    // A missing profile is treated as inactive (denied).
    role: profile?.role ?? "CUSTOMER",
    isActive: profile?.is_active ?? false,
    createdAt: profile?.created_at ?? null,
  };
});

/**
 * "granted" only for an active CUSTOMER. Staff (ADMIN) accounts manage the
 * store in mirna-admin; the storefront account area never serves them.
 */
export type CustomerAccess = "granted" | "inactive" | "staff";

export function getCustomerAccess(user: CurrentCustomer): CustomerAccess {
  if (!user.isActive) return "inactive";
  return user.role === "CUSTOMER" ? "granted" : "staff";
}

/** Signed-in user (any access level) or redirect to the login page. */
export async function requireUser(locale: Locale): Promise<CurrentCustomer> {
  const user = await getCurrentCustomer();
  if (!user) redirect(localizedHref(locale, routes.login));
  return user;
}

/**
 * For Server Actions: the active customer, or null. Actions return an error
 * state instead of redirecting; RLS still re-checks every write.
 */
export async function getCustomerOrNull(): Promise<CurrentCustomer | null> {
  const user = await getCurrentCustomer();
  return user && getCustomerAccess(user) === "granted" ? user : null;
}

/**
 * Active CUSTOMER or redirect: to /login when signed out, to /account (which
 * explains staff/inactive accounts) otherwise. For account sub-pages.
 */
export async function requireCustomer(locale: Locale): Promise<CurrentCustomer> {
  const user = await requireUser(locale);
  if (getCustomerAccess(user) !== "granted") redirect(localizedHref(locale, routes.account));
  return user;
}
