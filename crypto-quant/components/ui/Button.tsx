import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClass: Record<Variant, string> = {
  primary: "bg-[var(--color-accent)] text-white hover:brightness-110",
  secondary: "bg-[var(--color-surface-raised)] text-[var(--color-text)] hover:brightness-125 border border-[var(--color-border)]",
  ghost: "bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
  danger: "bg-[var(--color-down)] text-white hover:brightness-110",
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variantClass[variant],
        className,
      )}
      {...props}
    />
  );
}
