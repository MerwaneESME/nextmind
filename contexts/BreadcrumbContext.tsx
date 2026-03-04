"use client";

import { createContext, useContext, useState } from "react";

export type BreadcrumbItem = { label: string; href?: string };

type BreadcrumbContextType = {
  breadcrumb: BreadcrumbItem[];
  setBreadcrumb: (items: BreadcrumbItem[]) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextType>({
  breadcrumb: [],
  setBreadcrumb: () => {},
});

export const useBreadcrumb = () => useContext(BreadcrumbContext);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  return (
    <BreadcrumbContext.Provider value={{ breadcrumb, setBreadcrumb }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}
