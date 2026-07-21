"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuickAddTaskForm } from "@/components/gentle/quick-add-task-form";
import { addTask, parseTaskWithAI } from "@/app/actions";
import type { DbProject, EnergyLevel, Priority } from "@/types/gentle";

interface AddTaskDialogProps {
  projects: DbProject[];
  disabledEnergyLevels?: EnergyLevel[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoStartListening?: boolean;
}

export function AddTaskDialog({
  projects,
  disabledEnergyLevels = [],
  open,
  onOpenChange,
  autoStartListening = false,
}: AddTaskDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleAdd = async (input: {
    title: string;
    energyLevel: EnergyLevel;
    durationMinutes: number;
    projectId: string | null;
    priority: Priority;
    dueDate: string | null;
  }) => {
    setErrorMessage(null);
    const result = await addTask(input);
    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }
    onOpenChange(false);
    setSuccessTitle(input.title);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setSuccessTitle(null), 2600);
    router.refresh();
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (next === false) {
            setErrorMessage(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Нова задача</DialogTitle>
          </DialogHeader>
          {errorMessage && (
            <p className="rounded-xl bg-coral-soft/60 px-3 py-2 text-center text-sm text-coral">
              {errorMessage}
            </p>
          )}
          <QuickAddTaskForm
            onAdd={handleAdd}
            onParseWithAI={parseTaskWithAI}
            disabledEnergyLevels={disabledEnergyLevels}
            projects={projects}
            autoStartListening={autoStartListening}
          />
        </DialogContent>
      </Dialog>

      {successTitle && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 max-w-[calc(100vw-32px)] -translate-x-1/2 truncate rounded-full bg-sea-deep px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
        >
          Задачу створено 🐠 «{successTitle}»
        </div>
      )}
    </>
  );
}
