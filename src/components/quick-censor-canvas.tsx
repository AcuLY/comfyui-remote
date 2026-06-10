"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Loader2, X } from "lucide-react";
import {
  getQuickCensorBrushSettings,
  mosaicImageData,
  type MosaicRect,
} from "@/lib/quick-censor-core";

type CanvasPoint = {
  x: number;
  y: number;
};

function getCanvasContext(canvas: HTMLCanvasElement | null) {
  return canvas?.getContext("2d", { willReadFrequently: true }) ?? null;
}

export function QuickCensorCanvas({
  source,
  disabled = false,
  onCancel,
  onComplete,
}: {
  source: string;
  disabled?: boolean;
  onCancel: () => void;
  onComplete: (blob: Blob) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<CanvasPoint | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ height: number; width: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const brush = getQuickCensorBrushSettings();

  const clearPreview = useCallback(() => {
    const previewCanvas = previewCanvasRef.current;
    const previewContext = getCanvasContext(previewCanvas);
    if (!previewCanvas || !previewContext) return;
    previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    setIsReady(false);
    setError(null);
    clearPreview();

    image.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const previewCanvas = previewCanvasRef.current;
      const context = getCanvasContext(canvas);
      if (!canvas || !previewCanvas || !context) return;

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      previewCanvas.width = image.naturalWidth;
      previewCanvas.height = image.naturalHeight;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      setCanvasSize({ height: image.naturalHeight, width: image.naturalWidth });
      setIsReady(true);
    };

    image.onerror = () => {
      if (cancelled) return;
      setError("原图载入失败");
    };

    image.decoding = "async";
    image.src = source;

    return () => {
      cancelled = true;
    };
  }, [clearPreview, source]);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): CanvasPoint | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function brushRect(point: CanvasPoint, previousPoint: CanvasPoint | null): MosaicRect {
    const halfArea = brush.areaSize / 2;
    if (!previousPoint) {
      return {
        x: point.x - halfArea,
        y: point.y - halfArea,
        width: brush.areaSize,
        height: brush.areaSize,
      };
    }

    const left = Math.min(previousPoint.x, point.x) - halfArea;
    const top = Math.min(previousPoint.y, point.y) - halfArea;
    const right = Math.max(previousPoint.x, point.x) + halfArea;
    const bottom = Math.max(previousPoint.y, point.y) + halfArea;

    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    };
  }

  function snapRect(rect: MosaicRect, width: number, height: number): MosaicRect | null {
    const left = Math.max(0, Math.floor(rect.x / brush.blockSize) * brush.blockSize);
    const top = Math.max(0, Math.floor(rect.y / brush.blockSize) * brush.blockSize);
    const right = Math.min(width, Math.ceil((rect.x + rect.width) / brush.blockSize) * brush.blockSize);
    const bottom = Math.min(height, Math.ceil((rect.y + rect.height) / brush.blockSize) * brush.blockSize);
    if (right <= left || bottom <= top) return null;
    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    };
  }

  function applyMosaicToContext(
    context: CanvasRenderingContext2D,
    rect: MosaicRect,
    width: number,
    height: number,
  ) {
    const snapped = snapRect(rect, width, height);
    if (!snapped) return;

    const imageData = context.getImageData(snapped.x, snapped.y, snapped.width, snapped.height);
    mosaicImageData(imageData.data, {
      blockSize: brush.blockSize,
      height: imageData.height,
      rect: { x: 0, y: 0, width: imageData.width, height: imageData.height },
      width: imageData.width,
    });
    context.putImageData(imageData, snapped.x, snapped.y);
  }

  function applyPermanentMosaic(point: CanvasPoint, previousPoint: CanvasPoint | null) {
    const canvas = canvasRef.current;
    const context = getCanvasContext(canvas);
    if (!canvas || !context) return;
    applyMosaicToContext(context, brushRect(point, previousPoint), canvas.width, canvas.height);
  }

  function drawPreview(point: CanvasPoint) {
    const canvas = canvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    const previewContext = getCanvasContext(previewCanvas);
    const context = getCanvasContext(canvas);
    if (!canvas || !previewCanvas || !previewContext || !context) return;

    clearPreview();
    const rect = snapRect(brushRect(point, null), canvas.width, canvas.height);
    if (!rect) return;

    const imageData = context.getImageData(rect.x, rect.y, rect.width, rect.height);
    mosaicImageData(imageData.data, {
      blockSize: brush.blockSize,
      height: imageData.height,
      rect: { x: 0, y: 0, width: imageData.width, height: imageData.height },
      width: imageData.width,
    });
    previewContext.putImageData(imageData, rect.x, rect.y);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled || isSaving || !isReady) return;
    const point = pointFromEvent(event);
    if (!point) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    clearPreview();
    lastPointRef.current = point;
    setIsDrawing(true);
    applyPermanentMosaic(point, null);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled || isSaving || !isReady) return;
    const point = pointFromEvent(event);
    if (!point) return;

    if (!isDrawing) {
      drawPreview(point);
      return;
    }

    event.preventDefault();
    applyPermanentMosaic(point, lastPointRef.current);
    lastPointRef.current = point;
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    event.preventDefault();
    setIsDrawing(false);
    lastPointRef.current = null;
    clearPreview();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function handleComplete() {
    const canvas = canvasRef.current;
    if (!canvas || disabled || isSaving || !isReady) return;

    setIsSaving(true);
    setError(null);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new Error("无法导出打码图"));
          },
          "image/jpeg",
          0.92,
        );
      });
      await onComplete(blob);
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        <div className="min-w-0">
          <span className="font-medium">快速打码</span>
          <span className="ml-2 text-amber-100/70">
            区域 {brush.areaSize}px / 块 {brush.blockSize}px
          </span>
          {error && <span className="ml-2 text-red-200">{error}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 text-xs font-medium text-white/80 transition hover:bg-white/15 disabled:opacity-50"
          >
            <X className="size-3.5" />
            放弃
          </button>
          <button
            type="button"
            disabled={!isReady || isSaving}
            onClick={handleComplete}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/15 px-2.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            完成
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto">
        {!isReady && !error && (
          <div className="absolute inset-3 flex items-center justify-center">
            <div className="h-full max-h-[calc(100dvh-14rem)] w-full max-w-5xl animate-pulse rounded-lg bg-white/[0.08]" />
          </div>
        )}
        <div
          className="relative inline-block max-h-[calc(100dvh-14rem)] max-w-full"
          style={canvasSize ? { aspectRatio: `${canvasSize.width} / ${canvasSize.height}` } : undefined}
        >
          <canvas
            ref={canvasRef}
            aria-label="快速打码画布"
            className={`block max-h-[calc(100dvh-14rem)] max-w-full rounded-lg object-contain transition-opacity duration-150 ${
              isReady ? "cursor-crosshair opacity-100" : "opacity-0"
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={(event) => {
              if (isDrawing) {
                handlePointerUp(event);
              } else {
                clearPreview();
              }
            }}
          />
          <canvas
            ref={previewCanvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}
