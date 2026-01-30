"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Search, X } from "lucide-react";
import { User } from "@/types";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface HeaderProps {
  user?: User;
}

type NotificationRow = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
};

const formatRelativeTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "";
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes <= 0) return "A l'instant";
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Il y a ${diffDays} j`;
};

const isWarning = (type: string) => type === "warning" || type === "alert";
const isSuccess = (type: string) => type === "success" || type === "project";

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const [openNotif, setOpenNotif] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications]
  );

  const goProfile = () => {
    if (!user) return;
    router.push(`/dashboard/profile?role=${user.role}`);
  };

  const loadNotifications = async () => {
    if (!user?.id) return;
    setNotifLoading(true);
    setNotifError(null);
    const { data, error } = await supabase
      .from("notifications")
      .select("id,title,description,type,action_url,created_at,read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifLoading(false);
    if (error) {
      setNotifError(error.message);
      return;
    }
    setNotifications((data as NotificationRow[]) ?? []);
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (!unreadIds.length) return;
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((notif) => (unreadIds.includes(notif.id) ? { ...notif, read_at: now } : notif))
    );
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .in("id", unreadIds);
    if (error) {
      setNotifError(error.message);
    }
  };

  const removeNotif = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      setNotifError(error.message);
    }
  };

  const handleOpenNotif = (notif: NotificationRow) => {
    if (!notif.action_url) return;
    setOpenNotif(false);
    router.push(notif.action_url);
  };

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setOpenNotif(false);
      }
    };
    if (openNotif) {
      document.addEventListener("mousedown", onClickOutside);
    }
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [openNotif]);

  useEffect(() => {
    void loadNotifications();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const incoming = payload.new as NotificationRow;
          setNotifications((prev) => [incoming, ...prev].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (openNotif) {
      void markAllAsRead();
    }
  }, [openNotif]);

  return (
    <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-6 relative">
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Rechercher..."
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 relative">
        <div className="relative" ref={notifRef}>
          <button
            className="relative p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
            onClick={() => setOpenNotif((v) => !v)}
            aria-label="Notifications"
          >
            <img
              src="/images/bell.png"
              alt="Notifications"
              className="w-5 h-5 object-contain logo-blend"
            />
            {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
          </button>
          {openNotif && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-neutral-200 rounded-lg shadow-lg z-20">
              <div className="px-4 py-3 border-b border-neutral-200">
                <p className="text-sm font-semibold text-neutral-900">Notifications</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifLoading && (
                  <div className="px-4 py-3 text-sm text-neutral-500">Chargement...</div>
                )}
                {notifError && (
                  <div className="px-4 py-3 text-sm text-red-600">{notifError}</div>
                )}
                {!notifLoading && !notifError && notifications.length === 0 && (
                  <div className="px-4 py-3 text-sm text-neutral-500">Aucune notification</div>
                )}
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="px-4 py-3 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition-colors"
                    onClick={() => handleOpenNotif(notif)}
                  >
                    <div className="flex items-start gap-2">
                      {isWarning(notif.type) ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                      ) : isSuccess(notif.type) ? (
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                      ) : (
                        <img
                          src="/images/bell.png"
                          alt="Notification"
                          className="w-4 h-4 object-contain logo-blend mt-0.5"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-neutral-900">{notif.title}</p>
                        {notif.description && (
                          <p className="text-xs text-neutral-600">{notif.description}</p>
                        )}
                        <p className="text-[11px] text-neutral-500 mt-1">
                          {formatRelativeTime(notif.created_at)}
                        </p>
                      </div>
                      <button
                        aria-label="Supprimer la notification"
                        className="text-neutral-400 hover:text-neutral-700 transition-colors"
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeNotif(notif.id);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {user && (
          <button
            onClick={goProfile}
            className="flex items-center gap-3 hover:bg-neutral-100 px-2 py-1 rounded-lg transition-colors"
            aria-label="Ouvrir le profil"
          >
            <div className="text-right">
              <p className="text-sm font-medium text-neutral-900">{user.name}</p>
              <p className="text-xs text-neutral-500 capitalize">{user.role}</p>
            </div>
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-700 font-medium">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </button>
        )}
      </div>
    </header>
  );
}
