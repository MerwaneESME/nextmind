"use client";

import { useEffect, useMemo } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { UserRole } from "@/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const roleParam = searchParams.get("role");
  const fallbackRole: UserRole = roleParam === "professionnel" ? "professionnel" : "particulier";
  const { session, user, loading } = useAuth();

  const activeUser = useMemo(() => {
    if (user) return user;
    if (!session?.user?.id) return null;
    const email = session.user.email ?? "";
    return {
      id: session.user.id,
      email,
      name: email || "Utilisateur",
      role: fallbackRole,
      createdAt: new Date().toISOString(),
    };
  }, [user, session, fallbackRole]);

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (loading || !session || !activeUser) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-600">
        Chargement...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar userRole={activeUser.role} />
      <div className="ml-64">
        <Header user={activeUser} />
        <main className="p-6">{children}</main>
      </div>
      <ChatWidget
        userRole={activeUser.role}
        userId={activeUser.id}
        offsetBottom={pathname?.includes("/dashboard/messages") ? 96 : undefined}
      />
    </div>
  );
}
