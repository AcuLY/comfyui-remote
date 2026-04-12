"use client";

import { useEffect, useCallback } from "react";
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[85vw] w-full max-w-5xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={src}
          alt={alt ?? "Preview"}
          width={1280}
          height={720}
          className="h-auto max-h-[90vh] w-auto rounded-2xl object-contain"
          unoptimized
        />
      </div>
    </div>
  );
}
