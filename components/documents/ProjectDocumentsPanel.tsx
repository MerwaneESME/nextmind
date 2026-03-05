"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import {
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  File,
  FileArchive,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Maximize2,
  MoreHorizontal,
  Music,
  Pause,
  Pencil,
  Play,
  Trash2,
  Upload,
  Video as VideoIcon,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDate } from "@/lib/utils";
import { AnimatedTooltip } from "@/components/ui/animated-tooltip";
import { supabase } from "@/lib/supabaseClient";
import {
  deleteDocument,
  getDocuments,
  inferTypeFromFile,
  uploadDocument,
  type DocumentRow,
} from "@/lib/db/documentsDb";
import type { QuoteSummary } from "@/lib/quotesStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkflowStatus = "a_faire" | "envoye" | "valide" | "refuse";
type CustomFolder = { id: string; name: string };
type SelectedFile = {
  id: string; name: string; url: string | null; fileType: string;
  isDevis?: boolean; quoteId?: string;
};
type CtxTarget = { kind: "file"; docId: string } | { kind: "custom_folder"; folderId: string };
type CtxMenu = { x: number; y: number; target: CtxTarget };

// ─── Drag context ─────────────────────────────────────────────────────────────

const DragCtx = createContext<{
  draggingId: string | null; draggingType: "doc" | "quote" | null;
  setDragging: (id: string | null, type: "doc" | "quote" | null) => void;
  dropTarget: string | null; setDropTarget: (id: string | null) => void;
}>({ draggingId: null, draggingType: null, setDragging: () => {}, dropTarget: null, setDropTarget: () => {} });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const lsKey = (projectId: string, suffix: string) => `nm_proj_${projectId}_${suffix}`;

const isImageFile = (name: string, type?: string) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return (type ?? "").toLowerCase() === "photo" || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
};
const isPdfFile = (name: string, type?: string) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const t = (type ?? "").toLowerCase();
  return ["devis", "facture", "plan"].includes(t) || ext === "pdf";
};
const isVideoFile = (name: string) =>
  ["mp4", "mov", "avi", "webm", "mkv"].includes(name.split(".").pop()?.toLowerCase() ?? "");

function getFileIcon(name: string, fileType?: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (isImageFile(name, fileType)) return <ImageIcon className="size-4 text-emerald-500 flex-shrink-0" />;
  if (isPdfFile(name, fileType)) return <FileText className="size-4 text-primary-600 flex-shrink-0" />;
  if (isVideoFile(name)) return <VideoIcon className="size-4 text-purple-500 flex-shrink-0" />;
  if (["mp3", "wav", "aac", "flac"].includes(ext)) return <Music className="size-4 text-amber-500 flex-shrink-0" />;
  if (["zip", "rar", "tar", "gz"].includes(ext)) return <FileArchive className="size-4 text-orange-500 flex-shrink-0" />;
  return <File className="size-4 text-neutral-400 flex-shrink-0" />;
}

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const BADGE_COLORS: Record<WorkflowStatus, string> = {
  a_faire: "bg-amber-100 text-amber-800",
  envoye: "bg-blue-100 text-blue-800",
  valide: "bg-green-100 text-green-800",
  refuse: "bg-red-100 text-red-800",
};
const WF_LABELS: Record<WorkflowStatus, string> = { a_faire: "En étude", envoye: "Envoyé", valide: "Validé", refuse: "Refusé" };

const resolveWorkflowStatus = (q: QuoteSummary): WorkflowStatus => {
  const m = q.rawMetadata ?? {};
  const w = typeof m.workflow_status === "string" ? m.workflow_status : null;
  if (w === "a_faire" || w === "envoye" || w === "valide" || w === "refuse") return w;
  const s = typeof q.status === "string" ? q.status.toLowerCase() : "";
  if (s === "valide" || s === "refuse") return s as WorkflowStatus;
  if (s === "envoye" || s === "published") return "envoye";
  return "a_faire";
};

const isQuotePdf = (quote: QuoteSummary) => {
  const fileName = (quote.fileName ?? "").toLowerCase();
  if (fileName.endsWith(".pdf")) return true;
  const meta = quote.rawMetadata ?? {};
  const pdfPath = typeof (meta as any).pdf_path === "string" ? String((meta as any).pdf_path) : "";
  if (pdfPath.toLowerCase().endsWith(".pdf")) return true;
  const pdfUrl = typeof (meta as any).pdf_url === "string" ? String((meta as any).pdf_url) : "";
  if (pdfUrl.toLowerCase().includes(".pdf")) return true;
  const fileUrl = (quote.fileUrl ?? "").toLowerCase();
  if (fileUrl.includes(".pdf")) return true;
  return false;
};

const formatProjectMemberRoleLabel = (role?: string | null) => {
  if (!role) return null;
  const normalized = role.toLowerCase();
  if (normalized === "owner") return "Chef de projet";
  if (normalized === "collaborator" || normalized === "collaborateur") return "Collaborateur";
  if (normalized === "client" || normalized === "particulier") return "Client";
  if (normalized === "pro" || normalized === "professionnel") return "Professionnel";
  return role;
};

// ─── Uploader Avatar ──────────────────────────────────────────────────────────

// ─── Video Player ─────────────────────────────────────────────────────────────

