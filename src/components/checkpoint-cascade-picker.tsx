"use client";

import { LoraCascadePicker } from "@/components/lora-cascade-picker";

type CheckpointCascadePickerProps = {
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
  placeholder?: string;
  size?: "sm" | "md";
};

export function CheckpointCascadePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "选择 checkpoint…",
  size = "sm",
}: CheckpointCascadePickerProps) {
  return (
    <LoraCascadePicker
      kind="checkpoint"
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      size={size}
    />
  );
}
