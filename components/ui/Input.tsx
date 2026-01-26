import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-neutral-800 mb-1.5">
          {label}
        </label>
      )}
      <input
        className={cn(
          "w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white",
          "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
          "disabled:bg-neutral-100 disabled:cursor-not-allowed",
          error && "border-red-500 focus:ring-red-500",
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

