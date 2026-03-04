"use client";

import { Button } from "@/components/ui/Button";

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description ? <p className="text-gray-600 mb-4 max-w-md mx-auto">{description}</p> : null}
      {action ? (
        <Button onClick={action.onClick} className="px-6 py-3 font-medium">
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

