"use client";

import { useEffect, useState } from "react";
import { ClipboardCopy, ClipboardPaste } from "lucide-react";

import s from "./text-area-field.module.css";
import { Button } from "../button";
import { useDemoFeedback } from "../../feedback/context";
import { preventReadonlyEdit } from "../shared/utils";

export function TextAreaField({ label, value }: { label: string; value: string }) {
  const [fieldValue, setFieldValue] = useState(value);
  const { pushToast } = useDemoFeedback();

  useEffect(() => {
    setFieldValue(value);
  }, [value]);

  function handleCopy() {
    void copyToClipboard(fieldValue)
      .then(() => {
        pushToast({
          tone: "success",
          title: "内容已复制",
          detail: fieldValue ? label : "内容为空",
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
    void readClipboard()
      .then((clipboardValue) => {
        setFieldValue(clipboardValue);
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
          aria-readonly="true"
          className={s.control}
          onBeforeInput={preventReadonlyEdit}
          onChange={() => undefined}
          onDrop={preventReadonlyEdit}
          onPaste={preventReadonlyEdit}
          readOnly
          value={fieldValue}
        />
        <div className={s.clipboardDock} role="group" aria-label={`${label} 剪贴板操作`}>
          <Button icon={ClipboardCopy} iconOnly ariaLabel={`复制${label}`} onClick={handleCopy} size="sm" tone="subtle" />
          <Button icon={ClipboardPaste} iconOnly ariaLabel={`用剪贴板覆盖${label}`} onClick={handlePasteReplace} size="sm" tone="subtle" />
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
