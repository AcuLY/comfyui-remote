"use client";

import { useEffect } from "react";
import {
  isSfwModeEnabledValue,
  SFW_MODE_ATTRIBUTE,
  SFW_MODE_EVENT,
  SFW_MODE_STORAGE_KEY,
} from "@/lib/sfw-mode";

function safelyDecodeUrl(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isSfwImageTarget(target: EventTarget | null): HTMLImageElement | null {
  if (!(target instanceof Element)) return null;
  const image = target.closest("img");
  if (!(image instanceof HTMLImageElement)) return null;
  const imageSrc = `${image.currentSrc} ${image.src}`;
  const decodedSrc = safelyDecodeUrl(imageSrc);
  if (!decodedSrc.includes("/api/images/")) return null;
  return image;
}

function isCoarsePointer(event: PointerEvent): boolean {
  return event.pointerType === "touch" || event.pointerType === "pen" || window.matchMedia("(hover: none)").matches;
}

function setSfwModeAttribute(enabled: boolean) {
  document.documentElement.setAttribute(SFW_MODE_ATTRIBUTE, enabled ? "on" : "off");
}

export function SfwModeProvider() {
  useEffect(() => {
    let revealedImage: HTMLImageElement | null = null;

    const clearReveal = () => {
      if (!revealedImage) return;
      revealedImage.removeAttribute("data-sfw-revealed");
      revealedImage = null;
    };

    const syncMode = () => {
      const enabled = isSfwModeEnabledValue(window.localStorage.getItem(SFW_MODE_STORAGE_KEY));
      setSfwModeAttribute(enabled);
      if (!enabled) clearReveal();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (document.documentElement.getAttribute(SFW_MODE_ATTRIBUTE) !== "on") return;

      const image = isSfwImageTarget(event.target);
      if (!image) {
        clearReveal();
        return;
      }

      if (!isCoarsePointer(event)) return;

      if (image.dataset.sfwRevealed === "true") {
        revealedImage = image;
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      clearReveal();
      image.dataset.sfwRevealed = "true";
      image.tabIndex = -1;
      image.focus({ preventScroll: true });
      revealedImage = image;
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!revealedImage) return;
      if (event.target === revealedImage) return;
      clearReveal();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === SFW_MODE_STORAGE_KEY) syncMode();
    };

    syncMode();
    window.addEventListener(SFW_MODE_EVENT, syncMode);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("blur", clearReveal);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn, true);

    return () => {
      window.removeEventListener(SFW_MODE_EVENT, syncMode);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("blur", clearReveal);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, []);

  return null;
}
