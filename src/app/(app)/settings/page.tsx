import { createClient } from "@/lib/supabase/server";
import { SettingsTelegramSection } from "@/components/gentle/settings-telegram-section";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: profile } = await supabase
    .from("users")
    .select("telegram_chat_id")
    .eq("id", userId)
    .single();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-xl font-semibold">Налаштування</h2>
      <SettingsTelegramSection initiallyConnected={Boolean(profile?.telegram_chat_id)} />
    </div>
  );
}
