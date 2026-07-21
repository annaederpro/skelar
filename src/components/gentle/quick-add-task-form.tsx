"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Sparkles } from "lucide-react";
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
  /**
   * Mirrors the physical hold state of the dedicated audio FAB (true while
   * held, false on release) so a press-and-hold that started on the main
   * screen, before this form even mounted, keeps controlling the same
   * recording session once the dialog opens.
   */
  micHoldActive?: boolean;
}

const ENERGY_OPTIONS: EnergyLevel[] = [1, 2, 3];

type DurationUnit = "min" | "hour";

// Long tasks read as hours ("3" + год), short ones as minutes ("15" + хв).
function splitMinutes(minutes: number): { value: string; unit: DurationUnit } {
  if (minutes >= 60 && minutes % 30 === 0) {
    return { value: String(minutes / 60), unit: "hour" };
  }
  return { value: String(minutes), unit: "min" };
}

export function QuickAddTaskForm({
  onAdd,
  onParseWithAI,
  disabledEnergyLevels = [],
  projects = [],
  micHoldActive = false,
}: QuickAddTaskFormProps) {
  const [step, setStep] = useState<"input" | "review">("input");
  const [aiText, setAiText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(1);
  // Duration is kept as a raw string + unit: a controlled number input that
  // coerces to a number on every keystroke can't be cleared on iOS (the forced
  // "0" re-render leaves artifacts like "018").
  const [durationValue, setDurationValue] = useState("30");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("min");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>(4);
  const [dueDate, setDueDate] = useState("");

  const setDurationFromMinutes = (minutes: number) => {
    const { value, unit } = splitMinutes(minutes);
    setDurationValue(value);
    setDurationUnit(unit);
  };

  const durationInMinutes = (): number => {
    const n = Number(durationValue.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return 30;
    return Math.round(durationUnit === "hour" ? n * 60 : n);
  };

  // Latest text, readable from speech callbacks without stale-closure issues.
  const aiTextRef = useRef("");
  // Finalized speech chunks accumulate here; interim words render on top of it.
  const finalTextRef = useRef("");
  // Set on mic release so recognition's async end event triggers the parse.
  const parseOnEndRef = useRef(false);

  const setText = (value: string) => {
    aiTextRef.current = value;
    setAiText(value);
  };

  const runParse = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || isParsing) return;

    setIsParsing(true);
    const result = await onParseWithAI(trimmed);
    setIsParsing(false);

    if (result.ok) {
      setTitle(result.title);
      setPriority(result.priority ?? 4);
      setEnergyLevel(result.energyLevel ?? 1);
      setDurationFromMinutes(result.durationMinutes ?? 30);
      setProjectId(result.projectId);
      setDueDate(result.dueDate ?? "");
      setAiNotice(null);
    } else {
      setTitle(result.rawText);
      setPriority(4);
      setEnergyLevel(1);
      setDurationFromMinutes(30);
      setProjectId(null);
      setDueDate("");
      setAiNotice("AI-розбір не спрацював — перевір поля перед створенням.");
    }
    setStep("review");
  };

  const {
    isSupported: isMicSupported,
    isListening,
    start: startListening,
    stop: stopListening,
  } = useSpeechRecognition({
    onResult: (chunk) => {
      finalTextRef.current = `${finalTextRef.current} ${chunk}`.trim();
      setText(finalTextRef.current);
    },
    onInterim: (interim) => {
      setText(`${finalTextRef.current} ${interim}`.trim());
    },
    onEnd: () => {
      if (parseOnEndRef.current) {
        parseOnEndRef.current = false;
        void runParse(aiTextRef.current);
      }
    },
  });

  const handleMicPress = () => {
    if (isListening) return;
    finalTextRef.current = aiTextRef.current.trim();
    parseOnEndRef.current = false;
    startListening();
  };

  const handleMicRelease = () => {
    if (!isListening) return;
    parseOnEndRef.current = true;
    stopListening();
  };

  // The dedicated audio FAB is pressed/released on the main screen, before
  // (and after) this form is even mounted — this mirrors that hold state
  // onto the same start/release logic the inline mic button uses, so one
  // continuous hold gesture drives the whole capture regardless of the
  // dialog mounting mid-gesture.
  useEffect(() => {
    if (!isMicSupported) return;
    if (micHoldActive) {
      handleMicPress();
    } else {
      handleMicRelease();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micHoldActive]);

  const resetAll = () => {
    setStep("input");
    setText("");
    finalTextRef.current = "";
    setAiNotice(null);
    setTitle("");
    setEnergyLevel(1);
    setDurationFromMinutes(30);
    setProjectId(null);
    setPriority(4);
    setDueDate("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    onAdd({
      title: trimmed,
      energyLevel,
      durationMinutes: durationInMinutes(),
      projectId,
      priority,
      dueDate: dueDate || null,
    });
    resetAll();
  };

  const activeBucket = priorityBucket(priority);

  if (step === "input") {
    return (
      <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-card p-3">
        <textarea
          value={aiText}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напиши або наговори задачу..."
          rows={3}
          autoFocus
          className="w-full resize-none rounded-md border border-line bg-transparent px-3 py-2 text-sm"
        />
        {isListening && (
          <p className="text-center text-xs font-semibold text-coral">
            Слухаю… відпусти кнопку, коли договориш
          </p>
        )}
        <Button
          type="button"
          size="sm"
          className="h-9 w-full rounded-full"
          disabled={isParsing || isListening}
          onClick={() => void runParse(aiTextRef.current)}
        >
          {isParsing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {isParsing ? "Розбираю..." : "Створити"}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-[20px] border border-line bg-card p-3"
    >
      {aiNotice ? (
        <p className="rounded-xl bg-coral-soft/60 px-3 py-2 text-center text-xs text-coral">
          {aiNotice}
        </p>
      ) : (
        <p className="text-center text-xs text-ink-soft">
          ✨ Ось що я зрозумів — підправ, якщо треба
        </p>
      )}

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
          type="text"
          inputMode="decimal"
          value={durationValue}
          onChange={(e) => setDurationValue(e.target.value)}
          aria-label="Тривалість"
          className="ml-2 w-16"
        />
        <div className="flex gap-1 rounded-full bg-muted p-0.5 text-xs font-bold">
          {(["min", "hour"] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => setDurationUnit(unit)}
              aria-pressed={durationUnit === unit}
              className={cn(
                "rounded-full px-2.5 py-1 transition-colors",
                durationUnit === unit ? "bg-card text-ink" : "text-ink-soft",
              )}
            >
              {unit === "min" ? "хв" : "год"}
            </button>
          ))}
        </div>
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
          className="h-9 min-w-0 flex-1 rounded-md border border-line bg-transparent px-3 text-sm"
        >
          <option value="">Всі задачі</option>
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
          className="h-9 w-[132px] shrink-0 rounded-md border border-line bg-transparent px-2 text-sm text-ink-soft"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() => {
            setStep("input");
            setAiNotice(null);
          }}
        >
          ← Назад
        </Button>
        <Button type="submit" size="sm" className="h-9 flex-1 rounded-full">
          <Plus className="size-4" />
          Додати
        </Button>
      </div>
    </form>
  );
}
