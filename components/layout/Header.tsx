"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, CheckCircle, Check, Info, MessageSquare, UserPlus, X } from "lucide-react";
import { User } from "@/types";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { cn } from "@/lib/utils";

interface HeaderProps {
  user?: User;
}

type NotifMetadata = {
  actor_name?: string;
  actor_avatar?: string | null;
  project_name?: string;
  project_id?: string;
  document_name?: string;
  message_preview?: string;
  is_group?: boolean;
};

type NotificationRow = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
  metadata?: NotifMetadata | null;
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

type NotifTab = "all" | "unread" | "alerts";

function NotifIcon({ type }: { type: string }) {
  if (isWarning(type))
    return <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-4 h-4 text-amber-600" /></div>;
  if (isSuccess(type))
    return <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0"><CheckCircle className="w-4 h-4 text-emerald-600" /></div>;
  if (type === "message" || type === "chat")
    return <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0"><MessageSquare className="w-4 h-4 text-primary-600" /></div>;
  if (type === "invite" || type === "member")
    return <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0"><UserPlus className="w-4 h-4 text-violet-600" /></div>;
  if (type === "document")
    return <div className="h-9 w-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0"><Info className="w-4 h-4 text-sky-600" /></div>;
  return <div className="h-9 w-9 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0"><Info className="w-4 h-4 text-neutral-500" /></div>;
}

// Avatar enrichi avec photo ou initiales pour les notifs d'acteur
function NotifActorAvatar({ metadata, type }: { metadata?: NotifMetadata | null; type: string }) {
  const name = metadata?.actor_name ?? "";
  const avatar = metadata?.actor_avatar;
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";

  if (!name && !avatar) return <NotifIcon type={type} />;

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className="h-9 w-9 rounded-full object-cover flex-shrink-0 ring-1 ring-white shadow-sm"
      />
    );
  }

  // Couleur de l'avatar selon le type
  const bgClass =
    type === "message" || type === "chat"
      ? "from-primary-400 to-primary-600"
      : type === "member" || type === "invite"
      ? "from-violet-400 to-violet-600"
      : "from-neutral-400 to-neutral-600";

  return (
    <div className={`h-9 w-9 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-semibold text-white bg-gradient-to-br ${bgClass} ring-1 ring-white shadow-sm`}>
      {initials}
    </div>
  );
}

