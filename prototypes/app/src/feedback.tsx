import { createContext, useContext, useRef } from "react";
import type { ReactNode } from "react";
import { ConfirmDialog } from "primereact/confirmdialog";
import { Toast } from "primereact/toast";

export type ToastTone = "success" | "info" | "warn" | "error";

type PushToast = (tone: ToastTone, title: string, detail?: string) => void;

const ToastContext = createContext<PushToast>(() => {});

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const toast = useRef<Toast>(null);

  const pushToast: PushToast = (tone, title, detail) => {
    toast.current?.show({ severity: tone, summary: title, detail, life: 3200 });
  };

  return (
    <ToastContext.Provider value={pushToast}>
      {children}
      <Toast ref={toast} position="bottom-right" />
      <ConfirmDialog />
    </ToastContext.Provider>
  );
}

export function usePushToast() {
  return useContext(ToastContext);
}
