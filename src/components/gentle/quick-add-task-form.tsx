"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Mic, Square, Loader2 } from "lucide-react";
import type { DbProject, EnergyLevel, Priority } from "@/types/gentle";
import {
  EFFORT_WORD,
  priorityBucket,
  PRIORITY_BUCKETS,
  PRIORITY_BUCKET_LABEL,
} from "@/types/gentle";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import type { ParseTaskResult } from "@/lib/ai/parse-task";

interface QuickAddTaskFormProps {
  onAdd: (input: {
    title: string;
    energyLevel: EnergyLevel;
    durationMinutes: number;
    projectId: string | null;
    priority: Priority;
    dueDate: string | null;
  }) => void;
  onParseWithAI: (rawText: string) => Promise<ParseTaskResult>;
  disabledEnergyLevels?: EnergyLevel[];
  projects?: DbProject[];
}

const ENERGY_OPTIONS: EnergyLevel[] = [1, 2, 3];

export function QuickAddTaskForm({
  onAdd,
  onParseWithAI,
  disabledEnergyLevels = [],
  projects = [],
}: QuickAddTaskFormProps) {
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [title, setTitle] = useState("");
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(1);
  const [duration, setDuration] = useState(30);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>(4);
  const [dueDate, setDueDate] = useState("");

  const [aiText, setAiText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const {
    isSupported: isMicSupported,
    isListening,
    start: startListening,
    stop: stopListening,
  } = useSpeechRecognition({
    onResult: (transcript) =>
      setAiText((prev) => (prev ? `${prev} ${transcript}` : transcript)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    onAdd({
      title: trimmed,
      energyLevel,
      durationMinutes: duration,
      projectId,
      priority,
      dueDate: dueDate || null,
    });
    setTitle("");
    setEnergyLevel(1);
    setDuration(30);
    setProjectId(null);
    setPriority(4);
    setDueDate("");
  };

  const handleParse = async () => {
    const trimmed = aiText.trim();
    if (!trimmed) {
      setParseError("Введіть текст.");
      return;
    }

    setIsParsing(true);
    setParseError(null);
    const result = await onParseWithAI(trimmed);
    setIsParsing(false);

    if (result.ok) {
      setTitle(result.title);
      if (result.priority) setPriority(result.priority);
      if (result.energyLevel) setEnergyLevel(result.energyLevel);
      if (result.durationMinutes) setDuration(result.durationMinutes);
      setProjectId(result.projectId);
      setDueDate(result.dueDate ?? "");
    } else {
      setTitle(result.rawText);
      setParseError("Не вдалося розібрати автоматично, перевірте поля.");
    }
    setMode("manual");
  };

  const activeBucket = priorityBucket(priority);

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-card p-3">
      <div className="flex gap-1 rounded-full bg-muted p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={cn(
            "flex-1 rounded-full py-1.5 transition-colors",
            mode === "manual" ? "bg-card text-ink" : "text-ink-soft",
          )}
        >
          Вручну
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={cn(
            "flex-1 rounded-full py-1.5 transition-colors",
            mode === "ai" ? "bg-card text-ink" : "text-ink-soft",
          )}
        >
          AI
        </button>
      </div>

      {mode === "ai" ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder="Напиши або скажи, що потрібно зробити..."
            rows={3}
            autoFocus
            className="w-full resize-none rounded-md border border-line bg-transparent px-3 py-2 text-sm"
          />
          {parseError && <p className="text-xs text-coral">{parseError}</p>}
          <div className="flex items-center gap-2">
            {isMicSupported && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => (isListening ? stopListening() : startListening())}
                aria-label={isListening ? "Зупинити запис" : "Записати голосом"}
              >
                {isListening ? <Square className="size-3.5" /> : <Mic className="size-3.5" />}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="flex-1 rounded-full"
              disabled={isParsing}
              onClick={handleParse}
            >
              {isParsing && <Loader2 className="size-3.5 animate-spin" />}
              Розібрати
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            placeholder="Що потрібно зробити?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />

          {/* effort (energy) */}
          <div className="flex items-center gap-1.5">
            {ENERGY_OPTIONS.map((level) => {
              const isDisabled = disabledEnergyLevels.includes(level);
              return (
                <button
                  key={level}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setEnergyLevel(level)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                    energyLevel === level ? "border-sea" : "border-transparent",
                  )}
                  aria-label={`Зусилля: ${EFFORT_WORD[level]}`}
                >
                  <span
                    className={cn(
                      "size-3 rounded-full",
                      level <= energyLevel ? "bg-sea" : "bg-line",
                    )}
                  />
                </button>
              );
            })}
            <span className="text-xs text-ink-soft">{EFFORT_WORD[energyLevel]}</span>

            <Input
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 0)}
              className="ml-2 w-20"
            />
            <span className="text-xs text-ink-soft">хв</span>
          </div>

          {/* priority — 3 human buckets */}
          <div className="flex items-center gap-2">
            {PRIORITY_BUCKETS.map(({ bucket, value }) => (
              <button
                key={bucket}
                type="button"
                onClick={() => setPriority(value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                  activeBucket === bucket
                    ? "border-sea bg-sea-soft text-sea-deep"
                    : "border-line bg-card text-ink-soft",
                )}
                aria-label={`Пріоритет: ${PRIORITY_BUCKET_LABEL[bucket]}`}
                aria-pressed={activeBucket === bucket}
              >
                {PRIORITY_BUCKET_LABEL[bucket]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={projectId ?? ""}
              onChange={(e) => setProjectId(e.target.value || null)}
              aria-label="Проєкт"
              className="h-9 flex-1 rounded-md border border-line bg-transparent px-3 text-sm"
            >
              <option value="">Inbox</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="Дата виконання"
              className="h-9 rounded-md border border-line bg-transparent px-3 text-sm text-ink-soft"
            />
          </div>

          <Button type="submit" size="sm" className="w-full rounded-full">
            <Plus className="size-4" />
            Додати
          </Button>
        </form>
      )}
    </div>
  );
}
