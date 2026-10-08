import "server-only";
import { cookies } from "next/headers";

/**
 * Marks a session as "opened from a password-reset email" so /reset-password
 * can change the password without asking for the old one. The email-link
 * endpoint sets it after Supabase verifies the link; it is bound to that
 * user, httpOnly, short-lived and cleared once the password is changed. An
 * ordinary signed-in session cannot use the reset page.
 */
const RECOVERY_COOKIE = "mirna-recovery";
const RECOVERY_MAX_AGE = 15 * 60; // seconds

export async function markRecovery(userId: string): Promise<void> {
  (await cookies()).set(RECOVERY_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: RECOVERY_MAX_AGE,
  });
}

export async function isRecoveryFor(userId: string): Promise<boolean> {
  return (await cookies()).get(RECOVERY_COOKIE)?.value === userId;
}

export async function clearRecovery(): Promise<void> {
  (await cookies()).delete(RECOVERY_COOKIE);
}
