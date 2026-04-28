"use client";

import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import type { PresetGroupItem } from "@/lib/server-data";

// ---------------------------------------------------------------------------
// GroupInlineEditor
// ---------------------------------------------------------------------------

export function GroupInlineEditor({
  group,
  onSave,
  onDelete,
  isPending,
}: {
  group: PresetGroupItem;
  onSave: (data: { name: string; slug: string }) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(group.name);
  const [slug, setSlug] = useState(group.slug);
  const dirty = name !== group.name || slug !== group.slug;

  return (
    <div className="flex items-end gap-2">
      <label className="flex-1 space-y-1">
        <span className="text-[10px] text-zinc-500">组名</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </label>
      <label className="flex-1 space-y-1">
        <span className="text-[10px] text-zinc-500">Slug</span>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </label>
      {dirty && (
        <button
          type="button"
          disabled={isPending || !name.trim() || !slug.trim()}
          onClick={() => onSave({ name: name.trim(), slug: slug.trim() })}
          className="rounded-lg bg-sky-500/20 p-1.5 text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
        >
          <Save className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
