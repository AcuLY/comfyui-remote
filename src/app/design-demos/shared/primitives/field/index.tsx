"use client";

import { useId, useState } from "react";
import { ClipboardCopy, ClipboardPaste } from "lucide-react";

import { cx } from "../../../routing";
import s from "./field.module.css";
import { Button } from "../button";
import { useDemoFeedback } from "../../feedback/context";
import { preventReadonlyEdit } from "../shared/utils";

type FieldProps = {
  label: string;
  value?: string | number;
  defaultValue?: string | number;
  disabled?: boolean;
  features?: {
    resize?: boolean;
    clipboard?: boolean;
  };
  multiline?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
};

export function Field({
  label,
  value,
  defaultValue,
  disabled = false,
  features,
  multiline = false,
  placeholder,
  readOnly = false,
  onChange,
}: FieldProps) {
  const controlId = useId();
  const resolvedValue = stringifyFieldValue(value ?? defaultValue ?? "");
  const [fieldValue, setFieldValue] = useState(() => ({
    sourceValue: resolvedValue,
    draftValue: resolvedValue,
  }));
  const { pushToast } = useDemoFeedback();
  const hasClipboardTools = Boolean(features?.clipboard);
  const resizeEnabled = Boolean(features?.resize);
  const isReadOnly = readOnly;
  const isControlled = value !== undefined && onChange !== undefined;

  if (fieldValue.sourceValue !== resolvedValue) {
    setFieldValue({ sourceValue: resolvedValue, draftValue: resolvedValue });
  }

  const displayValue = isControlled
    ? resolvedValue
    : fieldValue.sourceValue === resolvedValue
      ? fieldValue.draftValue
      : resolvedValue;

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

  const control = multiline ? (
    <textarea
      aria-readonly={isReadOnly ? "true" : undefined}
      className={cx(s.control, s.multilineControl, resizeEnabled ? s.resizable : s.noResize)}
      disabled={disabled}
      id={controlId}
      onBeforeInput={isReadOnly ? preventReadonlyEdit : undefined}
      onChange={(event) => updateValue(event.currentTarget.value)}
      onDrop={isReadOnly ? preventReadonlyEdit : undefined}
      onPaste={isReadOnly ? preventReadonlyEdit : undefined}
      placeholder={placeholder}
      readOnly={isReadOnly}
      value={displayValue}
    />
  ) : (
    <input
      aria-readonly={isReadOnly ? "true" : undefined}
      className={s.control}
      disabled={disabled}
      id={controlId}
      onBeforeInput={isReadOnly ? preventReadonlyEdit : undefined}
      onChange={(event) => updateValue(event.currentTarget.value)}
      onDrop={isReadOnly ? preventReadonlyEdit : undefined}
      onPaste={isReadOnly ? preventReadonlyEdit : undefined}
      placeholder={placeholder}
      readOnly={isReadOnly}
      value={displayValue}
    />
  );

  return (
    <div className={s.root} data-demo-ui-field="true">
      <label htmlFor={controlId}>{label}</label>
      {hasClipboardTools ? (
        <div className={s.controlFrame}>
          {control}
          <div className={s.clipboardDock} role="group" aria-label={`${label} 剪贴板操作`}>
            <Button icon={ClipboardCopy} iconOnly ariaLabel={`复制${label}`} onClick={handleCopy} size="sm" tone="subtle" />
            <Button disabled={isReadOnly || disabled} icon={ClipboardPaste} iconOnly ariaLabel={`用剪贴板覆盖${label}`} onClick={handlePasteReplace} size="sm" tone="subtle" />
          </div>
        </div>
      ) : control}
    </div>
  );
}

function stringifyFieldValue(value: string | number) {
  return String(value);
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
