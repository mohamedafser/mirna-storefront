// Customer auth and profile input rules, shared by the client forms (instant
// feedback) and the Server Actions (authoritative). Error values are keys into
// messages.auth.errors.

export const NAME_MAX_LENGTH = 200; // profiles.full_name check constraint
export const PHONE_MAX_LENGTH = 32; // profiles.phone check constraint
export const EMAIL_MAX_LENGTH = 254;
// Supabase Auth hashes with bcrypt, which ignores bytes after 72, so longer
// passwords are rejected rather than silently truncated.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export type FieldError =
  | "emailRequired"
  | "emailInvalid"
  | "passwordRequired"
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordMismatch"
  | "nameRequired"
  | "nameTooLong"
  | "phoneInvalid";

export type FieldErrors<K extends string> = Partial<Record<K, FieldError>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digits with optional leading "+" and common separators: "+971 50 123 4567".
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,30}$/;

/** Phone number as customers type it ("+971 50 123 4567"); normalise first. */
export function isValidPhone(phone: string): boolean {
  return phone.length <= PHONE_MAX_LENGTH && PHONE_PATTERN.test(phone);
}

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some(Boolean);
}

export function normalizeEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/** Trims and collapses inner whitespace. */
export function normalizeName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Arabic-Indic and Persian digits → ASCII, then trimmed and single-spaced. */
export function normalizePhone(value: unknown): string {
  return String(value ?? "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .trim()
    .replace(/\s+/g, " ");
}

function emailError(email: string): FieldError | undefined {
  if (!email) return "emailRequired";
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) return "emailInvalid";
}

function nameError(fullName: string): FieldError | undefined {
  if (!fullName) return "nameRequired";
  if (fullName.length > NAME_MAX_LENGTH) return "nameTooLong";
}

/** For new passwords (sign-up, reset). */
function newPasswordErrors(
  password: string,
  confirmPassword: string,
): FieldErrors<"password" | "confirmPassword"> {
  if (!password) return { password: "passwordRequired" };
  if (password.length < PASSWORD_MIN_LENGTH) return { password: "passwordTooShort" };
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_LENGTH) {
    return { password: "passwordTooLong" };
  }
  if (confirmPassword !== password) return { confirmPassword: "passwordMismatch" };
  return {};
}

export function validateLogin(email: string, password: string): FieldErrors<"email" | "password"> {
  return { email: emailError(email), password: password ? undefined : "passwordRequired" };
}

export function validateEmail(email: string): FieldErrors<"email"> {
  return { email: emailError(email) };
}

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function readSignUp(data: FormData): SignUpInput {
  return {
    fullName: normalizeName(data.get("fullName")),
    email: normalizeEmail(data.get("email")),
    password: String(data.get("password") ?? ""),
    confirmPassword: String(data.get("confirmPassword") ?? ""),
  };
}

export function validateSignUp(input: SignUpInput): FieldErrors<keyof SignUpInput> {
  return {
    fullName: nameError(input.fullName),
    email: emailError(input.email),
    ...newPasswordErrors(input.password, input.confirmPassword),
  };
}

export function validateNewPassword(
  password: string,
  confirmPassword: string,
): FieldErrors<"password" | "confirmPassword"> {
  return newPasswordErrors(password, confirmPassword);
}

/**
 * The only profile fields a customer may edit. Role, active status and ids are
 * never read from the form.
 */
export interface ProfileInput {
  fullName: string;
  phone: string;
}

export function readProfile(data: FormData): ProfileInput {
  return {
    fullName: normalizeName(data.get("fullName")),
    phone: normalizePhone(data.get("phone")),
  };
}

export function validateProfile(input: ProfileInput): FieldErrors<keyof ProfileInput> {
  return {
    fullName: nameError(input.fullName),
    phone: input.phone && !isValidPhone(input.phone) ? "phoneInvalid" : undefined,
  };
}
