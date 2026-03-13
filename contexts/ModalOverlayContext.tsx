"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Ctx = { open: () => void; close: () => void };
const ModalOverlayContext = createContext<Ctx>({ open: () => {}, close: () => {} });

export function ModalOverlayProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const open = useCallback(() => setCount((n) => n + 1), []);
  const close = useCallback(() => setCount((n) => Math.max(0, n - 1)), []);

  return (
    <ModalOverlayContext.Provider value={{ open, close }}>
      {children}
      {count > 0 && (
        <div className="fixed inset-0 z-[48] bg-black/40 backdrop-blur-sm pointer-events-none" />
      )}
    </ModalOverlayContext.Provider>
  );
}

export function useModalOverlay() {
  return useContext(ModalOverlayContext);
}
