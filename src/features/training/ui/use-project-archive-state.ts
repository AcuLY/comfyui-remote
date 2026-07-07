"use client";

import { useState } from "react";

export function useProjectArchiveState(projectId: string | null, initialArchived: boolean) {
  const [projectArchiveState, setProjectArchiveState] = useState(() => ({
    archived: initialArchived,
    projectId,
  }));
  const isProjectArchived = projectArchiveState.projectId === projectId ? projectArchiveState.archived : initialArchived;

  function setProjectArchived(archived: boolean) {
    setProjectArchiveState({
      archived,
      projectId,
    });
  }

  return {
    isProjectArchived,
    setProjectArchived,
  };
}
