"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  createContext,
  useContext,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Plus,
  FileText,
  Download,
  Upload,
  Paperclip,
  Trash2,
  FolderOpen,
  ExternalLink,
  File,
  Eye,
  ChevronRight,
  Folder,
  Pencil,
  Check,
  X,
  FolderPlus,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  FileArchive,
  MoreHorizontal,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QuoteSummary } from "@/lib/quotesStore";
import {
  attachPdfToDevis,
  deleteDevisWithItems,
  fetchDevisForUser,
  saveUploadedDevis,
} from "@/lib/devisDb";
import { downloadQuotePdf } from "@/lib/quotePdf";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { AnimatePresence, motion } from "framer-motion";
import { resolveWorkflowStatus, type WorkflowStatus } from "@/lib/statusHelpers";

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomFolder = { id: string; name: string };
type SelectedFile = {
  id: string;
  name: string;
  url: string | null;
  fileType: string;
  quoteId?: string;
};
type CtxTarget =
  | { kind: "file"; quoteId: string }
  | { kind: "custom_folder"; folderId: string }
  | { kind: "status_folder"; statusKey: WorkflowStatus };
type CtxMenu = { x: number; y: number; target: CtxTarget };

// ─── Drag context ─────────────────────────────────────────────────────────────

const DragCtx = createContext<{
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  dropTarget: string | null;
  setDropTarget: (id: string | null) => void;
}>({
  draggingId: null,
  setDraggingId: () => {},
  dropTarget: null,
  setDropTarget: () => {},
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LS_FOLDERS = "nm_doc_folders";
const LS_FOLDER_MAP = "nm_doc_folder_map";
const LS_FILE_NAMES = "nm_doc_file_names";

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

const formatTime = (s: number) => {
  if (!Number.isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  a_faire: "En étude",
  envoye: "Envoyés",
  valide: "Validés",
  refuse: "Refusés",
};

// ─── Context menu component ───────────────────────────────────────────────────

function ContextMenu({
  menu,
  onClose,
  onRenameFile,
  onRenameFolder,
  onDeleteFile,
  onDeleteFolder,
  onMoveFile,
  customFolders,
  quoteFolderMap,
}: {
  menu: CtxMenu;
  onClose: () => void;
  onRenameFile: (quoteId: string) => void;
  onRenameFolder: (folderId: string) => void;
  onDeleteFile: (quoteId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveFile: (quoteId: string, folderId: string | null) => void;
  customFolders: CustomFolder[];
  quoteFolderMap: Record<string, string>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Use a ref object (not the timer number) to store the cleanup fn
    const cleanup = { fn: () => {} };
    const timer = window.setTimeout(() => {
      const close = (e: MouseEvent | KeyboardEvent) => {
        if (e instanceof KeyboardEvent && e.key !== "Escape") return;
        if (e instanceof MouseEvent && menuRef.current?.contains(e.target as Node)) return;
        onClose();
      };
      document.addEventListener("mousedown", close);
      document.addEventListener("keydown", close);
      cleanup.fn = () => {
        document.removeEventListener("mousedown", close);
        document.removeEventListener("keydown", close);
      };
    }, 0);
    return () => {
      window.clearTimeout(timer);
      cleanup.fn();
    };
  }, [onClose]);

  // Clamp menu position to viewport
  const style: React.CSSProperties = {
    position: "fixed",
    top: Math.min(menu.y, window.innerHeight - 260),
    left: Math.min(menu.x, window.innerWidth - 200),
    zIndex: 9999,
  };

  const { target } = menu;
  const currentFolderId =
    target.kind === "file" ? (quoteFolderMap[target.quoteId] ?? null) : null;

  return (
    <div
      ref={menuRef}
      style={style}
      className="w-52 rounded-xl border border-neutral-200 bg-white shadow-xl py-1 text-sm select-none"
    >
      {target.kind === "file" && (
        <>
          <button
            className="ctx-item"
            onClick={() => { onRenameFile(target.quoteId); onClose(); }}
          >
            <Pencil className="w-3.5 h-3.5" /> Renommer
          </button>

          {customFolders.length > 0 && (
            <>
              <div className="border-t border-neutral-100 my-1" />
              <div className="px-3 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">
                Déplacer vers
              </div>
              {customFolders.map((f) => (
                <button
                  key={f.id}
                  className="ctx-item"
                  onClick={() => {
                    onMoveFile(target.quoteId, f.id === currentFolderId ? null : f.id);
                    onClose();
                  }}
                >
                  <Folder className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  {f.id === currentFolderId && <Check className="w-3.5 h-3.5 ml-auto flex-shrink-0 text-primary-500" />}
                </button>
              ))}
              {currentFolderId && (
                <button
                  className="ctx-item text-neutral-500"
                  onClick={() => { onMoveFile(target.quoteId, null); onClose(); }}
                >
                  <X className="w-3.5 h-3.5" /> Retirer du dossier
                </button>
              )}
            </>
          )}

          <div className="border-t border-neutral-100 my-1" />
          <button
            className="ctx-item text-red-600 hover:bg-red-50"
            onClick={() => { onDeleteFile(target.quoteId); onClose(); }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Supprimer
          </button>
        </>
      )}

      {target.kind === "custom_folder" && (
        <>
          <button
            className="ctx-item"
            onClick={() => { onRenameFolder(target.folderId); onClose(); }}
          >
            <Pencil className="w-3.5 h-3.5" /> Renommer
          </button>
          <div className="border-t border-neutral-100 my-1" />
          <button
            className="ctx-item text-red-600 hover:bg-red-50"
            onClick={() => { onDeleteFolder(target.folderId); onClose(); }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Supprimer le dossier
          </button>
        </>
      )}

      {target.kind === "status_folder" && (
        <div className="px-3 py-2 text-xs text-neutral-400 italic">
          Dossier automatique — non modifiable
        </div>
      )}
    </div>
  );
}

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

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, [url]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  return (
    <div className="flex flex-col bg-black">
      <video
        ref={videoRef}
        src={url}
        className="w-full object-contain cursor-pointer"
        style={{ maxHeight: "calc(70vh - 160px)", minHeight: "240px" }}
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (v && !seeking.current) {
            setCurrentTime(v.currentTime);
            setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
          }
        }}
      />
      <div className="bg-neutral-900 px-4 pt-2 pb-3 space-y-2">
        {/* Seek */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-400 w-9 tabular-nums">{formatTime(currentTime)}</span>
          <input
            type="range" min={0} max={100} step={0.1} value={progress}
            onChange={(e) => {
              const pct = Number(e.target.value);
              setProgress(pct);
              if (videoRef.current && duration)
                videoRef.current.currentTime = (pct / 100) * duration;
            }}
            onMouseDown={() => { seeking.current = true; }}
            onMouseUp={() => { seeking.current = false; }}
            className="flex-1 h-1 rounded-full accent-primary-400 cursor-pointer"
          />
          <span className="text-[11px] text-neutral-400 w-9 text-right tabular-nums">{formatTime(duration)}</span>
        </div>
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button" onClick={togglePlay}
              className="w-8 h-8 rounded-full bg-primary-600 hover:bg-primary-500 flex items-center justify-center text-white transition-colors"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  setMuted(!muted);
                  v.muted = !muted;
                }}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v); setMuted(v === 0);
                  if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; }
                }}
                className="w-20 h-1 rounded-full accent-primary-400 cursor-pointer"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-500 truncate max-w-[120px]">{name}</span>
            <button
              type="button"
              onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen();
                else videoRef.current?.requestFullscreen();
              }}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── File Row ─────────────────────────────────────────────────────────────────

