"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export type PresetSaveStatus = "idle" | "saving" | "queued" | "saved" | "error";

export type PresetSaveQueueSnapshot = {
  status: PresetSaveStatus;
  error: string | null;
};

type PresetSaveQueueOptions<TPayload> = {
  initialStatus: PresetSaveStatus;
  onSave: (payload: TPayload) => void | Promise<void>;
  getErrorMessage?: (error: unknown) => string;
};

type PresetSaveQueueHandlers<TPayload> = Pick<PresetSaveQueueOptions<TPayload>, "onSave" | "getErrorMessage">;

type PresetSaveQueueListener = () => void;

export type PresetSaveQueue<TPayload> = {
  getSnapshot: () => PresetSaveQueueSnapshot;
  subscribe: (listener: PresetSaveQueueListener) => () => void;
  updateHandlers: (handlers: PresetSaveQueueHandlers<TPayload>) => void;
  requestSave: (payload: TPayload) => void;
  retryFailedSave: () => void;
};

function defaultSaveErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "保存失败";
}

export function createPresetSaveQueue<TPayload>({
  initialStatus,
  onSave,
  getErrorMessage = defaultSaveErrorMessage,
}: PresetSaveQueueOptions<TPayload>): PresetSaveQueue<TPayload> {
  const listeners = new Set<PresetSaveQueueListener>();
  let snapshot: PresetSaveQueueSnapshot = { status: initialStatus, error: null };
  let currentOnSave = onSave;
  let currentGetErrorMessage = getErrorMessage;
  let saveInFlight = false;
  let queuedPayload: TPayload | null = null;
  let failedPayload: TPayload | null = null;
  let hasQueuedPayload = false;
  let hasFailedPayload = false;

  function setSnapshot(nextSnapshot: PresetSaveQueueSnapshot) {
    if (snapshot.status === nextSnapshot.status && snapshot.error === nextSnapshot.error) {
      return;
    }

    snapshot = nextSnapshot;
    for (const listener of listeners) {
      listener();
    }
  }

  async function flushSaveQueue() {
    if (saveInFlight) return;
    saveInFlight = true;

    try {
      while (hasQueuedPayload) {
        const payload = queuedPayload as TPayload;
        queuedPayload = null;
        hasQueuedPayload = false;
        setSnapshot({ status: "saving", error: null });

        try {
          await currentOnSave(payload);
          failedPayload = null;
          hasFailedPayload = false;
        } catch (error: unknown) {
          failedPayload = payload;
          hasFailedPayload = true;
          setSnapshot({ status: "error", error: currentGetErrorMessage(error) });
          return;
        }
      }

      setSnapshot({ status: "saved", error: null });
    } finally {
      saveInFlight = false;
      if (hasQueuedPayload) {
        void flushSaveQueue();
      }
    }
  }

  return {
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    updateHandlers(handlers) {
      currentOnSave = handlers.onSave;
      currentGetErrorMessage = handlers.getErrorMessage ?? defaultSaveErrorMessage;
    },
    requestSave(payload) {
      failedPayload = null;
      hasFailedPayload = false;
      queuedPayload = payload;
      hasQueuedPayload = true;
      setSnapshot({ status: saveInFlight ? "queued" : "saving", error: null });
      void flushSaveQueue();
    },
    retryFailedSave() {
      const payload = hasQueuedPayload ? queuedPayload : failedPayload;
      if (!hasQueuedPayload && !hasFailedPayload) return;

      failedPayload = null;
      hasFailedPayload = false;
      queuedPayload = payload;
      hasQueuedPayload = true;
      setSnapshot({ status: "saving", error: null });
      void flushSaveQueue();
    },
  };
}

export function usePresetSaveQueue<TPayload>({
  initialStatus,
  onSave,
  getErrorMessage,
}: PresetSaveQueueOptions<TPayload>) {
  const [queue] = useState(() =>
    createPresetSaveQueue<TPayload>({
      initialStatus,
      onSave,
      getErrorMessage,
    }),
  );

  useEffect(() => {
    queue.updateHandlers({
      onSave,
      getErrorMessage,
    });
  }, [queue, onSave, getErrorMessage]);

  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);

  return {
    saveStatus: snapshot.status,
    saveError: snapshot.error,
    requestSave: queue.requestSave,
    retryFailedSave: queue.retryFailedSave,
  };
}
