"use client";

import { useSyncExternalStore } from "react";

import {
  WORK_MODE_CHANGE_EVENT,
  WORK_MODE_STORAGE_KEY,
  isDesignDemoWorkModeValue,
} from "@/app/design-demos/routing";

import type { PrototypeWorkMode } from "./routes";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(WORK_MODE_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(WORK_MODE_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getSnapshot(): PrototypeWorkMode {
  const stored = window.localStorage.getItem(WORK_MODE_STORAGE_KEY);
  return isDesignDemoWorkModeValue(stored) ? stored : "generation";
}

function getServerSnapshot(): PrototypeWorkMode {
  return "generation";
}

/**
 * 工作模式沿用组件外壳的存储键与变更事件，SSR 快照固定为 production。
 */
export function usePrototypeWorkMode() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setPrototypeWorkMode(nextMode: PrototypeWorkMode) {
  window.localStorage.setItem(WORK_MODE_STORAGE_KEY, nextMode);
  window.dispatchEvent(new CustomEvent(WORK_MODE_CHANGE_EVENT, { detail: { mode: nextMode } }));
}
