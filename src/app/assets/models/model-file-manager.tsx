"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  Info,
  Link as LinkIcon,
  Loader2,
  MessageSquare,
  Search,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { ModelKind } from "@/lib/model-constants";
import { modelSelectionDirectory } from "@/lib/model-asset-navigation";
import {
  assetPathSegments,
  formatAssetFileSize,
  type AssetBrowseItem,
  type AssetBrowseResult,
} from "../model-file-manager-shared";

type RootEntry = AssetBrowseItem & { pseudo?: "checkpoints" };

const KIND_LABEL: Record<ModelKind, string> = {
  lora: "LoRA",
  checkpoint: "checkpoints",
};

function buildModelUrl(endpoint: string, kind: ModelKind, params?: URLSearchParams) {
  const query = params ?? new URLSearchParams();
  query.set("kind", kind);
  return `/api/models/${endpoint}?${query.toString()}`;
}

function normalizeCivitaiLink(rawValue: string) {
  const value = rawValue.trim();
  if (!value) return "";

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  return parsed.toString();
}

function isFileItem(item: AssetBrowseItem): item is AssetBrowseItem & { type: "file" } {
  return item.type === "file";
}

function parentDirectory(filePath: string) {
  const index = filePath.lastIndexOf("/");
  return index === -1 ? "根目录" : filePath.slice(0, index);
}

function matchesModelSearch(item: AssetBrowseItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    item.name,
    item.path,
    item.notes,
    item.triggerWords,
    item.civitaiLink,
  ].some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function ModelInfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-600">{label}</div>
      <div className="min-w-0 text-xs leading-5 text-zinc-300">{children}</div>
    </div>
  );
}

