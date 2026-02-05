"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";
import { supabase } from "@/lib/supabaseClient";

interface SidebarProps {
  userRole: UserRole;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const particulierNavItems = [
  { href: "/dashboard", label: "Mes projets", iconSrc: "/images/folder-open.png" },
  { href: "/dashboard/professionnels", label: "Professionnels", iconSrc: "/images/users-three.png" },
  { href: "/dashboard/messages", label: "Messages", iconSrc: "/images/chats.png" },
  { href: "/dashboard/settings", label: "Parametres", iconSrc: "/images/gear.png" },
];

const professionnelNavItems = [
  { href: "/dashboard", label: "Tableau de bord", iconSrc: "/images/squares-four.png" },
  { href: "/dashboard/projets", label: "Projets", iconSrc: "/images/folder-open.png" },
  { href: "/dashboard/devis", label: "Devis", iconSrc: "/images/file.png" },
  { href: "/dashboard/professionnels", label: "Professionnels", iconSrc: "/images/users-three.png" },
  { href: "/dashboard/portfolio", label: "Portfolio", iconSrc: "/images/article.png" },
  { href: "/dashboard/messages", label: "Messages", iconSrc: "/images/chats.png" },
  { href: "/dashboard/settings", label: "Parametres", iconSrc: "/images/gear.png" },
];

export function Sidebar({ userRole, collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentRole: UserRole = userRole;
  const navItems = userRole === "professionnel" ? professionnelNavItems : particulierNavItems;

  const handleLogout = async () => {
    const confirmed =
      typeof window !== "undefined" && window.confirm("Etes-vous sur de vouloir vous deconnecter ?");
    if (!confirmed) return;
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full bg-white border-r border-neutral-200 flex flex-col",
        "transition-[width] duration-200 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Afficher le menu" : "Masquer le menu"}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2",
          "h-9 w-9 rounded-full border border-neutral-200 bg-white shadow-sm",
          "grid place-items-center text-neutral-700 hover:bg-neutral-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        )}
      >
        <span className="text-lg leading-none" aria-hidden>
          {collapsed ? "›" : "‹"}
        </span>
      </button>

      <div className={cn("border-b border-neutral-200", collapsed ? "p-4" : "p-6")}>
        <Link
          href={currentRole ? `/dashboard?role=${currentRole}` : "/dashboard"}
          className={cn("flex items-center gap-2", collapsed && "justify-center")}
        >
          <img
            src="/images/nextmind.png"
            alt="NextMind"
            className={cn("h-8 w-auto", collapsed && "h-7")}
          />
        </Link>
      </div>

      <nav className={cn("flex-1 space-y-1", collapsed ? "p-2" : "p-4")}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href + "/"));

          return (
            <Link
              key={item.href}
              href={currentRole ? `${item.href}?role=${currentRole}` : item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "px-4 py-2.5",
                isActive
                  ? "bg-primary-50 text-primary-700 font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                  : "text-neutral-700 hover:bg-neutral-100"
              )}
            >
              <img
                src={item.iconSrc}
                alt={item.label}
                className="w-5 h-5 object-contain logo-blend"
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={cn("border-t border-neutral-200 space-y-1", collapsed ? "p-2" : "p-4")}>
        <Link
          href={currentRole ? `/dashboard/assistant?role=${currentRole}` : "/dashboard/assistant"}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg transition-colors",
            collapsed ? "justify-center px-2 py-2.5" : "px-4 py-2.5",
            pathname === "/dashboard/assistant"
              ? "bg-primary-50 text-primary-700 font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
              : "text-neutral-700 hover:bg-neutral-100"
          )}
        >
          <img
            src="/images/grey/robot.png"
            alt="Assistant IA"
            className="w-5 h-5 object-contain logo-blend"
          />
          {!collapsed && <span>Assistant IA</span>}
        </Link>
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg text-red-600 !text-red-600 hover:bg-red-50 transition-colors",
            collapsed ? "justify-center px-2 py-2.5" : "px-4 py-2.5"
          )}
        >
          <img
            src="/images/sign-out.png"
            alt="Deconnexion"
            className="w-5 h-5 object-contain"
          />
          {!collapsed && <span className="text-red-600">Deconnexion</span>}
        </button>
      </div>
    </aside>
  );
}
