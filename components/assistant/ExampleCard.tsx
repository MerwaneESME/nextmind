"use client";

export function ExampleCard({ text }: { text: string }) {
  return (
    <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
      <p className="text-sm font-semibold text-green-800 flex items-center gap-2 mb-1">
        <span aria-hidden>💡</span> Exemple concret
      </p>
      <p className="text-sm text-green-700">{text}</p>
    </div>
  );
}

