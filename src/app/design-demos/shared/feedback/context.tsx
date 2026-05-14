"use client";

import { createContext, useContext } from "react";

import type { DemoToast } from "../../routing";

export const DemoFeedbackContext = createContext<{
  pushToast: (toast: Omit<DemoToast, "id">) => void;
} | null>(null);

export function useDemoFeedback() {
  return useContext(DemoFeedbackContext) ?? {
    pushToast: () => undefined,
  };
}
