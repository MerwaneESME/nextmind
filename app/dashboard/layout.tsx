"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { UserRole } from "@/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { ModalOverlayProvider } from "@/contexts/ModalOverlayContext";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const roleParam = searchParams.get("role");
  const tabParam = searchParams.get("tab");
  const fallbackRole: UserRole = roleParam === "professionnel" ? "professionnel" : "particulier";
  const { session, user, loading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const hideChatWidget = true; // Bouton Agent IA désactivé pour les deux rôles

  const activeUser = useMemo(() => {
    if (user) return user;
    if (!session?.user?.id) return null;
    const email = session.user.email ?? "";
    return {
      id: session.user.id,
      email,
      name: email || "Utilisateur",
      role: fallbackRole,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    };
  }, [user, session, fallbackRole]);

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("nextmind.sidebarCollapsed");
      if (saved === "1") setSidebarCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("nextmind.sidebarCollapsed", sidebarCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  if (loading || !session || !activeUser) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-600">
        Chargement...
      </div>
    );
  }

  return (
    <BreadcrumbProvider>
      <ModalOverlayProvider>
      <div className="relative min-h-screen overflow-x-hidden bg-neutral-50">
        {/* Full-width top gradient spanning sidebar + content */}
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[45] h-24 bg-gradient-to-b from-black/[0.06] to-transparent" />
        <Sidebar
          userRole={activeUser.role}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          user={{ name: activeUser.name, role: activeUser.role, avatarUrl: activeUser.avatarUrl }}
        />
        <div
          className={cn(
            "relative transition-[margin] duration-200 ease-in-out",
            sidebarCollapsed ? "ml-16" : "ml-64"
          )}
        >
          <Header user={activeUser} />
          <main className="p-6">{children}</main>
        </div>
        {!hideChatWidget && (
          <ChatWidget
            userRole={activeUser.role}
            userId={activeUser.id}
            offsetBottom={pathname?.includes("/dashboard/messages") ? 96 : undefined}
          />
        )}
      </div>
      </ModalOverlayProvider>
    </BreadcrumbProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-600">
        Chargement...
      </div>
    }>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
