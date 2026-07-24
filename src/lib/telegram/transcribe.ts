/**
 * Transcribes an audio file with Whisper via OpenRouter's OpenAI-compatible
 * transcription endpoint (reuses the same OPENROUTER_API_KEY / account
 * already used for task parsing, rather than a separate OpenAI account).
 * Server-only.
 */
export async function transcribeAudio(
  audio: Blob,
  filename: string,
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("transcribeAudio: OPENROUTER_API_KEY is not set");
    return null;
  }

  try {
    const form = new FormData();
    form.append("file", new File([audio], filename, { type: audio.type || "audio/ogg" }));
    form.append("model", "openai/whisper-1");

    const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      console.error("transcribeAudio: OpenRouter returned", response.status, await response.text());
      return null;
    }

    const body = await response.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    return text || null;
  } catch (err) {
    console.error("transcribeAudio: unexpected error", err);
    return null;
  }
}

/**
 * Downloads a Telegram voice file and transcribes it. Telegram voice notes
 * are OGG/Opus; `ogg` is an accepted Whisper input format, so the file is
 * forwarded as-is — no audio conversion.
 */
export async function transcribeVoice(fileUrl: string): Promise<string | null> {
  try {
    const audioResponse = await fetch(fileUrl);
    if (!audioResponse.ok) {
      console.error("transcribeVoice: failed to download voice file", audioResponse.status);
      return null;
    }
    const audioBlob = await audioResponse.blob();
    return transcribeAudio(audioBlob, "voice.ogg");
  } catch (err) {
    console.error("transcribeVoice: unexpected error", err);
    return null;
  }
}
