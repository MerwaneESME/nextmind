"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Minus, Plus } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  documentFile: Blob | string | null;
  fileError: string | null;
  fileLoading: boolean;
  onDocumentLoad: (payload: { numPages: number }) => void;
  pageNumber: number;
  numPages: number;
  scale: number;
  changePage: (offset: number) => void;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  onLoadError: () => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({
  documentFile,
  fileError,
  fileLoading,
  onDocumentLoad,
  pageNumber,
  numPages,
  scale,
  changePage,
  setScale,
  onLoadError,
}) => {
  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => changePage(-1)} disabled={pageNumber <= 1}>
            Precedent
          </Button>
          <span className="text-sm text-gray-600">
            Page {pageNumber} / {numPages || 1}
          </span>
          <Button variant="outline" size="sm" onClick={() => changePage(1)} disabled={pageNumber >= numPages}>
            Suivant
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setScale((prev) => Math.max(prev - 0.1, 0.6))}>
            <Minus className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-600">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={() => setScale((prev) => Math.min(prev + 0.1, 1.6))}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex justify-center overflow-auto bg-gray-50 rounded-lg p-4 min-h-[300px]">
        {fileLoading ? (
          <div className="text-sm text-gray-600">Chargement du PDF...</div>
        ) : documentFile ? (
          <Document
            file={documentFile}
            onLoadSuccess={onDocumentLoad}
            onLoadError={onLoadError}
            loading="Chargement..."
            error={<div className="text-sm text-red-600">Impossible de charger le PDF.</div>}
          >
            <Page pageNumber={pageNumber} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} />
          </Document>
        ) : (
          <div className="text-sm text-red-600">{fileError ?? "Impossible de charger le PDF."}</div>
        )}
      </div>
      {fileError && !fileLoading && <div className="text-sm text-red-600">{fileError}</div>}
    </Card>
  );
};

export default PdfViewer;