function FileRow({
  quote,
  displayName,
  selectedId,
  onSelect,
  onContextMenu,
  editingId,
  onRenameConfirm,
  onRenameCancel,
}: {
  quote: QuoteSummary;
  displayName: string;
  selectedId: string | null;
  onSelect: (q: QuoteSummary) => void;
  onContextMenu: (e: React.MouseEvent, quoteId: string) => void;
  editingId: string | null;
  onRenameConfirm: (quoteId: string, name: string) => void;
  onRenameCancel: () => void;
}) {
  const { draggingId, setDraggingId } = useContext(DragCtx);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSelected = selectedId === quote.id;
  const isEditing = editingId === quote.id;
  const isDragging = draggingId === quote.id;

  // Split name into base + extension for safe renaming
  const getBaseName = (name: string) => {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(0, dot) : name;
  };
  const getExt = (name: string) => {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot) : "";
  };

  const [editVal, setEditVal] = useState(() => getBaseName(displayName));

  useEffect(() => {
    if (isEditing) {
      setEditVal(getBaseName(displayName));
      // Focus and select all text (base name only)
      setTimeout(() => {
        const input = inputRef.current;
        if (input) { input.focus(); input.select(); }
      }, 30);
    }
  }, [isEditing, displayName]);

  const confirmRename = () => {
    const base = editVal.trim();
    if (base) onRenameConfirm(quote.id, base + getExt(displayName));
    else onRenameCancel();
  };

  const triggerCtxMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, quote.id);
  };

  return (
    <li
      draggable
      onDragStart={(e) => {
        setDraggingId(quote.id);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("quoteId", quote.id);
      }}
      onDragEnd={() => setDraggingId(null)}
      // Put onContextMenu on the li (draggable element) so it fires reliably
      onContextMenu={triggerCtxMenu}
      className={`relative transition-opacity ${isDragging ? "opacity-40" : ""}`}
    >
      <div
        onClick={() => !isEditing && onSelect(quote)}
        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer select-none ${
          isSelected ? "bg-primary-50 text-primary-700 font-medium" : "text-neutral-700 hover:bg-neutral-50"
        }`}
      >
        <span className="ml-[22px]">{getFileIcon(displayName, "devis")}</span>

        {isEditing ? (
          <div className="flex items-center flex-1 min-w-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmRename();
                if (e.key === "Escape") onRenameCancel();
              }}
              onBlur={confirmRename}
              className="min-w-0 flex-1 text-sm border border-primary-300 rounded-l px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary-400 bg-white text-neutral-900"
            />
            {getExt(displayName) && (
              <span className="flex-shrink-0 text-sm text-neutral-400 bg-neutral-100 border border-l-0 border-primary-300 rounded-r px-1.5 py-0.5 select-none">
                {getExt(displayName)}
              </span>
            )}
          </div>
        ) : (
          <span className="truncate flex-1 min-w-0">{displayName}</span>
        )}

        {!isEditing && (
          <button
            type="button"
            // onMouseDown fires before the document's mousedown close-listener is registered
            onMouseDown={(e) => { e.stopPropagation(); triggerCtxMenu(e); }}
            className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-neutral-400 hover:text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity rounded"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

// ─── Folder Row ───────────────────────────────────────────────────────────────

function FolderRow({
  folder,
  quotes,
  selectedId,
  onSelect,
  onContextMenu,
  onMoveToFolder,
  editingFolderId,
  onRenameConfirm,
  onRenameCancel,
  editingFileId,
  onFileContextMenu,
  onFileRenameConfirm,
  onFileRenameCancel,
  fileDisplayNames,
}: {
  folder: CustomFolder;
  quotes: QuoteSummary[];
  selectedId: string | null;
  onSelect: (q: QuoteSummary) => void;
  onContextMenu: (e: React.MouseEvent, folderId: string) => void;
  onMoveToFolder: (quoteId: string, folderId: string | null) => void;
  editingFolderId: string | null;
  onRenameConfirm: (folderId: string, name: string) => void;
  onRenameCancel: () => void;
  editingFileId: string | null;
  onFileContextMenu: (e: React.MouseEvent, quoteId: string) => void;
  onFileRenameConfirm: (quoteId: string, name: string) => void;
  onFileRenameCancel: () => void;
  fileDisplayNames: Record<string, string>;
}) {
  const { setDropTarget, dropTarget } = useContext(DragCtx);
  const [open, setOpen] = useState(true);
  const [editVal, setEditVal] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = editingFolderId === folder.id;
  const isDropTarget = dropTarget === folder.id;

  useEffect(() => {
    if (isEditing) {
      setEditVal(folder.name);
      setTimeout(() => inputRef.current?.select(), 30);
    }
  }, [isEditing, folder.name]);

  const confirmRename = () => {
    if (editVal.trim()) onRenameConfirm(folder.id, editVal.trim());
    else onRenameCancel();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(folder.id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const qId = e.dataTransfer.getData("quoteId");
    if (qId) onMoveToFolder(qId, folder.id);
    setDropTarget(null);
    setOpen(true);
  };

  return (
    <li>
      <div
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, folder.id); }}
        onDragOver={handleDragOver}
        onDragEnter={(e) => { e.preventDefault(); setDropTarget(folder.id); }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
        }}
        onDrop={handleDrop}
        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors cursor-pointer select-none ${
          isDropTarget
            ? "bg-primary-100 ring-2 ring-primary-300 ring-inset"
            : "hover:bg-neutral-50"
        }`}
        onClick={() => !isEditing && setOpen((v) => !v)}
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.3 }}
          className="flex flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        >
          <ChevronRight className="size-3.5 text-neutral-400" />
        </motion.span>

        {open ? (
          <FolderOpen className="size-4 text-primary-500 flex-shrink-0" />
        ) : (
          <Folder className="size-4 text-sky-500 flex-shrink-0" />
        )}

        {isEditing ? (
          <input
            ref={inputRef}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmRename();
              if (e.key === "Escape") onRenameCancel();
            }}
            onBlur={confirmRename}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 text-sm font-medium border border-primary-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-primary-400 bg-white text-neutral-900"
          />
        ) : (
          <span className="flex-1 min-w-0 text-sm font-medium text-neutral-700 truncate">
            {folder.name}
          </span>
        )}

        <span className="text-xs text-neutral-400 flex-shrink-0">{quotes.length}</span>
        {!isEditing && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onContextMenu(e, folder.id);
            }}
            className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-neutral-400 hover:text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity rounded"
          >
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
            {quotes.length === 0 ? (
              <li className="py-2 px-2 text-xs text-neutral-400 italic">
                Glissez des fichiers ici
              </li>
            ) : (
              quotes.map((q) => (
                <FileRow
                  key={q.id}
                  quote={q}
                  displayName={fileDisplayNames[q.id] ?? q.fileName ?? q.title ?? "Sans titre"}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onContextMenu={onFileContextMenu}
                  editingId={editingFileId}
                  onRenameConfirm={onFileRenameConfirm}
                  onRenameCancel={onFileRenameCancel}
                />
              ))
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

// ─── Status Folder Row ────────────────────────────────────────────────────────

function StatusFolderRow({
  statusKey,
  quotes,
  selectedId,
  onSelect,
  onMoveToFolder,
  onContextMenu,
  editingFileId,
  onFileRenameConfirm,
  onFileRenameCancel,
  fileDisplayNames,
}: {
  statusKey: WorkflowStatus;
  quotes: QuoteSummary[];
  selectedId: string | null;
  onSelect: (q: QuoteSummary) => void;
  onMoveToFolder: (quoteId: string, folderId: string | null) => void;
  onContextMenu: (e: React.MouseEvent, quoteId: string) => void;
  editingFileId: string | null;
  onFileRenameConfirm: (quoteId: string, name: string) => void;
  onFileRenameCancel: () => void;
  fileDisplayNames: Record<string, string>;
}) {
  const { setDropTarget, dropTarget } = useContext(DragCtx);
  const [open, setOpen] = useState(true);
  const isDropTarget = dropTarget === `status_${statusKey}`;
  if (quotes.length === 0) return null;

  return (
    <li>
      <button
        type="button"
        onContextMenu={(e) => { e.preventDefault(); /* status folders are read-only */ }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTarget(`status_${statusKey}`); }}
        onDragEnter={(e) => { e.preventDefault(); setDropTarget(`status_${statusKey}`); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
        onDrop={(e) => {
          e.preventDefault();
          const qId = e.dataTransfer.getData("quoteId");
          if (qId) onMoveToFolder(qId, null); // remove from custom folder
          setDropTarget(null);
        }}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors select-none ${
          isDropTarget
            ? "bg-neutral-100 ring-2 ring-neutral-300 ring-inset"
            : "text-neutral-600 hover:bg-neutral-50"
        }`}
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.3 }}
          className="flex flex-shrink-0"
        >
          <ChevronRight className="size-3.5 text-neutral-400" />
        </motion.span>
        <Folder className="size-4 text-neutral-400 flex-shrink-0" />
        <span className="flex-1 text-left truncate">{STATUS_LABEL[statusKey]}</span>
        <span className="text-xs text-neutral-400">{quotes.length}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="overflow-hidden border-l border-neutral-100 ml-[13px] pl-2"
          >
            {quotes.map((q) => (
              <FileRow
                key={q.id}
                quote={q}
                displayName={fileDisplayNames[q.id] ?? q.fileName ?? q.title ?? "Sans titre"}
                selectedId={selectedId}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
                editingId={editingFileId}
                onRenameConfirm={onFileRenameConfirm}
                onRenameCancel={onFileRenameCancel}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

// ─── Root files section (always visible, flat, no status grouping) ───────────

function RootFilesSection({
  quotes,
  selectedId,
  onSelect,
  onMoveToFolder,
  onContextMenu,
  editingFileId,
  onFileRenameConfirm,
  onFileRenameCancel,
  fileDisplayNames,
}: {
  quotes: QuoteSummary[];
  selectedId: string | null;
  onSelect: (q: QuoteSummary) => void;
  onMoveToFolder: (quoteId: string, folderId: string | null) => void;
  onContextMenu: (e: React.MouseEvent, quoteId: string) => void;
  editingFileId: string | null;
  onFileRenameConfirm: (quoteId: string, name: string) => void;
  onFileRenameCancel: () => void;
  fileDisplayNames: Record<string, string>;
}) {
  const { setDropTarget, dropTarget } = useContext(DragCtx);
  const isDropTarget = dropTarget === "root";

  return (
    <li>
      {/* Section header — drop target to unassign from custom folder */}
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTarget("root"); }}
        onDragEnter={(e) => { e.preventDefault(); setDropTarget("root"); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
        onDrop={(e) => {
          e.preventDefault();
          const qId = e.dataTransfer.getData("quoteId");
          if (qId) onMoveToFolder(qId, null);
          setDropTarget(null);
        }}
        className={`flex items-center gap-1.5 px-2 py-1 mt-1 rounded-lg transition-colors ${
          isDropTarget
            ? "bg-neutral-100 ring-2 ring-neutral-200 ring-inset"
            : ""
        }`}
      >
        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide flex-1">
          Non classés
        </span>
        <span className="text-[10px] text-neutral-400">{quotes.length}</span>
      </div>

      {quotes.length === 0 ? (
        <p className="px-3 py-2 text-xs text-neutral-400 italic">
          Glissez des fichiers ici pour les déclasser
        </p>
      ) : (
        <ul>
          {quotes.map((q) => (
            <FileRow
              key={q.id}
              quote={q}
              displayName={fileDisplayNames[q.id] ?? q.fileName ?? q.title ?? "Sans titre"}
              selectedId={selectedId}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              editingId={editingFileId}
              onRenameConfirm={onFileRenameConfirm}
              onRenameCancel={onFileRenameCancel}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const roleParam = searchParams.get("role");
  const role = user?.role ?? (roleParam === "professionnel" ? "professionnel" : "particulier");

  // Data
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Folder management
  const [customFolders, setCustomFolders] = useState<CustomFolder[]>([]);
  const [quoteFolderMap, setQuoteFolderMap] = useState<Record<string, string>>({});
  const [fileDisplayNames, setFileDisplayNames] = useState<Record<string, string>>({});

  // Inline editing
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // Global dragend safety net — clears faded state even if onDragEnd on the li doesn't fire
  useEffect(() => {
    const clear = () => { setDraggingId(null); setDropTarget(null); };
    document.addEventListener("dragend", clear);
    return () => document.removeEventListener("dragend", clear);
  }, []);

  // File upload refs
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const [attachTargetId, setAttachTargetId] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const f = localStorage.getItem(LS_FOLDERS);
      if (f) setCustomFolders(JSON.parse(f));
      const m = localStorage.getItem(LS_FOLDER_MAP);
      if (m) setQuoteFolderMap(JSON.parse(m));
      const n = localStorage.getItem(LS_FILE_NAMES);
      if (n) setFileDisplayNames(JSON.parse(n));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (creatingFolder) setTimeout(() => newFolderInputRef.current?.focus(), 50);
  }, [creatingFolder]);

  const saveFolders = useCallback((f: CustomFolder[]) => {
    setCustomFolders(f);
    localStorage.setItem(LS_FOLDERS, JSON.stringify(f));
  }, []);

  const saveFolderMap = useCallback((m: Record<string, string>) => {
    setQuoteFolderMap(m);
    localStorage.setItem(LS_FOLDER_MAP, JSON.stringify(m));
  }, []);

  const saveFileNames = useCallback((n: Record<string, string>) => {
    setFileDisplayNames(n);
    localStorage.setItem(LS_FILE_NAMES, JSON.stringify(n));
  }, []);

  // Folder CRUD
  const createFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    saveFolders([...customFolders, { id: `folder_${Date.now()}`, name }]);
    setNewFolderName("");
    setCreatingFolder(false);
  };

  const renameFolder = (id: string, name: string) => {
    saveFolders(customFolders.map((f) => (f.id === id ? { ...f, name } : f)));
    setEditingFolderId(null);
  };

  const deleteFolder = (id: string) => {
    if (!window.confirm(`Supprimer ce dossier ?`)) return;
    saveFolders(customFolders.filter((f) => f.id !== id));
    const m = { ...quoteFolderMap };
    Object.keys(m).forEach((qId) => { if (m[qId] === id) delete m[qId]; });
    saveFolderMap(m);
  };

  const moveQuoteToFolder = useCallback((quoteId: string, folderId: string | null) => {
    setQuoteFolderMap((prev) => {
      const m = { ...prev };
      if (folderId === null) delete m[quoteId];
      else m[quoteId] = folderId;
      localStorage.setItem(LS_FOLDER_MAP, JSON.stringify(m));
      return m;
    });
    setDropTarget(null);
    setDraggingId(null);
  }, []);

  const renameFile = (quoteId: string, name: string) => {
    saveFileNames({ ...fileDisplayNames, [quoteId]: name });
    setEditingFileId(null);
  };

  // Context menu handlers
  const openCtxMenu = (e: React.MouseEvent, target: CtxTarget) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, target });
  };

  // Data loading
  const normalizeStoragePath = (bucket?: string, path?: string) => {
    if (!bucket || !path) return path;
    return path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  };

  const loadQuotes = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      setQuotes(await fetchDevisForUser(user.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Impossible de charger les documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadQuotes(); }, [user?.id]);

  const quotesInFolder = useMemo(() => {
    const map: Record<string, QuoteSummary[]> = {};
    customFolders.forEach((f) => (map[f.id] = []));
    quotes.forEach((q) => {
      const fId = quoteFolderMap[q.id];
      if (fId && map[fId]) map[fId].push(q);
    });
    return map;
  }, [quotes, customFolders, quoteFolderMap]);

  // All unassigned files shown flat at root (no auto-status grouping)
  const unassignedQuotes = useMemo(
    () => quotes.filter((q) => !quoteFolderMap[q.id]),
    [quotes, quoteFolderMap]
  );

  // File selection
  const handleFileSelect = (quote: QuoteSummary) => {
    const name = fileDisplayNames[quote.id] ?? quote.fileName ?? quote.title ?? "Sans titre";
    if (quote.fileUrl) {
      setSelectedFile({ id: quote.id, name, url: quote.fileUrl, fileType: "devis", quoteId: quote.id });
    } else if (quote.previewData) {
      router.push(`/dashboard/devis/visualiser/${quote.id}?role=${role}`);
    } else {
      setSelectedFile({ id: quote.id, name, url: null, fileType: "devis", quoteId: quote.id });
    }
  };

  const handleDownload = async (quote: QuoteSummary) => {
    const bucket = typeof quote.rawMetadata?.pdf_bucket === "string" ? quote.rawMetadata.pdf_bucket : undefined;
    const rawPath = typeof quote.rawMetadata?.pdf_path === "string" ? quote.rawMetadata.pdf_path : undefined;
    const path = normalizeStoragePath(bucket, rawPath);
    if (bucket && path) {
      const { data } = await supabase.storage.from(bucket).download(path);
      if (data) {
        const blob = new Blob([await data.arrayBuffer()], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = quote.fileName || `${quote.title}.pdf`; a.rel = "noopener"; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return;
      }
    }
    if (quote.fileUrl) {
      const a = document.createElement("a");
      a.href = quote.fileUrl; a.download = quote.fileName || `${quote.title}.pdf`; a.rel = "noopener"; a.click();
      return;
    }
    if (quote.previewData) downloadQuotePdf(quote.previewData, quote.title);
  };

  const handleDelete = async (quoteId: string) => {
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote || !user?.id) return;
    if (!window.confirm("Supprimer ce document ?")) return;
    setDeletingId(quoteId);
    setError(null);
    try {
      const bucket = typeof quote.rawMetadata?.pdf_bucket === "string" ? quote.rawMetadata.pdf_bucket : undefined;
      const rawPath = typeof quote.rawMetadata?.pdf_path === "string" ? quote.rawMetadata.pdf_path : undefined;
      const path = normalizeStoragePath(bucket, rawPath);
      await deleteDevisWithItems(user.id, quoteId, { bucket, path });
      if (selectedFile?.quoteId === quoteId) setSelectedFile(null);
      await loadQuotes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur suppression.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;
    try { await saveUploadedDevis(user.id, file); await loadQuotes(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Erreur upload."); }
    finally { event.target.value = ""; }
  };

  const handleAttachFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !attachTargetId || !user?.id) return;
    const target = quotes.find((q) => q.id === attachTargetId);
    if (!target) return;
    try { await attachPdfToDevis(user.id, target, file); await loadQuotes(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Erreur attachement."); }
    finally { setAttachTargetId(null); event.target.value = ""; }
  };

  const selectedQuote = selectedFile?.quoteId ? quotes.find((q) => q.id === selectedFile.quoteId) : null;

  return (
    <DragCtx.Provider value={{ draggingId, setDraggingId, dropTarget, setDropTarget }}>
      <div
        className="space-y-6"
        onDragOver={(e) => e.preventDefault()}
      >
        {/* Context Menu */}
        {ctxMenu && (
          <ContextMenu
            menu={ctxMenu}
            onClose={() => setCtxMenu(null)}
            onRenameFile={(id) => { setEditingFileId(id); }}
            onRenameFolder={(id) => { setEditingFolderId(id); }}
            onDeleteFile={(id) => void handleDelete(id)}
            onDeleteFolder={(id) => deleteFolder(id)}
            onMoveFile={moveQuoteToFolder}
            customFolders={customFolders}
            quoteFolderMap={quoteFolderMap}
          />
        )}

        {/* ── Header ── */}
        <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="relative flex items-start justify-between gap-6 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
                <FolderOpen className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Documents</h1>
                <p className="text-neutral-600 mt-1">Gérez tous vos documents professionnels</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-neutral-600">
                    {quotes.length} document{quotes.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => uploadInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-neutral-300 bg-white text-neutral-700 font-medium hover:bg-neutral-50 transition-colors"
                  >
                    <Upload className="w-3 h-3" /> Importer
                  </button>
                  <button
                    onClick={() => router.push(`/dashboard/devis/creer?role=${role}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-primary-400 to-primary-600 text-white font-semibold shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-3 h-3" /> Nouveau devis
                  </button>
                </div>
              </div>
            </div>
            <FileText className="hidden sm:block h-16 w-16 text-neutral-200 flex-shrink-0" />
          </div>
        </header>

        <input ref={uploadInputRef} type="file" accept="application/pdf,image/*,video/*" className="hidden" onChange={handleUploadFile} />
        <input ref={attachInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleAttachFile} />
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

        {/* ── File manager + Preview ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
          {/* LEFT: Explorer — prevent browser context menu everywhere inside */}
          <Card className="overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">Explorateur</div>
                  <div className="text-xs text-gray-500 mt-0.5">{quotes.length} fichier{quotes.length !== 1 ? "s" : ""}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCreatingFolder(true)}
                    className="h-8 w-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors"
                    title="Nouveau dossier"
                  >
                    <FolderPlus className="w-4 h-4 text-neutral-600" />
                  </button>
                  <button
                    onClick={() => uploadInputRef.current?.click()}
                    className="h-8 w-8 rounded-lg bg-primary-50 hover:bg-primary-100 flex items-center justify-center transition-colors"
                    title="Importer"
                  >
                    <Upload className="w-4 h-4 text-primary-600" />
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-2 min-h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center h-40 text-sm text-neutral-400">Chargement...</div>
              ) : (
                <ul className="space-y-0.5">
                  {/* Custom folders */}
                  {customFolders.map((f) => (
                    <FolderRow
                      key={f.id}
                      folder={f}
                      quotes={quotesInFolder[f.id] ?? []}
                      selectedId={selectedFile?.id ?? null}
                      onSelect={handleFileSelect}
                      onContextMenu={(e, id) => openCtxMenu(e, { kind: "custom_folder", folderId: id })}
                      onMoveToFolder={moveQuoteToFolder}
                      editingFolderId={editingFolderId}
                      onRenameConfirm={renameFolder}
                      onRenameCancel={() => setEditingFolderId(null)}
                      editingFileId={editingFileId}
                      onFileContextMenu={(e, id) => openCtxMenu(e, { kind: "file", quoteId: id })}
                      onFileRenameConfirm={renameFile}
                      onFileRenameCancel={() => setEditingFileId(null)}
                      fileDisplayNames={fileDisplayNames}
                    />
                  ))}

                  {/* New folder inline input */}
                  {creatingFolder && (
                    <li className="px-2 py-1">
                      <div className="flex items-center gap-2">
                        <Folder className="size-4 text-sky-500 flex-shrink-0" />
                        <input
                          ref={newFolderInputRef}
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") createFolder();
                            if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
                          }}
                          placeholder="Nom du dossier"
                          className="flex-1 text-sm border border-primary-300 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary-400"
                        />
                        <button type="button" onClick={createFolder} className="text-primary-600 hover:text-primary-700">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => { setCreatingFolder(false); setNewFolderName(""); }} className="text-neutral-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  )}

                  {/* Non classés — always visible, drop zone to remove from custom folder */}
                  <RootFilesSection
                    quotes={unassignedQuotes}
                    selectedId={selectedFile?.id ?? null}
                    onSelect={handleFileSelect}
                    onMoveToFolder={moveQuoteToFolder}
                    onContextMenu={(e, id) => openCtxMenu(e, { kind: "file", quoteId: id })}
                    editingFileId={editingFileId}
                    onFileRenameConfirm={renameFile}
                    onFileRenameCancel={() => setEditingFileId(null)}
                    fileDisplayNames={fileDisplayNames}
                  />

                  {quotes.length === 0 && !creatingFolder && (
                    <li className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <FolderOpen className="w-10 h-10 text-neutral-200" />
                      <div>
                        <p className="text-sm font-medium text-neutral-600">Aucun document</p>
                        <p className="text-xs text-neutral-400 mt-0.5">Importez ou créez un devis</p>
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
                          {typeof selectedQuote.totalTtc === "number" && <> · {formatCurrency(selectedQuote.totalTtc)}</>}
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
                      {selectedQuote && (
                        <>
                          <button type="button" onClick={() => void handleDownload(selectedQuote)}
                            className="h-8 w-8 rounded-lg border border-neutral-200 hover:bg-neutral-50 flex items-center justify-center" title="Télécharger">
                            <Download className="w-4 h-4 text-neutral-500" />
                          </button>
                          {!selectedQuote.fileUrl && (
                            <button type="button" onClick={() => { setAttachTargetId(selectedQuote.id); attachInputRef.current?.click(); }}
                              className="h-8 w-8 rounded-lg border border-neutral-200 hover:bg-neutral-50 flex items-center justify-center" title="Attacher un PDF">
                              <Paperclip className="w-4 h-4 text-neutral-500" />
                            </button>
                          )}
                          <button type="button" onClick={() => void handleDelete(selectedQuote.id)}
                            disabled={deletingId === selectedQuote.id}
                            className="h-8 w-8 rounded-lg border border-red-200 hover:bg-red-50 flex items-center justify-center disabled:opacity-50">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </>
                      )}
                      <button type="button" onClick={() => setSelectedFile(null)}
                        className="h-8 px-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-xs text-neutral-500">
                        Fermer
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 p-0 overflow-hidden">
                  {selectedFile.url ? (
                    isVideoFile(selectedFile.name) ? (
                      <VideoPlayer url={selectedFile.url} name={selectedFile.name} />
                    ) : isImageFile(selectedFile.name, selectedFile.fileType) ? (
                      <div className="h-full flex items-center justify-center bg-neutral-50 p-6 min-h-[400px]">
                        <img src={selectedFile.url} alt={selectedFile.name}
                          className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm" />
                      </div>
                    ) : isPdfFile(selectedFile.name, selectedFile.fileType) ? (
                      <iframe src={selectedFile.url} title={selectedFile.name}
                        className="w-full border-0 min-h-[500px]"
                        style={{ height: "calc(70vh - 80px)" }} />
                    ) : (
                      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 bg-neutral-50">
                        <File className="w-12 h-12 text-neutral-300" />
                        <a href={selectedFile.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline">
                          <ExternalLink className="w-4 h-4" /> Ouvrir le fichier
                        </a>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 bg-neutral-50">
                      <FileText className="w-12 h-12 text-neutral-300" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-neutral-700">Aucun fichier joint</p>
                        <p className="text-xs text-neutral-400 mt-1">Ce document n&apos;a pas encore de fichier attaché</p>
                      </div>
                      <div className="flex gap-2">
                        {selectedFile.quoteId && (
                          <Button size="sm" onClick={() => router.push(`/dashboard/devis/visualiser/${selectedFile.quoteId}?role=${role}`)}>
                            <Eye className="w-4 h-4 mr-1.5" /> Visualiser
                          </Button>
                        )}
                        {selectedFile.quoteId && (
                          <Button variant="outline" size="sm"
                            onClick={() => { setAttachTargetId(selectedFile.quoteId!); attachInputRef.current?.click(); }}>
                            <Paperclip className="w-4 h-4 mr-1.5" /> Attacher un PDF
                          </Button>
                        )}
                      </div>
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
                  <p className="text-xs text-neutral-400 mt-1">
                    Sélectionnez un fichier dans l&apos;explorateur pour le visualiser
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DragCtx.Provider>
  );
}
