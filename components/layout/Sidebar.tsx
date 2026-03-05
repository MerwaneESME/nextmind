"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";
import { supabase } from "@/lib/supabaseClient";

interface SidebarProps {
  userRole: UserRole;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  user?: { name: string; role: string };
}

const particulierNavItems = [
  { href: "/dashboard", label: "Mes projets", iconSrc: "/images/folder-open.png" },
  { href: "/dashboard/professionnels", label: "Professionnels", iconSrc: "/images/users-three.png" },
  { href: "/dashboard/messages", label: "Messages", iconSrc: "/images/chats.png" },
];

const professionnelNavItems = [
  { href: "/dashboard", label: "Tableau de bord", iconSrc: "/images/squares-four.png" },
  { href: "/dashboard/projets", label: "Projets", iconSrc: "/images/folder-open.png" },
  { href: "/dashboard/devis", label: "Devis", iconSrc: "/images/file.png" },
  { href: "/dashboard/professionnels", label: "Professionnels", iconSrc: "/images/users-three.png" },
  { href: "/dashboard/portfolio", label: "Portfolio", iconSrc: "/images/article.png" },
  { href: "/dashboard/messages", label: "Messages", iconSrc: "/images/chats.png" },
];

export function Sidebar({ userRole, collapsed = false, onToggleCollapse, user }: SidebarProps) {
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
        "fixed left-0 top-0 h-full flex flex-col z-40",
        "bg-gradient-to-b from-slate-900 to-indigo-950",
        "transition-[width] duration-200 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Afficher le menu" : "Masquer le menu"}
        className="absolute top-20 -right-3 w-6 h-6 rounded-full bg-white shadow-md border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 transition-colors z-10"
      >
        {collapsed
          ? <ChevronRight className="h-3 w-3 text-neutral-600" />
          : <ChevronLeft className="h-3 w-3 text-neutral-600" />
        }
      </button>

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-1 py-4 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href + "/"));

          return (
            <Link
              key={item.href}
              href={currentRole ? `${item.href}?role=${currentRole}` : item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "sidebar-item",
                isActive && "sidebar-item-active",
                collapsed && "justify-center px-0"
              )}
            >
              <img
                src={item.iconSrc}
                alt={item.label}
                className="w-5 h-5 object-contain flex-shrink-0 brightness-0 invert"
              />
              {!collapsed && <span className="text-current">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom — Assistant IA + Se déconnecter */}
      <div className={cn("pb-3 space-y-1 border-t border-white/10 pt-3", collapsed ? "px-2" : "px-3")}>
        <Link
          href={currentRole ? `/dashboard/assistant?role=${currentRole}` : "/dashboard/assistant"}
          title={collapsed ? "Assistant IA" : undefined}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300",
            "bg-gradient-to-r from-primary-400/20 to-primary-600/20",
            "hover:from-primary-400/30 hover:to-primary-600/30 hover:text-white",
            "transition-all duration-200 border border-primary-400/20",
            collapsed && "justify-center px-0"
          )}
        >
          <img
            src="/images/grey/robot.png"
            alt="Assistant IA"
            className="w-5 h-5 object-contain flex-shrink-0 brightness-0 invert"
          />
          {!collapsed && <span className="text-current">Assistant IA</span>}
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          title="Se déconnecter"
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300",
            "hover:bg-white/10 hover:text-white transition-all duration-200",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-current">Se déconnecter</span>}
        </button>
      </div>
    </aside>
  );
}
