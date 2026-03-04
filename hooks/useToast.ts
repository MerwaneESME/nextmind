"use client";

import { useCallback } from "react";

type ToastType = "success" | "error" | "info";

/**
 * Global toast hook — renders a temporary notification at the bottom-right.
 * Uses DOM manipulation so it works outside of React render trees.
 */
export function useToast() {
  const showToast = useCallback((message: string, type: ToastType = "info") => {
    if (typeof window === "undefined") return;

    const colors: Record<ToastType, string> = {
      success: "bg-emerald-700 text-white",
      error: "bg-red-700 text-white",
      info: "bg-neutral-800 text-white",
    };

    const toast = document.createElement("div");
    toast.className = [
      "fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-sm z-[9999]",
      "transition-all duration-300 ease-in-out",
      "translate-y-2 opacity-0",
      colors[type],
    ].join(" ");
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove("translate-y-2", "opacity-0");
      toast.classList.add("translate-y-0", "opacity-100");
    });

    // Animate out + remove
    setTimeout(() => {
      toast.classList.remove("translate-y-0", "opacity-100");
      toast.classList.add("translate-y-2", "opacity-0");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }, []);

  return { showToast };
}
