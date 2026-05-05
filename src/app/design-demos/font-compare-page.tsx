"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Type } from "lucide-react";

import {
  DEFAULT_DESIGN_DEMO_FONT_KEY,
  DEMO_FONT_CHOICES,
  DESIGN_DEMO_FONT_EVENT,
  DESIGN_DEMO_FONT_STORAGE_KEY,
  applyDesignDemoFont,
  resolveDemoFontKey,
} from "./design-demo-fonts";
import type { DemoFontChoice, DemoFontKey } from "./design-demo-fonts";
import s from "./design-demo.module.css";
import { Button, PageHeader, StatusBadge } from "./design-demo-ui";
import { cx } from "./design-demo-utils";

const sampleSpecRows = [
  { label: "画幅比例", value: "512 × 768 → 1280 × 1920 最终" },
  { label: "Checkpoint", value: "oneObsession_v19Atypical.safetensors" },
  { label: "采样器", value: "Euler a · 28 steps · CFG 7" },
];

const codeSample = `prompt_block.default
positive: soft light, standing pose
size: 512 x 768 -> 1280 x 1920`;

function syncFontFromStorage(setSelected: (font: DemoFontKey) => void) {
  setSelected(resolveDemoFontKey(window.localStorage.getItem(DESIGN_DEMO_FONT_STORAGE_KEY)));
}

export function FontComparePage() {
  const [selected, setSelected] = useState<DemoFontKey>(DEFAULT_DESIGN_DEMO_FONT_KEY);
  const selectedChoice = useMemo(
    () => DEMO_FONT_CHOICES.find((choice) => choice.key === selected) ?? DEMO_FONT_CHOICES[0],
    [selected],
  );

  useEffect(() => {
    syncFontFromStorage(setSelected);

    function handleFontChange(event: Event) {
      const detail = event instanceof CustomEvent && typeof event.detail === "string"
        ? event.detail
        : window.localStorage.getItem(DESIGN_DEMO_FONT_STORAGE_KEY);
      setSelected(resolveDemoFontKey(detail));
    }

    window.addEventListener(DESIGN_DEMO_FONT_EVENT, handleFontChange);
    return () => window.removeEventListener(DESIGN_DEMO_FONT_EVENT, handleFontChange);
  }, []);

  function selectFont(choice: DemoFontChoice) {
    applyDesignDemoFont(choice.key);
    setSelected(choice.key);
  }

  function resetFont() {
    const defaultChoice = DEMO_FONT_CHOICES.find((choice) => choice.key === DEFAULT_DESIGN_DEMO_FONT_KEY) ?? DEMO_FONT_CHOICES[0];
    selectFont(defaultChoice);
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="字体对比"
        title="中文字体候选"
        subtitle="点击任一卡片会把整套 demo 同步切到对应中文字体；拉丁字符继续由 Geist 承担，代码块继续用 Maple Mono。"
        actions={<Button tone="subtle" onClick={resetFont} feedback={{ title: "已恢复 Noto 基线" }}>恢复基线</Button>}
      />

      <section className={s.fontCompareBanner}>
        <div className={s.fontCompareBannerText}>
          <span>当前全站预览</span>
          <strong>{selectedChoice.label}</strong>
          <p>{selectedChoice.note}</p>
        </div>
        <div className={s.fontCompareBannerTags}>
          <span>正文：Geist + {selectedChoice.family}</span>
          <span>代码：Maple Mono</span>
          <StatusBadge status="ready" label={selectedChoice.license} />
        </div>
      </section>

      <div className={s.fontCompareGrid}>
        {DEMO_FONT_CHOICES.map((choice, index) => {
          const active = choice.key === selected;
          return (
            <article
              className={cx(s.fontCompareCard, active && s.fontCompareCardActive)}
              data-font-option={choice.key}
              key={choice.key}
            >
              <header className={s.fontCompareCardHeader}>
                <div className={s.fontCompareCardTitle}>
                  <span>候选 {String(index + 1).padStart(2, "0")} · {choice.license}</span>
                  <strong>{choice.label}</strong>
                  <em>{choice.summary}</em>
                </div>
                {active ? <StatusBadge status="ready" label="当前" /> : null}
              </header>

              <div className={s.fontCompareSample}>
                <span>小节编辑 · UI 文案</span>
                <h3>单人 · 背手站立</h3>
                <p>决定最终画幅尺寸与批量数。Checkpoint 支持继承项目设置，预设和 LoRA 会跟随小节自动保存。</p>
              </div>

              <div className={s.fontCompareSpecList}>
                {sampleSpecRows.map((row) => (
                  <div className={s.fontCompareSpecRow} key={`${choice.key}-${row.label}`}>
                    <strong>{row.label}</strong>
                    <span>{row.value}</span>
                  </div>
                ))}
              </div>

              <pre className={s.fontCompareCode}>{codeSample}</pre>

              <footer className={s.fontCompareCardFooter}>
                <p>{choice.note}</p>
                <Button
                  tone={active ? "primary" : "subtle"}
                  icon={active ? Check : Type}
                  onClick={() => selectFont(choice)}
                  feedback={{ title: `已切换为 ${choice.label}` }}
                >
                  {active ? "正在预览" : "应用到 demo"}
                </Button>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
