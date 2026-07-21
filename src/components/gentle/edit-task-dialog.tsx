"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TaskFieldsForm } from "@/components/gentle/task-fields-form";
import { updateTask } from "@/app/actions";
import {
  splitMinutesToDuration,
  parseDurationMinutes,
  type DurationUnit,
  type DbProject,
  type DbTask,
  type EnergyLevel,
  type Priority,
} from "@/types/gentle";

interface EditTaskDialogProps {
  task: DbTask | null;
  projects: DbProject[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

// Keyed by task id at the call site so React remounts this component (and
// re-runs these lazy initializers) whenever a different task is opened —
// the recommended way to derive state from a prop, instead of an effect
// that would call multiple setStates synchronously on every task switch.
export function EditTaskDialog({ task, projects, onOpenChange, onSaved }: EditTaskDialogProps) {
  const initialDuration = splitMinutesToDuration(task?.duration_minutes ?? 30);
  const [title, setTitle] = useState(task?.title ?? "");
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(task?.energy_level ?? 1);
  const [durationValue, setDurationValue] = useState(initialDuration.value);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(initialDuration.unit);
  const [projectId, setProjectId] = useState<string | null>(task?.project_id ?? null);
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 4);
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    const trimmed = title.trim();
    if (!trimmed) return;

    setIsSaving(true);
    setErrorMessage(null);
    const result = await updateTask(task.id, {
      title: trimmed,
      energyLevel,
      durationMinutes: parseDurationMinutes(durationValue, durationUnit),
      projectId,
      priority,
      dueDate: dueDate || null,
    });
    setIsSaving(false);

    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }
    onSaved();
  };

  return (
    <Dialog open={task !== null} onOpenChange={onOpenChange}>
      <DialogContent className="top-[6vh] max-h-[88vh] translate-y-0 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редагувати задачу</DialogTitle>
        </DialogHeader>
        {task && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {errorMessage && (
              <p className="rounded-xl bg-coral-soft/60 px-3 py-2 text-center text-sm text-coral">
                {errorMessage}
              </p>
            )}
            <TaskFieldsForm
              title={title}
              onTitleChange={setTitle}
              energyLevel={energyLevel}
              onEnergyLevelChange={setEnergyLevel}
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
              projects={projects}
            />
            <Button
              type="submit"
              size="sm"
              className="h-9 w-full rounded-full"
              disabled={isSaving}
            >
              {isSaving ? "Зберігаю..." : "Зберегти"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
