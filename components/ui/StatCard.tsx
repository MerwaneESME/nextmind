"use client";

import { statusColors } from "@/lib/design/colors";

type AlertType = "success" | "warning" | "error" | "info";

export default function StatCard({
  icon,
  iconBg,
  label,
  value,
  subtitle,
  alert,
  onClick,
}: {
  icon: string;
  iconBg: string;
  label: string;
  value: string | number;
  subtitle?: string;
  alert?: { type: AlertType; message: string };
  onClick?: () => void;
}) {
  return (
    <div
      className={[
        "bg-white border border-gray-200 rounded-xl p-6",
        "hover:shadow-md transition-shadow",
        onClick ? "cursor-pointer" : "",
      ].join(" ")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 ${iconBg} rounded-lg`}>
          <span className="text-2xl">{icon}</span>
        </div>
        {subtitle ? <span className="text-sm text-gray-500">{subtitle}</span> : null}
      </div>

      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>

      {alert ? (
        <div
          className={[
            "mt-3 text-xs px-2 py-1 rounded",
            statusColors.alert[alert.type].bg,
            statusColors.alert[alert.type].text,
          ].join(" ")}
        >
          {statusColors.alert[alert.type].icon} {alert.message}
        </div>
      ) : null}
    </div>
  );
}