function NotificationsPanel({
  notifications, loading, error, onMarkAllRead, onRemove, onOpen,
}: {
  notifications: NotificationRow[];
  loading: boolean;
  error: string | null;
  onMarkAllRead: () => void;
  onRemove: (id: string) => void;
  onOpen: (n: NotificationRow) => void;
}) {
  const [tab, setTab] = useState<NotifTab>("all");
  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const alertCount = notifications.filter((n) => isWarning(n.type)).length;

  const filtered = notifications.filter((n) => {
    if (tab === "unread") return !n.read_at;
    if (tab === "alerts") return isWarning(n.type);
    return true;
  });

  const tabs: { key: NotifTab; label: string; count: number }[] = [
    { key: "all", label: "Tout", count: notifications.length },
    { key: "unread", label: "Non lus", count: unreadCount },
    { key: "alerts", label: "Alertes", count: alertCount },
  ];

  return (
    <div className="fixed top-[76px] right-6 w-[420px] bg-white border border-neutral-200 rounded-2xl shadow-xl z-[200] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-neutral-900">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Tout marquer lu
            </button>
          )}
        </div>
        {/* Tabs */}
        <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                tab === t.key
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  "inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold",
                  tab === t.key ? "bg-primary-100 text-primary-700" : "bg-neutral-200 text-neutral-600"
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-neutral-100">
        {loading && (
          <div className="px-5 py-8 text-sm text-neutral-400 text-center">Chargement...</div>
        )}
        {error && (
          <div className="px-5 py-4 text-sm text-red-600">{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-neutral-400" />
            </div>
            <p className="text-sm text-neutral-500 font-medium">Aucune notification</p>
          </div>
        )}
        {filtered.map((notif) => {
          const meta = notif.metadata;
          const hasActor = !!(meta?.actor_name || meta?.actor_avatar);
          const isMsg = notif.type === "message" || notif.type === "chat";
          const isDoc = notif.type === "document";
          const isMember = notif.type === "member" || notif.type === "invite";
          const showActorAvatar = hasActor && (isMsg || isMember);

          return (
            <div
              key={notif.id}
              onClick={() => onOpen(notif)}
              className={cn(
                "flex items-start gap-3 px-5 py-4 cursor-pointer transition-colors hover:bg-neutral-50/80",
                !notif.read_at && "bg-primary-50/40"
              )}
            >
              {showActorAvatar
                ? <NotifActorAvatar metadata={meta} type={notif.type} />
                : <NotifIcon type={notif.type} />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("text-sm leading-snug", !notif.read_at ? "font-semibold text-neutral-900" : "font-medium text-neutral-800")}>
                    {notif.title}
                  </p>
                  {!notif.read_at && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                  )}
                </div>

                {/* Contexte projet pour messages/documents/membres */}
                {meta?.project_name && (isMsg || isDoc || isMember) && (
                  <p className="text-[10px] font-semibold text-primary-600 mt-0.5 truncate">
                    {isMsg && meta.is_group ? `💬 ${meta.project_name}` : isDoc ? `📁 ${meta.project_name}` : `👥 ${meta.project_name}`}
                  </p>
                )}

                {/* Aperçu du message ou description */}
                {(notif.description || meta?.message_preview) && (
                  <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {meta?.message_preview ?? notif.description}
                  </p>
                )}

                <p className="text-[11px] text-neutral-400 mt-1.5 font-medium">{formatRelativeTime(notif.created_at)}</p>
              </div>
              <button
                aria-label="Supprimer"
                onClick={(e) => { e.stopPropagation(); onRemove(notif.id); }}
                className="p-1 rounded-lg text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100 transition-colors flex-shrink-0 mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const { breadcrumb } = useBreadcrumb();
  const [openNotif, setOpenNotif] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  const goToDashboard = () => {
    router.push(user?.role ? `/dashboard?role=${user.role}` : "/dashboard");
  };
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
      .select("id,title,description,type,action_url,created_at,read_at,metadata")
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
    void removeNotif(notif.id);
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

  useEffect(() => {
    if (!openNotif) return;
    const handleScroll = () => setOpenNotif(false);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [openNotif]);

  return (
    <header className="h-20 bg-white border-b border-neutral-200 shadow-sm flex items-center justify-end px-6 sticky top-0 z-50">
      {/* Breadcrumb — left side */}
      {breadcrumb.length > 0 ? (
        <nav aria-label="Fil d'Ariane" className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-2 text-sm">
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-neutral-300 select-none">›</span>}
              {item.href ? (
                <button
                  onClick={() => router.push(item.href!)}
                  className="text-neutral-500 hover:text-primary-600 transition-colors font-medium"
                >
                  {item.label}
                </button>
              ) : (
                <span className="text-neutral-800 font-semibold truncate max-w-[220px]">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      {/* Logo — centered */}
      <button
        type="button"
        onClick={goToDashboard}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[55%] flex items-center hover:opacity-75 transition-opacity focus-visible:outline-none rounded"
        aria-label="Retour au tableau de bord"
      >
        <img src="/images/nextmind.png" alt="NextMind" className="h-12 w-auto" />
      </button>

      {/* Right side — notifications + user pill */}
      <div className="flex items-center gap-2 relative">
        <div className="bg-white border border-neutral-200 shadow-md rounded-2xl px-3 py-2 flex items-center gap-2">
          <div className="relative" ref={notifRef}>
            <button
              className="relative p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-white/60 rounded-lg transition-colors"
              onClick={() => setOpenNotif((v) => !v)}
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          {openNotif && (
            <NotificationsPanel
              notifications={notifications}
              loading={notifLoading}
              error={notifError}
              onMarkAllRead={markAllAsRead}
              onRemove={removeNotif}
              onOpen={handleOpenNotif}
            />
          )}
        </div>

          {user && (
            <button
              onClick={goProfile}
              className="flex items-center gap-2.5 hover:bg-white/60 px-1.5 py-1 rounded-xl transition-colors"
              aria-label="Ouvrir le profil"
            >
              <div className="text-right">
                <p className="text-sm font-medium text-neutral-900 leading-tight">{user.name}</p>
                <p className="text-xs text-neutral-500 capitalize">{user.role}</p>
              </div>
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={`Avatar de ${user.name}`}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0 shadow-sm border border-neutral-200"
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-white font-semibold text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
