"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Check, ChevronDown, ChevronUp, File, FileText, Image, MessageSquare, Search, Send, X } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { mapUserTypeToRole, useAuth } from "@/hooks/useAuth";
import {
  fetchProjectsForUser,
  fetchProjectsByCreator,
  getProjectDemandeSummary,
  inviteProjectMemberByEmail,
  ProjectSummary,
  type DemandeProjetSummary,
  type QuestionnaireData,
} from "@/lib/projectsDb";
import { getDocuments, type DocumentRow } from "@/lib/db/documentsDb";
import {
  formatQuestionnaireForDisplay,
  getProjectTypeLabel,
  getQuestionnaireFields,
} from "@/lib/projectQuestionnaire";

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

const firstOrNull = <T,>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return value as T;
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
const SHARE_PREFIX = "__PROJECT_SHARE__:";

type InvitePayload = {
  project_id: string;
  project_name: string;
  role?: string | null;
  invite_id?: string | null;
};

type SharePayload = {
  project_id: string;
  project_name: string;
  invite_id?: string | null;
  recap: DemandeProjetSummary;
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

function normalizeSharePayload(parsed: SharePayload): SharePayload | null {
  if (!parsed?.project_id) return null;
  const recap = parsed.recap;
  if (!recap || typeof recap !== "object" || Array.isArray(recap)) return null;
  const r = recap as Record<string, unknown>;
  return {
    project_id: parsed.project_id,
    project_name: (parsed.project_name ?? r.titre ?? "Projet") as string,
    invite_id: parsed.invite_id ?? null,
    recap: {
      projectId: (r.projectId ?? parsed.project_id) as string,
      titre: (r.titre ?? parsed.project_name ?? "Projet") as string,
      typeTravaux: (r.typeTravaux ?? null) as string | null,
      adresse: (r.adresse ?? null) as string | null,
      codePostal: (r.codePostal ?? null) as string | null,
      ville: (r.ville ?? null) as string | null,
      description: (r.description ?? null) as string | null,
      budgetMin: (r.budgetMin ?? null) as number | null,
      budgetMax: (r.budgetMax ?? null) as number | null,
      dateDebutSouhaitee: (r.dateDebutSouhaitee ?? null) as string | null,
      surfaceSqm: (r.surfaceSqm ?? null) as number | null,
      questionnaireData: (r.questionnaireData ?? null) as QuestionnaireData | null,
    },
  };
}

const parseSharePayload = (content?: string | null): SharePayload | null => {
  const trimmed = typeof content === "string" ? content.trim().replace(/^\uFEFF/, "") : "";
  if (!trimmed) return null;
  const prefixMatch = trimmed.match(/^_*PROJECT_SHARE_*:?\s*/i);
  if (!prefixMatch) return null;
  let raw = trimmed.slice(prefixMatch[0].length).trim();
  if (!raw) return null;
  for (let jsonStr of [raw, raw.match(/\{[\s\S]*\}/)?.[0]]) {
    if (!jsonStr) continue;
    jsonStr = jsonStr
      .replace(/\('projectld'/gi, '{"projectId"')
      .replace(/\('projectId'/gi, '{"projectId"')
      .replace(/"projectld"/gi, '"projectId"')
      .replace(/'projectld'\s*:/gi, '"projectId":')
      .replace(/'projectId'\s*:/gi, '"projectId":')
      .replace(/:\s*'([^']*)'/g, ': "$1"');
    try {
      const parsed = JSON.parse(jsonStr) as SharePayload;
      const result = normalizeSharePayload(parsed);
      if (result) return result;
    } catch {
      /* try next */
    }
  }
  const extracted = extractSharePayloadFromRaw(raw);
  if (extracted) return extracted;
  return null;
};

function extractSharePayloadFromRaw(raw: string): SharePayload | null {
  const projectId = raw.match(/"project_id"\s*:\s*["']?([^"',}\s]+)["']?/)?.[1] ?? raw.match(/"projectId"\s*:\s*["']?([^"',}\s]+)["']?/)?.[1];
  if (!projectId) return null;
  const projectName = (raw.match(/"project_name"\s*:\s*"([^"]*)"/)?.[1] ?? raw.match(/"titre"\s*:\s*"([^"]*)"/)?.[1] ?? "Projet") || "Projet";
  const titre = raw.match(/"titre"\s*:\s*"([^"]*)"/)?.[1] ?? projectName;
  const typeTravaux = raw.match(/"typeTravaux"\s*:\s*"([^"]*)"/)?.[1] ?? null;
  const adresse = raw.match(/"adresse"\s*:\s*"([^"]*)"/)?.[1] ?? null;
  const codePostal = raw.match(/"codePostal"\s*:\s*["']?([^"',}\s]+)["']?/)?.[1] ?? null;
  const ville = raw.match(/"ville"\s*:\s*"([^"]*)"/)?.[1] ?? null;
  const description = raw.match(/"description"\s*:\s*"([^"]*)"/)?.[1] ?? null;
  const budgetMin = raw.match(/"budgetMin"\s*:\s*(\d+(?:\.\d+)?)/)?.[1];
  const budgetMax = raw.match(/"budgetMax"\s*:\s*(\d+(?:\.\d+)?)/)?.[1];
  const dateDebut = raw.match(/"dateDebutSouhaitee"\s*:\s*"([^"]*)"/)?.[1] ?? null;
  const surfaceSqm = raw.match(/"surfaceSqm"\s*:\s*(\d+(?:\.\d+)?)/)?.[1];
  const recapObj: Record<string, unknown> = {
    projectId,
    titre,
    typeTravaux,
    adresse,
    codePostal,
    ville,
    description,
    budgetMin: budgetMin ? Number(budgetMin) : null,
    budgetMax: budgetMax ? Number(budgetMax) : null,
    dateDebutSouhaitee: dateDebut,
    surfaceSqm: surfaceSqm ? Number(surfaceSqm) : null,
    questionnaireData: null,
  };
  return normalizeSharePayload({
    project_id: projectId,
    project_name: projectName,
    invite_id: null,
    recap: recapObj as DemandeProjetSummary,
  });
}

