"use client";

import { useEffect } from "react";

interface ReleaseToastProps {
  task: { id: string; title: string } | null;
  onUndo: () => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 5000;

export function ReleaseToast({ task, onUndo, onDismiss }: ReleaseToastProps) {
  useEffect(() => {
    if (!task) return;
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [task, onDismiss]);

  if (!task) return null;

  return (
    <div className="fixed inset-x-0 bottom-[84px] z-40 mx-auto flex w-full max-w-md justify-center px-4">
      <div className="flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-white/80">Пішло в безодню 🌊</p>
          <p className="mt-0.5 text-[13px] leading-snug text-white/90">
            Це нормально — змінювати плани. Ти звільнив місце для чогось важливішого.
          </p>
        </div>
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-[12.5px] font-extrabold text-white transition-colors hover:bg-white/25"
        >
          Скасувати
        </button>
      </div>
    </div>
  );
}
