import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/** Shared form controls, used by the shop and the admin panel so both look the same. */

export const inputClass =
  "w-full rounded border border-line bg-white px-3 py-2.5 text-sm text-brown placeholder:text-muted/70 focus:border-gold focus:outline-none disabled:opacity-60";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-xs tracking-wide text-brown-soft uppercase">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-gold-deep" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} min-h-24 ${props.className ?? ""}`} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brown text-cream hover:bg-brown-soft",
  secondary: "border border-brown/30 text-brown hover:border-brown bg-transparent",
  danger: "bg-[#a33b32] text-white hover:bg-[#872f28]",
  ghost: "text-brown-soft hover:text-brown underline-offset-4 hover:underline",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded px-5 py-2.5 text-sm tracking-[0.1em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Notice({
  tone,
  children,
}: {
  tone: "error" | "info" | "success";
  children: ReactNode;
}) {
  const style =
    tone === "error"
      ? "border-[#a33b32]/40 bg-[#a33b32]/10 text-[#7a2b25]"
      : tone === "success"
        ? "border-[#4f7a4a]/40 bg-[#4f7a4a]/10 text-[#2f5a2b]"
        : "border-gold/40 bg-cream-deep text-brown";
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-4 py-3 text-sm ${style}`}
    >
      {children}
    </div>
  );
}
