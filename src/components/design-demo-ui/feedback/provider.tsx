"use client";

import type * as React from "react";
import { useCallback, useRef, useState } from "react";
import { Check, X } from "lucide-react";

import type { DemoToast } from "@/app/design-demos/routing";
import { cx } from "@/app/design-demos/routing";
import s from "./feedback.module.css";
import { Button } from "../primitives/button";
import { DemoFeedbackContext } from "./context";

type DemoToastState = DemoToast & { closing?: boolean };

export function DemoFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<DemoToastState[]>([]);
  const toastSequence = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) =>
      current.map((item) => (item.id === id ? { ...item, closing: true } : item)),
    );
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 180);
  }, []);

  const pushToast = useCallback((toast: Omit<DemoToast, "id">) => {
    const id = `toast-${Date.now().toString(36)}-${toastSequence.current++}`;
    setToasts((current) => [{ id, ...toast }, ...current].slice(0, 3));
    window.setTimeout(() => {
      dismissToast(id);
    }, 3600);
  }, [dismissToast]);

  return (
    <DemoFeedbackContext.Provider value={{ pushToast }}>
      {children}
      <DemoToastStack toasts={toasts} onDismiss={dismissToast} />
    </DemoFeedbackContext.Provider>
  );
}

function DemoToastStack({ toasts, onDismiss }: { toasts: DemoToastState[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null;

  return (
    <div className={s.toastStack} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          className={cx(
            s.toast,
            toast.tone === "success" && s.toastSuccess,
            toast.tone === "warning" && s.toastWarning,
            toast.tone === "error" && s.toastError,
            toast.closing && s.toastClosing,
          )}
          key={toast.id}
        >
          <Check className={s.icon} />
          <div>
            <strong>{toast.title}</strong>
            {toast.detail ? <span>{toast.detail}</span> : null}
          </div>
          <Button className={s.toastCloseButton} tone="subtle" icon={X} iconOnly onClick={() => onDismiss(toast.id)} ariaLabel="关闭提示" />
        </div>
      ))}
    </div>
  );
}
