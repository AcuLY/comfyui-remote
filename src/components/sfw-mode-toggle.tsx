"use client";

import { useEffect, useState } from "react";
import { EyeOff } from "lucide-react";
import {
  isSfwModeEnabledValue,
  SFW_MODE_ATTRIBUTE,
  SFW_MODE_EVENT,
  SFW_MODE_STORAGE_KEY,
} from "@/lib/sfw-mode";

function applySfwMode(enabled: boolean) {
  document.documentElement.setAttribute(SFW_MODE_ATTRIBUTE, enabled ? "on" : "off");
  window.localStorage.setItem(SFW_MODE_STORAGE_KEY, enabled ? "on" : "off");
  window.dispatchEvent(new Event(SFW_MODE_EVENT));
}

export function SfwModeToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isSfwModeEnabledValue(window.localStorage.getItem(SFW_MODE_STORAGE_KEY)));
  }, []);

  function handleToggle() {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    applySfwMode(nextEnabled);
  }

  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 md:max-w-[500px]">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
        <EyeOff className="size-4 text-sky-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-zinc-200">SFW 模式</div>
        <div className="text-xs text-zinc-500">开启后图片默认模糊，桌面悬浮或移动端点按可临时查看。</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
          enabled
            ? "border-sky-400/40 bg-sky-500/40"
            : "border-white/10 bg-white/[0.05]"
        }`}
      >
        <span
          className={`size-4 rounded-full bg-white shadow-sm transition ${
            enabled ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
