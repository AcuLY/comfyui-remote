"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import Image from "next/image";

export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string | null;
  alt?: string;
  onClose?: () => void;
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

  if (!src) return null;

  return (
    // Backdrop: fully opaque black, clicking here closes
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      onClick={onClose}
    >
      {/* Inner container: semi-transparent, clicking here also closes.
          This is the "black bar" area caused by image aspect ratio. */}
      <div
        className="absolute inset-0 flex items-center justify-center bg-black/60"
        onClick={onClose}
      >
        {/* Image wrapper: click stops propagation so image area doesn't close */}
        <div
          className="relative max-h-[90vh] max-w-[90vw]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt ?? "Preview"}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * A hook that returns hover state for the lightbox trigger.
 * On desktop: hover opens, mouse leave closes.
 * On mobile (touch): tap opens, tap outside closes.
 */
export function useLightboxHover() {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openLightbox = useCallback((src: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setLightboxSrc(src);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxSrc(null);
  }, []);

  const handleMouseEnter = useCallback(
    (src: string) => {
      // Only use hover on devices with fine pointer (desktop)
      if (window.matchMedia("(hover: hover)").matches) {
        openLightbox(src);
      }
    },
    [openLightbox],
  );

  const handleMouseLeave = useCallback(() => {
    if (window.matchMedia("(hover: hover)").matches) {
      // Small delay to avoid flicker when moving between elements
      hoverTimerRef.current = setTimeout(() => {
        closeLightbox();
      }, 150);
    }
  }, [closeLightbox]);

  const handleClick = useCallback(
    (src: string) => {
      // On touch devices, toggle
      if (!window.matchMedia("(hover: hover)").matches) {
        setLightboxSrc((prev) => (prev === src ? null : src));
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  return { lightboxSrc, handleMouseEnter, handleMouseLeave, handleClick, closeLightbox };
}
