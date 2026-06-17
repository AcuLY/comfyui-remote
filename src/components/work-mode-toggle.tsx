"use client";

import { useSyncExternalStore } from "react";
import { FlaskConical, ImageIcon } from "lucide-react";

import {
  resolveStoredWorkMode,
  WORK_MODE_CHANGE_EVENT,
  WORK_MODE_STORAGE_KEY,
  type WorkMode,
} from "@/lib/work-mode";

const workModeOptions: Array<{
  description: string;
  icon: typeof ImageIcon;
  label: string;
  value: WorkMode;
}> = [
  {
    value: "generation",
    label: "生图模式",
    description: "运行、项目、预制、模板进入生图资源空间。",
    icon: ImageIcon,
  },
  {
    value: "lora_training",
    label: "LoRA 训练",
    description: "运行、项目、预制、模板进入训练资源空间。",
    icon: FlaskConical,
  },
];

function subscribeWorkMode(onStoreChange: () => void) {
  window.addEventListener(WORK_MODE_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(WORK_MODE_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getWorkModeSnapshot() {
  return resolveStoredWorkMode(window.localStorage.getItem(WORK_MODE_STORAGE_KEY));
}

function getWorkModeServerSnapshot(): WorkMode {
  return "generation";
}

function applyWorkMode(workMode: WorkMode) {
  window.localStorage.setItem(WORK_MODE_STORAGE_KEY, workMode);
  window.dispatchEvent(new Event(WORK_MODE_CHANGE_EVENT));
}

export function WorkModeToggle() {
  const workMode = useSyncExternalStore(
    subscribeWorkMode,
    getWorkModeSnapshot,
    getWorkModeServerSnapshot,
  );

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 md:max-w-[500px]">
      <div>
        <div className="text-sm font-medium text-zinc-200">工作模式</div>
        <div className="text-xs text-zinc-500">只影响资源入口目标；模型和设置保持两个模块共享。</div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {workModeOptions.map(({ value, label, description, icon: Icon }) => {
          const active = workMode === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => applyWorkMode(value)}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                active
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                  : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"
              }`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                <Icon className={active ? "size-4 text-emerald-300" : "size-4 text-sky-400"} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-zinc-500">{description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
