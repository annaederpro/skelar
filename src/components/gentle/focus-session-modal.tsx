"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { finishFocusSession, leaveFocusSession } from "@/app/actions";
import { useOceanNoise } from "@/lib/ocean-noise";
import { EFFORT_WORD, priorityBucket, PRIORITY_BUCKET_LABEL } from "@/types/gentle";
import type { DbTask } from "@/types/gentle";
import { cn } from "@/lib/utils";

interface FocusSessionModalProps {
  task: DbTask | null;
  onClose: () => void;
  onCelebrate: (kind: "fish" | "turtle", taskTitle: string) => void;
  onLeaveEgg: (taskTitle: string) => void;
}

const RADIUS = 80;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function FocusSessionModal({ task, onClose, onCelebrate, onLeaveEgg }: FocusSessionModalProps) {
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trackedTaskId, setTrackedTaskId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noise = useOceanNoise();
  const router = useRouter();

  const targetSec = task ? task.duration_minutes * 60 : 0;

  // Reset the visible timer the moment a session (re)starts. trackedTaskId
  // is cleared to null on close, so reopening the *same* task after leaving
  // it still restarts elapsed at 0 instead of resuming the old time.
  // Setting state during render (rather than in an effect) is React's
  // documented pattern for "adjusting state when a prop changes" — it
  // re-renders before painting, so there's no flicker and no extra effect.
  if (!task && trackedTaskId !== null) {
    setTrackedTaskId(null);
  } else if (task && task.id !== trackedTaskId) {
    setTrackedTaskId(task.id);
    setElapsed(0);
    setErrorMessage(null);
  }

  useEffect(() => {
    if (!task) return;
    intervalRef.current = setInterval(() => {
      setElapsed((e) => (e >= targetSec ? targetSec : e + 1));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [task, targetSec]);

  const closeAndStopNoise = () => {
    noise.stop();
    if (intervalRef.current) clearInterval(intervalRef.current);
    onClose();
  };

  const handleFinish = async () => {
    if (!task || pending) return;
    setPending(true);
    const result = await finishFocusSession(task.id);
    setPending(false);
    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }
    closeAndStopNoise();
    onCelebrate(task.is_seeded ? "turtle" : "fish", task.title);
    router.refresh();
  };

  const handleLeave = async () => {
    if (!task || pending) return;
    setPending(true);
    const result = await leaveFocusSession(task.id);
    setPending(false);
    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }
    closeAndStopNoise();
    onLeaveEgg(task.title);
    router.refresh();
  };

  const progress = targetSec > 0 ? Math.min(elapsed / targetSec, 1) : 0;

  return (
    <Dialog open={task !== null} onOpenChange={(next) => !next && !pending && closeAndStopNoise()}>
      <DialogContent className="text-center">
        {task && (
          <>
            <div className="text-xs font-extrabold uppercase tracking-widest text-sea">Фокус</div>
            <h2 className="mt-2 font-heading text-xl font-semibold leading-tight">{task.title}</h2>
            <p className="mt-1 text-[13px] text-ink-soft">
              {task.duration_minutes} хв · {EFFORT_WORD[task.energy_level]} ·{" "}
              {PRIORITY_BUCKET_LABEL[priorityBucket(task.priority)]}
            </p>

            <div className="relative mx-auto my-4 size-[180px]">
              <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
                <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="#DDE8E4" strokeWidth="10" />
                <circle
                  cx="90"
                  cy="90"
                  r={RADIUS}
                  fill="none"
                  stroke="#3E8E9C"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading text-[34px] font-semibold leading-none">{fmt(elapsed)}</span>
                <span className="mt-1 text-xs text-ink-soft">ціль {fmt(targetSec)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={noise.toggle}
              className={cn(
                "mx-auto mb-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                noise.isPlaying ? "bg-sea-soft text-sea-deep" : "bg-muted text-ink-soft",
              )}
              aria-pressed={noise.isPlaying}
            >
              {noise.isPlaying ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              Шум моря
            </button>

            <p className="mx-auto my-3.5 max-w-[260px] text-[13.5px] leading-relaxed text-ink-soft">
              Один крок за раз. Немає зворотного відліку з тиском — просто побудь тут, скільки зможеш.
            </p>

            {errorMessage && (
              <p className="mb-3 rounded-xl bg-coral-soft/60 px-3 py-2 text-center text-sm text-coral">
                {errorMessage}
              </p>
            )}

            <div className="flex gap-2.5">
              <Button
                onClick={handleFinish}
                disabled={pending}
                className="flex-1 rounded-2xl bg-sea py-5 font-extrabold hover:bg-sea-deep"
              >
                Завершити
              </Button>
              <Button
                onClick={handleLeave}
                disabled={pending}
                variant="ghost"
                className="rounded-2xl bg-muted py-5 font-bold text-ink-soft hover:bg-muted/70"
              >
                Вийти без тиску
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
