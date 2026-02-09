type ProgressBarVariant = "default" | "success" | "warning" | "danger";
type ProgressBarSize = "sm" | "md" | "lg";

export default function ProgressBar({
  percentage,
  showLabel = true,
  size = "md",
  variant = "default",
}: {
  percentage: number;
  showLabel?: boolean;
  size?: ProgressBarSize;
  variant?: ProgressBarVariant;
}) {
  const sizeClasses: Record<ProgressBarSize, string> = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  const variantClasses: Record<Exclude<ProgressBarVariant, "default"> | "default", string> = {
    default: "from-blue-500 to-blue-600",
    success: "from-green-500 to-green-600",
    warning: "from-yellow-500 to-yellow-600",
    danger: "from-red-500 to-red-600",
  };

  const clamped = Math.min(100, Math.max(0, Math.round(Number(percentage) || 0)));

  const resolvedVariant: Exclude<ProgressBarVariant, "default"> | "default" =
    variant !== "default"
      ? variant
      : clamped >= 100
        ? "success"
        : clamped >= 75
          ? "default"
          : clamped >= 50
            ? "warning"
            : "danger";

  return (
    <div>
      {showLabel && (
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">Progression</span>
          <span className="font-semibold text-gray-900">{clamped}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${sizeClasses[size]}`}>
        <div
          className={[
            "bg-gradient-to-r",
            variantClasses[resolvedVariant],
            sizeClasses[size],
            "rounded-full transition-all duration-500 ease-out",
          ].join(" ")}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