const formatPreviewMessage = (content: string) => {
  const invite = parseInvitePayload(content);
  if (invite) return `Invitation au projet ${invite.project_name || "projet"}`;
  const share = parseSharePayload(content);
  if (share) return `Projet partagé : ${share.project_name || "projet"}`;
  return content;
};

const formatDateFr = (dateStr: string | null) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return dateStr;
  }
};

function isImageType(fileType: string): boolean {
  const t = String(fileType).toLowerCase();
  return t === "photo" || t.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(t);
}

function isPdfType(fileType: string, fileName: string): boolean {
  const t = String(fileType).toLowerCase();
  if (t === "pdf" || t === "devis" || t === "facture" || t === "plan") return true;
  return /\.pdf$/i.test(fileName);
}

function ProjectShareRecapCard({
  sharePayload,
  inviteRow,
  isPendingInvite,
  decisionLabel,
  inviteActionId,
  onAccept,
  onDecline,
  messageCreatedAt,
  userRole,
}: {
  sharePayload: SharePayload;
  inviteRow: ProjectInviteRow | undefined;
  isPendingInvite: boolean;
  decisionLabel: string;
  inviteActionId: string | null;
  onAccept: () => void;
  onDecline: () => void;
  messageCreatedAt: string;
  userRole: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState<{ url: string; name: string; isImage: boolean; isPdf: boolean } | null>(null);
  const r = sharePayload.recap;
  let questionnaireItems = formatQuestionnaireForDisplay(
    r.typeTravaux ?? "",
    r.questionnaireData ?? {}
  );
  if (questionnaireItems.length === 0 && r.questionnaireData && Object.keys(r.questionnaireData).length > 0) {
    const fields = getQuestionnaireFields(r.typeTravaux ?? "");
    const fieldByKey = new Map(fields.map((f) => [f.key, f]));
    questionnaireItems = Object.entries(r.questionnaireData)
      .filter(([, v]) => v != null && v !== "")
      .map(([key, val]) => {
        const field = fieldByKey.get(key);
        let value = String(val);
        if (field?.type === "select" && field.options) {
          const opt = field.options.find((o) => o.value === val || o.value === value);
          if (opt) value = opt.label;
        }
        const label = field?.label?.replace(/\s*\*$/, "") ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
        return { label, value };
      });
  }
  const budget = r.budgetMax ?? r.budgetMin;
  const lieu = [r.adresse, r.codePostal, r.ville].filter(Boolean).join(", ");
  const images = documents.filter((d) => isImageType(d.file_type));
  const otherDocs = documents.filter((d) => !isImageType(d.file_type));

  useEffect(() => {
    if (!expanded || !sharePayload.project_id) return;
    setDocsLoading(true);
    getDocuments({ projectId: sharePayload.project_id })
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setDocsLoading(false));
  }, [expanded, sharePayload.project_id]);

  const infoRows: { label: string; value: React.ReactNode }[] = [
    { label: "Type de travaux", value: getProjectTypeLabel(r.typeTravaux ?? "") || null },
    { label: "Titre du projet", value: r.titre || null },
    { label: "Adresse du chantier", value: r.adresse || null },
    { label: "Code postal", value: r.codePostal || null },
    { label: "Ville", value: r.ville || null },
    { label: "Description détaillée", value: r.description ? <span className="whitespace-pre-wrap">{r.description}</span> : null },
    ...(r.surfaceSqm != null && Number.isFinite(r.surfaceSqm)
      ? [{ label: "Surface à traiter (m²)", value: String(r.surfaceSqm) }]
      : []),
    ...(budget != null && Number.isFinite(budget)
      ? [{ label: "Budget (€)", value: Number(budget).toLocaleString("fr-FR") + " €" }]
      : []),
    ...(r.dateDebutSouhaitee ? [{ label: "Date de début souhaitée", value: formatDateFr(r.dateDebutSouhaitee) }] : []),
    ...questionnaireItems.map((item) => ({ label: item.label, value: item.value })),
  ].filter((row) => row.value != null && row.value !== "");

  return (
    <div className="max-w-[85%] rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-sm font-semibold text-gray-900 mb-2">
        Projet partagé : {sharePayload.project_name || r.titre || "projet"}
      </div>
      <div className="text-xs text-gray-600 space-y-1.5 border-l-2 border-primary-200 pl-3 py-1">
        <p><span className="font-medium text-gray-700">Type :</span> {getProjectTypeLabel(r.typeTravaux ?? "")}</p>
        {lieu && <p><span className="font-medium text-gray-700">Lieu :</span> {lieu}</p>}
        {r.description && (
          <p><span className="font-medium text-gray-700">Description :</span> {r.description}</p>
        )}
        {r.surfaceSqm != null && Number.isFinite(r.surfaceSqm) && (
          <p><span className="font-medium text-gray-700">Surface :</span> {r.surfaceSqm} m²</p>
        )}
        {budget != null && Number.isFinite(budget) && (
          <p><span className="font-medium text-gray-700">Budget :</span> {Number(budget).toLocaleString("fr-FR")} €</p>
        )}
        {r.dateDebutSouhaitee && (
          <p><span className="font-medium text-gray-700">Début souhaité :</span> {formatDateFr(r.dateDebutSouhaitee)}</p>
        )}
        {questionnaireItems.length > 0 && questionnaireItems.map((item) => (
          <p key={item.label}><span className="font-medium text-gray-700">{item.label} :</span> {item.value}</p>
        ))}
      </div>
      {isPendingInvite ? (
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            onClick={onAccept}
            disabled={inviteActionId === inviteRow?.id}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <Check className="w-4 h-4" />
            Accepter
          </Button>
          <Button
            size="sm"
            onClick={onDecline}
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
      {userRole === "professionnel" ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
        >
          {expanded ? "Masquer l'aperçu" : "Voir le projet"}
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      ) : (
        <Link
          href={`/dashboard/projets/${sharePayload.project_id}?role=particulier`}
          className="mt-2 inline-block text-xs text-primary-600 hover:underline"
        >
          Voir le projet →
        </Link>
      )}
      {expanded && userRole === "professionnel" && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-4 text-sm">
          {infoRows.map((row, i) => (
            <div key={`${row.label}-${i}`}>
              <div className="text-gray-500 font-medium text-xs mb-0.5">{row.label}</div>
              <div className="text-gray-900">{row.value}</div>
            </div>
          ))}
          {docsLoading ? (
            <p className="text-xs text-gray-500">Chargement des documents...</p>
          ) : (
            <>
              {images.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <Image className="w-3 h-3" /> Photos
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setPreviewItem({ url: doc.file_url, name: doc.name, isImage: true, isPdf: false })}
                        className="block aspect-square rounded overflow-hidden border border-gray-200 bg-gray-50 hover:border-primary-300 text-left cursor-pointer"
                      >
                        <img src={doc.file_url} alt={doc.name} className="w-full h-full object-cover" />
                        <p className="p-1 text-[10px] text-gray-600 truncate bg-white">{doc.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {otherDocs.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Documents
                  </div>
                  <ul className="space-y-1">
                    {otherDocs.map((doc) => {
                      const isPdf = isPdfType(doc.file_type, doc.name);
                      return (
                        <li key={doc.id}>
                          <button
                            type="button"
                            onClick={() => setPreviewItem({ url: doc.file_url, name: doc.name, isImage: false, isPdf })}
                            className="w-full flex items-center gap-2 py-1.5 px-2 rounded border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 text-xs text-left"
                          >
                            <File className="w-3 h-3 text-gray-400" />
                            <span className="truncate flex-1">{doc.name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <div className="text-xs text-gray-400 mt-2">
        {formatDateTime(messageCreatedAt)}
      </div>

      {previewItem && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreviewItem(null)}
          role="presentation"
        >
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-[90vw] max-h-[90vh] w-full flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50">
              <span className="text-sm font-medium text-gray-900 truncate flex-1">{previewItem.name}</span>
              <a
                href={previewItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-600 hover:underline whitespace-nowrap"
              >
                Ouvrir
              </a>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-1 rounded hover:bg-gray-200 text-gray-600"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-4 flex items-center justify-center">
              {previewItem.isImage ? (
                <img
                  src={previewItem.url}
                  alt={previewItem.name}
                  className="max-w-full max-h-[75vh] object-contain"
                />
              ) : previewItem.isPdf ? (
                <iframe
                  src={previewItem.url}
                  title={previewItem.name}
                  className="w-full min-h-[70vh] border-0 rounded"
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">Aperçu non disponible pour ce type de fichier.</p>
                  <a
                    href={previewItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    Ouvrir dans un nouvel onglet
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
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
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareProjects, setShareProjects] = useState<ProjectSummary[]>([]);
  const [shareProjectId, setShareProjectId] = useState("");
  const [shareSending, setShareSending] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const loadShareProjects = async () => {
    if (!currentUserId) return;
    try {
      let projects = await fetchProjectsForUser(currentUserId);
      if (projects.length === 0) projects = await fetchProjectsByCreator(currentUserId);
      setShareProjects(projects);
      if (!shareProjectId && projects.length > 0) setShareProjectId(projects[0].id);
      else if (shareProjectId && !projects.some((p) => p.id === shareProjectId)) {
        setShareProjectId(projects[0]?.id ?? "");
      }
    } catch (err: any) {
      setShareError(err?.message ?? "Impossible de charger les projets.");
    }
  };

  const loadMessages = async (conversationId: string, silent = false) => {
    if (!conversationId) return;
    if (!silent) setMessagesLoading(true);
    const { data, error: messagesError } = await supabase
      .from("network_messages")
      .select("id,conversation_id,message,created_at,sender_id")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      if (!silent) setError(messagesError.message);
      if (!silent) setMessagesLoading(false);
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
    if (!silent) setMessagesLoading(false);
  };

  const loadConversations = async (silent = false) => {
    if (!currentUserId) return;
    if (!silent) {
      setLoading(true);
      setError(null);
      setConversationsLoaded(false);
    }
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
      ((membersRes.data as any[] | null | undefined) ?? []).forEach((member) => {
        const conversationId = String(member?.conversation_id ?? "");
        if (!conversationId) return;
        if (!membersByConversation[conversationId]) {
          membersByConversation[conversationId] = [];
        }
        membersByConversation[conversationId].push({
          conversation_id: conversationId,
          user_id: String(member?.user_id ?? ""),
          profile: firstOrNull(member?.profile) as any,
        });
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
      if (!silent) setError(err?.message ?? "Impossible de charger les conversations.");
    } finally {
      if (!silent) {
        setLoading(false);
        setConversationsLoaded(true);
      }
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
      const normalizedInvites: ProjectInviteRow[] = (data ?? []).map((row: any) => ({
        id: String(row.id),
        project_id: String(row.project_id),
        role: row.role ?? null,
        status: row.status ?? null,
        invited_email: row.invited_email ?? null,
        project: firstOrNull(row.project) as any,
      }));
      setPendingInvites(normalizedInvites);
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

  const handleSendProjectShare = async () => {
    if (userRole !== "particulier" || !selectedConversation || !shareProjectId) return;
    if (!selectedConversation.counterpartEmail) {
      setShareError("Email du contact indisponible.");
      return;
    }
    setShareSending(true);
    setShareError(null);
    try {
      const { recap, error: recapError } = await getProjectDemandeSummary(shareProjectId);
      if (!recap) {
        if (process.env.NODE_ENV === "development" && recapError) console.error("[getProjectDemandeSummary]", recapError);
        setShareError("Impossible de charger les détails du projet.");
        setShareSending(false);
        return;
      }
      let inviteRow: { id: string } | null = null;
      try {
        inviteRow = await inviteProjectMemberByEmail(
          currentUserId,
          shareProjectId,
          selectedConversation.counterpartEmail,
          "collaborator"
        );
      } catch (inviteErr: any) {
        if (inviteErr?.code !== "23505" && !inviteErr?.message?.includes("duplicate")) throw inviteErr;
      }
      const sharePayload: SharePayload = {
        project_id: shareProjectId,
        project_name: recap.titre ?? "Projet",
        invite_id: inviteRow?.id ?? null,
        recap,
      };
      const shareMessage = `${SHARE_PREFIX}${JSON.stringify(sharePayload)}`;
      const now = new Date().toISOString();
      const { data: messageRow, error: messageError } = await supabase
        .from("network_messages")
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: currentUserId,
          message: shareMessage,
        })
        .select("id,conversation_id,message,created_at,sender_id")
        .maybeSingle();
      if (messageError) throw messageError;
      const newMessage: ChatMessage = {
        id: messageRow?.id ?? `${Date.now()}`,
        conversationId: selectedConversation.id,
        senderId: currentUserId,
        content: shareMessage,
        createdAt: messageRow?.created_at ?? now,
      };
      setMessagesByConv((prev) => ({
        ...prev,
        [selectedConversation.id]: [...(prev[selectedConversation.id] ?? []), newMessage],
      }));
      setConversations((prev) =>
        [...prev]
          .map((c) =>
            c.id === selectedConversation.id
              ? { ...c, lastMessage: formatPreviewMessage(shareMessage), updatedAt: newMessage.createdAt, unread: 0 }
              : c
          )
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      );
      setShareModalOpen(false);
    } catch (err: any) {
      setShareError(err?.message ?? "Impossible de partager le projet.");
    } finally {
      setShareSending(false);
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
    if (!currentUserId) return;
    const interval = setInterval(() => {
      void loadConversations(true);
      void loadInvites();
      if (selectedId) void loadMessages(selectedId, true);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentUserId, selectedId]);

  useEffect(() => {
    if (!selectedId || !currentUserId) return;
    const conversationId = selectedId;
    const channel = supabase
      .channel(`conv:${conversationId}`)
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
          const sharePayload = parseSharePayload(newRow.message ?? "");
          if (invitePayload || sharePayload) void loadInvites();
        }
      )
      .on("broadcast", { event: "new_message" }, (event) => {
        // Reload messages instantly when the other user sends a message
        const senderId = (event.payload as { senderId?: string } | null)?.senderId;
        if (senderId && senderId !== currentUserId) {
          void loadMessages(conversationId, true);
        }
      })
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  }, [selectedId, currentUserId]);

  useEffect(() => {
    if (!authLoading && currentUserId && userRole === "professionnel") {
      void loadInviteProjects();
    }
  }, [authLoading, currentUserId, userRole]);

  useEffect(() => {
    if (!authLoading && currentUserId && userRole === "particulier") {
      void loadShareProjects();
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesByConv, selectedId]);

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

    // Broadcast to recipient for instant delivery (no Supabase config needed)
    if (realtimeChannelRef.current) {
      void realtimeChannelRef.current.send({
        type: "broadcast",
        event: "new_message",
        payload: { conversationId: selectedConversation.id, senderId: currentUserId },
      });
    }

    setInput("");
  };

  return (
    <div className="space-y-6">
      {/* Page header banner */}
      <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="absolute inset-0 bg-white" />
        <div className="relative flex items-start justify-between gap-6 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Messages</h1>
              <p className="text-neutral-600 mt-1">Communiquez avec les professionnels et partenaires.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1">
                  {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
                </span>
                {conversations.reduce((s, c) => s + c.unread, 0) > 0 && (
                  <span className="rounded-full border border-primary-200 bg-primary-50 text-primary-700 px-3 py-1">
                    {conversations.reduce((s, c) => s + c.unread, 0)} non lu{conversations.reduce((s, c) => s + c.unread, 0) !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
          <img
            src="/images/messages.png"
            alt="Messages"
            className="hidden sm:block h-20 w-20 object-contain opacity-90 logo-blend flex-shrink-0"
          />
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Conversations list */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4 border-b border-neutral-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Rechercher un contact..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all bg-neutral-50"
                />
              </div>
            </div>
            <div className="divide-y divide-neutral-100">
              {loading && (
                <div className="p-4 text-sm text-neutral-500">Chargement des conversations...</div>
              )}
              {!loading && filteredConversations.length === 0 && (
                <div className="p-4 text-sm text-neutral-500">
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
                      className={`p-4 cursor-pointer transition-all ${
                        isActive
                          ? "bg-primary-50 border-l-2 border-primary-500"
                          : "hover:bg-neutral-50 border-l-2 border-transparent"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sm shadow-sm ${
                          isActive
                            ? "bg-gradient-to-br from-primary-400 to-primary-600 text-white"
                            : "bg-gradient-to-br from-neutral-200 to-neutral-300 text-neutral-600"
                        }`}>
                          {conv.counterpartInitial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold truncate text-sm ${isActive ? "text-primary-700" : "text-neutral-800"}`}>
                            {conv.counterpartName}
                          </p>
                          <p className="text-xs text-neutral-500 truncate mt-0.5">
                            {conv.lastMessage}
                          </p>
                        </div>
                        {conv.unread > 0 && (
                          <span className="text-xs bg-gradient-to-r from-primary-400 to-primary-600 text-white rounded-full px-2 py-0.5 shadow-sm">
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

        {/* Chat window */}
        <Card className="overflow-hidden lg:col-span-2">
          <CardContent className="p-0 flex flex-col h-[600px]">
            {/* Chat header */}
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-3">
                {selectedConversation && (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-300 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-neutral-600 shadow-sm">
                    {selectedConversation.counterpartInitial}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-neutral-900 text-sm leading-tight">
                    {selectedConversation?.counterpartName ?? "Aucune conversation"}
                  </h3>
                  {selectedConversation && (
                    <p className="text-xs text-neutral-500 leading-tight capitalize">
                      Contact {selectedConversation.counterpartRole}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {userRole === "professionnel" && selectedConversation && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setInviteError(null);
                      setInviteModalOpen(true);
                    }}
                    className="text-xs border-neutral-200 hover:border-primary-300 hover:text-primary-600"
                  >
                    Inviter au projet
                  </Button>
                )}
                {userRole === "particulier" && selectedConversation && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setShareError(null);
                      await loadShareProjects();
                      setShareModalOpen(true);
                    }}
                    className="text-xs border-neutral-200 hover:border-primary-300 hover:text-primary-600"
                  >
                    Partager un projet
                  </Button>
                )}
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-neutral-50">
              {messagesLoading && (
                <div className="text-center text-sm text-neutral-400 pt-8">Chargement des messages...</div>
              )}
              {!messagesLoading &&
                selectedMessages.map((message) => {
                  const isMine = message.senderId === currentUserId;
                  const invitePayload = parseInvitePayload(message.content);
                  const sharePayload = parseSharePayload(message.content);
                  const projectId = invitePayload?.project_id ?? sharePayload?.project_id;
                  const inviteRow = projectId
                    ? pendingInvites.find((invite) => invite.project_id === projectId)
                    : null;
                  const isPendingInvite = Boolean(inviteRow && inviteRow.status === "pending");
                  const decision =
                    invitePayload?.invite_id || sharePayload?.invite_id
                      ? inviteDecisions[invitePayload?.invite_id ?? sharePayload?.invite_id ?? ""]
                      : null;
                  const decisionLabel =
                    decision === "accepted"
                      ? "Invitation acceptée."
                      : decision === "declined"
                        ? "Invitation refusée."
                        : sharePayload
                          ? "Projet partagé."
                          : "Invitation envoyée.";
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-2.5 ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      {!isMine && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neutral-200 to-neutral-300 flex items-center justify-center flex-shrink-0 text-neutral-600 text-xs font-semibold shadow-sm">
                          {selectedConversation?.counterpartInitial ?? "C"}
                        </div>
                      )}
                      {invitePayload ? (
                        <div className="max-w-[75%] rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
                          <div className="text-sm font-semibold text-neutral-900">
                            Invitation au projet {invitePayload.project_name || "projet"}
                          </div>
                          <div className="text-xs text-neutral-500 mt-1">
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
                            <div className="mt-2 text-xs text-neutral-500">{decisionLabel}</div>
                          )}
                          <div className="text-xs text-neutral-400 mt-2">
                            {formatDateTime(message.createdAt)}
                          </div>
                        </div>
                      ) : sharePayload ? (
                          <ProjectShareRecapCard
                            sharePayload={sharePayload}
                            inviteRow={inviteRow ?? undefined}
                            isPendingInvite={isPendingInvite}
                            decisionLabel={decisionLabel}
                            inviteActionId={inviteActionId}
                            onAccept={() => handleAcceptInvite(inviteRow?.id ?? "")}
                            onDecline={() => handleDeclineInvite(inviteRow?.id ?? "")}
                          messageCreatedAt={message.createdAt}
                          userRole={userRole}
                        />
                      ) : message.content.trim().startsWith(SHARE_PREFIX) ? (
                        <div className="max-w-[85%] rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
                          <div className="text-sm font-semibold text-neutral-900">Projet partagé</div>
                          <p className="text-xs text-neutral-500 mt-1">Rechargez la page pour afficher le récapitulatif.</p>
                          <p className="text-xs text-neutral-400 mt-2">{formatDateTime(message.createdAt)}</p>
                        </div>
                      ) : (
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
                            isMine
                              ? "bg-gradient-to-br from-primary-500 to-primary-700 rounded-br-sm"
                              : "bg-white border border-neutral-200 rounded-bl-sm"
                          }`}
                        >
                          <p className={`text-sm leading-relaxed ${isMine ? "text-white" : "text-neutral-800"}`}>
                            {message.content}
                          </p>
                          <p
                            className={`text-[11px] mt-1 ${
                              isMine ? "text-primary-200" : "text-neutral-400"
                            }`}
                          >
                            {formatDateTime(message.createdAt)}
                          </p>
                        </div>
                      )}
                      {isMine && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold shadow-sm">
                          {user?.name?.charAt(0).toUpperCase() ?? (userRole === "professionnel" ? "P" : "M")}
                        </div>
                      )}
                    </div>
                  );
                })}
              {!messagesLoading && selectedConversation && selectedMessages.length === 0 && (
                <div className="text-center text-sm text-neutral-400 pt-12">
                  Aucun message pour le moment. Démarrez la conversation !
                </div>
              )}
              {!messagesLoading && !selectedConversation && (
                <div className="text-center text-sm text-neutral-400 pt-12">
                  Sélectionnez une conversation pour commencer.
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="px-5 py-3.5 border-t border-neutral-100 bg-white">
              <div className="flex gap-2">
                <Input
                  placeholder={
                    selectedConversation
                      ? "Tapez votre message..."
                      : "Sélectionnez une conversation pour démarrer"
                  }
                  className="flex-1 text-sm border-neutral-200 bg-neutral-50 focus:bg-white transition-colors"
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
                <button
                  onClick={handleSend}
                  disabled={!selectedConversation || !input.trim()}
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-r from-primary-400 to-primary-600 text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  aria-label="Envoyer"
                >
                  <Send className="w-4 h-4" />
                </button>
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
                    aria-label="Sélectionner un projet"
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
                  aria-label="Rôle à attribuer"
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

      {shareModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-200 max-w-md w-full p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Partager un projet</h3>
                <p className="text-sm text-neutral-600">
                  {selectedConversation?.counterpartName ?? "Contact"}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setShareModalOpen(false)}>
                Fermer
              </Button>
            </div>
            {shareError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">
                {shareError}
              </div>
            )}
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Projet à partager</label>
                {shareProjects.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    Aucun projet à partager. Créez d&apos;abord un projet.
                  </div>
                ) : (
                  <select
                    aria-label="Sélectionner un projet à partager"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={shareProjectId}
                    onChange={(e) => setShareProjectId(e.target.value)}
                  >
                    {shareProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Le professionnel recevra un récapitulatif complet des informations de votre projet.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShareModalOpen(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={handleSendProjectShare}
                  disabled={!shareProjectId || shareSending || shareProjects.length === 0}
                >
                  {shareSending ? "Envoi..." : "Partager le projet"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
