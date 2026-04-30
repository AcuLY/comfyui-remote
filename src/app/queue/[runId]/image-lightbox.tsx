"use client";

import Image from "next/image";
import { useEffect, useCallback, useState, useRef } from "react";

export function ImageLightbox({
  src,
  alt,
  onClose,
  visible,
}: {
  src: string | null;
  alt?: string;
  onClose?: () => void;
  visible: boolean;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    },
    [onClose],
  );

  const shieldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, handleKeyDown]);

  const handleClose = useCallback(() => {
    onClose?.();
    // Deploy a click shield to absorb stray taps after close
    clearTimeout(shieldTimerRef.current!);
    document.body.style.pointerEvents = "none";
    shieldTimerRef.current = setTimeout(() => {
      document.body.style.pointerEvents = "";
    }, 300);
  }, [onClose]);

  useEffect(() => {
    return () => clearTimeout(shieldTimerRef.current!);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-200 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={handleClose}
    >
      {/* Backdrop: fully opaque */}
      <div className="absolute inset-0 bg-black" />
      {/* Semi-transparent zone (black bars from aspect ratio) */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
        {src ? (
          <div className="relative h-[100dvh] w-[100dvw] p-3 sm:p-4">
            <Image
              src={src}
              alt={alt ?? "Preview"}
              fill
              sizes="100vw"
              className="object-contain p-2 drop-shadow-2xl sm:p-4"
              draggable={false}
              unoptimized
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Lightbox state hook.
 * - open(src): programmatically open
 * - close(): programmatically close
 * - visible: whether lightbox is currently shown (for transition)
 */
export function useLightbox() {
  const [src, setSrc] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const open = useCallback((imageSrc: string) => {
    setSrc(imageSrc);
    // Delay visible for enter transition
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    // Wait for exit transition before clearing src
    setTimeout(() => setSrc(null), 200);
  }, []);

  return { src, visible, open, close };
}
