"use client";

import { useState } from "react";
import { disconnectTelegram, updateDailyReminderPreference } from "@/app/actions";
import { TelegramConnectCard } from "@/components/gentle/telegram-connect-card";
import { Switch } from "@/components/ui/switch";

export function SettingsTelegramSection({
  initiallyConnected,
  initialDailyReminderEnabled,
}: {
  initiallyConnected: boolean;
  initialDailyReminderEnabled: boolean;
}) {
  const [connected, setConnected] = useState(initiallyConnected);
  const [reminderEnabled, setReminderEnabled] = useState(initialDailyReminderEnabled);
  const [error, setError] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const disconnect = async () => {
    setError(null);
    const result = await disconnectTelegram();
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setConnected(false);
  };

  const toggleReminder = async (next: boolean) => {
    setReminderError(null);
    setReminderEnabled(next);
    const result = await updateDailyReminderPreference(next);
    if ("error" in result) {
      setReminderEnabled(!next);
      setReminderError(result.error);
    }
  };

  if (connected) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-muted p-4">
        <p className="text-[15px] font-bold text-ink">✅ Telegram підключено</p>
        {error && <p className="text-[13px] text-coral">{error}</p>}
        <button
          type="button"
          onClick={disconnect}
          className="self-start rounded-full bg-paper px-3 py-1.5 text-[13px] font-bold text-ink-soft"
        >
          Відключити
        </button>
        <div className="flex items-center justify-between border-t border-paper pt-3">
          <label className="text-[13px] text-ink-soft">
            Нагадування о 16:00, якщо лишились задачі
          </label>
          <Switch checked={reminderEnabled} onCheckedChange={toggleReminder} />
        </div>
        {reminderError && <p className="text-[13px] text-coral">{reminderError}</p>}
      </div>
    );
  }

  return <TelegramConnectCard />;
}