function ModelInfoDetails({
  item,
  kind,
  onEdit,
  onMove,
  compact = false,
}: {
  item: AssetBrowseItem & { type: "file" };
  kind: ModelKind;
  onEdit: () => void;
  onMove: () => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <ModelInfoRow label="文件名">
        <span className="break-all text-zinc-100">{item.name}</span>
      </ModelInfoRow>
      <ModelInfoRow label="路径">
        <span className="break-all font-mono text-[11px] text-zinc-400">{item.path}</span>
      </ModelInfoRow>
      <div className="grid grid-cols-2 gap-3">
        <ModelInfoRow label="类型">{KIND_LABEL[kind]}</ModelInfoRow>
        <ModelInfoRow label="大小">{item.size != null ? formatAssetFileSize(item.size) : "未知"}</ModelInfoRow>
      </div>
      <ModelInfoRow label="所在目录">
        <span className="break-all text-zinc-400">{parentDirectory(item.path)}</span>
      </ModelInfoRow>
      {kind === "lora" && (
        <ModelInfoRow label="触发词">
          {item.triggerWords ? (
            <span className="break-words text-amber-300/80">{item.triggerWords}</span>
          ) : (
            <span className="text-zinc-600">未填写</span>
          )}
        </ModelInfoRow>
      )}
      <ModelInfoRow label="Civitai">
        {item.civitaiLink ? (
          <a
            href={item.civitaiLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1 text-sky-300 transition hover:text-sky-200"
          >
            <ExternalLink className="size-3 shrink-0" />
            <span className="truncate">{item.civitaiLink}</span>
          </a>
        ) : (
          <span className="text-zinc-600">未填写</span>
        )}
      </ModelInfoRow>
      <ModelInfoRow label="备注">
        {item.notes ? <span className="break-words text-zinc-300">{item.notes}</span> : <span className="text-zinc-600">未填写</span>}
      </ModelInfoRow>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300 transition hover:border-sky-500/30 hover:bg-sky-500/10 hover:text-sky-200"
        >
          <MessageSquare className="size-3.5" />
          编辑信息
        </button>
        <button
          type="button"
          onClick={onMove}
          className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] p-2 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
          title="移动文件"
        >
          <ArrowRightLeft className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function ModelInfoPanel({
  item,
  kind,
  onEdit,
  onMove,
}: {
  item: (AssetBrowseItem & { type: "file" }) | null;
  kind: ModelKind;
  onEdit: (item: AssetBrowseItem & { type: "file" }) => void;
  onMove: (item: AssetBrowseItem & { type: "file" }) => void;
}) {
  return (
    <aside className="hidden min-h-[26rem] flex-col rounded-xl border border-white/10 bg-white/[0.02] lg:flex">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <Info className="size-4 text-sky-300/80" />
        <h2 className="text-sm font-medium text-zinc-100">模型信息</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {item ? (
          <ModelInfoDetails item={item} kind={kind} onEdit={() => onEdit(item)} onMove={() => onMove(item)} />
        ) : (
          <div className="flex h-full min-h-64 flex-col items-center justify-center text-center text-xs text-zinc-600">
            <FileText className="mb-2 size-8 text-zinc-700" />
            选择一个模型文件查看详情
          </div>
        )}
      </div>
    </aside>
  );
}

function MoveTargetPicker({
  kind,
  sourcePath,
  onConfirm,
  onCancel,
}: {
  kind: ModelKind;
  sourcePath: string;
  onConfirm: (targetDir: string) => void;
  onCancel: () => void;
}) {
  const [browsePath, setBrowsePath] = useState("");
  const [items, setItems] = useState<AssetBrowseItem[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const fetchDir = useCallback(async (dirPath: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dirPath) params.set("path", dirPath);
      const res = await fetch(buildModelUrl("browse", kind, params));
      if (!res.ok) throw new Error();
      const data: AssetBrowseResult = (await res.json()).data;
      setItems(data.items.filter((item) => item.type === "directory"));
      setParentPath(data.parentPath);
      setBrowsePath(data.currentPath);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [kind]);

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

  const segments = assetPathSegments(browsePath);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={(event) => {
        if (event.target === backdropRef.current) onCancel();
      }}
    >
      <div className="flex w-full max-w-lg flex-col rounded-t-2xl border border-white/10 bg-zinc-900 shadow-2xl" style={{ maxHeight: "65vh" }}>
        <div className="border-b border-white/5 px-4 py-3">
          <div className="mb-1 text-xs text-zinc-500">
            移动 <span className="text-zinc-300">{sourcePath.split("/").pop()}</span> 到：
          </div>
          <div className="flex items-center gap-2">
            {parentPath !== null && (
              <button type="button" onClick={() => fetchDir(parentPath)} className="shrink-0 rounded-lg p-1 text-zinc-400 hover:bg-white/[0.06]">
                <ChevronLeft className="size-4" />
              </button>
            )}
            <div className="flex flex-1 items-center gap-1 overflow-x-auto text-xs scrollbar-none">
              <button type="button" onClick={() => fetchDir("")} className="shrink-0 text-sky-400 hover:text-sky-300">
                {KIND_LABEL[kind]}
              </button>
              {segments.map((seg, index) => {
                const segPath = segments.slice(0, index + 1).join("/");
                return (
                  <span key={segPath} className="flex items-center gap-1">
                    <ChevronRight className="size-3 text-zinc-600" />
                    <button
                      type="button"
                      onClick={() => fetchDir(segPath)}
                      className={`shrink-0 ${index === segments.length - 1 ? "text-zinc-200" : "text-sky-400 hover:text-sky-300"}`}
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

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-zinc-500">加载中...</div>
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

export function ModelFileManager({
  initialKind = "lora",
  initialPath: selectedModelPath = "",
}: {
  initialKind?: ModelKind;
  initialPath?: string;
}) {
  const [kind, setKind] = useState<ModelKind>(initialKind);
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState<AssetBrowseItem[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchItems, setSearchItems] = useState<AssetBrowseItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchRefreshKey, setSearchRefreshKey] = useState(0);

  const [uploading, startUploadTransition] = useTransition();
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [movingFile, setMovingFile] = useState<string | null>(null);
  const [moveMsg, setMoveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [expandedFilePath, setExpandedFilePath] = useState<string | null>(null);

  const [editingNotesPath, setEditingNotesPath] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState("");
  const [editingTriggerText, setEditingTriggerText] = useState("");
  const [editingCivitaiLink, setEditingCivitaiLink] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const notesInputRef = useRef<HTMLTextAreaElement>(null);

  const fetchDir = useCallback(async (nextKind: ModelKind, dirPath: string, preferredSelectedPath?: string) => {
    setLoading(true);
    setError(null);
    setEditingNotesPath(null);
    setExpandedFilePath(null);
    try {
      const params = new URLSearchParams();
      if (dirPath) params.set("path", dirPath);
      const res = await fetch(buildModelUrl("browse", nextKind, params));
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.ok) {
        throw new Error(result?.error?.message ?? `HTTP ${res.status}`);
      }
      const data: AssetBrowseResult = result.data;
      const preferredFile = preferredSelectedPath
        ? data.items.find((item): item is AssetBrowseItem & { type: "file" } => item.type === "file" && item.path === preferredSelectedPath)
        : null;
      setKind(nextKind);
      setItems(data.items);
      setParentPath(data.parentPath);
      setCurrentPath(data.currentPath);
      setSelectedFilePath(preferredFile?.path ?? data.items.find(isFileItem)?.path ?? null);
      setExpandedFilePath(preferredFile?.path ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
      setItems([]);
      setSelectedFilePath(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  useEffect(() => {
    const initialPath = modelSelectionDirectory(selectedModelPath);
    fetchDir(initialKind, initialPath, selectedModelPath);
  }, [fetchDir, initialKind, selectedModelPath]);

  useEffect(() => {
    if (!normalizedSearchQuery) {
      setSearchItems([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      setEditingNotesPath(null);
      setExpandedFilePath(null);

      try {
        const params = new URLSearchParams();
        params.set("recursive", "1");
        const res = await fetch(buildModelUrl("browse", kind, params), {
          signal: controller.signal,
        });
        const result = await res.json().catch(() => null);
        if (!res.ok || !result?.ok) {
          throw new Error(result?.error?.message ?? `HTTP ${res.status}`);
        }

        const data: AssetBrowseResult = result.data;
        const matchedItems = data.items
          .filter(isFileItem)
          .filter((item) => matchesModelSearch(item, normalizedSearchQuery));
        if (controller.signal.aborted) return;

        setSearchItems(matchedItems);
        setSelectedFilePath(matchedItems[0]?.path ?? null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setSearchItems([]);
        setSelectedFilePath(null);
        setSearchError(err instanceof Error ? err.message : "搜索失败");
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [kind, normalizedSearchQuery, searchRefreshKey]);

  function openCheckpointsRoot() {
    setUploadMsg(null);
    setMoveMsg(null);
    fetchDir("checkpoint", "");
  }

  function openLoraRoot() {
    setUploadMsg(null);
    setMoveMsg(null);
    fetchDir("lora", "");
  }

  function handleOpenDirectory(item: AssetBrowseItem | RootEntry) {
    if ("pseudo" in item && item.pseudo === "checkpoints") {
      openCheckpointsRoot();
      return;
    }
    fetchDir(kind, item.path);
  }

  function handleSelectFile(item: AssetBrowseItem & { type: "file" }) {
    setSelectedFilePath(item.path);
    setExpandedFilePath((current) => (current === item.path ? null : item.path));
  }

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadMsg(null);
    startUploadTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("kind", kind);
        formData.set("targetDir", currentPath);
        formData.set("file", file);

        const res = await fetch(buildModelUrl("", kind), {
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
          await fetchDir(kind, currentPath);
          setSearchRefreshKey((value) => value + 1);
        }
      } catch {
        setUploadMsg({ type: "error", text: "上传失败" });
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  async function handleMoveConfirm(targetDir: string) {
    if (!movingFile) return;

    const sourceDir = movingFile.substring(0, movingFile.lastIndexOf("/")) || "";
    if (sourceDir === targetDir) {
      setMovingFile(null);
      return;
    }

    setMoveMsg(null);
    try {
      const res = await fetch(buildModelUrl("move", kind), {
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
        await fetchDir(kind, currentPath);
        setSearchRefreshKey((value) => value + 1);
      }
    } catch {
      setMoveMsg({ type: "error", text: "移动失败" });
    }
    setMovingFile(null);
  }

  function handleEditNotes(item: AssetBrowseItem) {
    if (editingNotesPath === item.path) {
      setEditingNotesPath(null);
      return;
    }
    if (item.type === "file") {
      setSelectedFilePath(item.path);
      setExpandedFilePath(item.path);
    }
    setEditingNotesPath(item.path);
    setEditingNotesText(item.notes ?? "");
    setEditingTriggerText(kind === "lora" ? (item.triggerWords ?? "") : "");
    setEditingCivitaiLink(item.type === "file" ? (item.civitaiLink ?? "") : "");
    setTimeout(() => notesInputRef.current?.focus(), 50);
  }

  async function handleSaveNotes() {
    if (!editingNotesPath) return;
    const civitaiLink = normalizeCivitaiLink(editingCivitaiLink);
    if (civitaiLink === null) {
      toast.error("请输入完整链接，例如 https://civitai.com/models/...");
      return;
    }

    setSavingNotes(true);
    try {
      const res = await fetch(buildModelUrl("notes", kind), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: editingNotesPath,
          notes: editingNotesText,
          triggerWords: kind === "lora" ? editingTriggerText : undefined,
          civitaiLink,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        const updateMetadata = (prev: AssetBrowseItem[]) =>
          prev.map((item) =>
            item.path === editingNotesPath
              ? {
                  ...item,
                  notes: editingNotesText || undefined,
                  triggerWords: kind === "lora" ? (editingTriggerText || undefined) : undefined,
                  civitaiLink: civitaiLink || undefined,
                }
              : item,
          );

        setItems(updateMetadata);
        setSearchItems((prev) =>
          updateMetadata(prev).filter((item) => matchesModelSearch(item, normalizedSearchQuery)),
        );
        setEditingNotesPath(null);
        toast.success("备注已保存");
      } else {
        toast.error(data?.error?.message ?? "保存失败");
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setSavingNotes(false);
    }
  }

  const segments = assetPathSegments(currentPath);
  const isSearchActive = normalizedSearchQuery.length > 0;
  const displayItems = isSearchActive ? searchItems : items;
  const displayLoading = isSearchActive ? searchLoading : loading;
  const displayError = isSearchActive ? searchError : error;
  const fileCount = displayItems.filter((item) => item.type === "file").length;
  const dirCount = displayItems.filter((item) => item.type === "directory").length;
  const showRootCheckpoint = kind === "lora" && currentPath === "" && !isSearchActive;
  const selectedFile = selectedFilePath
    ? displayItems.find((item): item is AssetBrowseItem & { type: "file" } => item.type === "file" && item.path === selectedFilePath) ?? null
    : null;
  const rootCheckpointEntry: RootEntry = {
    name: "checkpoints",
    type: "directory",
    path: "",
    pseudo: "checkpoints",
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="min-w-0 space-y-3">
      <div className="flex items-center gap-2">
        {(parentPath !== null || kind === "checkpoint") && (
          <button
            type="button"
            onClick={() => {
              if (kind === "checkpoint" && parentPath === null) {
                openLoraRoot();
              } else if (parentPath !== null) {
                fetchDir(kind, parentPath);
              }
            }}
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        <div className="flex flex-1 items-center gap-1 overflow-x-auto text-xs scrollbar-none">
          <button type="button" onClick={openLoraRoot} className="shrink-0 text-sky-400 transition hover:text-sky-300">
            模型
          </button>
          {kind === "checkpoint" && (
            <span className="flex items-center gap-1">
              <ChevronRight className="size-3 text-zinc-600" />
              <button type="button" onClick={openCheckpointsRoot} className="shrink-0 text-sky-400 transition hover:text-sky-300">
                checkpoints
              </button>
            </span>
          )}
          {kind === "lora" && (
            <span className="flex items-center gap-1">
              <ChevronRight className="size-3 text-zinc-600" />
              <button type="button" onClick={openLoraRoot} className="shrink-0 text-sky-400 transition hover:text-sky-300">
                LoRA
              </button>
            </span>
          )}
          {segments.map((seg, index) => {
            const segPath = segments.slice(0, index + 1).join("/");
            const isLast = index === segments.length - 1;
            return (
              <span key={segPath} className="flex items-center gap-1">
                <ChevronRight className="size-3 text-zinc-600" />
                {isLast ? (
                  <span className="shrink-0 text-zinc-200">{seg}</span>
                ) : (
                  <button type="button" onClick={() => fetchDir(kind, segPath)} className="shrink-0 text-sky-400 transition hover:text-sky-300">
                    {seg}
                  </button>
                )}
              </span>
            );
          })}
        </div>
        {!displayLoading && (
          <span className="shrink-0 text-[10px] text-zinc-600">
            {isSearchActive ? (
              `${fileCount} 匹配`
            ) : (
              <>
                {dirCount > 0 && `${dirCount} 文件夹`}
                {dirCount > 0 && fileCount > 0 && " · "}
                {fileCount > 0 && `${fileCount} 文件`}
              </>
            )}
          </span>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="搜索模型文件"
          className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-10 text-xs text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-sky-500/30 focus:bg-white/[0.05]"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 rounded-lg p-1 text-zinc-500 transition -translate-y-1/2 hover:bg-white/[0.06] hover:text-zinc-200"
            aria-label="清空搜索"
            title="清空搜索"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {displayLoading ? (
        <div className="flex items-center justify-center py-12 text-xs text-zinc-500">
          <Loader2 className="mr-2 size-4 animate-spin" /> {isSearchActive ? "搜索中..." : "加载中..."}
        </div>
      ) : displayError ? (
        <div className="rounded-xl bg-rose-500/10 px-3 py-3 text-xs text-rose-300">{displayError}</div>
      ) : displayItems.length === 0 && !showRootCheckpoint ? (
        <div className="flex flex-col items-center justify-center py-12 text-xs text-zinc-600">
          <Folder className="mb-2 size-8 text-zinc-700" />
          {isSearchActive ? "没有匹配的模型文件" : "空目录"}
        </div>
      ) : (
        <div className="space-y-0.5">
          {showRootCheckpoint && (
            <>
              <div>
                <button
                  type="button"
                  onClick={() => handleOpenDirectory(rootCheckpointEntry)}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.03]"
                  style={{ minHeight: 44 }}
                >
                  <HardDrive className="size-4 shrink-0 text-emerald-400/80" />
                  <span className="flex-1 truncate text-xs font-medium text-zinc-100">checkpoints</span>
                  <ChevronRight className="size-3.5 shrink-0 text-zinc-600" />
                </button>
              </div>
              <div className="my-2 border-t border-white/10" />
            </>
          )}

          {displayItems.map((item) => {
            const fileItem = isFileItem(item) ? item : null;
            const isSelected = fileItem !== null && selectedFilePath === fileItem.path;
            const isExpanded = fileItem !== null && expandedFilePath === fileItem.path;

            return (
            <div key={`${kind}:${item.path}`}>
              {fileItem === null ? (
                <div className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.03]" style={{ minHeight: 44 }}>
                  <button type="button" onClick={() => handleOpenDirectory(item)} className="flex flex-1 items-center gap-3 text-left">
                    <Folder className="size-4 shrink-0 text-amber-400/70" />
                    <span className="flex-1 truncate text-xs text-zinc-200">{item.name}</span>
                    <ChevronRight className="size-3.5 shrink-0 text-zinc-600" />
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className={`group flex items-center gap-2 rounded-xl px-2.5 py-2 transition hover:bg-white/[0.03] ${
                      isSelected ? "bg-sky-500/10 ring-1 ring-sky-500/20" : ""
                    }`}
                    style={{ minHeight: 44 }}
                  >
                    <button
                      type="button"
                      aria-expanded={expandedFilePath === fileItem.path}
                      onClick={() => handleSelectFile(fileItem)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <FileText className="size-4 shrink-0 text-zinc-500" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs text-zinc-300">{fileItem.name}</span>
                        {editingNotesPath !== fileItem.path && (
                          <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[10px] text-zinc-500">
                            {fileItem.notes && <span className="truncate">{fileItem.notes}</span>}
                            {kind === "lora" && fileItem.triggerWords && (
                              <span className="inline-flex min-w-0 items-center gap-0.5 text-amber-400/50">
                                <Zap className="size-2.5 shrink-0" />
                                <span className="truncate">{fileItem.triggerWords}</span>
                              </span>
                            )}
                            {fileItem.civitaiLink && (
                              <span className="inline-flex min-w-0 items-center gap-0.5 text-sky-400/60">
                                <LinkIcon className="size-2.5 shrink-0" />
                                <span className="truncate">Civitai</span>
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      {fileItem.size != null && <span className="hidden shrink-0 text-[10px] text-zinc-600 sm:inline">{formatAssetFileSize(fileItem.size)}</span>}
                      <ChevronDown className={`size-3.5 shrink-0 text-zinc-600 transition md:hidden ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditNotes(fileItem)}
                      className={`hidden shrink-0 rounded-lg p-1.5 transition md:inline-flex ${
                        editingNotesPath === fileItem.path
                          ? "bg-sky-500/10 text-sky-400"
                          : fileItem.notes || fileItem.civitaiLink
                            ? "text-sky-500/50 hover:bg-white/[0.06] hover:text-sky-400"
                            : "text-zinc-600 opacity-0 hover:bg-white/[0.06] hover:text-zinc-300 group-hover:opacity-100"
                      }`}
                      title="备注"
                    >
                      <MessageSquare className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovingFile(fileItem.path)}
                      className="hidden shrink-0 rounded-lg p-1.5 text-zinc-600 opacity-0 transition hover:bg-white/[0.06] hover:text-zinc-300 group-hover:opacity-100 md:inline-flex"
                      title="移动文件"
                    >
                      <ArrowRightLeft className="size-3.5" />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="mx-2 mb-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 md:hidden">
                      <ModelInfoDetails
                        compact
                        item={fileItem}
                        kind={kind}
                        onEdit={() => handleEditNotes(fileItem)}
                        onMove={() => setMovingFile(fileItem.path)}
                      />
                    </div>
                  )}
                </>
              )}

              {editingNotesPath === item.path && (
                <div className="mb-1 ml-10 mr-3 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-1.5">
                      <textarea
                        ref={notesInputRef}
                        value={editingNotesText}
                        onChange={(event) => setEditingNotesText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setEditingNotesPath(null);
                        }}
                        placeholder="别名/备注..."
                        rows={1}
                        className="cm-text-editor cm-text-editor--compact w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
                      />
                      {kind === "lora" && (
                        <div className="flex items-center gap-1.5">
                          <Zap className="size-3 shrink-0 text-amber-400/50" />
                          <input
                            type="text"
                            value={editingTriggerText}
                            onChange={(event) => setEditingTriggerText(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleSaveNotes();
                              }
                              if (event.key === "Escape") setEditingNotesPath(null);
                            }}
                            placeholder="触发词..."
                            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-500/30"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <LinkIcon className="size-3 shrink-0 text-sky-400/50" />
                        <input
                          type="url"
                          value={editingCivitaiLink}
                          onChange={(event) => setEditingCivitaiLink(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleSaveNotes();
                            }
                            if (event.key === "Escape") setEditingNotesPath(null);
                          }}
                          placeholder="https://civitai.com/models/..."
                          className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
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
                      {savingNotes ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={kind === "checkpoint" ? ".safetensors" : ".safetensors,.ckpt,.pt,.pth"}
        onChange={handleFileSelected}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.01] py-3 text-xs text-zinc-500 transition hover:border-sky-500/30 hover:bg-white/[0.03] hover:text-zinc-300 disabled:opacity-50"
      >
        {uploading ? (
          <>
            <Loader2 className="size-3.5 animate-spin" /> 上传中...
          </>
        ) : (
          <>
            <Upload className="size-3.5" /> 上传文件到此目录
          </>
        )}
      </button>

      {uploadMsg && (
        <div className={`rounded-xl px-3 py-2 text-xs ${uploadMsg.type === "success" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
          {uploadMsg.text}
        </div>
      )}
      {moveMsg && (
        <div className={`rounded-xl px-3 py-2 text-xs ${moveMsg.type === "success" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
          {moveMsg.text}
        </div>
      )}
      </div>

      <ModelInfoPanel kind={kind} item={selectedFile} onEdit={handleEditNotes} onMove={(item) => setMovingFile(item.path)} />

      {movingFile && (
        <MoveTargetPicker
          kind={kind}
          sourcePath={movingFile}
          onConfirm={handleMoveConfirm}
          onCancel={() => setMovingFile(null)}
        />
      )}
    </div>
  );
}
