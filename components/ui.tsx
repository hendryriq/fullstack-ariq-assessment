import type { ComponentProps, ReactNode } from "react";

// The shared building blocks of the Star Generation theme. Pages compose these
// instead of repeating colors and spacing.

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

const BUTTON_VARIANTS = {
  primary: "bg-navy font-medium text-white hover:bg-navy/90",
  secondary: "border border-cloud font-medium text-navy hover:bg-cloud/50",
  danger: "bg-danger font-semibold text-white hover:bg-danger/90",
  ghost: "font-medium text-white hover:bg-white/10",
};

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`cursor-pointer rounded-card px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

const fieldStyles = `w-full min-w-0 rounded-card border border-cloud bg-white px-3 py-2 text-base font-normal md:text-sm ${focusRing}`;

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${fieldStyles} ${className}`} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select {...props} className={`${fieldStyles} ${className}`} />;
}

export function Textarea({
  className = "",
  ...props
}: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${fieldStyles} ${className}`} />;
}

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description && <p className="text-sm text-muted">{description}</p>}
    </div>
  );
}

export function PageLoading() {
  return <p className="text-sm text-muted">Loading…</p>;
}

// Hides a row's less common action until it is needed.
export function Disclosure({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium whitespace-nowrap underline">
        {label}
      </summary>
      <div className="mt-2 min-w-56">{children}</div>
    </details>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-cloud bg-surface p-6">
      {children}
    </div>
  );
}

// An error message. The text stays navy so it is easy to read.
export function Alert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-card border-l-4 border-danger bg-danger/10 px-3 py-2 text-sm"
    >
      {children}
    </p>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm [&_td]:border-t [&_td]:border-cloud [&_td]:py-3 [&_td]:pr-4 [&_th]:py-2 [&_th]:pr-4 [&_th]:font-medium [&_th]:text-muted">
        {children}
      </table>
    </div>
  );
}

const BADGE_TONES = {
  success: { background: "bg-success/10", dot: "bg-success" },
  pending: { background: "bg-gold/20", dot: "bg-gold" },
  danger: { background: "bg-danger/10", dot: "bg-danger" },
  neutral: { background: "bg-cloud/60", dot: "bg-muted" },
};

// Every status used by invoices, enrollments, lessons and logbooks.
const STATUS_TONES = {
  paid: "success",
  approved: "success",
  active: "success",
  pending: "pending",
  pending_payment: "pending",
  submitted: "pending",
  low_hours: "pending",
  returned: "danger",
  void: "danger",
  needs_top_up: "danger",
  loss: "danger",
  draft: "neutral",
  scheduled: "neutral",
  cancelled: "neutral",
} as const;

export type Status = keyof typeof STATUS_TONES;

export function StatusBadge({ status }: { status: Status }) {
  const tone = BADGE_TONES[STATUS_TONES[status]];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-card px-2 py-0.5 text-xs font-medium capitalize ${tone.background}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${tone.dot}`} />
      {status.replaceAll("_", " ")}
    </span>
  );
}
