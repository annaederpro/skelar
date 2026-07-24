"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
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

function AppHeader({
  openTasks,
  displayName,
}: {
  openTasks: DbTask[];
  displayName: string | null;
}) {
  const { resourceStatus, setResourceStatus, isDepleted } = useResourceStatus();
  const pathname = usePathname();
  // The Focus card lives only on Сьогодні — the other tabs stay lighter.
  const showFocus = pathname === "/today" || pathname.startsWith("/today/");

  return (
    <header className="flex flex-col gap-4 px-4 pt-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex w-full items-center justify-between">
          <Link href="/today" aria-label="На головну">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              aria-label="Налаштування"
              className="flex items-center text-ink-soft transition-colors hover:text-ink"
            >
              <Settings className="size-5" />
            </Link>
            <form action={signOut} className="flex items-center">
              <button
                type="submit"
                aria-label="Вийти"
                className="flex items-center text-ink-soft transition-colors hover:text-ink"
              >
                <LogOut className="size-5" />
              </button>
            </form>
          </div>
        </div>
        {showFocus && (
          <p className="text-[14px] font-bold text-ink">
            {displayName ? `Привіт, ${displayName}! Як ти?` : "Привіт! Як ти?"}
          </p>
        )}
      </div>
      {showFocus && (
        <ResourceStatusToggle value={resourceStatus} onChange={setResourceStatus} />
      )}
      {showFocus && <FocusCard tasks={openTasks} />}
      {showFocus && isDepleted && <DepletedBanner />}
    </header>
  );
}

interface AppShellProps {
  initialResourceStatus: ResourceStatus;
  displayName: string | null;
  projects: DbProject[];
  todayCount: number;
  openTasks: DbTask[];
  children: ReactNode;
}

export function AppShell({
  initialResourceStatus,
  displayName,
  projects,
  todayCount,
  openTasks,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  // Settings has no task list to add to, and the FAB visually overlaps the
  // page's own controls (e.g. the daily reminder toggle) at that scroll
  // position — hide it there.
  const showFab = !pathname.startsWith("/settings");

  return (
    <ResourceStatusProvider initialResourceStatus={initialResourceStatus}>
      <ProjectsProvider projects={projects}>
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
          <AppHeader openTasks={openTasks} displayName={displayName} />
          <div className="flex-1 px-4 py-4">{children}</div>
          <BottomNav todayCount={todayCount} />
        </div>
        {showFab && <Fab projects={projects} />}
      </ProjectsProvider>
    </ResourceStatusProvider>
  );
}
