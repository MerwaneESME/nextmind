"use client"

import { useState } from "react"
import { ChevronRight, Folder, FolderOpen, File, FileText, Image, Video, Music, FileArchive } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

export type FileNode = {
  id?: string
  name: string
  nodes?: FileNode[]
  meta?: {
    url?: string
    fileType?: string
    size?: string
    quoteId?: string
    hasPreview?: boolean
    [key: string]: unknown
  }
}

function getFileIcon(name: string, fileType?: string): React.ReactNode {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  const type = (fileType ?? "").toLowerCase()

  if (type === "photo" || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
    return <Image className="size-4 text-emerald-500 flex-shrink-0 ml-[22px]" />
  }
  if (type === "devis" || type === "facture" || type === "plan" || ext === "pdf") {
    return <FileText className="size-4 text-primary-600 flex-shrink-0 ml-[22px]" />
  }
  if (["mp4", "mov", "avi", "webm", "mkv"].includes(ext)) {
    return <Video className="size-4 text-purple-500 flex-shrink-0 ml-[22px]" />
  }
  if (["mp3", "wav", "aac", "flac", "ogg"].includes(ext)) {
    return <Music className="size-4 text-amber-500 flex-shrink-0 ml-[22px]" />
  }
  if (["zip", "rar", "tar", "gz", "7z"].includes(ext)) {
    return <FileArchive className="size-4 text-orange-500 flex-shrink-0 ml-[22px]" />
  }
  return <File className="size-4 text-neutral-400 flex-shrink-0 ml-[22px]" />
}

interface FilesystemItemProps {
  node: FileNode
  animated?: boolean
  selectedId?: string
  onSelect?: (node: FileNode) => void
  depth?: number
  defaultOpen?: boolean
}

export function FilesystemItem({
  node,
  animated = true,
  selectedId,
  onSelect,
  depth = 0,
  defaultOpen,
}: FilesystemItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? depth === 0)
  const isFolder = node.nodes !== undefined
  const isFile = !isFolder
  const isSelected = isFile && selectedId !== undefined && (node.id ?? node.name) === selectedId

  const handleClick = () => {
    if (isFolder) {
      setIsOpen((prev) => !prev)
    } else if (onSelect) {
      onSelect(node)
    }
  }

  const hasChildren = isFolder && node.nodes!.length > 0

  const chevron = hasChildren ? (
    animated ? (
      <motion.span
        animate={{ rotate: isOpen ? 90 : 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.35 }}
        className="flex flex-shrink-0"
      >
        <ChevronRight className="size-3.5 text-neutral-400" />
      </motion.span>
    ) : (
      <ChevronRight
        className={`size-3.5 text-neutral-400 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
      />
    )
  ) : null

  const folderIcon = isFolder ? (
    isOpen ? (
      <FolderOpen
        className={`size-4 flex-shrink-0 text-primary-500 fill-primary-50 ${!hasChildren ? "ml-[22px]" : ""}`}
      />
    ) : (
      <Folder
        className={`size-4 flex-shrink-0 text-sky-500 fill-sky-50 ${!hasChildren ? "ml-[22px]" : ""}`}
      />
    )
  ) : null

  const children = node.nodes?.map((child) => (
    <FilesystemItem
      key={child.id ?? child.name}
      node={child}
      animated={animated}
      selectedId={selectedId}
      onSelect={onSelect}
      depth={depth + 1}
      defaultOpen={false}
    />
  ))

  return (
    <li>
      <button
        type="button"
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors text-left group ${
          isSelected
            ? "bg-primary-50 text-primary-700 font-medium"
            : "text-neutral-700 hover:bg-neutral-50"
        }`}
        onClick={handleClick}
      >
        {chevron}
        {folderIcon ?? getFileIcon(node.name, node.meta?.fileType)}
        <span className="truncate min-w-0 flex-1">{node.name}</span>
        {isFile && !node.meta?.hasPreview && (
          <span className="text-[10px] text-neutral-400 flex-shrink-0 hidden group-hover:block">
            Pas d&apos;aperçu
          </span>
        )}
      </button>

      {isFolder &&
        (animated ? (
          <AnimatePresence initial={false}>
            {isOpen && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                className="overflow-hidden border-l border-neutral-100 ml-[13px] pl-2"
              >
                {children}
                {node.nodes!.length === 0 && (
                  <li className="py-1.5 px-2 text-xs text-neutral-400 italic">Vide</li>
                )}
              </motion.ul>
            )}
          </AnimatePresence>
        ) : isOpen ? (
          <ul className="border-l border-neutral-100 ml-[13px] pl-2">
            {children}
            {node.nodes!.length === 0 && (
              <li className="py-1.5 px-2 text-xs text-neutral-400 italic">Vide</li>
            )}
          </ul>
        ) : null)}
    </li>
  )
}
