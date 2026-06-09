"use client";

import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Check, Copy } from "lucide-react";

const COPY_BUTTON_SELECTOR = "[data-notification-copy-button]";

function getToastCopyText(toast: HTMLElement) {
  const clone = toast.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-close-button], [data-notification-copy-button]").forEach((node) => node.remove());
  return clone.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
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

function renderButtonIcon(button: HTMLButtonElement, roots: Map<HTMLButtonElement, Root>, copied: boolean) {
  let root = roots.get(button);
  if (!root) {
    root = createRoot(button);
    roots.set(button, root);
  }

  const Icon = copied ? Check : Copy;
  root.render(<Icon aria-hidden="true" className="size-3" />);
}

function createCopyButton(toast: HTMLElement, roots: Map<HTMLButtonElement, Root>) {
  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.setAttribute("data-notification-copy-button", "true");
  copyButton.setAttribute("aria-label", "复制通知信息");
  copyButton.title = "复制通知信息";
  copyButton.style.position = "absolute";
  copyButton.style.top = "50%";
  copyButton.style.right = "2.25rem";
  copyButton.style.transform = "translateY(-50%)";
  copyButton.style.zIndex = "1";
  copyButton.style.display = "inline-flex";
  copyButton.style.alignItems = "center";
  copyButton.style.justifyContent = "center";
  copyButton.style.width = "1.5rem";
  copyButton.style.height = "1.5rem";
  copyButton.style.padding = "0";
  copyButton.style.borderRadius = "9999px";
  copyButton.style.border = "1px solid rgba(255,255,255,0.1)";
  copyButton.style.background = "rgba(255,255,255,0.05)";
  copyButton.style.color = "#d4d4d8";
  copyButton.style.cursor = "pointer";

  copyButton.addEventListener("mouseenter", () => {
    copyButton.style.borderColor = "rgba(255,255,255,0.2)";
    copyButton.style.background = "rgba(255,255,255,0.1)";
    copyButton.style.color = "#ffffff";
  });
  copyButton.addEventListener("mouseleave", () => {
    copyButton.style.borderColor = "rgba(255,255,255,0.1)";
    copyButton.style.background = "rgba(255,255,255,0.05)";
    copyButton.style.color = "#d4d4d8";
  });
  copyButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const text = getToastCopyText(toast);
    if (!text) return;

    try {
      await writeClipboardText(text);
      copyButton.title = "已复制";
      copyButton.setAttribute("aria-label", "已复制通知信息");
      renderButtonIcon(copyButton, roots, true);
      window.setTimeout(() => {
        copyButton.title = "复制通知信息";
        copyButton.setAttribute("aria-label", "复制通知信息");
        renderButtonIcon(copyButton, roots, false);
      }, 1200);
    } catch {
      copyButton.title = "复制失败";
      copyButton.setAttribute("aria-label", "复制通知信息失败");
    }
  });

  renderButtonIcon(copyButton, roots, false);
  return copyButton;
}

function cleanupDisconnectedCopyButtons(roots: Map<HTMLButtonElement, Root>) {
  roots.forEach((root, button) => {
    if (button.isConnected) return;

    root.unmount();
    roots.delete(button);
  });
}

function syncNotificationCopyButtons(roots: Map<HTMLButtonElement, Root>) {
  cleanupDisconnectedCopyButtons(roots);

  document.querySelectorAll<HTMLElement>("[data-sonner-toast]").forEach((toastNode) => {
    const closeButton = toastNode.querySelector<HTMLElement>("[data-close-button]");
    if (!closeButton || toastNode.querySelector(COPY_BUTTON_SELECTOR)) return;

    const copyButton = createCopyButton(toastNode, roots);
    closeButton.parentElement?.insertBefore(copyButton, closeButton);
  });
}

export function NotificationCopyButtons() {
  useEffect(() => {
    const roots = new Map<HTMLButtonElement, Root>();
    syncNotificationCopyButtons(roots);

    const observer = new MutationObserver(() => syncNotificationCopyButtons(roots));
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      roots.forEach((root) => root.unmount());
      roots.clear();
    };
  }, []);

  return null;
}
