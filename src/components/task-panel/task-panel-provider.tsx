"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { useTaskPolling } from "./use-task-polling";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenerationBaseImage = {
  id: string;
  label: string;
  relativePath: string;
  artifactId?: string;
  sha256?: string;
  canonicalView?: string | null;
  generationRunId?: string;
};

export type TaskFormConfig = {
  type: "canonical" | "section" | "promptCard";
  jobId: string;
  sectionId?: string;
  defaultCanonicalView?: string;
  sourceImages?: Array<{ id: string; relativePath: string | null }>;
  disabled?: boolean;
  disabledReason?: string;
};

export type TrackedTask = {
  taskId: string;
  jobId: string;
  type: "canonical" | "section" | "promptCard";
  label: string;
  status: "queued" | "running" | "done" | "failed";
  workerType: string;
  errorSummary?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
};

export type TaskPanelContextValue = {
  // Panel visibility
  isOpen: boolean;
  setOpen: (open: boolean) => void;

  // Form config (set by the page on mount)
  formConfig: TaskFormConfig | null;
  setFormConfig: (config: TaskFormConfig | null) => void;

  // Base images for rerun mode
  baseImages: GenerationBaseImage[];
  pushBaseImage: (image: GenerationBaseImage) => void;
  removeBaseImage: (id: string) => void;
  clearBaseImages: () => void;

  // Task tracking
  activeTasks: TrackedTask[];
  recentTasks: TrackedTask[];
  addTask: (task: TrackedTask) => void;
  dismissTask: (taskId: string) => void;
  activeTaskCount: number;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const TaskPanelContext = createContext<TaskPanelContextValue | null>(null);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTaskPanel(): TaskPanelContextValue {
  const context = useContext(TaskPanelContext);
  if (!context) {
    throw new Error("useTaskPanel must be used within a TaskPanelProvider");
  }
  return context;
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "task-panel:active-tasks";

function loadActiveTasks(): TrackedTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as TrackedTask[];
  } catch {
    return [];
  }
}

function persistActiveTasks(tasks: TrackedTask[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Storage full or unavailable — silently ignore.
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function TaskPanelProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  // Panel open/close
  const [isOpen, setOpen] = useState(false);

  // Form configuration
  const [formConfig, setFormConfig] = useState<TaskFormConfig | null>(null);

  // Base images
  const [baseImages, setBaseImages] = useState<GenerationBaseImage[]>([]);

  // Active tasks (persisted)
  const [activeTasks, setActiveTasks] = useState<TrackedTask[]>(() => loadActiveTasks());

  // Recent tasks (completed within last 60s, auto-dismissed)
  const [recentTasks, setRecentTasks] = useState<TrackedTask[]>([]);

  // Persist active tasks whenever they change
  useEffect(() => {
    persistActiveTasks(activeTasks);
  }, [activeTasks]);

  // Auto-dismiss recent tasks after 60 seconds
  const recentTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = recentTimersRef.current;
    return () => {
      // Cleanup all timers on unmount
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const scheduleRecentDismissal = useCallback((taskId: string) => {
    // Clear existing timer if any
    const existing = recentTimersRef.current.get(taskId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      setRecentTasks((prev) => prev.filter((t) => t.taskId !== taskId));
      recentTimersRef.current.delete(taskId);
    }, 60_000);

    recentTimersRef.current.set(taskId, timer);
  }, []);

  // --- Task tracking callbacks ---

  const addTask = useCallback((task: TrackedTask) => {
    setActiveTasks((prev) => {
      // Prevent duplicate
      if (prev.some((t) => t.taskId === task.taskId)) return prev;
      return [...prev, task];
    });
  }, []);

  const dismissTask = useCallback((taskId: string) => {
    setActiveTasks((prev) => prev.filter((t) => t.taskId !== taskId));
    setRecentTasks((prev) => prev.filter((t) => t.taskId !== taskId));
    const timer = recentTimersRef.current.get(taskId);
    if (timer) {
      clearTimeout(timer);
      recentTimersRef.current.delete(taskId);
    }
  }, []);

  // --- Polling callbacks ---

  const handleTaskUpdate = useCallback((taskId: string, updates: Partial<TrackedTask>) => {
    setActiveTasks((prev) =>
      prev.map((t) => (t.taskId === taskId ? { ...t, ...updates } : t)),
    );
  }, []);

  const handleTaskComplete = useCallback(
    (task: TrackedTask) => {
      // Remove from active
      setActiveTasks((prev) => prev.filter((t) => t.taskId !== task.taskId));

      // Add to recent
      setRecentTasks((prev) => {
        if (prev.some((t) => t.taskId === task.taskId)) return prev;
        return [...prev, task];
      });
      scheduleRecentDismissal(task.taskId);

      // Refresh server data
      router.refresh();
    },
    [router, scheduleRecentDismissal],
  );

  // --- Polling ---
  useTaskPolling(activeTasks, handleTaskUpdate, handleTaskComplete);

  // --- Base images ---

  const pushBaseImage = useCallback((image: GenerationBaseImage) => {
    setBaseImages((prev) => {
      if (prev.some((img) => img.id === image.id)) return prev;
      return [...prev, image];
    });
    setOpen(true);
  }, []);

  const removeBaseImage = useCallback((id: string) => {
    setBaseImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const clearBaseImages = useCallback(() => {
    setBaseImages([]);
  }, []);

  // --- Derived ---

  const activeTaskCount = useMemo(
    () => activeTasks.filter((t) => t.status === "queued" || t.status === "running").length,
    [activeTasks],
  );

  // --- Context value ---

  const value = useMemo<TaskPanelContextValue>(
    () => ({
      isOpen,
      setOpen,
      formConfig,
      setFormConfig,
      baseImages,
      pushBaseImage,
      removeBaseImage,
      clearBaseImages,
      activeTasks,
      recentTasks,
      addTask,
      dismissTask,
      activeTaskCount,
    }),
    [
      isOpen,
      formConfig,
      baseImages,
      pushBaseImage,
      removeBaseImage,
      clearBaseImages,
      activeTasks,
      recentTasks,
      addTask,
      dismissTask,
      activeTaskCount,
    ],
  );

  return (
    <TaskPanelContext.Provider value={value}>
      {children}
    </TaskPanelContext.Provider>
  );
}
