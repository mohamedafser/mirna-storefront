"use client";

import { ChevronDown, CircleAlert, CircleCheck, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useId, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils/cn";

/**
 * Labelled text input with an optional hint and error message, wired up
 * with aria-invalid / aria-describedby. Used by every account form.
 */
export function TextField({
  label,
  hint,
  error,
  trailing,
  className,
  ...props
}: ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string;
  /** Control inside the input's inline-end edge (e.g. show password). */
  trailing?: ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={id} className="caps text-[0.6875rem] font-medium">
        {label}
      </label>
      {/* Shares the input's direction so a trailing control sits at its end. */}
      <div className="relative" dir={props.dir}>
        <Input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(error && "border-error", trailing ? "pe-12" : undefined)}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 end-0 flex items-center">{trailing}</div>}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-error">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Password field with a show/hide toggle. */
export function PasswordField(props: Omit<ComponentProps<typeof TextField>, "type" | "trailing">) {
  const { messages } = useI18n();
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? messages.auth.hidePassword : messages.auth.showPassword;
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      // Passwords are always entered left-to-right, even in Arabic.
      dir="ltr"
      trailing={
        <Button
          variant="ghost"
          size="icon"
          aria-label={toggleLabel}
          aria-pressed={visible}
          title={toggleLabel}
          onClick={() => setVisible((value) => !value)}
          className="text-muted-foreground"
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      }
    />
  );
}

/** Form-level message. Errors are announced immediately (role="alert"). */
export function FormMessage({
  tone = "error",
  id,
  children,
}: {
  tone?: "error" | "success";
  id?: string;
  children: ReactNode;
}) {
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 border px-4 py-3 text-sm",
        tone === "error" ? "border-error/40 text-error" : "border-success/40 text-success",
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/** Full-width submit button; disabled (no duplicate requests) while pending. */
export function SubmitButton({
  pending,
  label,
  pendingLabel,
  className,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      aria-busy={pending}
      className={cn("w-full", className)}
    >
      {pending && <LoaderCircle aria-hidden className="animate-spin" />}
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Runs `validate` on submit. With errors it cancels the submit, shows them
 * and focuses the first invalid field; the Server Action validates again.
 * Also ignores extra submits while a request is in flight.
 */
export function useClientValidation<E extends object>(
  validate: (data: FormData) => E,
  pending: boolean,
) {
  const [clientErrors, setClientErrors] = useState<E | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (pending) {
      event.preventDefault();
      return;
    }
    const errors = validate(new FormData(event.currentTarget));
    const invalid = Object.entries(errors).filter(([, value]) => Boolean(value));
    setClientErrors(invalid.length > 0 ? errors : null);
    if (invalid.length > 0) {
      event.preventDefault();
      const field = event.currentTarget.elements.namedItem(invalid[0][0]);
      if (field instanceof HTMLElement) field.focus();
    }
  }

  return { clientErrors, onSubmit };
}

/** Labelled native <select> styled like Input (keyboard and screen-reader friendly everywhere). */
export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...props
}: ComponentProps<"select"> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={id} className="caps text-[0.6875rem] font-medium">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full min-w-0 appearance-none border border-border bg-card ps-4 pe-10 text-base text-foreground sm:text-sm",
            "hover:border-input focus-visible:border-foreground focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error && "border-error",
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      {error && (
        <p id={errorId} className="text-sm text-error">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
