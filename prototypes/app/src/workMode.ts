import { useSyncExternalStore } from "react";

export type PrototypeWorkMode = "generation" | "lora_training";

const WORK_MODE_STORAGE_KEY = "comfyui-manager-prototype:work-mode";
const WORK_MODE_CHANGE_EVENT = "comfyui-manager-prototype:work-mode-change";

function isWorkModeValue(value: unknown): value is PrototypeWorkMode {
  return value === "generation" || value === "lora_training";
}

function readStoredWorkMode(): PrototypeWorkMode {
  try {
    const stored = window.localStorage.getItem(WORK_MODE_STORAGE_KEY);
    return isWorkModeValue(stored) ? stored : "generation";
  } catch {
    return "generation";
  }
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(WORK_MODE_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(WORK_MODE_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function usePrototypeWorkMode(): PrototypeWorkMode {
  return useSyncExternalStore(subscribe, readStoredWorkMode, () => "generation");
}

export function setPrototypeWorkMode(nextMode: PrototypeWorkMode) {
  window.localStorage.setItem(WORK_MODE_STORAGE_KEY, nextMode);
  window.dispatchEvent(
    new CustomEvent(WORK_MODE_CHANGE_EVENT, { detail: { mode: nextMode } }),
  );
}
