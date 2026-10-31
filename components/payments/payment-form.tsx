"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance, type Stripe as StripeJs } from "@stripe/stripe-js";
import { LoaderCircle, Lock, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/auth/form-controls";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { postJson } from "@/lib/api/client";
import type { StartPaymentError, StartPaymentResult } from "@/lib/payments/actions";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/messages";

// Loaded once per page, and only on pages that render this form.
let stripePromise: Promise<StripeJs | null> | null = null;
function getStripeJs(): Promise<StripeJs | null> | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  stripePromise ??= loadStripe(key);
  return stripePromise;
}

/** Stripe's fields in the storefront's palette (read from the CSS tokens, so dark mode matches). */
function appearance(locale: string): Appearance {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const dark = css.colorScheme === "dark";
  return {
    theme: dark ? "night" : "stripe",
    labels: "above",
    variables: {
      colorPrimary: token("--primary", "#291113"),
      colorBackground: token("--card", "#ffffff"),
      colorText: token("--foreground", "#291113"),
      colorTextSecondary: token("--muted-foreground", "#655754"),
      colorDanger: token("--error", "#b91c1c"),
      fontFamily:
        locale === "ar"
          ? "Tajawal, system-ui, sans-serif"
          : '"Nunito Sans", system-ui, -apple-system, sans-serif',
      fontSizeBase: "15px",
      borderRadius: "0px",
      spacingUnit: "4px",
    },
    rules: {
      ".Input": { border: `1px solid ${token("--input", "#958680")}`, boxShadow: "none" },
      ".Input:focus": { borderColor: token("--ring", "#291113"), boxShadow: "none" },
      ".Tab": { border: `1px solid ${token("--border", "#e4dbd1")}`, boxShadow: "none" },
      ".Tab--selected": { borderColor: token("--foreground", "#291113"), boxShadow: "none" },
    },
  };
}

const FONTS = [
  { cssSrc: "https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600&display=swap" },
  { cssSrc: "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500&display=swap" },
];

type Phase =
  | { name: "loading" }
  | { name: "ready"; clientSecret: string; appearance: Appearance }
  | { name: "error"; error: StartPaymentError };

/**
 * Card / Apple Pay payment for one order, with Stripe's Payment Element.
 *
 * Card details are typed into Stripe's own iframes and go straight to
 * Stripe; this page and the store's servers never see them. Apple Pay (and
 * Google Pay, Link, …) appear inside the element only when Stripe confirms
 * the device, browser and domain support them, with cards always available.
 * 3D Secure is shown by Stripe.js when the bank asks for it.
 *
 * The client secret comes from startPayment() (the server computes the
 * amount from the stored order). A successful confirmation only navigates to
 * the confirmation page, which waits for the webhook-confirmed status: the
 * browser's word is never what marks the order paid.
 */
export function PaymentForm({
  orderId,
  amountLabel,
  confirmationHref,
}: {
  orderId: string;
  /** The order total, formatted, for the pay button. */
  amountLabel: string;
  confirmationHref: string;
}) {
  const { locale, messages } = useI18n();
  const t = messages.payment;
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [retrying, startRetry] = useTransition();
  const stripe = getStripeJs();

  function load() {
    startRetry(async () => {
      const result = await postJson<StartPaymentResult>("/api/payments/start", { orderId }).catch(
        () => ({ status: "error", error: "unexpected" }) as const,
      );
      if (result.status === "done") return router.replace(confirmationHref);
      if (result.status === "error") return setPhase({ name: "error", error: result.error });
      setPhase({
        name: "ready",
        clientSecret: result.clientSecret,
        appearance: appearance(locale),
      });
    });
  }

  useEffect(() => {
    load();
    // Once per mount (and again only through "Try again").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!stripe) return <FormMessage>{t.errors.unavailable}</FormMessage>;

  if (phase.name === "error") {
    const retryable = phase.error === "unexpected";
    return (
      <div className="grid gap-4">
        <FormMessage>{t.errors[phase.error]}</FormMessage>
        {retryable && (
          <Button
            variant="outline"
            onClick={load}
            disabled={retrying}
            className="justify-self-start"
          >
            {retrying ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : (
              <RotateCw aria-hidden />
            )}
            {t.retry}
          </Button>
        )}
      </div>
    );
  }

  if (phase.name === "loading") return <PaymentSkeleton label={t.loading} />;

  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret: phase.clientSecret,
        appearance: phase.appearance,
        locale: locale === "ar" ? "ar" : "en",
        fonts: FONTS,
      }}
    >
      <ConfirmPayment amountLabel={amountLabel} confirmationHref={confirmationHref} />
    </Elements>
  );
}

function PaymentSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-3">
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    </div>
  );
}

function ConfirmPayment({
  amountLabel,
  confirmationHref,
}: {
  amountLabel: string;
  confirmationHref: string;
}) {
  const { messages } = useI18n();
  const t = messages.payment;
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Guards against a second submit before React re-renders the disabled button.
  const inFlight = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      // Used only by payment methods that leave the page (bank redirects);
      // cards, Apple Pay and 3D Secure complete here.
      confirmParams: { return_url: new URL(confirmationHref, window.location.origin).toString() },
      redirect: "if_required",
    });

    if (error) {
      // Card declines and form problems carry a message meant for the
      // customer (localised by Stripe); anything else gets a generic one.
      setMessage(
        error.type === "card_error" || error.type === "validation_error"
          ? (error.message ?? t.errors.declined)
          : t.errors.confirmFailed,
      );
      inFlight.current = false;
      setSubmitting(false);
      return;
    }
    // Succeeded or processing: the confirmation page waits for the webhook.
    router.replace(confirmationHref);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" aria-busy={submitting}>
      {!ready && <PaymentSkeleton label={t.loading} />}
      <div className={ready ? undefined : "sr-only"}>
        <PaymentElement
          onReady={() => setReady(true)}
          options={{
            layout: { type: "tabs", defaultCollapsed: false },
            wallets: { applePay: "auto", googlePay: "auto" },
          }}
        />
      </div>

      <div aria-live="assertive" className="empty:hidden">
        {message && <FormMessage>{message}</FormMessage>}
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!stripe || !elements || !ready || submitting}
        aria-busy={submitting}
      >
        {submitting ? <LoaderCircle aria-hidden className="animate-spin" /> : <Lock aria-hidden />}
        {submitting ? t.processing : format(t.pay, { amount: amountLabel })}
      </Button>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {t.secureNote}
      </p>
    </form>
  );
}
