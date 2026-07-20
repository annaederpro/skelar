"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { updateResourceStatus } from "@/app/actions";
import type { ResourceStatus } from "@/types/gentle";

interface ResourceStatusContextValue {
  resourceStatus: ResourceStatus;
  setResourceStatus: (next: ResourceStatus) => void;
  isDepleted: boolean;
}

const ResourceStatusContext = createContext<ResourceStatusContextValue | null>(null);

export function ResourceStatusProvider({
  initialResourceStatus,
  children,
}: {
  initialResourceStatus: ResourceStatus;
  children: ReactNode;
}) {
  const [resourceStatus, setResourceStatusState] = useState<ResourceStatus>(initialResourceStatus);
  const [, startTransition] = useTransition();

  const setResourceStatus = (next: ResourceStatus) => {
    const previous = resourceStatus;
    setResourceStatusState(next);
    startTransition(async () => {
      const result = await updateResourceStatus(next);
      if ("error" in result) {
        setResourceStatusState(previous);
      }
    });
  };

  return (
    <ResourceStatusContext.Provider
      value={{ resourceStatus, setResourceStatus, isDepleted: resourceStatus === "depleted" }}
    >
      {children}
    </ResourceStatusContext.Provider>
  );
}

export function useResourceStatus(): ResourceStatusContextValue {
  const ctx = useContext(ResourceStatusContext);
  if (!ctx) {
    throw new Error("useResourceStatus must be used within ResourceStatusProvider");
  }
  return ctx;
}
