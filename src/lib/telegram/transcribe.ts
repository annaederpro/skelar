/**
 * Downloads a Telegram voice file and transcribes it with OpenAI Whisper.
 * Telegram voice notes are OGG/Opus; `ogg` is an accepted Whisper input
 * format, so the file is forwarded as-is under the name "voice.ogg" —
 * no audio conversion. Server-only (reads OPENAI_API_KEY).
 */
export async function transcribeVoice(fileUrl: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const audioResponse = await fetch(fileUrl);
    if (!audioResponse.ok) {
      return null;
    }
    const audioBlob = await audioResponse.blob();

    const form = new FormData();
    form.append("file", new File([audioBlob], "voice.ogg", { type: "audio/ogg" }));
    form.append("model", "whisper-1");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      return null;
    }

    const body = await response.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    return text || null;
  } catch {
    return null;
  }
}
