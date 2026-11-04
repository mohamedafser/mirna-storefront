"use client";

import { LoaderCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect } from "react";
import { signInWithGoogle, type GoogleSignInState } from "@/lib/auth/actions";
import { GOOGLE_ERROR_MESSAGE, REDIRECT_PARAM } from "@/lib/auth/redirect";
import { GUEST_CART_FIELD } from "@/lib/cart/rules";
import { readGuestCart } from "@/lib/cart/storage";
import { useI18n } from "@/lib/i18n/client";
import { FormMessage } from "./form-controls";

const initialState: GoogleSignInState = { error: null };

/** Google's "G" in its required colours, on any background. */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-5 shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * "Continue with Google", for both signing in and creating an account: Supabase
 * finds or creates the account by email either way. Sits above the email form,
 * with a divider. Shows why a previous attempt failed (?error= from
 * app/[lang]/auth/callback). Reads the URL, so it needs a Suspense boundary.
 */
export function GoogleSignIn({ from }: { from: "login" | "signup" }) {
  const { locale, messages } = useI18n();
  const t = messages.auth;
  const searchParams = useSearchParams();
  const [state, action, pending] = useActionState(signInWithGoogle, initialState);

  // Coming back from Google with the browser's Back button restores this page
  // as it was left, with the button still spinning. Start fresh instead.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const param = searchParams.get("error") ?? "";
  const returned = Object.hasOwn(GOOGLE_ERROR_MESSAGE, param)
    ? GOOGLE_ERROR_MESSAGE[param as keyof typeof GOOGLE_ERROR_MESSAGE]
    : null;
  const error = state.error ?? returned;

  return (
    <div className="grid gap-5">
      {error && !pending && <FormMessage>{t.errors[error]}</FormMessage>}

      <form
        action={action}
        onSubmit={(event) => {
          // Carried across the trip to Google, like the guest cart on password sign-in.
          const field = event.currentTarget.elements.namedItem(GUEST_CART_FIELD);
          if (field instanceof HTMLInputElement) field.value = JSON.stringify(readGuestCart());
        }}
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="from" value={from} />
        <input type="hidden" name={GUEST_CART_FIELD} defaultValue="" />
        <input type="hidden" name={REDIRECT_PARAM} value={searchParams.get(REDIRECT_PARAM) ?? ""} />
        {/* Google's guidelines: its name as written, so not the uppercase button style. */}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="inline-flex h-12 w-full items-center justify-center gap-3 border border-border bg-card px-4 text-sm font-medium text-foreground transition-[border-color,background-color,opacity,transform] duration-200 ease-out hover:border-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? (
            <LoaderCircle aria-hidden className="size-5 shrink-0 animate-spin" />
          ) : (
            <GoogleMark />
          )}
          {pending ? t.googleRedirecting : t.continueWithGoogle}
        </button>
      </form>

      <div className="flex items-center gap-4" role="separator" aria-label={t.orDivider}>
        <span aria-hidden className="h-px flex-1 bg-border" />
        <span aria-hidden className="caps text-[0.6875rem] text-muted-foreground">
          {t.orDivider}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
