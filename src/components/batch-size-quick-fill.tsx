"use client";

// 2 的次幂快捷填充值：1, 2, 4, 8, 16
const QUICK_VALUES = [1, 2, 4, 8, 16];

type BatchSizeQuickFillProps = {
  onSelect: (value: number) => void;
  disabled?: boolean;
  /** 可选的当前值，用于高亮显示 */
  currentValue?: number | null;
  /** 尺寸变体 */
  size?: "sm" | "md";
};

export function BatchSizeQuickFill({
  onSelect,
  disabled,
  currentValue,
  size = "md",
}: BatchSizeQuickFillProps) {
  const sizeClasses =
    size === "sm"
      ? "px-1.5 py-0.5 text-[10px] rounded-md"
      : "px-2 py-1 text-xs rounded-lg";

  return (
    <div className="flex items-center gap-1">
      {QUICK_VALUES.map((val) => {
        const isActive = currentValue === val;
        return (
          <button
            key={val}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(val)}
            className={`${sizeClasses} border transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isActive
                ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
                : "border-white/10 bg-white/[0.03] text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300"
            }`}
          >
            {val}
          </button>
        );
      })}
    </div>
  );
}