function VideoPlayer({ url, name }: { url: string; name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const seeking = useRef(false);
  useEffect(() => { setPlaying(false); setProgress(0); setCurrentTime(0); setDuration(0); }, [url]);
  const togglePlay = () => { const v = videoRef.current; if (!v) return; v.paused ? v.play() : v.pause(); };
  return (
    <div className="flex flex-col bg-black">
      <video ref={videoRef} src={url} className="w-full object-contain cursor-pointer"
        style={{ maxHeight: "calc(70vh - 160px)", minHeight: "240px" }} onClick={togglePlay}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
        onTimeUpdate={() => { const v = videoRef.current; if (v && !seeking.current) { setCurrentTime(v.currentTime); setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0); } }} />
      <div className="bg-neutral-900 px-4 pt-2 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-400 w-9 tabular-nums">{formatTime(currentTime)}</span>
          <input type="range" min={0} max={100} step={0.1} value={progress}
            onChange={(e) => { const p = Number(e.target.value); setProgress(p); if (videoRef.current && duration) videoRef.current.currentTime = (p / 100) * duration; }}
            onMouseDown={() => { seeking.current = true; }} onMouseUp={() => { seeking.current = false; }}
            className="flex-1 h-1 rounded-full accent-primary-400 cursor-pointer" />
          <span className="text-[11px] text-neutral-400 w-9 text-right tabular-nums">{formatTime(duration)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={togglePlay} className="w-8 h-8 rounded-full bg-primary-600 hover:bg-primary-500 flex items-center justify-center text-white">
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => { const v = videoRef.current; if (!v) return; setMuted(!muted); v.muted = !muted; }} className="text-neutral-400 hover:text-white">
                {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={(e) => { const v = Number(e.target.value); setVolume(v); setMuted(v === 0); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; } }}
                className="w-20 h-1 rounded-full accent-primary-400 cursor-pointer" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-500 truncate max-w-[120px]">{name}</span>
            <button type="button" onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); else videoRef.current?.requestFullscreen(); }} className="text-neutral-400 hover:text-white">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

function ContextMenu({
  menu, onClose, onRenameFile, onRenameFolder, onDeleteFile, onDeleteFolder, onMoveFile, customFolders, docFolderMap,
}: {
  menu: CtxMenu; onClose: () => void;
  onRenameFile: (id: string) => void; onRenameFolder: (id: string) => void;
  onDeleteFile: (id: string) => void; onDeleteFolder: (id: string) => void;
  onMoveFile: (docId: string, folderId: string | null) => void;
  customFolders: CustomFolder[]; docFolderMap: Record<string, string>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cleanup = { fn: () => {} };
    const timer = window.setTimeout(() => {
      const close = (e: MouseEvent | KeyboardEvent) => {
        if (e instanceof KeyboardEvent && e.key !== "Escape") return;
        if (e instanceof MouseEvent && menuRef.current?.contains(e.target as Node)) return;
        onClose();
      };
      document.addEventListener("mousedown", close);
      document.addEventListener("keydown", close);
      cleanup.fn = () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
    }, 0);
    return () => { window.clearTimeout(timer); cleanup.fn(); };
  }, [onClose]);
  const s: React.CSSProperties = { position: "fixed", top: Math.min(menu.y, window.innerHeight - 240), left: Math.min(menu.x, window.innerWidth - 210), zIndex: 9999 };
  const { target } = menu;
  const currentFolderId = target.kind === "file" ? (docFolderMap[target.docId] ?? null) : null;
  return (
    <div ref={menuRef} style={s} className="w-52 rounded-xl border border-neutral-200 bg-white shadow-xl py-1 text-sm select-none">
      {target.kind === "file" && (
        <>
          <button className="ctx-item" onClick={() => { onRenameFile(target.docId); onClose(); }}><Pencil className="w-3.5 h-3.5" /> Renommer</button>
          {customFolders.length > 0 && (
            <>
              <div className="border-t border-neutral-100 my-1" />
              <div className="px-3 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Déplacer vers</div>
              {customFolders.map((f) => (
                <button key={f.id} className="ctx-item" onClick={() => { onMoveFile(target.docId, f.id === currentFolderId ? null : f.id); onClose(); }}>
                  <Folder className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" /><span className="truncate flex-1">{f.name}</span>
                  {f.id === currentFolderId && <Check className="w-3.5 h-3.5 ml-auto flex-shrink-0 text-primary-500" />}
                </button>
              ))}
              {currentFolderId && (
                <button className="ctx-item text-neutral-500" onClick={() => { onMoveFile(target.docId, null); onClose(); }}><X className="w-3.5 h-3.5" /> Retirer du dossier</button>
              )}
            </>
          )}
          <div className="border-t border-neutral-100 my-1" />
          <button className="ctx-item text-red-600 hover:bg-red-50" onClick={() => { onDeleteFile(target.docId); onClose(); }}><Trash2 className="w-3.5 h-3.5" /> Supprimer</button>
        </>
      )}
      {target.kind === "custom_folder" && (
        <>
          <button className="ctx-item" onClick={() => { onRenameFolder(target.folderId); onClose(); }}><Pencil className="w-3.5 h-3.5" /> Renommer</button>
          <div className="border-t border-neutral-100 my-1" />
          <button className="ctx-item text-red-600 hover:bg-red-50" onClick={() => { onDeleteFolder(target.folderId); onClose(); }}><Trash2 className="w-3.5 h-3.5" /> Supprimer le dossier</button>
        </>
      )}
    </div>
  );
}

// ─── File Row (uploaded document) ─────────────────────────────────────────────

