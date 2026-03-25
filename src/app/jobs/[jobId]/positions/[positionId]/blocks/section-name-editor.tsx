"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { renameSection } from "@/lib/actions";

export function SectionNameEditor({
  sectionId,
  initialName,
}: {
  sectionId: string;
  initialName: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  function handleSave() {
    if (name.trim() === initialName) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      await renameSection(sectionId, name.trim());
      setIsEditing(false);
    });
  }

  function handleCancel() {
    setName(initialName);
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  }

  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isPending}
          className="w-40 rounded-lg border border-sky-500/30 bg-black/30 px-2 py-1 text-base font-semibold text-white outline-none"
        />
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded p-1 text-emerald-400 transition hover:bg-emerald-500/20"
        >
          <Check className="size-4" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="rounded p-1 text-zinc-400 transition hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="group inline-flex items-center gap-1.5 text-base font-semibold text-white transition hover:text-sky-300"
    >
      {initialName}
      <Pencil className="size-3.5 opacity-0 transition group-hover:opacity-100" />
    </button>
  );
}
