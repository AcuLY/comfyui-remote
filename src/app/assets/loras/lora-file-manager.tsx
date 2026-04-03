"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import {
  Folder,
  FileText,
  ChevronRight,
  Upload,
  Loader2,
  ArrowRightLeft,
  ChevronLeft,
  X,
  FolderOpen,
  MessageSquare,
  Check,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BrowseItem = {
  name: string;
  type: "directory" | "file";
  path: string;
  size?: number;
  notes?: string;
  triggerWords?: string;
};

type BrowseResult = {
  currentPath: string;
  parentPath: string | null;
  items: BrowseItem[];
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
// Move Target Picker (bottom sheet to choose target directory)
// ---------------------------------------------------------------------------

function MoveTargetPicker({
  sourcePath,
  onConfirm,
  onCancel,
}: {
  sourcePath: string;
  onConfirm: (targetDir: string) => void;
  onCancel: () => void;
}) {
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
      if (!res.ok) throw new Error();
      const data: BrowseResult = (await res.json()).data;
      setItems(data.items.filter((i) => i.type === "directory"));
      setParentPath(data.parentPath);
      setBrowsePath(data.currentPath);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDir("");
  }, [fetchDir]);

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === backdropRef.current) onCancel();
      }}
    >
      <div
        className="flex w-full max-w-lg flex-col rounded-t-2xl border border-white/10 bg-zinc-900 shadow-2xl"
        style={{ maxHeight: "65vh" }}
      >
        {/* Header */}
        <div className="border-b border-white/5 px-4 py-3">
          <div className="mb-1 text-xs text-zinc-500">
            移动 <span className="text-zinc-300">{sourcePath.split("/").pop()}</span> 到：
          </div>
          <div className="flex items-center gap-2">
            {parentPath !== null && (
              <button
                type="button"
                onClick={() => fetchDir(parentPath)}
                className="shrink-0 rounded-lg p-1 text-zinc-400 hover:bg-white/[0.06]"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
            <div className="flex flex-1 items-center gap-1 overflow-x-auto text-xs scrollbar-none">
              <button
                type="button"
                onClick={() => fetchDir("")}
                className="shrink-0 text-sky-400 hover:text-sky-300"
              >
                LoRA
              </button>
              {segments.map((seg, i) => {
                const segPath = segments.slice(0, i + 1).join("/");
                return (
                  <span key={segPath} className="flex items-center gap-1">
                    <ChevronRight className="size-3 text-zinc-600" />
                    <button
                      type="button"
                      onClick={() => fetchDir(segPath)}
                      className={`shrink-0 ${i === segments.length - 1 ? "text-zinc-200" : "text-sky-400 hover:text-sky-300"}`}
                    >
                      {seg}
                    </button>
                  </span>
                );
              })}
            </div>
            <button type="button" onClick={onCancel} className="shrink-0 rounded-lg p-1 text-zinc-500 hover:text-zinc-200">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Directory list */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-zinc-500">加载中…</div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-xs text-zinc-600">无子文件夹</div>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => fetchDir(item.path)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-zinc-300 transition hover:bg-white/[0.04]"
                  style={{ minHeight: 44 }}
                >
                  <Folder className="size-4 shrink-0 text-amber-400/70" />
                  <span className="flex-1 truncate text-xs">{item.name}</span>
                  <ChevronRight className="size-3.5 shrink-0 text-zinc-600" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Confirm button */}
        <div className="border-t border-white/5 px-4 py-3">
          <button
            type="button"
            onClick={() => onConfirm(browsePath)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2.5 text-xs text-sky-300 transition hover:bg-sky-500/20"
          >
            <FolderOpen className="size-3.5" />
            移动到此处{browsePath ? `（${browsePath}）` : "（根目录）"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main File Manager
// ---------------------------------------------------------------------------

export function LoraFileManager() {
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploading, startUploadTransition] = useTransition();
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Move state
  const [movingFile, setMovingFile] = useState<string | null>(null);
  const [moveMsg, setMoveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Notes editing state
  const [editingNotesPath, setEditingNotesPath] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState("");
  const [editingTriggerText, setEditingTriggerText] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const notesInputRef = useRef<HTMLTextAreaElement>(null);

  const fetchDir = useCallback(async (dirPath: string) => {
    setLoading(true);
    setError(null);
    setEditingNotesPath(null);
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
      setCurrentPath(data.currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDir("");
  }, [fetchDir]);

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadMsg(null);
    startUploadTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("targetDir", currentPath);
        formData.set("file", file);

        const res = await fetch("/api/loras", {
          method: "POST",
          body: formData,
        });
        const result = await res.json().catch(() => null);

        if (!res.ok || !result?.ok) {
          setUploadMsg({
            type: "error",
            text: result?.error?.message ?? `上传失败 (${res.status})`,
          });
        } else {
          setUploadMsg({ type: "success", text: `${file.name} 上传成功` });
          await fetchDir(currentPath);
        }
      } catch {
        setUploadMsg({ type: "error", text: "上传失败" });
      }
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  async function handleMoveConfirm(targetDir: string) {
    if (!movingFile) return;

    // Don't move to same directory
    const sourceDir = movingFile.substring(0, movingFile.lastIndexOf("/")) || "";
    if (sourceDir === targetDir) {
      setMovingFile(null);
      return;
    }

    setMoveMsg(null);
    try {
      const res = await fetch("/api/loras/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePath: movingFile, targetDir }),
      });
      const result = await res.json().catch(() => null);

      if (!res.ok || !result?.ok) {
        setMoveMsg({
          type: "error",
          text: result?.error?.message ?? "移动失败",
        });
      } else {
        setMoveMsg({
          type: "success",
          text: `已移动到 ${targetDir || "根目录"}`,
        });
        await fetchDir(currentPath);
      }
    } catch {
      setMoveMsg({ type: "error", text: "移动失败" });
    }
    setMovingFile(null);
  }

  function handleEditNotes(item: BrowseItem) {
    if (editingNotesPath === item.path) {
      // Toggle off
      setEditingNotesPath(null);
      return;
    }
    setEditingNotesPath(item.path);
    setEditingNotesText(item.notes ?? "");
    setEditingTriggerText(item.triggerWords ?? "");
    // Focus the textarea after render
    setTimeout(() => notesInputRef.current?.focus(), 50);
  }

  async function handleSaveNotes() {
    if (!editingNotesPath) return;
    setSavingNotes(true);
    try {
      const res = await fetch("/api/loras/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: editingNotesPath, notes: editingNotesText, triggerWords: editingTriggerText }),
      });
      if (res.ok) {
        // Update local state
        setItems((prev) =>
          prev.map((item) =>
            item.path === editingNotesPath
              ? { ...item, notes: editingNotesText || undefined, triggerWords: editingTriggerText || undefined }
              : item
          )
        );
        setEditingNotesPath(null);
      }
    } finally {
      setSavingNotes(false);
    }
  }

  const segments = pathSegments(currentPath);
  const fileCount = items.filter((i) => i.type === "file").length;
  const dirCount = items.filter((i) => i.type === "directory").length;

  return (
    <div className="space-y-3">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={() => fetchDir("")}
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
                    onClick={() => fetchDir(segPath)}
                    className="shrink-0 text-sky-400 transition hover:text-sky-300"
                  >
                    {seg}
                  </button>
                )}
              </span>
            );
          })}
        </div>
        {!loading && (
          <span className="shrink-0 text-[10px] text-zinc-600">
            {dirCount > 0 && `${dirCount} 文件夹`}
            {dirCount > 0 && fileCount > 0 && " · "}
            {fileCount > 0 && `${fileCount} 文件`}
          </span>
        )}
      </div>

      {/* File listing */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-xs text-zinc-500">
          <Loader2 className="mr-2 size-4 animate-spin" /> 加载中…
        </div>
      ) : error ? (
        <div className="rounded-xl bg-rose-500/10 px-3 py-3 text-xs text-rose-300">{error}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-xs text-zinc-600">
          <Folder className="mb-2 size-8 text-zinc-700" />
          空目录
        </div>
      ) : (
        <div className="space-y-0.5">
          {items.map((item) => (
            <div key={item.path}>
              <div
                className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.03]"
                style={{ minHeight: 44 }}
              >
                {item.type === "directory" ? (
                  <button
                    type="button"
                    onClick={() => fetchDir(item.path)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <Folder className="size-4 shrink-0 text-amber-400/70" />
                    <span className="flex-1 truncate text-xs text-zinc-200">{item.name}</span>
                    <ChevronRight className="size-3.5 shrink-0 text-zinc-600" />
                  </button>
                ) : (
                  <>
                    <FileText className="size-4 shrink-0 text-zinc-500" />
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-xs text-zinc-300">{item.name}</span>
                      {item.notes && editingNotesPath !== item.path && (
                        <span className="block truncate text-[10px] text-zinc-500 mt-0.5">
                          {item.notes}
                        </span>
                      )}
                      {item.triggerWords && editingNotesPath !== item.path && (
                        <span className="block truncate text-[10px] text-amber-400/50 mt-0.5">
                          <Zap className="inline size-2.5 mr-0.5" />{item.triggerWords}
                        </span>
                      )}
                    </div>
                    {item.size != null && (
                      <span className="shrink-0 text-[10px] text-zinc-600">
                        {formatSize(item.size)}
                      </span>
                    )}
                    {/* Notes button */}
                    <button
                      type="button"
                      onClick={() => handleEditNotes(item)}
                      className={`shrink-0 rounded-lg p-1.5 transition ${
                        editingNotesPath === item.path
                          ? "bg-sky-500/10 text-sky-400"
                          : item.notes
                            ? "text-sky-500/50 hover:bg-white/[0.06] hover:text-sky-400"
                            : "text-zinc-600 opacity-0 hover:bg-white/[0.06] hover:text-zinc-300 group-hover:opacity-100"
                      }`}
                      title="备注"
                    >
                      <MessageSquare className="size-3.5" />
                    </button>
                    {/* Move button */}
                    <button
                      type="button"
                      onClick={() => setMovingFile(item.path)}
                      className="shrink-0 rounded-lg p-1.5 text-zinc-600 opacity-0 transition hover:bg-white/[0.06] hover:text-zinc-300 group-hover:opacity-100"
                      title="移动文件"
                    >
                      <ArrowRightLeft className="size-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Notes & trigger words editor (inline, below the file row) */}
              {editingNotesPath === item.path && (
                <div className="ml-10 mr-3 mb-1 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-1.5">
                      <textarea
                        ref={notesInputRef}
                        value={editingNotesText}
                        onChange={(e) => setEditingNotesText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingNotesPath(null);
                        }}
                        placeholder="别名/备注…"
                        rows={1}
                        className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
                      />
                      <div className="flex items-center gap-1.5">
                        <Zap className="size-3 shrink-0 text-amber-400/50" />
                        <input
                          type="text"
                          value={editingTriggerText}
                          onChange={(e) => setEditingTriggerText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveNotes();
                            }
                            if (e.key === "Escape") setEditingNotesPath(null);
                          }}
                          placeholder="触发词…"
                          className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-500/30"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="shrink-0 rounded-lg bg-sky-500/10 p-1.5 text-sky-400 transition hover:bg-sky-500/20 disabled:opacity-50"
                      title="保存"
                    >
                      {savingNotes ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload section */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".safetensors,.ckpt,.pt,.pth"
        onChange={handleFileSelected}
        className="hidden"
      />
      <button
        type="button"
        onClick={handleUploadClick}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.01] py-3 text-xs text-zinc-500 transition hover:border-sky-500/30 hover:bg-white/[0.03] hover:text-zinc-300 disabled:opacity-50"
      >
        {uploading ? (
          <><Loader2 className="size-3.5 animate-spin" /> 上传中…</>
        ) : (
          <><Upload className="size-3.5" /> 上传文件到此目录</>
        )}
      </button>

      {/* Messages */}
      {uploadMsg && (
        <div
          className={`rounded-xl px-3 py-2 text-xs ${
            uploadMsg.type === "success"
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-rose-500/10 text-rose-300"
          }`}
        >
          {uploadMsg.text}
        </div>
      )}
      {moveMsg && (
        <div
          className={`rounded-xl px-3 py-2 text-xs ${
            moveMsg.type === "success"
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-rose-500/10 text-rose-300"
          }`}
        >
          {moveMsg.text}
        </div>
      )}

      {/* Move target picker */}
      {movingFile && (
        <MoveTargetPicker
          sourcePath={movingFile}
          onConfirm={handleMoveConfirm}
          onCancel={() => setMovingFile(null)}
        />
      )}
    </div>
  );
}