function FileRow({
  doc, displayName, selectedId, onSelect, onContextMenu, editingId, onRenameConfirm, onRenameCancel,
  memberRoleByUserId,
}: {
  doc: DocumentRow; displayName: string; selectedId: string | null;
  onSelect: (d: DocumentRow) => void;
  onContextMenu: (e: React.MouseEvent, docId: string) => void;
  editingId: string | null; onRenameConfirm: (id: string, name: string) => void; onRenameCancel: () => void;
  memberRoleByUserId: Record<string, string | null>;
}) {
  const { setDragging } = useContext(DragCtx);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSelected = selectedId === doc.id;
  const isEditing = editingId === doc.id;
  const uploaderId = doc.uploader?.id ?? doc.uploaded_by ?? null;
  const rawProjectRole = uploaderId ? memberRoleByUserId[uploaderId] ?? null : null;
  const uploaderRoleLabel =
    formatProjectMemberRoleLabel(rawProjectRole) ??
    (doc.uploader?.user_type === "pro"
      ? "Professionnel"
      : doc.uploader?.user_type === "client"
        ? "Particulier"
        : null);
  const getBase = (n: string) => { const d = n.lastIndexOf("."); return d > 0 ? n.slice(0, d) : n; };
  const getExt = (n: string) => { const d = n.lastIndexOf("."); return d > 0 ? n.slice(d) : ""; };
  const [editVal, setEditVal] = useState(() => getBase(displayName));
  useEffect(() => { if (isEditing) { setEditVal(getBase(displayName)); setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 30); } }, [isEditing, displayName]);
  const confirmRename = () => { const b = editVal.trim(); if (b) onRenameConfirm(doc.id, b + getExt(displayName)); else onRenameCancel(); };
  const triggerCtx = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, doc.id); };
  return (
    <li
      draggable
      onDragStart={(e) => {
        setDragging(doc.id, "doc");
        e.dataTransfer.effectAllowed = "copyMove";
        e.dataTransfer.setData("docId", doc.id);
        e.dataTransfer.setData("text/plain", `doc:${doc.id}`);
      }}
      onDragEnd={() => setDragging(null, null)} onContextMenu={triggerCtx}>
      <div onClick={() => !isEditing && onSelect(doc)}
        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer select-none ${isSelected ? "bg-primary-50 text-primary-700 font-medium" : "text-neutral-700 hover:bg-neutral-50"}`}>
        <span className="ml-[22px]">{getFileIcon(displayName, doc.file_type as string)}</span>
        {isEditing ? (
          <div className="flex items-center flex-1 min-w-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
            <input ref={inputRef} value={editVal} onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") onRenameCancel(); }}
              onBlur={confirmRename}
              className="min-w-0 flex-1 text-sm border border-primary-300 rounded-l px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary-400 bg-white" />
            {getExt(displayName) && (
              <span className="flex-shrink-0 text-sm text-neutral-400 bg-neutral-100 border border-l-0 border-primary-300 rounded-r px-1.5 py-0.5 select-none">{getExt(displayName)}</span>
            )}
          </div>
        ) : (
          <span className="truncate flex-1 min-w-0">{displayName}</span>
        )}
        {/* Uploader avatar */}
        {!isEditing && doc.uploader?.full_name && (
          <AnimatedTooltip
            items={[{
              id: uploaderId ?? doc.id,
              name: doc.uploader.full_name,
              role: uploaderRoleLabel ?? undefined,
              image: doc.uploader.avatar_url ?? null,
            }]}
            size="xs"
          />
        )}
        {!isEditing && (
          <button type="button" onMouseDown={(e) => { e.stopPropagation(); triggerCtx(e); }}
            className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-neutral-400 hover:text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity rounded">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

// ─── Folder Row ───────────────────────────────────────────────────────────────

function FolderRow({
  folder, docs, selectedId, onSelect, onContextMenu, onMoveToFolder,
  editingFolderId, onRenameConfirm, onRenameCancel,
  editingFileId, onFileContextMenu, onFileRenameConfirm, onFileRenameCancel, fileDisplayNames,
  memberRoleByUserId,
}: {
  folder: CustomFolder; docs: DocumentRow[]; selectedId: string | null;
  onSelect: (d: DocumentRow) => void;
  onContextMenu: (e: React.MouseEvent, folderId: string) => void;
  onMoveToFolder: (docId: string, folderId: string | null) => void;
  editingFolderId: string | null; onRenameConfirm: (id: string, name: string) => void; onRenameCancel: () => void;
  editingFileId: string | null;
  onFileContextMenu: (e: React.MouseEvent, docId: string) => void;
  onFileRenameConfirm: (id: string, name: string) => void; onFileRenameCancel: () => void;
  fileDisplayNames: Record<string, string>;
  memberRoleByUserId: Record<string, string | null>;
}) {
  const { setDropTarget, dropTarget, draggingType } = useContext(DragCtx);
  const [open, setOpen] = useState(true);
  const [editVal, setEditVal] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = editingFolderId === folder.id;
  const isDropTarget = dropTarget === folder.id && draggingType === "doc";
  useEffect(() => { if (isEditing) { setEditVal(folder.name); setTimeout(() => inputRef.current?.select(), 30); } }, [isEditing, folder.name]);
  const confirmRename = () => { if (editVal.trim()) onRenameConfirm(folder.id, editVal.trim()); else onRenameCancel(); };
  return (
    <li>
      <div onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, folder.id); }}
        onDragOver={(e) => { if (draggingType === "doc") { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTarget(folder.id); } }}
        onDragEnter={(e) => { if (draggingType === "doc") { e.preventDefault(); setDropTarget(folder.id); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("docId"); if (id) onMoveToFolder(id, folder.id); setDropTarget(null); setOpen(true); }}
        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors cursor-pointer select-none ${isDropTarget ? "bg-primary-100 ring-2 ring-primary-300 ring-inset" : "hover:bg-neutral-50"}`}
        onClick={() => !isEditing && setOpen((v) => !v)}>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="flex flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
          <ChevronRight className="size-3.5 text-neutral-400" />
        </motion.span>
        {open ? <FolderOpen className="size-4 text-primary-500 flex-shrink-0" /> : <Folder className="size-4 text-sky-500 flex-shrink-0" />}
        {isEditing ? (
          <input ref={inputRef} value={editVal} onChange={(e) => setEditVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") onRenameCancel(); }}
            onBlur={confirmRename} onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 text-sm font-medium border border-primary-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary-400 bg-white" />
        ) : (
          <span className="flex-1 min-w-0 text-sm font-medium text-neutral-700 truncate">{folder.name}</span>
        )}
        <span className="text-xs text-neutral-400 flex-shrink-0">{docs.length}</span>
        {!isEditing && (
          <button type="button" onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onContextMenu(e, folder.id); }}
            className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-neutral-400 hover:text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity rounded">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="overflow-hidden border-l border-neutral-100 ml-[13px] pl-2"
          >
            {docs.length === 0 ? <li className="py-2 px-2 text-xs text-neutral-400 italic">Glissez des fichiers ici</li>
              : docs.map((d) => (
                <FileRow key={d.id} doc={d} displayName={fileDisplayNames[d.id] ?? d.name}
                  selectedId={selectedId} onSelect={onSelect} onContextMenu={onFileContextMenu}
                  editingId={editingFileId} onRenameConfirm={onFileRenameConfirm} onRenameCancel={onFileRenameCancel}
                  memberRoleByUserId={memberRoleByUserId} />
              ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

// ─── Root files section ───────────────────────────────────────────────────────

function RootFilesSection({
  docs, selectedId, onSelect, onMoveToFolder, onContextMenu,
  editingFileId, onFileRenameConfirm, onFileRenameCancel, fileDisplayNames,
  memberRoleByUserId,
}: {
  docs: DocumentRow[]; selectedId: string | null;
  onSelect: (d: DocumentRow) => void;
  onMoveToFolder: (docId: string, folderId: string | null) => void;
  onContextMenu: (e: React.MouseEvent, docId: string) => void;
  editingFileId: string | null; onFileRenameConfirm: (id: string, name: string) => void; onFileRenameCancel: () => void;
  fileDisplayNames: Record<string, string>;
  memberRoleByUserId: Record<string, string | null>;
}) {
  const { setDropTarget, dropTarget, draggingType } = useContext(DragCtx);
  const isDropTarget = dropTarget === "root" && draggingType === "doc";
  return (
    <li>
      <div onDragOver={(e) => { if (draggingType === "doc") { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTarget("root"); } }}
        onDragEnter={(e) => { if (draggingType === "doc") { e.preventDefault(); setDropTarget("root"); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("docId"); if (id) onMoveToFolder(id, null); setDropTarget(null); }}
        className={`flex items-center gap-1.5 px-2 py-1 mt-1 rounded-lg transition-colors ${isDropTarget ? "bg-neutral-100 ring-2 ring-neutral-200 ring-inset" : ""}`}>
        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide flex-1">Non classés</span>
        <span className="text-[10px] text-neutral-400">{docs.length}</span>
      </div>
      {docs.length === 0
        ? <p className="px-3 py-2 text-xs text-neutral-400 italic">Glissez des fichiers ici pour les déclasser</p>
        : <ul>{docs.map((d) => (
            <FileRow key={d.id} doc={d} displayName={fileDisplayNames[d.id] ?? d.name}
              selectedId={selectedId} onSelect={onSelect} onContextMenu={onContextMenu}
              editingId={editingFileId} onRenameConfirm={onFileRenameConfirm} onRenameCancel={onFileRenameCancel}
              memberRoleByUserId={memberRoleByUserId} />
          ))}</ul>}
    </li>
  );
}

// ─── Devis liés section (with drag drop to link) ──────────────────────────────

function DevisLiesSection({
  quotes, availableQuotes, selectedId, onSelectQuote, canEdit,
  onAttachQuoteById,
  onAttachDocumentById,
}: {
  quotes: QuoteSummary[]; availableQuotes: QuoteSummary[]; selectedId: string | null;
  onSelectQuote: (q: QuoteSummary) => void;
  canEdit: boolean; onAttachQuoteById: (quoteId: string) => void;
  onAttachDocumentById: (docId: string) => void | Promise<void>;
}) {
  const { setDropTarget, dropTarget, draggingType } = useContext(DragCtx);
  const [open, setOpen] = useState(true);
  const isDropTarget = dropTarget === "devis_lies";

  const readDragged = (dt: DataTransfer) => {
    const quoteId = dt.getData("quoteId");
    const docId = dt.getData("docId");
    const plain = dt.getData("text/plain") || "";
    if (quoteId) return { kind: "quote" as const, id: quoteId };
    if (docId) return { kind: "doc" as const, id: docId };
    if (plain.startsWith("quote:")) return { kind: "quote" as const, id: plain.slice("quote:".length) };
    if (plain.startsWith("doc:")) return { kind: "doc" as const, id: plain.slice("doc:".length) };
    if (draggingType === "quote" && plain) return { kind: "quote" as const, id: plain };
    if (draggingType === "doc" && plain) return { kind: "doc" as const, id: plain };
    return null;
  };

  return (
    <li>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          const dragged = readDragged(e.dataTransfer);
          if (!dragged) return;
          e.dataTransfer.dropEffect = dragged.kind === "doc" ? "move" : "link";
          setDropTarget("devis_lies");
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          const dragged = readDragged(e.dataTransfer);
          if (dragged) setDropTarget("devis_lies");
        }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
        onDrop={(e) => {
          e.preventDefault();
          const dragged = readDragged(e.dataTransfer);
          if (!dragged) return;
          if (dragged.kind === "quote") onAttachQuoteById(dragged.id);
          else void onAttachDocumentById(dragged.id);
          setDropTarget(null);
        }}
        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors cursor-pointer select-none ${
          isDropTarget ? "bg-amber-50 ring-2 ring-amber-300 ring-inset" : "hover:bg-neutral-50"
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="flex flex-shrink-0">
          <ChevronRight className="size-3.5 text-neutral-400" />
        </motion.span>
        <Folder className="size-4 text-amber-500 flex-shrink-0" />
        <span className="flex-1 min-w-0 text-sm font-medium text-neutral-700 truncate">
          Devis liés
          {isDropTarget && <span className="ml-2 text-[10px] text-amber-600 font-normal">Déposer pour lier</span>}
        </span>
        <span className="text-xs text-neutral-400 flex-shrink-0">{quotes.length}</span>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onDragOver={(e) => {
              e.preventDefault();
              const dragged = readDragged(e.dataTransfer);
              if (!dragged) return;
              e.dataTransfer.dropEffect = dragged.kind === "doc" ? "move" : "link";
              setDropTarget("devis_lies");
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              const dragged = readDragged(e.dataTransfer);
              if (dragged) setDropTarget("devis_lies");
            }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
            onDrop={(e) => {
              e.preventDefault();
              const dragged = readDragged(e.dataTransfer);
              if (!dragged) return;
              if (dragged.kind === "quote") onAttachQuoteById(dragged.id);
              else void onAttachDocumentById(dragged.id);
              setDropTarget(null);
            }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="overflow-hidden border-l border-neutral-100 ml-[13px] pl-2"
          >
            {quotes.length === 0
              ? <li className="py-2 px-2 text-xs text-neutral-400 italic min-h-[44px] flex items-center">
                  {canEdit ? "Glissez un devis disponible ici pour le lier" : "Aucun devis lié"}
                </li>
              : quotes.map((q) => {
                const ws = resolveWorkflowStatus(q);
                const isSelected = selectedId === `devis_${q.id}`;
                return (
                  <li key={q.id}>
                    <div onClick={() => onSelectQuote(q)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer select-none ${isSelected ? "bg-primary-50 text-primary-700 font-medium" : "text-neutral-700 hover:bg-neutral-50"}`}>
                      <span className="ml-[22px]"><FileText className="size-4 text-primary-600 flex-shrink-0" /></span>
                      <span className="truncate flex-1 min-w-0">{q.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${BADGE_COLORS[ws]}`}>{WF_LABELS[ws]}</span>
                    </div>
                  </li>
                );
              })}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

// ─── Available Devis section (draggable to link) ──────────────────────────────

function DevisDisponiblesSection({
  availableQuotes,
}: {
  availableQuotes: QuoteSummary[];
}) {
  const { setDragging } = useContext(DragCtx);
  const [open, setOpen] = useState(false);
  if (availableQuotes.length === 0) return null;
  return (
    <li>
      <div className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors cursor-pointer select-none hover:bg-neutral-50"
        onClick={() => setOpen((v) => !v)}>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="flex flex-shrink-0">
          <ChevronRight className="size-3.5 text-neutral-400" />
        </motion.span>
        <Folder className="size-4 text-neutral-300 flex-shrink-0" />
        <span className="flex-1 min-w-0 text-sm font-medium text-neutral-500 truncate">Devis disponibles</span>
        <span className="text-xs text-neutral-400 flex-shrink-0">{availableQuotes.length}</span>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="overflow-hidden border-l border-neutral-100 ml-[13px] pl-2">
            <li className="px-2 py-1 text-[10px] text-neutral-400 italic">Glissez un devis vers « Devis liés » pour le lier</li>
            {availableQuotes.map((q) => (
              <li key={q.id}>
                <div
                  draggable={isQuotePdf(q)}
                  onDragStart={(e) => {
                    if (!isQuotePdf(q)) return;
                    setDragging(q.id, "quote");
                    e.dataTransfer.effectAllowed = "link";
                    e.dataTransfer.setData("quoteId", q.id);
                    e.dataTransfer.setData("text/plain", `quote:${q.id}`);
                  }}
                  onDragEnd={() => setDragging(null, null)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm select-none ${
                    isQuotePdf(q)
                      ? "text-neutral-500 hover:bg-neutral-50 cursor-grab"
                      : "text-neutral-300 cursor-not-allowed"
                  }`}
                  title={isQuotePdf(q) ? undefined : "Seuls les devis PDF peuvent être liés"}
                >
                  <span className="ml-[22px]"><FileText className="size-4 text-neutral-300 flex-shrink-0" /></span>
                  <span className="truncate flex-1 min-w-0">{q.title}</span>
                  {!isQuotePdf(q) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-400 flex-shrink-0">
                      PDF requis
                    </span>
                  )}
                </div>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ProjectDocumentsPanelProps {
  projectId: string;
  canUpload?: boolean;
  quotes: QuoteSummary[];
  canEditQuotes?: boolean;
  availableQuotes: QuoteSummary[];
  selectedQuoteId: string;
  onSetSelectedQuoteId: (id: string) => void;
  onAttachQuote: (quoteId?: string) => void | Promise<void>;
  quoteStatusUpdatingId?: string | null;
  quoteDeletingId?: string | null;
  onUpdateWorkflow?: (q: QuoteSummary, status: "valide" | "refuse") => void;
  onDeleteQuote?: (q: QuoteSummary) => void;
  onDownloadQuote?: (q: QuoteSummary) => void;
  onViewQuote?: (q: QuoteSummary) => void;
}

export default function ProjectDocumentsPanel({
  projectId, canUpload = true,
  quotes, canEditQuotes = false, availableQuotes,
  selectedQuoteId, onSetSelectedQuoteId, onAttachQuote,
  quoteStatusUpdatingId = null, quoteDeletingId = null,
  onUpdateWorkflow, onDeleteQuote, onDownloadQuote,
}: ProjectDocumentsPanelProps) {
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [memberRoleByUserId, setMemberRoleByUserId] = useState<Record<string, string | null>>({});

  const [customFolders, setCustomFolders] = useState<CustomFolder[]>([]);
  const [docFolderMap, setDocFolderMap] = useState<Record<string, string>>({});
  const [fileDisplayNames, setFileDisplayNames] = useState<Record<string, string>>({});

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingType, setDraggingType] = useState<"doc" | "quote" | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    try {
      const f = localStorage.getItem(lsKey(projectId, "folders")); if (f) setCustomFolders(JSON.parse(f));
      const m = localStorage.getItem(lsKey(projectId, "map")); if (m) setDocFolderMap(JSON.parse(m));
      const n = localStorage.getItem(lsKey(projectId, "names")); if (n) setFileDisplayNames(JSON.parse(n));
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => { if (creatingFolder) setTimeout(() => newFolderInputRef.current?.focus(), 50); }, [creatingFolder]);

  useEffect(() => {
    const clear = () => { setDraggingId(null); setDraggingType(null); setDropTarget(null); };
    document.addEventListener("dragend", clear);
    return () => document.removeEventListener("dragend", clear);
  }, []);

  const saveFolders = useCallback((f: CustomFolder[]) => { setCustomFolders(f); localStorage.setItem(lsKey(projectId, "folders"), JSON.stringify(f)); }, [projectId]);
  const saveFolderMap = useCallback((m: Record<string, string>) => { setDocFolderMap(m); localStorage.setItem(lsKey(projectId, "map"), JSON.stringify(m)); }, [projectId]);
  const saveFileNames = useCallback((n: Record<string, string>) => { setFileDisplayNames(n); localStorage.setItem(lsKey(projectId, "names"), JSON.stringify(n)); }, [projectId]);

  const loadDocs = useCallback(async () => {
    setLoading(true); setError(null);
    try { setDocs(await getDocuments({ projectId })); }
    catch (e: any) { setError(e?.message ?? "Impossible de charger les documents."); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void loadDocs(); }, [loadDocs]);

  useEffect(() => {
    let active = true;
    const loadMemberRoles = async () => {
      try {
        const { data, error } = await supabase
          .from("project_members")
          .select("user_id,role,status")
          .eq("project_id", projectId)
          .in("status", ["accepted", "active"]);
        if (!active) return;
        if (error) {
          setMemberRoleByUserId({});
          return;
        }
        const map: Record<string, string | null> = {};
        for (const row of data ?? []) {
          const userId = (row as any).user_id as string | null | undefined;
          if (!userId) continue;
          map[userId] = ((row as any).role as string | null) ?? null;
        }
        setMemberRoleByUserId(map);
      } catch {
        if (active) setMemberRoleByUserId({});
      }
    };
    void loadMemberRoles();
    return () => {
      active = false;
    };
  }, [projectId]);

  const createFolder = () => {
    const name = newFolderName.trim(); if (!name) return;
    saveFolders([...customFolders, { id: `folder_${Date.now()}`, name }]);
    setNewFolderName(""); setCreatingFolder(false);
  };
  const renameFolder = (id: string, name: string) => { saveFolders(customFolders.map((f) => (f.id === id ? { ...f, name } : f))); setEditingFolderId(null); };
  const deleteFolder = (id: string) => {
    if (!window.confirm("Supprimer ce dossier ?")) return;
    saveFolders(customFolders.filter((f) => f.id !== id));
    const m = { ...docFolderMap }; Object.keys(m).forEach((dId) => { if (m[dId] === id) delete m[dId]; }); saveFolderMap(m);
  };
  const moveDocToFolder = useCallback((docId: string, folderId: string | null) => {
    setDocFolderMap((prev) => {
      const m = { ...prev }; if (folderId === null) delete m[docId]; else m[docId] = folderId;
      localStorage.setItem(lsKey(projectId, "map"), JSON.stringify(m)); return m;
    });
    setDropTarget(null); setDraggingId(null); setDraggingType(null);
  }, [projectId]);
  const renameFile = (id: string, name: string) => { saveFileNames({ ...fileDisplayNames, [id]: name }); setEditingFileId(null); };
  const openCtxMenu = (e: React.MouseEvent, target: CtxTarget) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, target }); };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { await uploadDocument(file, { projectId, fileType: inferTypeFromFile(file) }); await loadDocs(); }
    catch (e: any) { setError(e?.message ?? "Erreur upload."); }
    finally { event.target.value = ""; }
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm("Supprimer ce document ?")) return;
    setDeletingId(docId);
    try { await deleteDocument(docId); if (selectedFile?.id === docId) setSelectedFile(null); await loadDocs(); }
    catch (e: any) { setError(e?.message ?? "Erreur suppression."); }
    finally { setDeletingId(null); }
  };

  const handleDocSelect = (doc: DocumentRow) => {
    setSelectedFile({ id: doc.id, name: fileDisplayNames[doc.id] ?? doc.name, url: doc.file_url, fileType: doc.file_type as string });
  };
  const handleQuoteSelect = (q: QuoteSummary) => {
    setSelectedFile({ id: `devis_${q.id}`, name: q.title, url: q.fileUrl ?? null, fileType: "devis", isDevis: true, quoteId: q.id });
  };

  const handleAttachQuoteById = useCallback((quoteId: string) => {
    const q = availableQuotes.find((it) => it.id === quoteId) ?? quotes.find((it) => it.id === quoteId) ?? null;
    if (q && !isQuotePdf(q)) {
      setError("Seuls les devis PDF peuvent être liés au projet.");
      return;
    }
    void onAttachQuote(quoteId);
  }, [onAttachQuote, availableQuotes, quotes]);

  const handleAttachDocumentById = useCallback(async (docId: string) => {
    if (!canEditQuotes) {
      setError("Seuls les professionnels peuvent lier un devis.");
      return;
    }
    const doc = docs.find((d) => d.id === docId) ?? null;
    if (!doc) return;
    const name = String(doc.name ?? "");
    if (!name.toLowerCase().endsWith(".pdf")) {
      setError("Seuls les fichiers PDF peuvent être liés comme devis.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Session invalide. Veuillez vous reconnecter.");
      return;
    }

    setError(null);
    const res = await fetch("/api/devis/from-document", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ projectId, documentId: docId }),
    });
    const json = (await res.json().catch(() => null)) as { devisId?: string; error?: string } | null;
    if (!res.ok || !json?.devisId) {
      setError(json?.error ?? `Impossible de lier le devis (HTTP ${res.status}).`);
      return;
    }
    void onAttachQuote(json.devisId);
  }, [canEditQuotes, docs, onAttachQuote, projectId]);

  const docsInFolder = useMemo(() => {
    const map: Record<string, DocumentRow[]> = {};
    customFolders.forEach((f) => (map[f.id] = []));
    docs.forEach((d) => { const fId = docFolderMap[d.id]; if (fId && map[fId]) map[fId].push(d); });
    return map;
  }, [docs, customFolders, docFolderMap]);

  const unassignedDocs = useMemo(() => docs.filter((d) => !docFolderMap[d.id]), [docs, docFolderMap]);
  const selectedQuote = selectedFile?.isDevis && selectedFile.quoteId ? quotes.find((q) => q.id === selectedFile.quoteId) : null;

  const setDragging = useCallback((id: string | null, type: "doc" | "quote" | null) => {
    setDraggingId(id); setDraggingType(type);
  }, []);

  return (
    <DragCtx.Provider value={{ draggingId, draggingType, setDragging, dropTarget, setDropTarget }}>
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start" onDragOver={(e) => e.preventDefault()}>
        {ctxMenu && (
          <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)}
            onRenameFile={(id) => setEditingFileId(id)} onRenameFolder={(id) => setEditingFolderId(id)}
            onDeleteFile={(id) => void handleDelete(id)} onDeleteFolder={(id) => deleteFolder(id)}
            onMoveFile={moveDocToFolder} customFolders={customFolders} docFolderMap={docFolderMap} />
        )}

        {/* LEFT: Explorer */}
        <Card className="overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">Explorateur</div>
                <div className="text-xs text-gray-500 mt-0.5">{docs.length} fichier{docs.length !== 1 ? "s" : ""}</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setCreatingFolder(true)}
                  className="h-8 w-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors" title="Nouveau dossier">
                  <FolderPlus className="w-4 h-4 text-neutral-600" />
                </button>
                {canUpload && (
                  <button onClick={() => uploadInputRef.current?.click()}
                    className="h-8 w-8 rounded-lg bg-primary-50 hover:bg-primary-100 flex items-center justify-center transition-colors" title="Importer">
                    <Upload className="w-4 h-4 text-primary-600" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 min-h-[400px]">
            <input ref={uploadInputRef} type="file" accept="application/pdf,image/*,video/*" className="hidden" onChange={handleUpload} />
            {error && <div className="mb-2 px-2 py-1.5 bg-red-50 rounded text-xs text-red-600">{error}</div>}
            {loading ? <div className="flex items-center justify-center h-40 text-sm text-neutral-400">Chargement...</div> : (
              <ul className="space-y-0.5">
                {customFolders.map((f) => (
                  <FolderRow key={f.id} folder={f} docs={docsInFolder[f.id] ?? []}
                    selectedId={selectedFile?.id ?? null} onSelect={handleDocSelect}
                    onContextMenu={(e, id) => openCtxMenu(e, { kind: "custom_folder", folderId: id })}
                    onMoveToFolder={moveDocToFolder} editingFolderId={editingFolderId}
                    onRenameConfirm={renameFolder} onRenameCancel={() => setEditingFolderId(null)}
                    editingFileId={editingFileId}
                    onFileContextMenu={(e, id) => openCtxMenu(e, { kind: "file", docId: id })}
                    onFileRenameConfirm={renameFile} onFileRenameCancel={() => setEditingFileId(null)}
                    fileDisplayNames={fileDisplayNames}
                    memberRoleByUserId={memberRoleByUserId} />
                ))}

                {creatingFolder && (
                  <li className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <Folder className="size-4 text-sky-500 flex-shrink-0" />
                      <input ref={newFolderInputRef} value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); } }}
                        placeholder="Nom du dossier"
                        className="flex-1 text-sm border border-primary-300 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary-400" />
                      <button type="button" onClick={createFolder} className="text-primary-600 hover:text-primary-700"><Check className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => { setCreatingFolder(false); setNewFolderName(""); }} className="text-neutral-400"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </li>
                )}

                <RootFilesSection docs={unassignedDocs} selectedId={selectedFile?.id ?? null} onSelect={handleDocSelect}
                  onMoveToFolder={moveDocToFolder}
                  onContextMenu={(e, id) => openCtxMenu(e, { kind: "file", docId: id })}
                  editingFileId={editingFileId} onFileRenameConfirm={renameFile} onFileRenameCancel={() => setEditingFileId(null)}
                  fileDisplayNames={fileDisplayNames}
                  memberRoleByUserId={memberRoleByUserId} />

                <DevisLiesSection
                  quotes={quotes} availableQuotes={availableQuotes}
                  selectedId={selectedFile?.id ?? null} onSelectQuote={handleQuoteSelect}
                  canEdit={canEditQuotes}
                  onAttachQuoteById={handleAttachQuoteById}
                  onAttachDocumentById={handleAttachDocumentById} />

                {canEditQuotes && (
                  <DevisDisponiblesSection availableQuotes={availableQuotes} />
                )}

                {docs.length === 0 && quotes.length === 0 && !creatingFolder && (
                  <li className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                    <FolderOpen className="w-10 h-10 text-neutral-200" />
                    <div>
                      <p className="text-sm font-medium text-neutral-600">Aucun document</p>
                      <p className="text-xs text-neutral-400 mt-0.5">Importez un document ou liez un devis</p>
                    </div>
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: Preview */}
        <Card className="overflow-hidden min-h-[480px] flex flex-col">
          {selectedFile ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{selectedFile.name}</div>
                    {selectedQuote && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {formatDate(selectedQuote.updatedAt)}
                        {typeof selectedQuote.totalTtc === "number" && <> · {selectedQuote.totalTtc.toLocaleString("fr-FR")} €</>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {selectedFile.url && (
                      <a href={selectedFile.url} target="_blank" rel="noopener noreferrer"
                        className="h-8 w-8 rounded-lg border border-neutral-200 hover:bg-neutral-50 flex items-center justify-center" title="Ouvrir">
                        <ExternalLink className="w-4 h-4 text-neutral-500" />
                      </a>
                    )}
                    {!selectedFile.isDevis && selectedFile.url && (
                      <a href={selectedFile.url} download
                        className="h-8 w-8 rounded-lg border border-neutral-200 hover:bg-neutral-50 flex items-center justify-center" title="Télécharger">
                        <Download className="w-4 h-4 text-neutral-500" />
                      </a>
                    )}
                    {selectedQuote && onDownloadQuote && (
                      <button type="button" onClick={() => onDownloadQuote(selectedQuote)}
                        className="h-8 w-8 rounded-lg border border-neutral-200 hover:bg-neutral-50 flex items-center justify-center">
                        <Download className="w-4 h-4 text-neutral-500" />
                      </button>
                    )}
                    {!selectedFile.isDevis && (
                      <button type="button" onClick={() => void handleDelete(selectedFile.id)}
                        disabled={deletingId === selectedFile.id}
                        className="h-8 w-8 rounded-lg border border-red-200 hover:bg-red-50 flex items-center justify-center disabled:opacity-50">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                    {selectedFile.isDevis && selectedQuote && canEditQuotes && onDeleteQuote && (
                      <button type="button" onClick={() => onDeleteQuote(selectedQuote)}
                        disabled={quoteDeletingId === selectedQuote.id}
                        className="h-8 w-8 rounded-lg border border-red-200 hover:bg-red-50 flex items-center justify-center disabled:opacity-50">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                    <button type="button" onClick={() => setSelectedFile(null)}
                      className="h-8 px-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-xs text-neutral-500">
                      Fermer
                    </button>
                  </div>
                </div>
                {selectedFile.isDevis && selectedQuote && canEditQuotes && onUpdateWorkflow && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-100">
                    <span className="text-xs text-neutral-500">Statut :</span>
                    {(["a_faire", "envoye", "valide", "refuse"] as WorkflowStatus[]).map((s) => {
                      const current = resolveWorkflowStatus(selectedQuote);
                      return (
                        <button key={s} type="button" onClick={() => onUpdateWorkflow(selectedQuote, s as "valide" | "refuse")}
                          disabled={quoteStatusUpdatingId === selectedQuote.id}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all disabled:opacity-50 ${current === s ? BADGE_COLORS[s] + " ring-1 ring-current" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"}`}>
                          {WF_LABELS[s]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                {selectedFile.url ? (
                  isVideoFile(selectedFile.name) ? <VideoPlayer url={selectedFile.url} name={selectedFile.name} />
                  : isImageFile(selectedFile.name, selectedFile.fileType) ? (
                    <div className="h-full flex items-center justify-center bg-neutral-50 p-6 min-h-[400px]">
                      <img src={selectedFile.url} alt={selectedFile.name} className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm" />
                    </div>
                  ) : isPdfFile(selectedFile.name, selectedFile.fileType) ? (
                    <iframe src={selectedFile.url} title={selectedFile.name} className="w-full border-0 min-h-[500px]" style={{ height: "calc(70vh - 80px)" }} />
                  ) : (
                    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 bg-neutral-50">
                      <File className="w-12 h-12 text-neutral-300" />
                      <a href={selectedFile.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline">
                        <ExternalLink className="w-4 h-4" /> Ouvrir le fichier
                      </a>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 bg-neutral-50">
                    <FileText className="w-12 h-12 text-neutral-300" />
                    <p className="text-sm font-medium text-neutral-700">Aucun fichier joint</p>
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[480px] bg-neutral-50/50">
              <div className="w-16 h-16 rounded-2xl bg-white border border-neutral-100 shadow-sm flex items-center justify-center">
                <Eye className="w-7 h-7 text-neutral-300" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-neutral-700">Aperçu du document</p>
                <p className="text-xs text-neutral-400 mt-1">Sélectionnez un fichier dans l&apos;explorateur pour le visualiser</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DragCtx.Provider>
  );
}
