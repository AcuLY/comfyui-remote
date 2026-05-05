"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Pencil, Check, ExternalLink } from "lucide-react";

import s from "./design-demo.module.css";
import { cx } from "./design-demo-utils";
export type SaveStatus = "idle" | "saving" | "saved";

// ============================================================================
// Section Name Editor — click-to-edit, debounced save
// ============================================================================

type SectionNameEditorProps = {
  initialName: string;
  onChange?: (name: string) => void;
  onSavingChange?: (status: SaveStatus) => void;
};

export function SectionNameEditor({
  initialName,
  onChange,
  onSavingChange,
}: SectionNameEditorProps) {
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reset = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      if (reset.current) clearTimeout(reset.current);
    };
  }, []);

  const commit = useCallback(
    (next: string) => {
      const trimmed = next.trim() || name;
      setName(trimmed);
      setDraft(trimmed);
      setEditing(false);
      if (debounce.current) clearTimeout(debounce.current);
      if (reset.current) clearTimeout(reset.current);
      onSavingChange?.("saving");
      debounce.current = setTimeout(() => {
        onChange?.(trimmed);
        onSavingChange?.("saved");
        reset.current = setTimeout(() => onSavingChange?.("idle"), 1200);
      }, 600);
    },
    [name, onChange, onSavingChange],
  );

  if (!editing) {
    return (
      <button
        type="button"
        className={s.sectionNameDisplay}
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        aria-label="编辑小节名"
      >
        <strong>{name}</strong>
        <span className={s.sectionNamePencil} aria-hidden>
          <Pencil className="size-3.5" />
        </span>
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      className={s.sectionNameInput}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(draft);
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDraft(name);
          setEditing(false);
        }
      }}
    />
  );
}

// ============================================================================
// Save status pill
// ============================================================================

export function SaveStatusPill({ status }: { status: SaveStatus }) {
  return (
    <span className={s.savePill} data-status={status} aria-live="polite">
      {status === "saving" ? (
        <>
          <span className={s.savePillSpinner} aria-hidden />
          保存中…
        </>
      ) : status === "saved" ? (
        <>
          <Check className="size-3.5" />
          已保存
        </>
      ) : (
        <>
          <Check className="size-3.5" />
          已保存
        </>
      )}
    </span>
  );
}

// ============================================================================
// Header: back · eyebrow · name · siblings nav · download · run controls
// ============================================================================

type HeaderProps = {
  backHref: string;
  backLabel: string;
  prev: { name: string; href: string } | null;
  next: { name: string; href: string } | null;
  workflowDownloadHref: string;
  initialName: string;
  saveStatus: SaveStatus;
  onSavingChange: (status: SaveStatus) => void;
  onRename: (name: string) => void;
  batchSize: number;
  onBatchSizeChange: (n: number) => void;
  onRun: () => void;
};

export function SectionHeader(props: HeaderProps) {
  const {
    backHref,
    backLabel,
    prev,
    next,
    workflowDownloadHref,
    initialName,
    saveStatus,
    onSavingChange,
    onRename,
    batchSize,
    onBatchSizeChange,
    onRun,
  } = props;

  return (
    <header className={s.sectionHeader}>
      <div className={s.sectionHeaderTop}>
        <Link href={backHref} className={s.sectionHeaderBack}>
          <ChevronLeft className="size-4" />
          {backLabel}
        </Link>
        <span className={s.sectionHeaderEyebrow}>小节</span>
        <SectionNameEditor
          initialName={initialName}
          onChange={onRename}
          onSavingChange={onSavingChange}
        />
        <SaveStatusPill status={saveStatus} />

        <div className={s.sectionHeaderSpacer} />

        <nav className={s.sectionHeaderNav} aria-label="切换小节">
          {prev ? (
            <Link href={prev.href} className={s.sectionHeaderNavBtn} title={`上一节 · ${prev.name}`}>
              <ChevronLeft className="size-4" />
            </Link>
          ) : (
            <span className={cx(s.sectionHeaderNavBtn, s.sectionHeaderNavBtnDisabled)} aria-disabled>
              <ChevronLeft className="size-4" />
            </span>
          )}
          <span className={s.sectionHeaderNavLabel}>
            {prev ? prev.name : "—"}
            <em>·</em>
            {next ? next.name : "—"}
          </span>
          {next ? (
            <Link href={next.href} className={s.sectionHeaderNavBtn} title={`下一节 · ${next.name}`}>
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span className={cx(s.sectionHeaderNavBtn, s.sectionHeaderNavBtnDisabled)} aria-disabled>
              <ChevronRight className="size-4" />
            </span>
          )}
        </nav>

        <Link
          href={workflowDownloadHref}
          download
          className={s.sectionHeaderGhostBtn}
          title="下载 workflow"
        >
          <ExternalLink className="size-4" />
          <span>workflow</span>
        </Link>

        <div className={s.sectionRunDock}>
          <div className={s.sectionRunStepper} role="group" aria-label="批量数">
            <button
              type="button"
              className={s.sectionRunStep}
              onClick={() => onBatchSizeChange(Math.max(1, batchSize - 1))}
              aria-label="减少批量"
            >
              −
            </button>
            <span className={s.sectionRunCount}>
              <b>×{batchSize}</b>
              <em>批量</em>
            </span>
            <button
              type="button"
              className={s.sectionRunStep}
              onClick={() => onBatchSizeChange(Math.min(16, batchSize + 1))}
              aria-label="增加批量"
            >
              +
            </button>
          </div>
          <button type="button" className={s.sectionRunButton} onClick={onRun}>
            <RunIcon />
            运行
          </button>
        </div>
      </div>
    </header>
  );
}

function RunIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
      <path d="M4 3.2a1 1 0 0 1 1.5-.86l7.5 4.3a1 1 0 0 1 0 1.74l-7.5 4.3A1 1 0 0 1 4 11.8V3.2Z" />
    </svg>
  );
}

// ============================================================================
// Tabs
// ============================================================================
