"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createProject } from "@/app/actions";

export function CreateProjectForm() {
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setErrorMessage(null);
    const result = await createProject(trimmed);
    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }
    setName("");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Назва нового проєкту"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" size="sm" className="rounded-full">
          <Plus className="size-4" />
        </Button>
      </div>
      {errorMessage && <p className="text-sm text-coral">{errorMessage}</p>}
    </form>
  );
}
