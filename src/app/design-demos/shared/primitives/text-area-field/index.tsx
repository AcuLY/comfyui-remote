"use client";

import { useState } from "react";
import { ClipboardCopy, ClipboardPaste } from "lucide-react";

import s from "./text-area-field.module.css";
import { Button } from "../button";
import { useDemoFeedback } from "../../feedback/context";
import { preventReadonlyEdit } from "../shared/utils";

type TextAreaFieldProps = {
  label: string;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  onChange?: (value: string) => void;
};

export function TextAreaField({ label, value, defaultValue, disabled = false, readOnly = false, onChange }: TextAreaFieldProps) {
  const resolvedValue = value ?? defaultValue ?? "";
  const [fieldValueState, setFieldValue] = useState(() => ({
    sourceValue: resolvedValue,
    draftValue: resolvedValue,
  }));
  const { pushToast } = useDemoFeedback();
  const isReadOnly = readOnly;
  const isControlled = value !== undefined && onChange !== undefined;

  if (fieldValueState.sourceValue !== resolvedValue) {
    setFieldValue({ sourceValue: resolvedValue, draftValue: resolvedValue });
  }

  const fieldValue = fieldValueState.sourceValue === resolvedValue ? fieldValueState.draftValue : resolvedValue;
  const displayValue = isControlled ? resolvedValue : fieldValue;

  function updateValue(nextValue: string) {
    if (isReadOnly || disabled) return;
    onChange?.(nextValue);
    if (isControlled) return;

    setFieldValue({ sourceValue: resolvedValue, draftValue: nextValue });
  }

  function handleCopy() {
    void copyToClipboard(displayValue)
      .then(() => {
        pushToast({
          tone: "success",
          title: "内容已复制",
          detail: displayValue ? label : "内容为空",
        });
      })
      .catch(() => {
        pushToast({
          tone: "error",
          title: "复制失败",
          detail: "浏览器没有开放剪贴板写入权限",
        });
      });
  }

  function handlePasteReplace() {
    if (isReadOnly || disabled) return;

    void readClipboard()
      .then((clipboardValue) => {
        updateValue(clipboardValue);
        pushToast({
          tone: "success",
          title: "已用剪贴板覆盖",
          detail: clipboardValue ? label : "剪贴板为空",
        });
      })
      .catch(() => {
        pushToast({
          tone: "error",
          title: "读取剪贴板失败",
          detail: "浏览器没有开放剪贴板读取权限",
        });
      });
  }

  return (
    <div className={s.root} data-demo-ui-field="true">
      <label>{label}</label>
      <div className={s.controlFrame}>
        <textarea
          aria-readonly={isReadOnly ? "true" : undefined}
          className={s.control}
          disabled={disabled}
          onBeforeInput={isReadOnly ? preventReadonlyEdit : undefined}
          onChange={(event) => updateValue(event.currentTarget.value)}
          onDrop={isReadOnly ? preventReadonlyEdit : undefined}
          onPaste={isReadOnly ? preventReadonlyEdit : undefined}
          readOnly={isReadOnly}
          value={displayValue}
        />
        <div className={s.clipboardDock} role="group" aria-label={`${label} 剪贴板操作`}>
          <Button icon={ClipboardCopy} iconOnly ariaLabel={`复制${label}`} onClick={handleCopy} size="sm" tone="subtle" />
          <Button disabled={isReadOnly || disabled} icon={ClipboardPaste} iconOnly ariaLabel={`用剪贴板覆盖${label}`} onClick={handlePasteReplace} size="sm" tone="subtle" />
        </div>
      </div>
    </div>
  );
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto -9999px";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Clipboard copy failed");
  }
}

async function readClipboard() {
  if (!navigator.clipboard?.readText) {
    throw new Error("Clipboard read is not available");
  }

  return navigator.clipboard.readText();
}
