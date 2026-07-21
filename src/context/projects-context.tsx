"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DbProject } from "@/types/gentle";

const ProjectsContext = createContext<DbProject[]>([]);

export function ProjectsProvider({
  projects,
  children,
}: {
  projects: DbProject[];
  children: ReactNode;
}) {
  return <ProjectsContext.Provider value={projects}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): DbProject[] {
  return useContext(ProjectsContext);
}
