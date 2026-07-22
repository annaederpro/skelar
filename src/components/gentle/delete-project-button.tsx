"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteProject } from "@/app/actions";

interface DeleteProjectButtonProps {
  projectId: string;
  projectName: string;
}

export function DeleteProjectButton({ projectId, projectName }: DeleteProjectButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    if (!window.confirm(`Видалити проєкт «${projectName}»? Задачі залишаться без проєкту.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteProject(projectId);
      if (!("error" in result)) {
        router.refresh();
      }
    });
  };

  return (
    <button
      type="button"
      aria-label={`Видалити проєкт ${projectName}`}
      onClick={handleDelete}
      disabled={isPending}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-coral-soft hover:text-coral disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
