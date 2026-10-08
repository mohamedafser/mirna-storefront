"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/client";

function SubmitButton() {
  const { messages } = useI18n();
  // Disabled while the sign-out request is in flight → no duplicate requests.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending} aria-busy={pending}>
      {pending ? (
        <LoaderCircle aria-hidden className="animate-spin" />
      ) : (
        // Exit arrow points "out" of the reading direction, so it mirrors in RTL.
        <LogOut aria-hidden className="rtl:-scale-x-100" />
      )}
      {pending ? messages.auth.signingOut : messages.auth.signOut}
    </Button>
  );
}

/** Sign-out form (Server Action): clears the session and returns to the storefront. */
export function SignOutButton({ className }: { className?: string }) {
  const { locale } = useI18n();
  return (
    <form action={signOut} className={className}>
      <input type="hidden" name="locale" value={locale} />
      <SubmitButton />
    </form>
  );
}
