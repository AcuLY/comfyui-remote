"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Save,
  AlertCircle,
  GripVertical,
  X,
  Search,
  Wand2,
} from "lucide-react";

import s from "./design-demo.module.css";

// ============================================================================
// Section Name Editor
// ============================================================================

type SectionNameEditorProps = {
  initialName: string;
  onChange?: (name: string) => void;
};

export function SectionNameEditor({ initialName, onChange }: SectionNameEditorProps) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (value: string) => {
    setName(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setSaving(true);
    timeoutRef.current = setTimeout(() => {
      onChange?.(value);
      setSaving(false);
    }, 600);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className={s.sectionNameEditor}>
      <input
        type="text"
        value={name}
        onChange={(e) => handleChange(e.target.value)}
        className={s.sectionNameEditorInput}
      />
      {saving && (
        <span className={s.sectionNameEditorSaving}>
          <Save className="size-3" />
          保存中…
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Checkpoint Picker
// ============================================================================

type CheckpointPickerProps = {
  value: string;
  projectCheckpoint?: string | null;
  options: string[];
  onChange?: (value: string) => void;
  disabled?: boolean;
};

export function CheckpointPicker({
  value,
  projectCheckpoint,
  options,
  onChange,
  disabled,
}: CheckpointPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const displayValue = value || projectCheckpoint || "选择 checkpoint…";
  const isInherited = !value && projectCheckpoint;

  return (
    <div className={s.checkpointPicker} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={s.checkpointPickerButton}
      >
        <span>{displayValue}</span>
        <ChevronDown className="size-4" />
      </button>
      {isInherited && (
        <div className={s.checkpointPickerInheritance}>继承项目设置</div>
      )}
      {isOpen && (
        <div className={s.checkpointPickerDropdown}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange?.(option);
                setIsOpen(false);
              }}
              data-selected={value === option ? "true" : "false"}
              className={s.checkpointPickerOption}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// KSampler Panel
// ============================================================================

type KSamplerParams = {
  steps: number;
  cfg: number;
  sampler_name: string;
  scheduler: string;
};

type KSamplerPanelProps = {
  label: string;
  subtitle: string;
  params: KSamplerParams;
  onChange?: (params: KSamplerParams) => void;
  disabled?: boolean;
};

export function KSamplerPanel({
  label,
  subtitle,
  params,
  onChange,
  disabled,
}: KSamplerPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const handleFieldChange = (field: keyof KSamplerParams, value: string | number) => {
    onChange?.({ ...params, [field]: value });
  };

  return (
    <div className={s.ksamplerPanel}>
      <button
        type="button"
        onClick={() => !disabled && setExpanded(!expanded)}
        data-expanded={expanded ? "true" : "false"}
        data-disabled={disabled ? "true" : "false"}
        className={s.ksamplerPanelHeader}
      >
        <div className={s.ksamplerPanelHeaderMain}>
          <div className={s.ksamplerPanelLabel}>{label}</div>
          <div className={s.ksamplerPanelSubtitle}>{subtitle}</div>
        </div>
        <ChevronDown className={s.ksamplerPanelChevron} />
      </button>
      {expanded && (
        <div className={s.ksamplerPanelBody}>
          <div className={s.ksamplerPanelGrid}>
            <div className={s.ksamplerPanelField}>
              <label className={s.ksamplerPanelFieldLabel}>Steps</label>
              <input
                type="number"
                value={params.steps}
                onChange={(e) => handleFieldChange("steps", parseInt(e.target.value, 10))}
                disabled={disabled}
                className={s.ksamplerPanelFieldInput}
              />
            </div>
            <div className={s.ksamplerPanelField}>
              <label className={s.ksamplerPanelFieldLabel}>CFG</label>
              <input
                type="number"
                step="0.1"
                value={params.cfg}
                onChange={(e) => handleFieldChange("cfg", parseFloat(e.target.value))}
                disabled={disabled}
                className={s.ksamplerPanelFieldInput}
              />
            </div>
            <div className={s.ksamplerPanelField}>
              <label className={s.ksamplerPanelFieldLabel}>Sampler</label>
              <select
                value={params.sampler_name}
                onChange={(e) => handleFieldChange("sampler_name", e.target.value)}
                disabled={disabled}
                className={s.ksamplerPanelFieldInput}
              >
                <option value="euler_ancestral">euler_ancestral</option>
                <option value="dpmpp_2m_sde">dpmpp_2m_sde</option>
                <option value="dpmpp_2m">dpmpp_2m</option>
                <option value="euler">euler</option>
                <option value="heun">heun</option>
              </select>
            </div>
            <div className={s.ksamplerPanelField}>
              <label className={s.ksamplerPanelFieldLabel}>Scheduler</label>
              <select
                value={params.scheduler}
                onChange={(e) => handleFieldChange("scheduler", e.target.value)}
                disabled={disabled}
                className={s.ksamplerPanelFieldInput}
              >
                <option value="normal">normal</option>
                <option value="karras">karras</option>
                <option value="exponential">exponential</option>
                <option value="simple">simple</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Upscale Factor Field
// ============================================================================

type UpscaleFactorFieldProps = {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
};

export function UpscaleFactorField({ value, onChange, disabled }: UpscaleFactorFieldProps) {
  const quickFillOptions = [1, 1.5, 2, 2.5, 3, 4];
  const numericValue = parseFloat(value);
  const show1xWarning = numericValue === 1;

  return (
    <div className={s.upscaleFactorField}>
      <input
        type="number"
        min={1}
        max={4}
        step={0.5}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={s.upscaleFactorInput}
      />
      <div className={s.upscaleFactorQuickFill}>
        {quickFillOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange?.(String(option))}
            disabled={disabled}
            data-selected={numericValue === option ? "true" : "false"}
            className={s.upscaleFactorChip}
          >
            {option}x
          </button>
        ))}
      </div>
      {show1xWarning && (
        <div className={s.upscaleFactorWarning}>
          <AlertCircle />
          <span>1x 模式将跳过 Upscale Latent 和 KSampler2（无高清修复）</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Preset Import Modal
// ============================================================================

type PresetCategory = {
  id: string;
  name: string;
  color: string | null;
  presets: Array<{
    id: string;
    name: string;
    variantCount: number;
  }>;
};

type PresetImportModalProps = {
  categories: PresetCategory[];
  onImport?: (presetId: string) => void;
  onClose?: () => void;
};

export function PresetImportModal({ categories, onImport, onClose }: PresetImportModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      presets: cat.presets.filter((preset) =>
        preset.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((cat) => cat.presets.length > 0);

  const handleImport = () => {
    if (selectedPresetId) {
      onImport?.(selectedPresetId);
      onClose?.();
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className={s.presetImportModal}>
      <div className={s.presetImportBackdrop} onClick={onClose} />
      <div className={s.presetImportSheet}>
        <div className={s.presetImportHeader}>
          <div className={s.presetImportHeaderMain}>
            <h2 className={s.presetImportTitle}>导入预设</h2>
            <p className={s.presetImportSubtitle}>选择预设添加到当前小节</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={s.presetImportCloseButton}
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className={s.presetImportBody}>
          <input
            type="text"
            placeholder="搜索预设…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={s.presetImportSearch}
          />
          <div className={s.presetImportCategoryList}>
            {filteredCategories.map((category) => (
              <div key={category.id} className={s.presetImportCategory}>
                <div className={s.presetImportCategoryHeader}>
                  <div
                    className={s.presetImportCategoryBadge}
                    style={{
                      background: category.color || "var(--demo-muted)",
                      color: "white",
                    }}
                  >
                    {category.name[0]}
                  </div>
                  <div className={s.presetImportCategoryName}>{category.name}</div>
                </div>
                <div className={s.presetImportPresetList}>
                  {category.presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPresetId(preset.id)}
                      data-selected={selectedPresetId === preset.id ? "true" : "false"}
                      className={s.presetImportPresetItem}
                    >
                      <div className={s.presetImportPresetName}>{preset.name}</div>
                      <div className={s.presetImportPresetVariants}>
                        {preset.variantCount} variants
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={s.presetImportFooter}>
          <button
            type="button"
            onClick={handleImport}
            disabled={!selectedPresetId}
            className={s.presetImportConfirmButton}
          >
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Variant Switcher
// ============================================================================

type VariantSwitcherProps = {
  variants: Array<{ id: string; name: string }>;
  currentVariantId: string;
  onChange?: (variantId: string) => void;
};

export function VariantSwitcher({ variants, currentVariantId, onChange }: VariantSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentVariant = variants.find((v) => v.id === currentVariantId);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className={s.variantSwitcher} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={s.variantSwitcherButton}
      >
        <Wand2 />
        {currentVariant?.name || "切换 Variant"}
        <ChevronDown />
      </button>
      {isOpen && (
        <div className={s.variantSwitcherDropdown}>
          {variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => {
                onChange?.(variant.id);
                setIsOpen(false);
              }}
              data-selected={variant.id === currentVariantId ? "true" : "false"}
              className={s.variantSwitcherOption}
            >
              {variant.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LoRA Entry Row
// ============================================================================

type LoraEntryRowProps = {
  entry: {
    id: string;
    name: string;
    weight: string;
    enabled: boolean;
    source: string;
    sourceColor: string;
  };
  onWeightChange?: (weight: string) => void;
  onToggle?: () => void;
  onRemove?: () => void;
  draggable?: boolean;
};

export function LoraEntryRow({
  entry,
  onWeightChange,
  onToggle,
  onRemove,
  draggable,
}: LoraEntryRowProps) {
  return (
    <div className={s.loraEntryDraggable}>
      {draggable && (
        <div className={s.loraEntryDragHandle}>
          <GripVertical />
        </div>
      )}
      <div className={s.loraEntryMain}>
        <span
          className={s.loraEntrySource}
          style={{ "--source-color": `hsl(${entry.sourceColor})` } as React.CSSProperties}
        >
          {entry.source}
        </span>
        <strong className={s.loraEntryName}>{entry.name}</strong>
      </div>
      <input
        type="text"
        value={entry.weight}
        onChange={(e) => onWeightChange?.(e.target.value)}
        className={s.loraEntryWeight}
      />
      <button
        type="button"
        onClick={onToggle}
        className={s.loraEntryToggle}
        aria-label="切换启用"
      >
        <div className={s.loraEntryToggleTrack}>
          <div className={s.loraEntryToggleThumb} />
        </div>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className={s.iconMiniButton}
          aria-label="移除"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Change History Item
// ============================================================================

type ChangeHistoryItemProps = {
  change: {
    id: string;
    timestamp: string;
    dimension: string;
    title: string;
    before: string | null;
    after: string | null;
  };
};

export function ChangeHistoryItem({ change }: ChangeHistoryItemProps) {
  const formatDiff = (value: string | null) => {
    if (!value) return "—";
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  };

  return (
    <div className={s.changeHistoryItem}>
      <div className={s.changeHistoryHeader}>
        <div className={s.changeHistoryTitle}>{change.title}</div>
        <div className={s.changeHistoryTimestamp}>{change.timestamp}</div>
      </div>
      <div className={s.changeHistoryDiff}>
        <div className={s.changeHistoryDiffLabel}>Before</div>
        <div className={`${s.changeHistoryDiffContent} ${s.changeHistoryDiffBefore}`}>
          {formatDiff(change.before)}
        </div>
      </div>
      <div className={s.changeHistoryDiff}>
        <div className={s.changeHistoryDiffLabel}>After</div>
        <div className={`${s.changeHistoryDiffContent} ${s.changeHistoryDiffAfter}`}>
          {formatDiff(change.after)}
        </div>
      </div>
    </div>
  );
}
