"use client";

import React from "react";
import { X } from "lucide-react";

function isImageType(fileType: string, fileName: string): boolean {
  const t = String(fileType).toLowerCase();
  if (t === "photo" || t.startsWith("image/")) return true;
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
}

function isPdfType(fileType: string, fileName: string): boolean {
  const t = String(fileType).toLowerCase();
  if (t === "pdf" || t === "devis" || t === "facture" || t === "plan") return true;
  return /\.pdf$/i.test(fileName);
}

export type DocumentPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  url: string;
  name: string;
  fileType?: string;
};

export function DocumentPreviewModal({
  open,
  onClose,
  url,
  name,
  fileType = "autre",
}: DocumentPreviewModalProps) {
  if (!open) return null;

  const isImage = isImageType(fileType, name);
  const isPdf = isPdfType(fileType, name);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative bg-white rounded-lg shadow-xl max-w-[90vw] max-h-[90vh] w-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50">
          <span className="text-sm font-medium text-gray-900 truncate flex-1">{name}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary-600 hover:underline whitespace-nowrap"
          >
            Ouvrir
          </a>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-200 text-gray-600"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-4 flex items-center justify-center">
          {isImage ? (
            <img
              src={url}
              alt={name}
              className="max-w-full max-h-[75vh] object-contain"
            />
          ) : isPdf ? (
            <iframe
              src={url}
              title={name}
              className="w-full min-h-[70vh] border-0 rounded"
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">Aperçu non disponible pour ce type de fichier.</p>
              <a
                href={url}
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
  );
}

export type DocumentPreviewTriggerProps = {
  url: string;
  name: string;
  fileType?: string;
  children: React.ReactNode;
  className?: string;
};

export function DocumentPreviewTrigger({
  url,
  name,
  fileType = "autre",
  children,
  className,
}: DocumentPreviewTriggerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Enter" && setOpen(true)}
        className={className}
      >
        {children}
      </span>
      <DocumentPreviewModal
        open={open}
        onClose={() => setOpen(false)}
        url={url}
        name={name}
        fileType={fileType}
      />
    </>
  );
}
