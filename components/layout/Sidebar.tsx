"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Users,
  Newspaper,
  MessageSquare,
  Settings,
  LogOut,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";
import { supabase } from "@/lib/supabaseClient";

interface SidebarProps {
  userRole: UserRole;
}

const particulierNavItems = [
  { href: "/dashboard", label: "Mes projets", icon: FolderKanban },
  { href: "/dashboard/professionnels", label: "Professionnels", icon: Users },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/settings", label: "Parametres", icon: Settings },
];

const professionnelNavItems = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/dashboard/projets", label: "Projets", icon: FolderKanban },
  { href: "/dashboard/devis", label: "Devis", icon: FileText },
  { href: "/dashboard/professionnels", label: "Professionnels", icon: Users },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: Newspaper },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/settings", label: "Parametres", icon: Settings },
];

export function Sidebar({ userRole }: SidebarProps) {
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
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-neutral-200 flex flex-col">
      <div className="p-6 border-b border-neutral-200">
        <Link
          href={currentRole ? `/dashboard?role=${currentRole}` : "/dashboard"}
          className="flex items-center gap-2"
        >
          <img
            src="/images/nextmind.png"
            alt="NextMind"
            className="h-8 w-auto"
          />
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href + "/"));

          return (
            <Link
              key={item.href}
              href={currentRole ? `${item.href}?role=${currentRole}` : item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-700 font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                  : "text-neutral-700 hover:bg-neutral-100"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-neutral-200 space-y-1">
        <Link
          href={currentRole ? `/chat?role=${currentRole}` : "/chat"}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          <Bot className="w-5 h-5" />
          <span>Assistant IA</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Deconnexion</span>
        </button>
      </div>
    </aside>
  );
}
