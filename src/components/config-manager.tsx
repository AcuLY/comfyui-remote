"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, X } from "lucide-react";
import { LoraBindingEditor } from "@/components/lora-binding-editor";
import type { LoraBinding } from "@/lib/lora-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select" | "lora-bindings";
  placeholder?: string;
  options?: { value: string; label: string }[];
  loraOptions?: { value: string; label: string }[];
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

  // Remember original values for rollback on failed save
  const originalDataRef = useRef<Record<string, unknown>>({});
  // Keep a ref to latest formData so closures always see fresh values
  const formDataRef = useRef<Record<string, unknown>>(formData);
  useEffect(() => { formDataRef.current = formData; }, [formData]);
  // Track per-field save status: key → "saving" | "saved" | "error"
  const [fieldSaveStatus, setFieldSaveStatus] = useState<Record<string, string>>({});

  function startEdit(item: ConfigItem) {
    setEditingId(item.id);
    setIsCreating(false);
    const data: Record<string, unknown> = {};
    for (const field of fields) {
      data[field.key] = item[field.key] ?? "";
    }
    setFormData(data);
    originalDataRef.current = { ...data };
    setFieldSaveStatus({});
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

  /** Auto-save a single field immediately (for select, lora-bindings, checkbox). */
  const saveFieldNow = useCallback(
    (key: string, newValue: unknown) => {
      if (!editingId) return;
      setFieldSaveStatus((prev) => ({ ...prev, [key]: "saving" }));
      startTransition(async () => {
        try {
          const payload = { ...formDataRef.current, [key]: newValue };
          await onUpdateAction(editingId, payload);
          originalDataRef.current = { ...payload };
          setFieldSaveStatus((prev) => ({ ...prev, [key]: "saved" }));
          setTimeout(() => {
            setFieldSaveStatus((prev) => {
              const next = { ...prev };
              if (next[key] === "saved") delete next[key];
              return next;
            });
          }, 1500);
          router.refresh();
        } catch {
          setFormData((prev) => ({ ...prev, [key]: originalDataRef.current[key] }));
          setFieldSaveStatus((prev) => ({ ...prev, [key]: "error" }));
          setTimeout(() => {
            setFieldSaveStatus((prev) => {
              const next = { ...prev };
              if (next[key] === "error") delete next[key];
              return next;
            });
          }, 2000);
        }
      });
    },
    [editingId, onUpdateAction, router],
  );

  /** Auto-save on blur (edit mode only) */
  const handleFieldBlur = useCallback(
    (key: string) => {
      if (!editingId || isPending) return;
      const currentVal = formDataRef.current[key];
      const originalVal = originalDataRef.current[key];
      // No change → skip
      if (currentVal === originalVal) return;

      setFieldSaveStatus((prev) => ({ ...prev, [key]: "saving" }));
      startTransition(async () => {
        try {
          const payload = { ...formDataRef.current };
          await onUpdateAction(editingId, payload);
          originalDataRef.current = { ...payload };
          setFieldSaveStatus((prev) => ({ ...prev, [key]: "saved" }));
          setTimeout(() => {
            setFieldSaveStatus((prev) => {
              const next = { ...prev };
              if (next[key] === "saved") delete next[key];
              return next;
            });
          }, 1500);
          router.refresh();
        } catch {
          // Rollback to original value on error
          setFormData((prev) => ({ ...prev, [key]: originalVal }));
          setFieldSaveStatus((prev) => ({ ...prev, [key]: "error" }));
          setTimeout(() => {
            setFieldSaveStatus((prev) => {
              const next = { ...prev };
              if (next[key] === "error") delete next[key];
              return next;
            });
          }, 2000);
        }
      });
    },
    [editingId, isPending, onUpdateAction, router],
  );

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
          <button
            type="button"
            role="switch"
            aria-checked={!!value}
            onClick={() => {
              const newValue = !value;
              handleFieldChange(field.key, newValue);
              if (!isCreating) {
                saveFieldNow(field.key, newValue);
              }
            }}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors ${
              value
                ? "border-sky-500/30 bg-sky-500"
                : "border-white/10 bg-white/10"
            }`}
          >
            <span
              className={`pointer-events-none block size-4 rounded-full bg-white shadow transition-transform ${
                value ? "translate-x-4.5" : "translate-x-0.5"
              }`}
            />
          </button>
          {field.label}
        </label>
      );
    }

    if (field.type === "textarea") {
      const status = fieldSaveStatus[field.key];
      return (
        <div key={field.key}>
          <label className="mb-1 block text-xs text-zinc-500">{field.label}</label>
          <textarea
            value={String(value ?? "")}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            onBlur={() => !isCreating && handleFieldBlur(field.key)}
            placeholder={field.placeholder}
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-sky-500/30"
          />
          {!isCreating && status === "saving" && <span className="mt-0.5 block text-[11px] text-sky-400">保存中…</span>}
          {!isCreating && status === "saved" && <span className="mt-0.5 block text-[11px] text-emerald-400">已保存 ✓</span>}
          {!isCreating && status === "error" && <span className="mt-0.5 block text-[11px] text-rose-400">保存失败，已回退</span>}
        </div>
      );
    }

    if (field.type === "number") {
      const status = fieldSaveStatus[field.key];
      return (
        <div key={field.key}>
          <label className="mb-1 block text-xs text-zinc-500">{field.label}</label>
          <input
            type="number"
            value={Number(value ?? 0)}
            onChange={(e) => handleFieldChange(field.key, parseInt(e.target.value) || 0)}
            onBlur={() => !isCreating && handleFieldBlur(field.key)}
            className="input-number w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-sky-500/30"
          />
          {!isCreating && status === "saving" && <span className="mt-0.5 block text-[11px] text-sky-400">保存中…</span>}
          {!isCreating && status === "saved" && <span className="mt-0.5 block text-[11px] text-emerald-400">已保存 ✓</span>}
          {!isCreating && status === "error" && <span className="mt-0.5 block text-[11px] text-rose-400">保存失败，已回退</span>}
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <div key={field.key}>
          <label className="mb-1 block text-xs text-zinc-500">{field.label}</label>
          <select
            value={String(value ?? "")}
            onChange={(e) => {
              handleFieldChange(field.key, e.target.value);
              // Auto-save immediately for select (no blur needed)
              if (!isCreating) {
                saveFieldNow(field.key, e.target.value);
              }
            }}
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

    if (field.type === "lora-bindings") {
      const bindings = Array.isArray(value) ? (value as LoraBinding[]) : [];
      const status = fieldSaveStatus[field.key];
      return (
        <div key={field.key}>
          <LoraBindingEditor
            bindings={bindings}
            onChange={(newBindings) => {
              handleFieldChange(field.key, newBindings);
              // Auto-save immediately for lora-bindings
              if (!isCreating) {
                saveFieldNow(field.key, newBindings);
              }
            }}
            loraOptions={field.loraOptions}
          />
          {!isCreating && status === "saving" && <span className="mt-0.5 block text-[11px] text-sky-400">保存中…</span>}
          {!isCreating && status === "saved" && <span className="mt-0.5 block text-[11px] text-emerald-400">已保存 ✓</span>}
          {!isCreating && status === "error" && <span className="mt-0.5 block text-[11px] text-rose-400">保存失败，已回退</span>}
        </div>
      );
    }

    // text
    const status = fieldSaveStatus[field.key];
    return (
      <div key={field.key}>
        <label className="mb-1 block text-xs text-zinc-500">{field.label}</label>
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => handleFieldChange(field.key, e.target.value)}
          onBlur={() => !isCreating && handleFieldBlur(field.key)}
          placeholder={field.placeholder}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-sky-500/30"
        />
        {!isCreating && status === "saving" && <span className="mt-0.5 block text-[11px] text-sky-400">保存中…</span>}
        {!isCreating && status === "saved" && <span className="mt-0.5 block text-[11px] text-emerald-400">已保存 ✓</span>}
        {!isCreating && status === "error" && <span className="mt-0.5 block text-[11px] text-rose-400">保存失败，已回退</span>}
      </div>
    );
  }

  // Inline edit / create form
  const renderForm = () => (
    <div className="space-y-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] p-4">
      <div
        className={`text-sm font-medium ${isCreating ? "text-sky-300" : "cursor-pointer text-sky-300"}`}
        onClick={isCreating ? undefined : cancel}
      >
        {isCreating ? `新增${entityName}` : `编辑${entityName}`}
        {!isCreating && <span className="ml-2 text-[11px] text-zinc-500">失焦自动保存 · 点击收起</span>}
      </div>
      {fields.map(renderField)}
      {isCreating && (
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
      )}
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
