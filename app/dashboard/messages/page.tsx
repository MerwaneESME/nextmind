"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Check, Search, Send, X } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { mapUserTypeToRole, useAuth } from "@/hooks/useAuth";
import {
  fetchProjectsForUser,
  inviteProjectMemberByEmail,
  ProjectSummary,
} from "@/lib/projectsDb";

type Conversation = {
  id: string;
  counterpartId: string | null;
  counterpartName: string;
  counterpartInitial: string;
  counterpartEmail: string | null;
  lastMessage: string;
  updatedAt: string;
  unread: number;
  counterpartRole: "professionnel" | "particulier";
};

type ConversationRow = {
  id: string;
  created_at: string | null;
};

type MemberRow = {
  conversation_id: string;
  user_id: string;
  profile: {
    id: string;
    full_name: string | null;
    company_name: string | null;
    email: string | null;
    user_type: "pro" | "client" | null;
  } | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  message: string | null;
  created_at: string | null;
  sender_id: string | null;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
};

type ProjectInviteRow = {
  id: string;
  project_id: string;
  role: string | null;
  status: string | null;
  invited_email: string | null;
  project: { id: string; name: string | null } | null;
};

const pickCounterpart = (members: MemberRow[], currentUserId: string) => {
  const others = members.filter((member) => member.user_id !== currentUserId);
  if (!others.length) return null;
  const preferred = others.find(
    (member) =>
      member.profile?.user_type === "pro" || member.profile?.user_type === "client"
  );
  return preferred ?? others[0];
};

const resolveName = (profile: MemberRow["profile"] | null) =>
  profile?.company_name || profile?.full_name || profile?.email || "Interlocuteur";

const resolveRole = (profile: MemberRow["profile"] | null): Conversation["counterpartRole"] => {
  if (profile?.user_type) {
    return mapUserTypeToRole(profile.user_type);
  }
  return "particulier";
};

const fallbackMessage = "D\u00e9marrez la conversation";
const INVITE_PREFIX = "__PROJECT_INVITE__:";

type InvitePayload = {
  project_id: string;
  project_name: string;
  role?: string | null;
  invite_id?: string | null;
};

const parseInvitePayload = (content?: string | null): InvitePayload | null => {
  if (!content || !content.startsWith(INVITE_PREFIX)) return null;
  try {
    const raw = content.slice(INVITE_PREFIX.length);
    const parsed = JSON.parse(raw) as InvitePayload;
    if (!parsed?.project_id) return null;
    return parsed;
  } catch {
    return null;
  }
};

