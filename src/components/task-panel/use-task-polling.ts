"use client";

import { useEffect, useRef } from "react";

import { pollTaskStatus } from "@/lib/actions/task-polling";
import type { TrackedTask } from "./task-panel-provider";

const POLL_INTERVAL_MS = 3_000;

/**
 * Polls all active (queued/running) tasks every 3 seconds.
 * Calls `onTaskUpdate` when a task's status or metadata changes,
 * and `onTaskComplete` when a task transitions to done/failed.
 */
export function useTaskPolling(
  activeTasks: TrackedTask[],
  onTaskUpdate: (taskId: string, updates: Partial<TrackedTask>) => void,
  onTaskComplete: (task: TrackedTask) => void,
) {
  // Keep stable references so the interval closure always uses latest callbacks
  const onTaskUpdateRef = useRef(onTaskUpdate);
  const onTaskCompleteRef = useRef(onTaskComplete);
  const activeTasksRef = useRef(activeTasks);

  useEffect(() => {
    onTaskUpdateRef.current = onTaskUpdate;
  }, [onTaskUpdate]);

  useEffect(() => {
    onTaskCompleteRef.current = onTaskComplete;
  }, [onTaskComplete]);

  useEffect(() => {
    activeTasksRef.current = activeTasks;
  }, [activeTasks]);

  useEffect(() => {
    // Don't start polling if no tasks need it
    const hasPollable = activeTasks.some(
      (t) => t.status === "queued" || t.status === "running",
    );
    if (!hasPollable) return;

    let cancelled = false;

    const poll = async () => {
      const tasks = activeTasksRef.current.filter(
        (t) => t.status === "queued" || t.status === "running",
      );

      if (tasks.length === 0) return;

      const results = await Promise.allSettled(
        tasks.map((t) => pollTaskStatus(t.jobId, t.taskId)),
      );

      if (cancelled) return;

      for (let i = 0; i < tasks.length; i++) {
        const result = results[i];
        if (result.status !== "fulfilled") continue;

        const response = result.value;
        if (!response.ok) continue;

        const task = tasks[i];
        const newStatus = normalizeStatus(response.status);

        // Determine if anything changed
        const updates: Partial<TrackedTask> = {};
        if (newStatus && newStatus !== task.status) {
          updates.status = newStatus;
        }
        if (response.errorSummary !== task.errorSummary) {
          updates.errorSummary = response.errorSummary;
        }
        if (response.startedAt !== task.startedAt) {
          updates.startedAt = response.startedAt;
        }
        if (response.finishedAt !== task.finishedAt) {
          updates.finishedAt = response.finishedAt;
        }

        if (Object.keys(updates).length === 0) continue;

        const updatedTask = { ...task, ...updates };

        if (updatedTask.status === "done" || updatedTask.status === "failed") {
          onTaskCompleteRef.current(updatedTask);
        } else {
          onTaskUpdateRef.current(task.taskId, updates);
        }
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);

    // Run immediately on first mount
    poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // Re-create interval when the set of pollable tasks changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTasks.filter((t) => t.status === "queued" || t.status === "running").map((t) => t.taskId).join(",")]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeStatus(status: string): TrackedTask["status"] | null {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "done":
      return "done";
    case "failed":
      return "failed";
    default:
      return null;
  }
}
