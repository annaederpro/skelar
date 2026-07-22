"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LogOut, Waves, ChevronRight, ChevronUp } from "lucide-react";
import { ResourceStatusProvider, useResourceStatus } from "@/context/resource-status-context";
import { ProjectsProvider } from "@/context/projects-context";
import { ResourceStatusToggle } from "@/components/gentle/resource-status-toggle";
import { DepletedBanner } from "@/components/gentle/depleted-banner";
import { BottomNav } from "@/components/gentle/bottom-nav";
import { Fab } from "@/components/gentle/fab";
import { Wordmark } from "@/components/gentle/wordmark";
import { FocusCard } from "@/components/gentle/focus-card";
import { signOut } from "@/app/actions";
import type { DbProject, DbTask, ResourceStatus } from "@/types/gentle";

function AppHeader({ openTasks }: { openTasks: DbTask[] }) {
  const { resourceStatus, setResourceStatus, isDepleted } = useResourceStatus();
  const pathname = usePathname();
  // The Focus card lives only on Сьогодні — the other tabs stay lighter.
  const showFocus = pathname === "/today" || pathname.startsWith("/today/");
  // Collapsed by default so opening Today lands on the task list, not a
  // decision — Focus is something you reach for, not something you're asked.
  const [focusExpanded, setFocusExpanded] = useState(false);

  return (
    <header className="flex flex-col gap-4 px-4 pt-6">
      <div className="flex w-full items-center justify-between">
        <Wordmark />
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Вийти"
            className="text-ink-soft transition-colors hover:text-ink"
          >
            <LogOut className="size-5" />
          </button>
        </form>
      </div>
      {showFocus &&
        (focusExpanded ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[15px] text-ink-soft">Скільки в тебе енергії зараз?</p>
              <button
                type="button"
                onClick={() => setFocusExpanded(false)}
                aria-label="Згорнути фокус"
                className="text-ink-soft transition-colors hover:text-ink"
              >
                <ChevronUp className="size-4.5" />
              </button>
            </div>
            <ResourceStatusToggle value={resourceStatus} onChange={setResourceStatus} />
            <FocusCard tasks={openTasks} />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setFocusExpanded(true)}
            className="flex items-center justify-between rounded-[18px] bg-gradient-to-br from-sea to-sea-deep px-4 py-3 text-white shadow-[0_10px_26px_rgba(46,110,122,.32)] transition-transform hover:-translate-y-px"
          >
            <span className="flex items-center gap-2 text-[14.5px] font-bold">
              <Waves className="size-[18px]" aria-hidden />
              Підібрати задачу під зараз
            </span>
            <ChevronRight className="size-4" aria-hidden />
          </button>
        ))}
      {showFocus && isDepleted && <DepletedBanner />}
    </header>
  );
}

interface AppShellProps {
  initialResourceStatus: ResourceStatus;
  projects: DbProject[];
  todayCount: number;
  openTasks: DbTask[];
  children: ReactNode;
}

export function AppShell({
  initialResourceStatus,
  projects,
  todayCount,
  openTasks,
  children,
}: AppShellProps) {
  return (
    <ResourceStatusProvider initialResourceStatus={initialResourceStatus}>
      <ProjectsProvider projects={projects}>
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
          <AppHeader openTasks={openTasks} />
          <div className="flex-1 px-4 py-4">{children}</div>
          <BottomNav todayCount={todayCount} />
        </div>
        <Fab projects={projects} />
      </ProjectsProvider>
    </ResourceStatusProvider>
  );
}
