"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { generateTelegramLinkCode } from "@/app/actions";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; code: string }
  | { status: "error"; message: string };

export function TelegramConnectCard() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    generateTelegramLinkCode().then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setState({ status: "error", message: result.error });
      } else {
        setState({ status: "ready", code: result.code });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const regenerate = async () => {
    setState({ status: "loading" });
    const result = await generateTelegramLinkCode(true);
    setState("error" in result ? { status: "error", message: result.error } : { status: "ready", code: result.code });
  };

  const copyCommand = async (code: string) => {
    await navigator.clipboard.writeText(`/link ${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (state.status === "loading") {
    return <p className="text-[15px] text-ink-soft">Генерую код…</p>;
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[15px] text-coral">{state.message}</p>
        <button
          type="button"
          onClick={regenerate}
          className="self-start rounded-full bg-muted px-3 py-1.5 text-[13px] font-bold text-ink-soft"
        >
          Спробувати ще раз
        </button>
      </div>
    );
  }

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const deepLink = `https://t.me/${botUsername}?start=${state.code}`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-muted p-4">
      <a
        href={deepLink}
        target="_blank"
        rel="noreferrer"
        className="rounded-full bg-sea-deep px-4 py-3 text-center text-[15px] font-bold text-white"
      >
        Під&apos;єднати Telegram 🐠
      </a>
      <div className="flex items-center gap-2 text-[13px] text-ink-soft">
        <span>
          Якщо чат з ботом вже відкритий, кнопка може нічого не надіслати — тоді напиши{" "}
          <code className="rounded bg-paper px-1.5 py-0.5">/link {state.code}</code> в чаті вручну
        </span>
        <button
          type="button"
          aria-label="Скопіювати команду"
          onClick={() => copyCommand(state.code)}
          className="text-ink-soft transition-colors hover:text-ink"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <div className="flex items-center justify-between text-[12.5px] text-ink-soft">
        <span>код дійсний 15 хвилин</span>
        <button type="button" onClick={regenerate} className="font-bold underline">
          Згенерувати новий код
        </button>
      </div>
    </div>
  );
}
