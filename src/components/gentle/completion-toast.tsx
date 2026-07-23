"use client";

const COMPLETION_PHRASES = [
  "Так тримати! 🌊",
  "Ще одна зроблена ✅",
  "Крок за кроком 🐚",
  "Це вже рахується 🐠",
  "Гарна робота 🌿",
  "Плюс одна перемога 🎉",
];

export function pickCompletionPhrase(lastPhrase: string | null): string {
  const pool = lastPhrase
    ? COMPLETION_PHRASES.filter((phrase) => phrase !== lastPhrase)
    : COMPLETION_PHRASES;
  return pool[Math.floor(Math.random() * pool.length)];
}

interface CompletionToastProps {
  toast: { key: number; message: string } | null;
}

export function CompletionToast({ toast }: CompletionToastProps) {
  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[84px] z-40 mx-auto flex w-full max-w-md justify-center px-4">
      <div
        key={toast.key}
        className="animate-in fade-in-0 slide-in-from-bottom-3 zoom-in-95 rounded-full bg-sea-deep px-5 py-2.5 text-sm font-bold text-white shadow-lg duration-300"
      >
        {toast.message}
      </div>
    </div>
  );
}
