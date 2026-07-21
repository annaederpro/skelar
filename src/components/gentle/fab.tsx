"use client";

import { Plus } from "lucide-react";
import { AddTaskDialog } from "@/components/gentle/add-task-dialog";
import { useResourceStatus } from "@/context/resource-status-context";
import type { DbProject } from "@/types/gentle";

interface FabProps {
  projects: DbProject[];
}

export function Fab({ projects }: FabProps) {
  const { isDepleted } = useResourceStatus();

  return (
    <AddTaskDialog
      projects={projects}
      disabledEnergyLevels={isDepleted ? [3] : []}
      triggerClassName="fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-sea text-white shadow-lg transition-colors hover:bg-sea-deep"
    >
      <Plus className="size-6" aria-hidden />
      <span className="sr-only">Нова задача</span>
    </AddTaskDialog>
  );
}
