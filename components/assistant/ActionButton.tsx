"use client";

import { cn } from "@/lib/utils";

export type ActionButtonColor = "blue" | "green" | "purple" | "orange" | "indigo" | "red";

export type AssistantActionButton = {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: ActionButtonColor;
  disabled?: boolean;
};

const colorClasses: Record<ActionButtonColor, { border: string; hover: string; focus: string }> = {
  blue: {
    border: "border-blue-200",
    hover: "hover:bg-blue-50 hover:border-blue-400",
    focus: "focus-visible:ring-blue-300",
  },
  green: {
    border: "border-green-200",
    hover: "hover:bg-green-50 hover:border-green-400",
    focus: "focus-visible:ring-green-300",
  },
  purple: {
    border: "border-purple-200",
    hover: "hover:bg-purple-50 hover:border-purple-400",
    focus: "focus-visible:ring-purple-300",
  },
  orange: {
    border: "border-orange-200",
    hover: "hover:bg-orange-50 hover:border-orange-400",
    focus: "focus-visible:ring-orange-300",
  },
  indigo: {
    border: "border-indigo-200",
    hover: "hover:bg-indigo-50 hover:border-indigo-400",
    focus: "focus-visible:ring-indigo-300",
  },
  red: {
    border: "border-red-200",
    hover: "hover:bg-red-50 hover:border-red-400",
    focus: "focus-visible:ring-red-300",
  },
};

export function ActionButton({
  icon,
  title,
  description,
  color,
  onClick,
  className,
  disabled,
}: AssistantActionButton & { onClick: () => void; className?: string }) {
  const c = colorClasses[color];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full p-4 rounded-lg border-2 bg-white text-left",
        "transition-all duration-200 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        c.border,
        c.hover,
        c.focus,
        disabled && "opacity-60 cursor-not-allowed hover:shadow-none",
        className
      )}
      aria-label={`${title} - ${description}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none flex-shrink-0" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-neutral-900 mb-1 truncate">{title}</h3>
          <p className="text-sm text-neutral-600 leading-snug">{description}</p>
        </div>
      </div>
    </button>
  );
}
