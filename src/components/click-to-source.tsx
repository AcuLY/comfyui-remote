"use client";

import { useEffect, useRef } from "react";

type ReactFiber = {
  _debugOwner?: ReactFiber | null;
  _debugInfo?: unknown[] | null;
  _debugSource?: {
    columnNumber?: number;
    fileName?: string;
    lineNumber?: number;
  } | null;
  _debugStack?: unknown;
};

type ReactSource = {
  columnNumber: number;
  fileName: string;
  lineNumber: number;
};

const PROJECT_ROOT = "D:/Luca/Code/MyProject/comfyui-manager";

function isMarkableElement(element: Element): element is HTMLElement | SVGElement {
  return element instanceof HTMLElement || element instanceof SVGElement;
}

function getReactFiberForElement(element: Element): ReactFiber | null {
  if ("__REACT_DEVTOOLS_GLOBAL_HOOK__" in window) {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__ as {
      renderers?: Map<unknown, { findFiberByHostInstance?: (element: Element) => ReactFiber | null }>;
    };

    for (const renderer of hook.renderers?.values() ?? []) {
      try {
        const fiber = renderer.findFiberByHostInstance?.(element);
        if (fiber) return fiber;
      } catch {
        // React can invalidate host refs while a click is being handled.
      }
    }
  }

  for (const key in element) {
    if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
      return (element as unknown as Record<string, ReactFiber>)[key] ?? null;
    }
  }

  return null;
}

function normalizeSource(value: unknown): ReactSource | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    columnNumber?: unknown;
    fileName?: unknown;
    lineNumber?: unknown;
  };

  if (typeof candidate.fileName !== "string") return null;
  return {
    columnNumber: typeof candidate.columnNumber === "number" ? candidate.columnNumber : 1,
    fileName: candidate.fileName,
    lineNumber: typeof candidate.lineNumber === "number" ? candidate.lineNumber : 1,
  };
}

function parseSourceFromStack(value: unknown): ReactSource | null {
  if (!(value instanceof Error) || !value.stack) return null;

  const lines = value.stack.split("\n");
  for (const line of lines) {
    const match = line.match(/\(?((?:webpack-internal:\/\/\/|file:\/\/\/|https?:\/\/|\[project\]\/|[A-Za-z]:[\\/]).+?):(\d+):(\d+)\)?$/);
    if (!match) continue;
    return {
      columnNumber: Number(match[3]),
      fileName: match[1],
      lineNumber: Number(match[2]),
    };
  }

  return null;
}

function getSourceFromDebugInfo(debugInfo: unknown[] | null | undefined): ReactSource | null {
  if (!debugInfo) return null;
  for (let index = debugInfo.length - 1; index >= 0; index--) {
    const entry = debugInfo[index];
    const direct = normalizeSource(entry);
    if (direct) return direct;

    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const nested = normalizeSource(record.source) ?? normalizeSource(record.debugSource) ?? parseSourceFromStack(record.stack);
      if (nested) return nested;
    }
  }
  return null;
}

function getSourceForFiber(fiber: ReactFiber | null): ReactSource | null {
  let current = fiber;
  while (current) {
    const source =
      normalizeSource(current._debugSource) ??
      normalizeSource(current._debugStack) ??
      parseSourceFromStack(current._debugStack) ??
      getSourceFromDebugInfo(current._debugInfo);
    if (source) return source;

    current = current._debugOwner ?? null;
  }
  return null;
}

function getSourceForElement(element: Element | null) {
  let current = element;
  while (current) {
    const source = getSourceForFiber(getReactFiberForElement(current));
    if (source) return source;
    current = current.parentElement;
  }
  return null;
}

function toEditorUrl(source: ReactSource) {
  const fileName = source.fileName.startsWith("[project]/")
    ? `${PROJECT_ROOT}/${source.fileName.slice("[project]/".length)}`
    : source.fileName;
  const path = `${fileName}:${source.lineNumber}:${source.columnNumber}`;
  return path.startsWith("/") ? `vscode://file${path}` : `vscode://file/${path}`;
}

export function ClickToSource() {
  const targetRef = useRef<Element | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    function clearTarget() {
      const previous = targetRef.current;
      if (previous && isMarkableElement(previous)) {
        delete previous.dataset.clickToSourceTarget;
      }
      targetRef.current = null;
    }

    function markTarget(element: Element) {
      if (targetRef.current === element) return;
      clearTarget();
      targetRef.current = element;
      if (isMarkableElement(element)) {
        element.dataset.clickToSourceTarget = "true";
      }
    }

    function handleClick(event: MouseEvent) {
      if (!event.altKey || !(event.target instanceof Element)) return;

      const source = getSourceForElement(event.target);
      if (!source) {
        console.warn("Could not find React source for element", event.target);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      window.location.assign(toEditorUrl(source));
    }

    function handleMouseMove(event: MouseEvent) {
      if (!event.altKey || !(event.target instanceof Element)) {
        clearTarget();
        return;
      }
      markTarget(event.target);
    }

    window.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keyup", clearTarget);
    window.addEventListener("blur", clearTarget);

    return () => {
      window.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keyup", clearTarget);
      window.removeEventListener("blur", clearTarget);
    };
  }, []);

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <style>
      {`
        [data-click-to-source-target] {
          cursor: pointer !important;
          outline: var(--click-to-source-outline, -webkit-focus-ring-color auto 1px) !important;
        }
      `}
    </style>
  );
}
