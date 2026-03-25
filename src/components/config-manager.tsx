"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
};

export type ConfigItem = Record<string, unknown> & { id: string };

type Props = {
  items: ConfigItem[];
  fields: FieldDef[];
  entityName: string;
  onCreateAction: (data: Record<string, unknown>) => Promise<void>;
  onUpdateAction: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDeleteAction: (id: string) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConfigManager({
  items,
  fields,
  entityName,
  onCreateAction,
  onUpdateAction,
  onDeleteAction,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function startEdit(item: ConfigItem) {
    setEditingId(item.id);
    setIsCreating(false);
    const data: Record<string, unknown> = {};
    for (const field of fields) {
      data[field.key] = item[field.key] ?? "";
    }
    setFormData(data);
  }

  function startCreate() {
    setEditingId(null);
    setIsCreating(true);
    const data: Record<string, unknown> = {};
    for (const field of fields) {
      data[field.key] = field.type === "boolean" ? true : field.type === "number" ? 1 : "";
    }
    setFormData(data);
  }

  function cancel() {
    setEditingId(null);
    setIsCreating(false);
    setFormData({});
  }

  function handleFieldChange(key: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      if (isCreating) {
        await onCreateAction(formData);
      } else if (editingId) {
        await onUpdateAction(editingId, formData);
      }
      cancel();
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm(`确认停用此${entityName}？（软删除，不会影响已有数据）`)) return;
    startTransition(async () => {
      await onDeleteAction(id);
      router.refresh();
    });
  }

  function renderField(field: FieldDef) {
    const value = formData[field.key];

    if (field.type === "boolean") {
      return (
        <label key={field.key} className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => handleFieldChange(field.key, e.target.checked)}
            className="size-4 rounded border-white/20 bg-white/10"
          />
          {field.label}
        </label>
      );
    }

    if (field.type === "textarea") {
      return (
        <div key={field.key}>
          <label className="mb-1 block text-xs text-zinc-500">{field.label}</label>
          <textarea
            value={String(value ?? "")}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </div>
      );
    }

    if (field.type === "number") {
      return (
        <div key={field.key}>
          <label className="mb-1 block text-xs text-zinc-500">{field.label}</label>
          <input
            type="number"
            value={Number(value ?? 0)}
            onChange={(e) => handleFieldChange(field.key, parseInt(e.target.value) || 0)}
            className="input-number w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <div key={field.key}>
          <label className="mb-1 block text-xs text-zinc-500">{field.label}</label>
          <select
            value={String(value ?? "")}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-sky-500/30"
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // text
    return (
      <div key={field.key}>
        <label className="mb-1 block text-xs text-zinc-500">{field.label}</label>
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => handleFieldChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-sky-500/30"
        />
      </div>
    );
  }

  // Inline edit / create form
  const renderForm = () => (
    <div className="space-y-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] p-4">
      <div className="text-sm font-medium text-sky-300">
        {isCreating ? `新增${entityName}` : `编辑${entityName}`}
      </div>
      {fields.map(renderField)}
      <div className="flex gap-2">
        <button
          disabled={isPending}
          onClick={handleSave}
          className="inline-flex items-center gap-1 rounded-xl bg-sky-500/20 px-4 py-2 text-sm text-sky-300 transition hover:bg-sky-500/30 disabled:opacity-50"
        >
          <Save className="size-3.5" /> {isPending ? "保存中…" : "保存"}
        </button>
        <button
          onClick={cancel}
          className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06]"
        >
          <X className="size-3.5" /> 取消
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header + create button */}
      <div className="flex items-center justify-end">
        <button
          onClick={startCreate}
          className="inline-flex items-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-sm text-sky-300 transition hover:bg-sky-500/20"
        >
          <Plus className="size-4" /> 新增{entityName}
        </button>
      </div>

      {/* Create form */}
      {isCreating && renderForm()}

      {/* Items list */}
      {items.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-zinc-500">
          暂无{entityName}记录
        </div>
      )}

      {items.map((item) => (
        <div key={item.id}>
          {editingId === item.id ? (
            renderForm()
          ) : (
            <div
              onClick={() => startEdit(item)}
              className="flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-sm font-medium text-zinc-200">
                  {String(item.name ?? item.id)}
                </div>
                {typeof item.slug === "string" && item.slug && (
                  <div className="text-xs text-zinc-500">slug: {item.slug}</div>
                )}
                {typeof item.prompt === "string" && item.prompt && (
                  <div className="line-clamp-2 text-xs text-zinc-400">
                    {item.prompt}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  disabled={isPending}
                  onClick={() => handleDelete(item.id)}
                  className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
