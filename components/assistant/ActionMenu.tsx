"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { AssistantActionButton } from "@/components/assistant/ActionButton";

type ActionMenuProps = {
  actions: Array<AssistantActionButton & { onClick: () => void }>;
  disabled?: boolean;
  className?: string;
};

export function ActionMenu({ actions, disabled, className }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const effectiveDisabled = disabled || actions.length === 0;

  const label = useMemo(() => {
    if (actions.length <= 1) return "Action";
    return "Actions";
  }, [actions.length]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(event.target as Node)) setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-9 !p-0"
        aria-label={`${label} rapides`}
        disabled={effectiveDisabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-lg leading-none" aria-hidden>
          ⋯
        </span>
      </Button>

      {open && (
        <div
          role="menu"
          aria-label={`${label} rapides`}
          className={cn(
            "absolute right-0 mt-2 w-[340px] max-w-[85vw] z-50",
            "rounded-xl border border-neutral-200 bg-white shadow-xl",
            "p-2"
          )}
        >
          <div className="px-2 py-1 text-xs font-medium text-neutral-500">{label} rapides</div>
          <div className="max-h-[60vh] overflow-auto">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
                className={cn(
                  "w-full text-left rounded-lg px-3 py-2",
                  "transition-colors hover:bg-neutral-50 active:bg-neutral-100",
                  "hover:ring-1 hover:ring-neutral-200/80",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                  action.disabled && "opacity-60 cursor-not-allowed hover:bg-transparent"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      action.color === "green" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70",
                      action.color === "blue" && "bg-blue-50 text-blue-700 ring-1 ring-blue-200/70",
                      action.color === "indigo" && "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/70",
                      action.color === "purple" && "bg-violet-50 text-violet-700 ring-1 ring-violet-200/70",
                      action.color === "orange" && "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70",
                      action.color === "red" && "bg-rose-50 text-rose-700 ring-1 ring-rose-200/70"
                    )}
                    aria-hidden
                  >
                    <span className="text-sm font-semibold leading-none">{action.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-neutral-900 leading-snug">{action.title}</div>
                    <div className="text-xs text-neutral-600 leading-snug">{action.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

