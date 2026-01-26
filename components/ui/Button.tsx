import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    "font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)]";
  
  const variants = {
    primary:
      "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500",
    secondary:
      "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 focus:ring-neutral-400",
    outline:
      "border-2 border-neutral-200 text-neutral-800 hover:bg-neutral-50 focus:ring-primary-500",
    ghost:
      "text-neutral-800 hover:bg-neutral-100 focus:ring-primary-500",
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };
  
  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

