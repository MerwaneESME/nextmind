"use client";

export type BreadcrumbItem = { label: string; href?: string };

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-gray-600">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center gap-2">
          {item.href ? (
            <a href={item.href} className="hover:text-blue-600">
              {item.label}
            </a>
          ) : (
            <span className="font-semibold text-gray-900">{item.label}</span>
          )}
          {index < items.length - 1 && <span aria-hidden>→</span>}
        </div>
      ))}
    </nav>
  );
}

