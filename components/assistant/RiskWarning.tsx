"use client";

import { cn } from "@/lib/utils";

export type RiskVariant = "info" | "warning" | "danger" | "success";

const variantStyles: Record<RiskVariant, string> = {
  info: "bg-blue-50 border-blue-200",
  success: "bg-green-50 border-green-200",
  warning: "bg-orange-50 border-orange-200",
  danger: "bg-red-50 border-red-200",
};

const variantTitle: Record<RiskVariant, string> = {
  info: "text-blue-900",
  success: "text-green-900",
  warning: "text-orange-900",
  danger: "text-red-900",
};

export function RiskWarning({
  icon,
  title,
  description,
  actions,
  variant = "warning",
  className,
}: {
  icon?: string;
  title: string;
  description?: string;
  actions?: string[];
  variant?: RiskVariant;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border-l-4 border p-5", variantStyles[variant], className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <span className="text-3xl leading-none flex-shrink-0" aria-hidden>
            {icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <h3 className={cn("font-bold mb-2", variantTitle[variant])}>{title}</h3>
          {description && <p className="text-sm text-neutral-800 mb-3">{description}</p>}
          {actions && actions.length > 0 && (
            <div className="bg-white/70 rounded-lg p-3">
              <p className="text-sm font-semibold text-neutral-900 mb-2">✅ Actions concrètes :</p>
              <ul className="text-sm text-neutral-800 space-y-1 list-disc pl-5">
                {actions.map((action, idx) => (
                  <li key={idx}>{action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

