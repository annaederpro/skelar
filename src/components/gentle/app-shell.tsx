"use client";

import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { ResourceStatusProvider, useResourceStatus } from "@/context/resource-status-context";
import { ResourceStatusToggle } from "@/components/gentle/resource-status-toggle";
import { DepletedBanner } from "@/components/gentle/depleted-banner";
import { BottomNav } from "@/components/gentle/bottom-nav";
import { Fab } from "@/components/gentle/fab";
import { signOut } from "@/app/actions";
import type { DbProject, ResourceStatus } from "@/types/gentle";

function AppHeader() {
  const { resourceStatus, setResourceStatus, isDepleted } = useResourceStatus();

  return (
    <header className="flex flex-col items-center gap-4 px-4 pt-6">
      <div className="flex w-full items-center justify-between">
        <span className="size-5" aria-hidden />
        <h1 className="text-lg font-semibold">Gentle Productivity</h1>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Вийти"
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-5" />
          </button>
        </form>
      </div>
      <ResourceStatusToggle value={resourceStatus} onChange={setResourceStatus} />
      {isDepleted && <DepletedBanner />}
    </header>
  );
}

interface AppShellProps {
  initialResourceStatus: ResourceStatus;
  projects: DbProject[];
  todayCount: number;
  children: ReactNode;
}

export function AppShell({
  initialResourceStatus,
  projects,
  todayCount,
  children,
}: AppShellProps) {
  return (
    <ResourceStatusProvider initialResourceStatus={initialResourceStatus}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
        <AppHeader />
        <div className="flex-1 px-4 py-4">{children}</div>
        <BottomNav todayCount={todayCount} />
      </div>
      <Fab projects={projects} />
    </ResourceStatusProvider>
  );
}
