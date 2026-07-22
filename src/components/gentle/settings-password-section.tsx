"use client";

import { useState } from "react";
import { updatePassword } from "@/app/actions";
import { Input } from "@/components/ui/input";

export function SettingsPasswordSection() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (password.length < 6) {
      setError("Пароль має містити щонайменше 6 символів.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Паролі не співпадають.");
      return;
    }

    setIsSaving(true);
    const result = await updatePassword(password);
    setIsSaving(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-muted p-4">
      <p className="text-[15px] font-bold text-ink">Пароль</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-password" className="text-[13px] text-ink-soft">
            Новий пароль
          </label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-password" className="text-[13px] text-ink-soft">
            Повтори пароль
          </label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        {error && <p className="text-[13px] text-coral">{error}</p>}
        {saved && <p className="text-[13px] text-sea-deep">Пароль оновлено</p>}

        <button
          type="submit"
          disabled={isSaving}
          className="self-start rounded-full bg-sea-deep px-3 py-1.5 text-[13px] font-bold text-white disabled:opacity-50"
        >
          Змінити пароль
        </button>
      </form>
    </div>
  );
}
