import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { statusColors } from "@/lib/design/colors";

type LegacyBadgeProps = {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  className?: string;
};

type StatusBadgeProps = {
  type: "phase" | "project" | "lot";
  status: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
};

type BadgeProps = LegacyBadgeProps | StatusBadgeProps;

export function Badge(props: BadgeProps) {
  const variants = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",
  };

  if ("type" in props && "status" in props) {
    const colors = (statusColors[props.type] as any)?.[props.status] as
      | { bg: string; text: string; border?: string; dot?: string }
      | undefined;

    const sizeClasses = {
      sm: "px-2 py-0.5 text-xs",
      md: "px-3 py-1 text-xs",
      lg: "px-4 py-1.5 text-sm",
    } as const;

    if (!colors) {
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full font-semibold",
            sizeClasses[props.size ?? "md"],
            variants.default,
            props.className
          )}
        >
          {props.children}
        </span>
      );
    }

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-semibold",
          sizeClasses[props.size ?? "md"],
          colors.bg,
          colors.text,
          props.className
        )}
      >
        {colors.dot ? <span className={cn("h-1.5 w-1.5 rounded-full", colors.dot)} /> : null}
        {props.children}
      </span>
    );
  }

  const { children, className, variant = "default" } = props;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
