"use client";

import { useState } from "react";
import { Plus, Mic } from "lucide-react";
import { AddTaskDialog } from "@/components/gentle/add-task-dialog";
import { useResourceStatus } from "@/context/resource-status-context";
import type { DbProject } from "@/types/gentle";

interface FabProps {
  projects: DbProject[];
}

export function Fab({ projects }: FabProps) {
  const { isDepleted } = useResourceStatus();
  const [open, setOpen] = useState(false);
  const [micHoldActive, setMicHoldActive] = useState(false);

  const openForText = () => {
    setMicHoldActive(false);
    setOpen(true);
  };

  // Press-and-hold starts recording immediately, before the dialog has even
  // mounted; releasing (up/leave/cancel) stops it — same gesture as the
  // inline mic button, just anchored on the main-screen FAB itself.
  const handleMicPress = () => {
    setMicHoldActive(true);
    setOpen(true);
  };

  const handleMicRelease = () => {
    setMicHoldActive(false);
  };

  return (
    <>
      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-center gap-3.5">
        <button
          type="button"
          onClick={openForText}
          aria-label="Нова задача текстом"
          className="flex size-14 items-center justify-center rounded-full bg-sea text-white shadow-lg transition-colors hover:bg-sea-deep"
        >
          <Plus className="size-6" aria-hidden />
        </button>
        <button
          type="button"
          onPointerDown={handleMicPress}
          onPointerUp={handleMicRelease}
          onPointerLeave={handleMicRelease}
          onPointerCancel={handleMicRelease}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Утримуй, щоб наговорити задачу"
          className="flex size-14 touch-none select-none items-center justify-center rounded-full border-2 border-coral bg-card text-coral shadow-lg transition-colors hover:bg-coral-soft"
        >
          <Mic className="size-6" aria-hidden />
        </button>
      </div>
      <AddTaskDialog
        projects={projects}
        disabledEnergyLevels={isDepleted ? [3] : []}
        open={open}
        onOpenChange={setOpen}
        micHoldActive={micHoldActive}
      />
    </>
  );
}
