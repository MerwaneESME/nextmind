"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserRole } from "@/types";
import { supabase } from "@/lib/supabaseClient";

interface SidebarProps {
  userRole: UserRole;
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
              <img
                src={item.iconSrc}
                alt={item.label}
                className="w-5 h-5 object-contain logo-blend"
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-neutral-200 space-y-1">
        <Link
          href={currentRole ? `/dashboard/assistant?role=${currentRole}` : "/dashboard/assistant"}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors",
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
          <span>Assistant IA</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-600 !text-red-600 hover:bg-red-50 transition-colors"
        >
          <img
            src="/images/sign-out.png"
            alt="Deconnexion"
            className="w-5 h-5 object-contain"
          />
          <span className="text-red-600">Deconnexion</span>
        </button>
      </div>
    </aside>
  );
}
