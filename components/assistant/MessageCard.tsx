"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MessageCardVariant = "info" | "success" | "warning" | "danger";

const variantClasses: Record<MessageCardVariant, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-900",
  success: "bg-green-50 border-green-200 text-green-900",
  warning: "bg-orange-50 border-orange-200 text-orange-900",
  danger: "bg-red-50 border-red-200 text-red-900",
};

export function MessageCard({
  title,
  children,
  variant = "info",
  className,
}: {
  title?: string;
  children: ReactNode;
  variant?: MessageCardVariant;
  className?: string;
}) {
  return (
    <div className={cn("border-l-4 rounded-r-lg p-4 border", variantClasses[variant], className)}>
      {title && <h3 className="font-bold mb-2">{title}</h3>}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

