"use client";

import { useEffect, useCallback, useState } from "react";

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

  useEffect(() => {
    if (!src) return;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [src, handleKeyDown]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* Backdrop: fully opaque */}
      <div className="absolute inset-0 bg-black" onClick={onClose} />
      {/* Semi-transparent zone (black bars from aspect ratio) */}
      <div
        className="absolute inset-0 flex items-center justify-center bg-black/60"
        onClick={onClose}
      >
        {/* Image container: keeps lightbox open while mouse is here */}
        <div
          className={`relative max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl transition-all duration-200 ${
            visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
          onClick={(e) => e.stopPropagation()}
          onMouseLeave={onClose}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src ?? ""}
            alt={alt ?? "Preview"}
            className="max-h-[90vh] max-w-[90vw] rounded-lg"
            draggable={false}
          />
        </div>
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
