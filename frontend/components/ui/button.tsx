import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#0F172A] text-white shadow-sm hover:bg-[#111c34] focus-visible:ring-[#3B82F6]",
  secondary:
    "bg-white text-[#0F172A] border border-[#E2E8F0] hover:bg-slate-50 focus-visible:ring-[#3B82F6]",
  ghost:
    "bg-transparent text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] focus-visible:ring-[#3B82F6]",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          variantStyles[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
