"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { WorkflowActionResult } from "./workflow-actions";

type WorkflowAction = (formData: FormData) => Promise<WorkflowActionResult>;

type WorkflowActionFormProps = {
  action: WorkflowAction;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  successMessage?: string;
  disabled?: boolean;
  confirmMessage?: string;
  className?: string;
  buttonClassName?: string;
};

export function WorkflowActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  successMessage,
  disabled = false,
  confirmMessage,
  className,
  buttonClassName,
}: WorkflowActionFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<WorkflowActionResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || disabled) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    const formData = new FormData(event.currentTarget);
    setPending(true);
    setFeedback(null);
    try {
      const result = await action(formData);
      setFeedback(result);
      if (result.ok) {
        toast.success(successMessage ?? result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "操作失败。";
      const result = { ok: false, message };
      setFeedback(result);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      {children}
      {feedback ? (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            feedback.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending || disabled}
        className={buttonClassName ?? "h-9 w-full rounded-md bg-emerald-500 px-3 text-xs font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"}
      >
        <span className="inline-flex items-center justify-center gap-2">
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {pending ? pendingLabel ?? submitLabel : submitLabel}
        </span>
      </button>
    </form>
  );
}
