"use client";

import { useState, useMemo } from "react";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Trash2,
  GripVertical,
  Pencil,
  Folder,
  FolderInput,
  ChevronRight,
  X,
} from "lucide-react";
import type { FolderItem } from "@/lib/server-data";

// ---------------------------------------------------------------------------
// FolderBreadcrumb
// ---------------------------------------------------------------------------

export function FolderBreadcrumb({
  breadcrumb,
  onNavigate,
}: {
  breadcrumb: FolderItem[];
  onNavigate: (folderId: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-[11px] text-zinc-500 flex-wrap">
      <button
        type="button"
        onClick={() => onNavigate(null)}
        disabled={breadcrumb.length === 0}
        className={breadcrumb.length === 0 ? "text-zinc-400" : "text-sky-400 hover:underline"}
      >
        根目录
      </button>
      {breadcrumb.map((f) => (
        <span key={f.id} className="flex items-center gap-1">
          <ChevronRight className="size-3 text-zinc-600" />
          <button
            type="button"
            onClick={() => onNavigate(f.id)}
            className={f.id === breadcrumb[breadcrumb.length - 1]?.id ? "text-zinc-400" : "text-sky-400 hover:underline"}
            disabled={f.id === breadcrumb[breadcrumb.length - 1]?.id}
          >
            {f.name}
          </button>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FolderRow
// ---------------------------------------------------------------------------

function FolderRow({
  folder,
  itemCount,
  onEnter,
  onRename,
  onDelete,
  isPending,
}: {
  folder: FolderItem;
  itemCount: number;
  onEnter: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(folder.name);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-white/15">
      <button type="button" onClick={onEnter} className="flex flex-1 items-center gap-2 min-w-0 text-left">
        <Folder className="size-4 shrink-0 text-amber-400/70" />
        {isRenaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { onRename(name.trim()); setIsRenaming(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onRename(name.trim()); setIsRenaming(false); }
              if (e.key === "Escape") { setName(folder.name); setIsRenaming(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent text-xs text-zinc-200 outline-none border-b border-sky-500/40"
          />
        ) : (
          <span className="text-xs text-zinc-200">{folder.name}</span>
        )}
        <span className="text-[10px] text-zinc-500 shrink-0">{itemCount} 项</span>
      </button>
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}
          className="rounded p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
          title="重命名"
        >
          <Pencil className="size-3" />
        </button>
        {itemCount === 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            disabled={isPending}
            className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
            title="删除空文件夹"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableFolderRow
// ---------------------------------------------------------------------------

export function SortableFolderRow(props: {
  folder: FolderItem;
  itemCount: number;
  onEnter: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.folder.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <button
        type="button"
        className="cursor-grab touch-none p-1 text-zinc-600 hover:text-zinc-400 shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3" />
      </button>
      <div className="flex-1 min-w-0 overflow-hidden">
        <FolderRow {...props} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// buildFolderOptions
// ---------------------------------------------------------------------------

/** Flatten folders into indented options for a move-to-folder dropdown */
export function buildFolderOptions(folders: FolderItem[], parentId: string | null = null, depth = 0): Array<{ id: string | null; label: string }> {
  const opts: Array<{ id: string | null; label: string }> = [];
  if (depth === 0) opts.push({ id: null, label: "根目录" });
  const children = folders.filter((f) => (f.parentId ?? null) === parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  for (const child of children) {
    opts.push({ id: child.id, label: "\u00A0\u00A0".repeat(depth + 1) + child.name });
    opts.push(...buildFolderOptions(folders, child.id, depth + 1));
  }
  return opts;
}

// ---------------------------------------------------------------------------
// MoveToFolderButton
// ---------------------------------------------------------------------------

export function MoveToFolderButton({
  currentFolderId,
  folders,
  onMove,
}: {
  currentFolderId: string | null;
  folders: FolderItem[];
  onMove: (folderId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => buildFolderOptions(folders), [folders]);

  if (folders.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="rounded p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
        title="移动到文件夹"
      >
        <FolderInput className="size-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-48 w-44 overflow-auto rounded-lg border border-white/10 bg-zinc-900 py-1 shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.id ?? "__root"}
              type="button"
              disabled={opt.id === currentFolderId}
              onClick={(e) => { e.stopPropagation(); onMove(opt.id); setOpen(false); }}
              className={`block w-full px-3 py-1 text-left text-[11px] hover:bg-white/[0.06] ${opt.id === currentFolderId ? "text-zinc-600" : "text-zinc-300"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// countFolderItems
// ---------------------------------------------------------------------------

/** Count items inside a folder (direct children: presets/groups + subfolders) */
export function countFolderItems(
  folderId: string,
  folders: FolderItem[],
  presets: { folderId: string | null }[],
  groups?: { folderId: string | null }[],
): number {
  const subFolders = folders.filter((f) => f.parentId === folderId).length;
  const p = presets.filter((x) => x.folderId === folderId).length;
  const g = groups ? groups.filter((x) => x.folderId === folderId).length : 0;
  return subFolders + p + g;
}

// ---------------------------------------------------------------------------
// BatchActionBar
// ---------------------------------------------------------------------------

export function BatchActionBar({
  selectedCount,
  totalCount,
  folders,
  onMoveToFolder,
  onSelectAll,
  onClearSelection,
}: {
  selectedCount: number;
  totalCount: number;
  folders: FolderItem[];
  onMoveToFolder: (folderId: string | null) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => buildFolderOptions(folders), [folders]);

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 py-1.5">
      <span className="text-[11px] text-sky-300 font-medium">已选 {selectedCount} 项</span>
      {folders.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300 hover:bg-sky-500/30"
          >
            <FolderInput className="size-3" /> 移至文件夹
          </button>
          {open && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-44 overflow-auto rounded-lg border border-white/10 bg-zinc-900 py-1 shadow-xl">
              {options.map((opt) => (
                <button
                  key={opt.id ?? "__root"}
                  type="button"
                  onClick={() => { onMoveToFolder(opt.id); setOpen(false); }}
                  className="block w-full px-3 py-1 text-left text-[11px] text-zinc-300 hover:bg-white/[0.06]"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={selectedCount === totalCount ? onClearSelection : onSelectAll}
        className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-white/[0.1] hover:text-zinc-300"
      >
        {selectedCount === totalCount ? "取消选择" : "全选"}
      </button>
      <button
        type="button"
        onClick={onClearSelection}
        className="rounded p-0.5 text-zinc-500 hover:text-zinc-300"
        title="取消选择"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
