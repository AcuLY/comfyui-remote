"use client";

import type { ReactNode } from "react";

import { cn } from "./utils";

type Tab = {
  count?: number;
  label: string;
  value: string;
};

export function ShadcnDemoTabs({
  className,
  onValueChange,
  tabs,
  value,
}: {
  className?: string;
  onValueChange: (value: string) => void;
  tabs: Tab[];
  value: string;
}) {
  return (
    <div className={cn("demoShadcnTabs", className)}>
      <div className="demoShadcnTabsList inline-flex h-9 items-center justify-center rounded-lg p-1" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-selected={tab.value === value}
            className="demoShadcnTabsTrigger inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
            data-state={tab.value === value ? "active" : "inactive"}
            key={tab.value}
            onClick={() => onValueChange(tab.value)}
            role="tab"
            type="button"
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" ? <span className="demoShadcnTabsCount">{tab.count}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ShadcnDemoTabsPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("demoShadcnTabsPanel mt-2 rounded-md border p-3 text-sm", className)}>{children}</div>;
}
