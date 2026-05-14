"use client";

/* eslint-disable @next/next/no-img-element -- Local design shell previews use direct API image URLs. */
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";

import type { DemoImage } from "../../../data";
import { cx } from "../../../routing";
import s from "../image/image.module.css";

export function ImagePreviewFrame({
  image,
  interactive = false,
  onOpen,
  priority = false,
}: {
  image: DemoImage;
  interactive?: boolean;
  onOpen?: () => void;
  priority?: boolean;
}) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    originX: number;
    originY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  const panBounds = useCallback((scale: number) => {
    const frame = frameRef.current;
    const imageNode = imageRef.current;
    if (!frame || !imageNode) return { x: 0, y: 0 };
    const frameWidth = frame.clientWidth;
    const frameHeight = frame.clientHeight;
    const imageWidth = imageNode.offsetWidth;
    const imageHeight = imageNode.offsetHeight;
    return {
      x: Math.max(0, (imageWidth * scale - frameWidth) / 2),
      y: Math.max(0, (imageHeight * scale - frameHeight) / 2),
    };
  }, []);

  const clampView = useCallback((next: { scale: number; x: number; y: number }) => {
    if (next.scale <= 1) return { scale: 1, x: 0, y: 0 };
    const bounds = panBounds(next.scale);
    return {
      scale: next.scale,
      x: Math.min(bounds.x, Math.max(-bounds.x, next.x)),
      y: Math.min(bounds.y, Math.max(-bounds.y, next.y)),
    };
  }, [panBounds]);

  useEffect(() => {
    const node = frameRef.current;
    if (!interactive || !node) return;

    function handleNativeWheel(event: WheelEvent) {
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      setView((current) => {
        const nextScale = Math.min(5, Math.max(1, Number((current.scale + direction * 0.18).toFixed(2))));
        return clampView({ ...current, scale: nextScale });
      });
    }

    node.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleNativeWheel);
  }, [clampView, interactive]);

  function resetView() {
    setView({ scale: 1, x: 0, y: 0 });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!interactive || view.scale <= 1 || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    dragRef.current = {
      originX: view.x,
      originY: view.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!interactive || !drag || drag.pointerId !== event.pointerId) return;
    setView((current) => clampView({
      scale: current.scale,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    }));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const isLandscapeImage = image.width !== null && image.height !== null
    ? image.width >= image.height
    : false;
  const interactiveImageStyle: CSSProperties | undefined = interactive
    ? {
        height: isLandscapeImage ? "auto" : "100%",
        left: `calc(50% + ${view.x}px)`,
        top: `calc(50% + ${view.y}px)`,
        transform: `translate(-50%, -50%) scale(${view.scale})`,
        width: isLandscapeImage ? "100%" : "auto",
      }
    : undefined;

  const content = image.full || image.src ? (
    <img
      src={image.full || image.src}
      alt=""
      className={cx(s.imageFill, interactive && s.imagePreviewInteractiveImage)}
      fetchPriority={priority ? "high" : "auto"}
      loading="eager"
      draggable={false}
      ref={imageRef}
      style={interactiveImageStyle}
    />
  ) : (
    <ImageIcon className={s.icon2xl} />
  );

  if (onOpen) {
    return (
      <button className={s.imagePreviewFrame} type="button" onClick={onOpen} aria-label="Open image preview">
        {content}
      </button>
    );
  }

  return (
    <div
      className={cx(
        s.imagePreviewFrame,
        interactive && s.imagePreviewFrameInteractive,
        interactive && view.scale > 1 && s.imagePreviewFrameZoomed,
        isDragging && s.imagePreviewFrameDragging,
      )}
      onDoubleClick={interactive ? resetView : undefined}
      onPointerCancel={interactive ? handlePointerUp : undefined}
      onPointerDown={interactive ? handlePointerDown : undefined}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerUp={interactive ? handlePointerUp : undefined}
      ref={frameRef}
    >
      {content}
    </div>
  );
}