const formatPreviewMessage = (content: string) => {
  const invite = parseInvitePayload(content);
  if (!invite) return content;
  return `Invitation au projet ${invite.project_name || "projet"}`;
};

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const roleParam = searchParams.get("role");
  const roleFromProfile = profile ? mapUserTypeToRole(profile.user_type) : "particulier";
  const userRole =
    roleParam === "professionnel" || roleParam === "particulier"
      ? roleParam
      : roleFromProfile;
  const currentUserId = user?.id ?? "";
  const proId = searchParams.get("proId");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, ChatMessage[]>>({});
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [failedTargets, setFailedTargets] = useState<string[]>([]);
  const [pendingInvites, setPendingInvites] = useState<ProjectInviteRow[]>([]);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const [inviteDecisions, setInviteDecisions] = useState<Record<string, "accepted" | "declined">>({});
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteProjects, setInviteProjects] = useState<ProjectSummary[]>([]);
  const [inviteProjectId, setInviteProjectId] = useState("");
  const [inviteRole, setInviteRole] = useState("client");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const loadMessages = async (conversationId: string) => {
    if (!conversationId) return;
    setMessagesLoading(true);
    const { data, error: messagesError } = await supabase
      .from("network_messages")
      .select("id,conversation_id,message,created_at,sender_id")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      setError(messagesError.message);
      setMessagesLoading(false);
      return;
    }

    const mapped = (data as MessageRow[] | null | undefined)?.map((message) => ({
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id ?? "",
      content: message.message ?? "",
      createdAt: message.created_at ?? new Date().toISOString(),
    }));

    setMessagesByConv((prev) => ({
      ...prev,
      [conversationId]: mapped ?? [],
    }));
    setMessagesLoading(false);
  };

  const loadConversations = async () => {
    if (!currentUserId) return;
    setLoading(true);
    setError(null);
    setConversationsLoaded(false);
    try {
      const { data: memberRows, error: memberError } = await supabase
        .from("network_conversation_members")
        .select("conversation_id")
        .eq("user_id", currentUserId);

      if (memberError) throw memberError;

      const conversationIds = Array.from(
        new Set((memberRows ?? []).map((row) => row.conversation_id).filter(Boolean))
      );

      if (!conversationIds.length) {
        setConversations([]);
        setSelectedId("");
        return;
      }

      const [conversationsRes, membersRes, messagesRes] = await Promise.all([
        supabase
          .from("network_conversations")
          .select("id,created_at")
          .in("id", conversationIds),
        supabase
          .from("network_conversation_members")
          .select(
            "conversation_id,user_id,profile:profiles!network_conversation_members_user_id_fkey(id,full_name,company_name,email,user_type)"
          )
          .in("conversation_id", conversationIds),
        supabase
          .from("network_messages")
          .select("id,conversation_id,message,created_at,sender_id")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (conversationsRes.error) throw conversationsRes.error;
      if (membersRes.error) throw membersRes.error;
      if (messagesRes.error) throw messagesRes.error;

      const membersByConversation: Record<string, MemberRow[]> = {};
      (membersRes.data as MemberRow[] | null | undefined)?.forEach((member) => {
        if (!member.conversation_id) return;
        if (!membersByConversation[member.conversation_id]) {
          membersByConversation[member.conversation_id] = [];
        }
        membersByConversation[member.conversation_id].push(member);
      });

      const lastMessageByConversation: Record<string, MessageRow> = {};
      (messagesRes.data as MessageRow[] | null | undefined)?.forEach((message) => {
        if (!message.conversation_id || lastMessageByConversation[message.conversation_id]) return;
        lastMessageByConversation[message.conversation_id] = message;
      });

      const nextConversations = (conversationsRes.data as ConversationRow[] | null | undefined)
        ?.map((conversation) => {
          const conversationMembers = membersByConversation[conversation.id] ?? [];
          const counterpart = pickCounterpart(conversationMembers, currentUserId);
          const counterpartName = resolveName(counterpart?.profile ?? null);
          const lastMessageRaw =
            lastMessageByConversation[conversation.id]?.message?.trim() || "";
          const lastMessage = lastMessageRaw
            ? formatPreviewMessage(lastMessageRaw)
            : fallbackMessage;
          const updatedAt =
            lastMessageByConversation[conversation.id]?.created_at ??
            conversation.created_at ??
            new Date().toISOString();

          return {
            id: conversation.id,
            counterpartId: counterpart?.profile?.id ?? counterpart?.user_id ?? null,
            counterpartName,
            counterpartInitial: counterpartName.charAt(0).toUpperCase(),
            counterpartEmail: counterpart?.profile?.email ?? null,
            lastMessage,
            updatedAt,
            unread: 0,
            counterpartRole: counterpart
              ? resolveRole(counterpart.profile ?? null)
              : userRole === "professionnel"
                ? "particulier"
                : "professionnel",
          } satisfies Conversation;
        })
        ?.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      const safeConversations = nextConversations ?? [];
      setConversations(safeConversations);
      setSelectedId((prev) => {
        if (prev && safeConversations.some((conv) => conv.id === prev)) {
          return prev;
        }
        return safeConversations[0]?.id ?? "";
      });
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les conversations.");
    } finally {
      setLoading(false);
      setConversationsLoaded(true);
    }
  };

  const loadInvites = async () => {
    if (!currentUserId) return;
    try {
      let query = supabase
        .from("project_members")
        .select("id,project_id,role,status,invited_email,project:projects(id,name)")
        .eq("status", "pending");
      if (profile?.email) {
        query = query.or(
          `user_id.eq.${currentUserId},invited_email.ilike.${profile.email}`
        );
      } else {
        query = query.eq("user_id", currentUserId);
      }
      const { data, error: inviteError } = await query;
      if (inviteError) throw inviteError;
      setPendingInvites((data as ProjectInviteRow[] | null | undefined) ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les invitations.");
    }
  };

  const loadInviteProjects = async () => {
    if (!currentUserId || userRole !== "professionnel") return;
    try {
      const projects = await fetchProjectsForUser(currentUserId);
      const manageable = projects.filter((project) => {
        const status = (project.memberStatus ?? "").toLowerCase();
        const role = (project.memberRole ?? "").toLowerCase();
        const allowedRoles = ["owner", "collaborator", "pro", "professionnel"];
        return status === "accepted" && allowedRoles.includes(role);
      });
      setInviteProjects(manageable);
      if (!inviteProjectId && manageable.length > 0) {
        setInviteProjectId(manageable[0].id);
      }
    } catch (err: any) {
      setInviteError(err?.message ?? "Impossible de charger les projets.");
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    if (!inviteId) return;
    setInviteActionId(inviteId);
    const { error: updateError } = await supabase
      .from("project_members")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", inviteId);
    if (updateError) {
      setError(updateError.message);
      setInviteActionId(null);
      return;
    }
    setInviteDecisions((prev) => ({ ...prev, [inviteId]: "accepted" }));
    await loadInvites();
    setInviteActionId(null);
  };

  const handleDeclineInvite = async (inviteId: string) => {
    if (!inviteId) return;
    setInviteActionId(inviteId);
    const { error: updateError } = await supabase
      .from("project_members")
      .update({ status: "declined" })
      .eq("id", inviteId);
    if (updateError) {
      setError(updateError.message);
      setInviteActionId(null);
      return;
    }
    setInviteDecisions((prev) => ({ ...prev, [inviteId]: "declined" }));
    await loadInvites();
    setInviteActionId(null);
  };

  const handleSendProjectInvite = async () => {
    if (userRole !== "professionnel" || !selectedConversation) return;
    if (!inviteProjectId) {
      setInviteError("Selectionnez un projet.");
      return;
    }
    if (!selectedConversation.counterpartEmail) {
      setInviteError("Email du contact indisponible.");
      return;
    }
    setInviteSending(true);
    setInviteError(null);
    try {
      const inviteRow = await inviteProjectMemberByEmail(
        currentUserId,
        inviteProjectId,
        selectedConversation.counterpartEmail,
        inviteRole
      );
      const projectName =
        inviteProjects.find((project) => project.id === inviteProjectId)?.name ??
        "Projet";
      const invitePayload = {
        project_id: inviteProjectId,
        project_name: projectName,
        role: inviteRole,
        invite_id: inviteRow?.id ?? null,
      };
      const inviteMessage = `${INVITE_PREFIX}${JSON.stringify(invitePayload)}`;
      const now = new Date().toISOString();
      const { data: messageRow, error: messageError } = await supabase
        .from("network_messages")
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: currentUserId,
          message: inviteMessage,
        })
        .select("id,conversation_id,message,created_at,sender_id")
        .maybeSingle();
      if (messageError) {
        throw messageError;
      }
      const newMessage: ChatMessage = {
        id: messageRow?.id ?? `${Date.now()}`,
        conversationId: selectedConversation.id,
        senderId: currentUserId,
        content: inviteMessage,
        createdAt: messageRow?.created_at ?? now,
      };
      setMessagesByConv((prev) => ({
        ...prev,
        [selectedConversation.id]: [
          ...(prev[selectedConversation.id] ?? []),
          newMessage,
        ],
      }));
      setConversations((prev) =>
        [...prev]
          .map((c) =>
            c.id === selectedConversation.id
              ? {
                  ...c,
                  lastMessage: formatPreviewMessage(inviteMessage),
                  updatedAt: newMessage.createdAt,
                  unread: 0,
                }
              : c
          )
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      );
      setInviteModalOpen(false);
    } catch (err: any) {
      setInviteError(err?.message ?? "Impossible d'envoyer l'invitation.");
    } finally {
      setInviteSending(false);
    }
  };

  const ensureConversationWith = async (targetId: string) => {
    if (!currentUserId || !targetId || targetId === currentUserId) return;
    if (failedTargets.includes(targetId)) return;
    const existing = conversations.find((conv) => conv.counterpartId === targetId);
    if (existing) {
      setSelectedId(existing.id);
      return;
    }

    setCreatingConversation(true);
    setError(null);
    try {
      const conversationId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const { error: createError } = await supabase
        .from("network_conversations")
        .insert({ id: conversationId });

      if (createError) {
        throw createError;
      }

      const { error: selfMemberError } = await supabase
        .from("network_conversation_members")
        .insert({ conversation_id: conversationId, user_id: currentUserId });

      if (selfMemberError) {
        throw selfMemberError;
      }

      const { error: targetMemberError } = await supabase
        .from("network_conversation_members")
        .insert({ conversation_id: conversationId, user_id: targetId });

      if (targetMemberError) {
        throw targetMemberError;
      }

      await loadConversations();
      setSelectedId(conversationId);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de cr\u00e9er la conversation.");
      setFailedTargets((prev) =>
        prev.includes(targetId) ? prev : [...prev, targetId]
      );
    } finally {
      setCreatingConversation(false);
    }
  };

  useEffect(() => {
    if (!authLoading && currentUserId) {
      void loadConversations();
      void loadInvites();
    }
  }, [authLoading, currentUserId]);

  useEffect(() => {
    if (!selectedId || !currentUserId) return;
    const conversationId = selectedId;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "network_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newRow = payload.new as MessageRow | null;
          if (!newRow?.id) return;
          setMessagesByConv((prev) => {
            const existing = prev[conversationId] ?? [];
            if (existing.some((msg) => msg.id === newRow.id)) {
              return prev;
            }
            const nextMessage: ChatMessage = {
              id: newRow.id,
              conversationId: newRow.conversation_id,
              senderId: newRow.sender_id ?? "",
              content: newRow.message ?? "",
              createdAt: newRow.created_at ?? new Date().toISOString(),
            };
            return {
              ...prev,
              [conversationId]: [...existing, nextMessage],
            };
          });

          const preview = formatPreviewMessage(newRow.message ?? "");
          setConversations((prev) =>
            [...prev]
              .map((conv) =>
                conv.id === conversationId
                  ? {
                      ...conv,
                      lastMessage: preview || conv.lastMessage,
                      updatedAt: newRow.created_at ?? new Date().toISOString(),
                      unread: 0,
                    }
                  : conv
              )
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          );

          const invitePayload = parseInvitePayload(newRow.message ?? "");
          if (invitePayload) {
            void loadInvites();
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedId, currentUserId]);

  useEffect(() => {
    if (!authLoading && currentUserId && userRole === "professionnel") {
      void loadInviteProjects();
    }
  }, [authLoading, currentUserId, userRole]);

  useEffect(() => {
    if (selectedId) {
      void loadMessages(selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!proId || !currentUserId || !conversationsLoaded || loading || creatingConversation) return;
    if (failedTargets.includes(proId)) return;
    const existing = conversations.find((conv) => conv.counterpartId === proId);
    if (existing) {
      setSelectedId(existing.id);
      return;
    }
    void ensureConversationWith(proId);
  }, [proId, currentUserId, conversationsLoaded, loading, creatingConversation, conversations]);

  const filteredConversations = useMemo(() => {
    const query = search.toLowerCase();
    return conversations.filter(
      (c) =>
        c.counterpartName.toLowerCase().includes(query) ||
        c.lastMessage.toLowerCase().includes(query)
    );
  }, [conversations, search]);

  const selectedConversation =
    conversations.find((c) => c.id === selectedId) ?? filteredConversations[0];

  const selectedMessages = selectedConversation
    ? messagesByConv[selectedConversation.id] ?? []
    : [];

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
    );
  };

  const handleSend = async () => {
    if (!selectedConversation || !input.trim() || !currentUserId) return;
    const content = input.trim();
    const now = new Date().toISOString();
    const { data, error: insertError } = await supabase
      .from("network_messages")
      .insert({
        conversation_id: selectedConversation.id,
        sender_id: currentUserId,
        message: content,
      })
      .select("id,conversation_id,message,created_at,sender_id")
      .maybeSingle();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    const newMessage: ChatMessage = {
      id: data?.id ?? `${Date.now()}`,
      conversationId: selectedConversation.id,
      senderId: currentUserId,
      content,
      createdAt: data?.created_at ?? now,
    };

    setMessagesByConv((prev) => ({
      ...prev,
      [selectedConversation.id]: [
        ...(prev[selectedConversation.id] ?? []),
        newMessage,
      ],
    }));

    setConversations((prev) =>
      [...prev]
        .map((c) =>
          c.id === selectedConversation.id
            ? { ...c, lastMessage: content, updatedAt: newMessage.createdAt, unread: 0 }
            : c
        )
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    );

    setInput("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <img
          src="/images/messages.png"
          alt="Messages"
          className="h-28 w-28 object-contain logo-blend"
        />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Messages</h1>
          <p className="text-gray-600">Communiquez avec les professionnels et partenaires.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Rechercher un contact..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {loading && (
                <div className="p-4 text-sm text-gray-500">Chargement des conversations...</div>
              )}
              {!loading && filteredConversations.length === 0 && (
                <div className="p-4 text-sm text-gray-500">
                  Aucune conversation pour le moment.
                </div>
              )}
              {!loading &&
                filteredConversations.map((conv) => {
                  const isActive = selectedConversation?.id === conv.id;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSelect(conv.id)}
                      className={`p-4 cursor-pointer transition-colors ${
                        isActive ? "bg-primary-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-700 font-medium">
                            {conv.counterpartInitial}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {conv.counterpartName}
                          </p>
                          <p className="text-xs text-gray-500 truncate mt-1">
                            {conv.lastMessage}
                          </p>
                        </div>
                        {conv.unread > 0 && (
                          <span className="text-xs bg-primary-600 text-white rounded-full px-2 py-0.5">
                            {conv.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-0 flex flex-col h-[600px]">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {selectedConversation?.counterpartName ?? "Aucune conversation"}
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedConversation
                    ? `Contact ${selectedConversation.counterpartRole}`
                    : ""}
                </p>
              </div>
              {userRole === "professionnel" && selectedConversation && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setInviteError(null);
                    setInviteModalOpen(true);
                  }}
                >
                  Inviter au projet
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {messagesLoading && (
                <div className="text-center text-sm text-gray-500">Chargement des messages...</div>
              )}
              {!messagesLoading &&
                selectedMessages.map((message) => {
                  const isMine = message.senderId === currentUserId;
                  const invitePayload = parseInvitePayload(message.content);
                  const inviteRow = invitePayload
                    ? pendingInvites.find((invite) => invite.project_id === invitePayload.project_id)
                    : null;
                  const isPendingInvite = Boolean(inviteRow && inviteRow.status === "pending");
                  const decision =
                    invitePayload?.invite_id ? inviteDecisions[invitePayload.invite_id] : null;
                  const decisionLabel =
                    decision === "accepted"
                      ? "Invitation acceptée."
                      : decision === "declined"
                        ? "Invitation refusée."
                        : "Invitation envoyée.";
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      {!isMine && (
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-600 text-sm">
                            {selectedConversation?.counterpartInitial ?? "C"}
                          </span>
                        </div>
                      )}
                      {invitePayload ? (
                        <div className="max-w-[75%] rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
                          <div className="text-sm font-semibold text-gray-900">
                            Invitation au projet {invitePayload.project_name || "projet"}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Rôle proposé : {invitePayload.role || "membre"}
                          </div>
                          {isPendingInvite ? (
                            <div className="mt-3 flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleAcceptInvite(inviteRow?.id ?? "")}
                                disabled={inviteActionId === inviteRow?.id}
                                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
                              >
                                <Check className="w-4 h-4" />
                                Accepter
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleDeclineInvite(inviteRow?.id ?? "")}
                                disabled={inviteActionId === inviteRow?.id}
                                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                              >
                                <X className="w-4 h-4" />
                                Refuser
                              </Button>
                            </div>
                          ) : (
                            <div className="mt-2 text-xs text-gray-500">{decisionLabel}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-2">
                            {formatDateTime(message.createdAt)}
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            isMine ? "bg-primary-600" : "bg-gray-100"
                          }`}
                        >
                          <p className={`text-sm ${isMine ? "text-white" : "text-gray-900"}`}>
                            {message.content}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              isMine ? "text-primary-100" : "text-gray-500"
                            }`}
                          >
                            {formatDateTime(message.createdAt)}
                          </p>
                        </div>
                      )}
                      {isMine && (
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-700 text-sm">
                            {userRole === "professionnel" ? "P" : "M"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              {!messagesLoading && selectedConversation && selectedMessages.length === 0 && (
                <div className="text-center text-sm text-gray-500">
                  Aucun message pour le moment.
                </div>
              )}
              {!messagesLoading && !selectedConversation && (
                <div className="text-center text-sm text-gray-500">
                  Aucune conversation sélectionnée.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <Input
                  placeholder={
                    selectedConversation
                      ? "Tapez votre message..."
                      : "S\u00e9lectionnez une conversation pour d\u00e9marrer"
                  }
                  className="flex-1"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={!selectedConversation}
                />
                <Button onClick={handleSend} disabled={!selectedConversation || !input.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-md w-full p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Inviter au projet</h3>
                <p className="text-sm text-neutral-600">
                  {selectedConversation?.counterpartName ?? "Contact"}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setInviteModalOpen(false)}>
                Fermer
              </Button>
            </div>
            {inviteError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">
                {inviteError}
              </div>
            )}
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Projet</label>
                {inviteProjects.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    Aucun projet disponible pour inviter ce contact.
                  </div>
                ) : (
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={inviteProjectId}
                    onChange={(event) => setInviteProjectId(event.target.value)}
                  >
                    {inviteProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rôle</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value)}
                >
                  <option value="client">Client</option>
                  <option value="collaborator">Collaborateur</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setInviteModalOpen(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={handleSendProjectInvite}
                  disabled={!inviteProjectId || inviteSending || inviteProjects.length === 0}
                >
                  {inviteSending ? "Envoi..." : "Envoyer l'invitation"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
