"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/design-demo-ui/primitives/button";

import s from "./tasks.module.css";

export type TaskConfirm = {
  title: string;
  text: string;
  label: string;
  action: () => void;
};

export function TaskConfirmSheet({
  confirm,
  onClose,
}: {
  confirm: TaskConfirm | null;
  onClose: () => void;
}) {
  if (!confirm) return null;

  return (
    <Sheet
      open={Boolean(confirm)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className={s.confirmSheet}>
        <SheetHeader>
          <SheetTitle>{confirm.title}</SheetTitle>
          <SheetDescription>{confirm.text}</SheetDescription>
        </SheetHeader>
        <div className={s.confirmActions}>
          <Button onClick={onClose} tone="subtle">
            返回
          </Button>
          <Button
            tone="danger"
            onClick={() => {
              onClose();
              confirm.action();
            }}
          >
            {confirm.label}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
