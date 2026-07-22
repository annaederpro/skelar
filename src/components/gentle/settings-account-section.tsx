"use client";

import { useState } from "react";
import { updateDisplayName } from "@/app/actions";
import { Input } from "@/components/ui/input";

export function SettingsAccountSection({
  email,
  initialDisplayName,
}: {
  email: string;
  initialDisplayName: string | null;
}) {
  const [name, setName] = useState(initialDisplayName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setIsSaving(true);

    const result = await updateDisplayName(name);
    setIsSaving(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-muted p-4">
      <p className="text-[15px] font-bold text-ink">Обліковий запис</p>

      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-ink-soft">Пошта</span>
        <span className="text-[15px] text-ink">{email}</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
        <label htmlFor="display-name" className="text-[13px] text-ink-soft">
          Як до тебе звертатись?
        </label>
        <Input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ім'я"
        />

        {error && <p className="text-[13px] text-coral">{error}</p>}
        {saved && <p className="text-[13px] text-sea-deep">Збережено</p>}

        <button
          type="submit"
          disabled={isSaving}
          className="self-start rounded-full bg-sea-deep px-3 py-1.5 text-[13px] font-bold text-white disabled:opacity-50"
        >
          Зберегти
        </button>
      </form>
    </div>
  );
}
