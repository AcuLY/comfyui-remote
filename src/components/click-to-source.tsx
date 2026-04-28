"use client";

import { useEffect, useRef } from "react";

type ReactFiber = {
  _debugOwner?: ReactFiber | null;
  _debugSource?: {
    columnNumber?: number;
    fileName?: string;
    lineNumber?: number;
  } | null;
};

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

function getSourceForFiber(fiber: ReactFiber | null) {
  let current = fiber;
  while (current) {
    const source = current._debugSource;
    if (source?.fileName) {
      return {
        columnNumber: source.columnNumber ?? 1,
        fileName: source.fileName,
        lineNumber: source.lineNumber ?? 1,
      };
    }
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

function toEditorUrl(source: { columnNumber: number; fileName: string; lineNumber: number }) {
  const path = `${source.fileName}:${source.lineNumber}:${source.columnNumber}`;
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
