"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronRight, Folder, FileText, X, ChevronLeft } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BrowseItem = {
  name: string;
  type: "directory" | "file";
  path: string;
  size?: number;
};

type BrowseResult = {
  currentPath: string;
  parentPath: string | null;
  items: BrowseItem[];
};

type LoraCascadePickerProps = {
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Size variant for trigger button */
  size?: "sm" | "md";
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function pathSegments(p: string): string[] {
  if (!p) return [];
  return p.split("/").filter(Boolean);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoraCascadePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "选择 LoRA…",
  size = "sm",
}: LoraCascadePickerProps) {
  const [open, setOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState("");
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const fetchDir = useCallback(async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dirPath) params.set("path", dirPath);
      const res = await fetch(`/api/loras/browse?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const data: BrowseResult = (await res.json()).data;
      setItems(data.items);
      setParentPath(data.parentPath);
      setBrowsePath(data.currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on open
  useEffect(() => {
    if (open) {
      // Start browsing from the directory of the current value
      const initial = value ? value.substring(0, value.lastIndexOf("/")) : "";
      fetchDir(initial);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function handleSelect(item: BrowseItem) {
    if (item.type === "directory") {
      fetchDir(item.path);
    } else {
      onChange(item.path);
      setOpen(false);
    }
  }

  function handleBreadcrumbClick(targetPath: string) {
    fetchDir(targetPath);
  }

  const displayValue = value ? value.split("/").pop() : null;
  const segments = pathSegments(browsePath);

  const triggerSizeClasses = size === "sm"
    ? "px-2 py-1 text-xs"
    : "px-3 py-2 text-sm";

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] ${triggerSizeClasses} text-left outline-none transition hover:bg-white/[0.06] focus:border-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${
          displayValue ? "text-zinc-200" : "text-zinc-500"
        }`}
      >
        <span className="flex-1 truncate">{displayValue ?? placeholder}</span>
        <ChevronRight className="size-3.5 shrink-0 text-zinc-500" />
      </button>

      {/* Bottom-sheet overlay */}
      {open && (
        <div
          ref={backdropRef}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={(e) => {
            if (e.target === backdropRef.current) setOpen(false);
          }}
        >
          <div
            className="flex w-full max-w-lg flex-col rounded-t-2xl border border-white/10 bg-zinc-900 shadow-2xl"
            style={{ maxHeight: "65vh" }}
          >
            {/* Header: breadcrumb + close */}
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
              {/* Back button */}
              {parentPath !== null && (
                <button
                  type="button"
                  onClick={() => fetchDir(parentPath)}
                  className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
                >
                  <ChevronLeft className="size-4" />
                </button>
              )}

              {/* Breadcrumb */}
              <div className="flex flex-1 items-center gap-1 overflow-x-auto text-xs scrollbar-none">
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick("")}
                  className="shrink-0 text-sky-400 transition hover:text-sky-300"
                >
                  LoRA
                </button>
                {segments.map((seg, i) => {
                  const segPath = segments.slice(0, i + 1).join("/");
                  const isLast = i === segments.length - 1;
                  return (
                    <span key={segPath} className="flex items-center gap-1">
                      <ChevronRight className="size-3 text-zinc-600" />
                      {isLast ? (
                        <span className="shrink-0 text-zinc-200">{seg}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleBreadcrumbClick(segPath)}
                          className="shrink-0 text-sky-400 transition hover:text-sky-300"
                        >
                          {seg}
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>

              {/* Close */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-xs text-zinc-500">
                  加载中…
                </div>
              ) : error ? (
                <div className="rounded-xl bg-rose-500/10 px-3 py-3 text-xs text-rose-300">
                  {error}
                </div>
              ) : items.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-xs text-zinc-600">
                  空目录
                </div>
              ) : (
                <div className="space-y-1">
                  {items.map((item) => {
                    const isSelected = item.type === "file" && item.path === value;
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => handleSelect(item)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                          isSelected
                            ? "bg-sky-500/10 text-sky-300"
                            : "text-zinc-300 hover:bg-white/[0.04]"
                        }`}
                        style={{ minHeight: 44 }}
                      >
                        {item.type === "directory" ? (
                          <Folder className="size-4 shrink-0 text-amber-400/70" />
                        ) : (
                          <FileText className="size-4 shrink-0 text-zinc-500" />
                        )}
                        <span className="flex-1 truncate text-xs">{item.name}</span>
                        {item.type === "file" && item.size != null && (
                          <span className="shrink-0 text-[10px] text-zinc-600">
                            {formatSize(item.size)}
                          </span>
                        )}
                        {item.type === "directory" && (
                          <ChevronRight className="size-3.5 shrink-0 text-zinc-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Directory-only picker (used in file manager for "move to" dialogs)
// ---------------------------------------------------------------------------

type LoraDirPickerProps = {
  onSelect: (dirPath: string) => void;
  onCancel: () => void;
};

export function LoraDirPicker({ onSelect, onCancel }: LoraDirPickerProps) {
  const [browsePath, setBrowsePath] = useState("");
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const fetchDir = useCallback(async (dirPath: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dirPath) params.set("path", dirPath);
      const res = await fetch(`/api/loras/browse?${params.toString()}`);
      const data: BrowseResult = (await res.json()).data;
      setBrowsePath(data.currentPath);
      setParentPath(data.parentPath);
      setItems(data.items.filter((i) => i.type === "directory"));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDir("");
  }, [fetchDir]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  const segments = pathSegments(browsePath);

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onCancel(); }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
    >
      <div
        className="flex w-full max-w-lg flex-col rounded-t-2xl border border-white/10 bg-zinc-900 shadow-2xl"
        style={{ maxHeight: "60vh" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          {parentPath !== null && (
            <button
              type="button"
              onClick={() => fetchDir(parentPath)}
              className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <div className="flex flex-1 items-center gap-1 overflow-x-auto text-xs scrollbar-none">
            <button type="button" onClick={() => fetchDir("")} className="shrink-0 text-sky-400 hover:text-sky-300">
              LoRA
            </button>
            {segments.map((seg, i) => {
              const segPath = segments.slice(0, i + 1).join("/");
              const isLast = i === segments.length - 1;
              return (
                <span key={segPath} className="flex items-center gap-1">
                  <ChevronRight className="size-3 text-zinc-600" />
                  {isLast ? (
                    <span className="shrink-0 text-zinc-200">{seg}</span>
                  ) : (
                    <button type="button" onClick={() => fetchDir(segPath)} className="shrink-0 text-sky-400 hover:text-sky-300">
                      {seg}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Directory list */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-zinc-500">加载中…</div>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => fetchDir(item.path)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.04]"
                  style={{ minHeight: 44 }}
                >
                  <Folder className="size-4 shrink-0 text-amber-400/70" />
                  <span className="flex-1 truncate text-xs text-zinc-200">{item.name}</span>
                  <ChevronRight className="size-3.5 shrink-0 text-zinc-600" />
                </button>
              ))}
              {items.length === 0 && (
                <div className="py-4 text-center text-[11px] text-zinc-600">无子文件夹</div>
              )}
            </div>
          )}
        </div>

        {/* Confirm */}
        <div className="border-t border-white/5 px-4 py-3">
          <button
            type="button"
            onClick={() => onSelect(browsePath)}
            className="w-full rounded-xl border border-sky-500/20 bg-sky-500/10 py-2.5 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20"
          >
            移动到此处{browsePath ? ` (${browsePath})` : " (根目录)"}
          </button>
        </div>
      </div>
    </div>
  );
}
