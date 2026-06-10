"use client";

import { Toaster } from "sonner";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Copy } from "lucide-react";
import { PersistentBottomNav } from "@/components/persistent-bottom-nav";
import { SfwModeProvider } from "@/components/sfw-mode-provider";
import { TaskPanelProvider, TaskPanelContainer } from "@/components/task-panel";

let toastCopyId = 0;

function getToastText(toastElement: HTMLElement) {
  const title = toastElement.querySelector("[data-title]")?.textContent?.trim();
  const description = toastElement.querySelector("[data-description]")?.textContent?.trim();
  const text = [title, description].filter(Boolean).join("\n");

  return text || toastElement.textContent?.trim() || "";
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Clipboard copy failed");
  }
}

function assignToastCopyId(toastElement: HTMLElement) {
  if (!toastElement.dataset.toastCopyId) {
    toastCopyId += 1;
    toastElement.dataset.toastCopyId = String(toastCopyId);
  }

  return toastElement.dataset.toastCopyId;
}

function ToastCopyButton({ toastElement }: { toastElement: HTMLElement }) {
  const [copied, setCopied] = useState(false);

  return createPortal(
    <button
      type="button"
      data-toast-copy-button
      aria-label="复制通知内容"
      title={copied ? "已复制" : "复制通知内容"}
      className="absolute right-[2.45rem] top-1/2 z-[2] flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 p-0 text-zinc-300 transition hover:bg-white/10 hover:text-white"
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const text = getToastText(toastElement);
        if (!text) return;

        try {
          await copyTextToClipboard(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>,
    toastElement,
  );
}

function ToastCopyButtons() {
  const [toastElements, setToastElements] = useState<HTMLElement[]>([]);

  useEffect(() => {
    function collectToastElements() {
      const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-sonner-toast]"));
      elements.forEach(assignToastCopyId);
      setToastElements((current) => {
        const unchanged =
          current.length === elements.length &&
          current.every((element, index) => element === elements[index]);

        return unchanged ? current : elements;
      });
    }

    collectToastElements();
    const observer = new MutationObserver(collectToastElements);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      {toastElements.map((toastElement) => (
        <ToastCopyButton key={assignToastCopyId(toastElement)} toastElement={toastElement} />
      ))}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TaskPanelProvider>
      <SfwModeProvider />
      <main className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-3 overflow-x-hidden px-3 py-4 pb-24 sm:px-6">
        {children}
      </main>
      <PersistentBottomNav />
      <TaskPanelContainer />
      <ToastCopyButtons />
      <Toaster
        theme="dark"
        position="top-right"
        closeButton
        visibleToasts={3}
        toastOptions={{
          duration: 3000,
          style: { background: "rgba(24,24,27,0.95)", border: "1px solid rgba(255,255,255,0.1)", color: "#e4e4e7", paddingRight: "4.5rem" },
          closeButton: true,
          closeButtonAriaLabel: "关闭通知",
          classNames: {
            closeButton:
              "!top-1/2 !h-6 !w-6 !border-white/10 !bg-white/5 !text-zinc-300 [--toast-close-button-end:0.5rem] [--toast-close-button-start:auto] [--toast-close-button-transform:translateY(-50%)] hover:!border-white/20 hover:!bg-white/10 hover:!text-white",
          },
        }}
      />
    </TaskPanelProvider>
  );
}
