"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Loader2, Sparkles, Plus } from "lucide-react";
import type { DbProject, EnergyLevel, Priority } from "@/types/gentle";
import { type DurationUnit, splitMinutesToDuration, parseDurationMinutes } from "@/types/gentle";
import { TaskFieldsForm } from "@/components/gentle/task-fields-form";
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
    dueTime: string | null;
  }) => void;
  onParseWithAI: (rawText: string) => Promise<ParseTaskResult>;
  disabledEnergyLevels?: EnergyLevel[];
  projects?: DbProject[];
}

export function QuickAddTaskForm({
  onAdd,
  onParseWithAI,
  disabledEnergyLevels = [],
  projects = [],
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
  const [dueTime, setDueTime] = useState("");

  const setDurationFromMinutes = (minutes: number) => {
    const { value, unit } = splitMinutesToDuration(minutes);
    setDurationValue(value);
    setDurationUnit(unit);
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
      setDueTime(result.dueTime ?? "");
      setAiNotice(null);
    } else {
      setTitle(result.rawText);
      setPriority(4);
      setEnergyLevel(1);
      setDurationFromMinutes(30);
      setProjectId(null);
      setDueDate("");
      setDueTime("");
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
    setDueTime("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    onAdd({
      title: trimmed,
      energyLevel,
      durationMinutes: parseDurationMinutes(durationValue, durationUnit),
      projectId,
      priority,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
    });
    resetAll();
  };

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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-9 flex-1 rounded-full"
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
          {isMicSupported && (
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              disabled={isParsing}
              onPointerDown={handleMicPress}
              onPointerUp={handleMicRelease}
              onPointerLeave={handleMicRelease}
              onPointerCancel={handleMicRelease}
              onContextMenu={(e) => e.preventDefault()}
              className={cn(
                "touch-none select-none",
                isListening && "animate-pulse border-coral bg-coral text-white hover:bg-coral",
              )}
              aria-label="Утримуй, щоб наговорити задачу"
            >
              <Mic className="size-4" />
            </Button>
          )}
        </div>
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

      <TaskFieldsForm
        title={title}
        onTitleChange={setTitle}
        energyLevel={energyLevel}
        onEnergyLevelChange={setEnergyLevel}
        disabledEnergyLevels={disabledEnergyLevels}
        durationValue={durationValue}
        onDurationValueChange={setDurationValue}
        durationUnit={durationUnit}
        onDurationUnitChange={setDurationUnit}
        priority={priority}
        onPriorityChange={setPriority}
        projectId={projectId}
        onProjectIdChange={setProjectId}
        dueDate={dueDate}
        onDueDateChange={setDueDate}
        dueTime={dueTime}
        onDueTimeChange={setDueTime}
        projects={projects}
        collapsibleDetails={aiNotice === null}
      />

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
