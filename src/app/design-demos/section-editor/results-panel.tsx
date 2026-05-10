"use client";

import { Check, Image as ImageIcon, Star, Trash2 } from "lucide-react";

import { cx } from "../design-demo-utils";
import s from "../styles/section-editor.module.css";
import { ImageListMedium } from "../ui/image-list-medium";
import { ImageThumbMedium } from "../ui/image-thumb-medium";
import type { SectionEditorModel } from "./use-section-editor-state";

export function ResultsPanel({ editor }: { editor: SectionEditorModel }) {
  return (
    <div className={s.sectionTabBody}>
      <div className={s.resultsHead}>
        <div className={s.resultsHeadTitle}>
          <h3>运行结果</h3>
          <span>
            共 {editor.images.length} 张 · {editor.keptCount} 保留 · {editor.pendingCount} 待审
          </span>
        </div>
        <div className={s.resultsFilter}>
          {(
            [
              { k: "all" as const, label: "全部" },
              { k: "pending" as const, label: "待审" },
              { k: "kept" as const, label: "保留" },
              { k: "trashed" as const, label: "删除" },
              { k: "featured" as const, label: "精选" },
            ]
          ).map((tab) => (
            <button
              key={tab.k}
              type="button"
              className={cx(
                s.resultsFilterBtn,
                editor.resultsFilter === tab.k && s.resultsFilterBtnActive,
              )}
              onClick={() => editor.setResultsFilter(tab.k)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {editor.runs.length === 0 ? (
        <div className={s.diffEmptyState}>暂无运行结果</div>
      ) : (
        editor.runs.map((run) => (
          <div key={run.runIndex} className={s.runGroup}>
            <div className={s.runGroupHead}>
              <span className={s.runGroupNumber}>
                <ImageIcon className={s.iconSm} />
                Run <b>#{run.runIndex}</b>
              </span>
              <span className={s.runGroupTime}>{run.timestamp}</span>
              <span className={s.runGroupStats}>
                <span className={s.runStatPill}>{run.images.length} 张</span>
                <span className={cx(s.runStatPill, s.runStatKept)}>
                  {run.images.filter((image) => image.status === "kept").length} 保留
                </span>
                <span className={cx(s.runStatPill, s.runStatTrashed)}>
                  {run.images.filter((image) => image.status === "trashed").length} 已删
                </span>
              </span>
              <div className={s.runGroupActions}>
                <button
                  type="button"
                  className={s.resultsFilterBtn}
                  onClick={() => editor.bulkStatusForRun(run.runIndex, "kept")}
                >
                  <Check className={s.iconSm} /> 批量保留
                </button>
                <button
                  type="button"
                  className={s.resultsFilterBtn}
                  onClick={() => editor.bulkStatusForRun(run.runIndex, "trashed")}
                >
                  <Trash2 className={s.iconSm} /> 批量删除
                </button>
              </div>
            </div>
            <ImageListMedium gap={10}>
              {run.images
                .filter((image) => editor.filteredImageIds.has(image.id))
                .map((image) => (
                  <ImageThumbMedium
                    actionSlot={
                      <>
                        <button
                          type="button"
                          className={s.resultThumbAction}
                          data-tone="keep"
                          onClick={() =>
                            editor.markStatus(
                              image.id,
                              image.status === "kept" ? "pending" : "kept",
                            )
                          }
                          aria-label="保留"
                          title="保留"
                        >
                          <Check className={s.iconSm} />
                        </button>
                        <button
                          type="button"
                          className={s.resultThumbAction}
                          data-tone="trash"
                          onClick={() =>
                            editor.markStatus(
                              image.id,
                              image.status === "trashed" ? "pending" : "trashed",
                            )
                          }
                          aria-label="删除"
                          title="删除"
                        >
                          <Trash2 className={s.iconSm} />
                        </button>
                        <button
                          type="button"
                          className={s.resultThumbAction}
                          data-tone="star"
                          onClick={() => editor.toggleFeatured(image.id)}
                          aria-label="精选"
                          title="精选"
                        >
                          <Star className={s.iconSm} />
                        </button>
                      </>
                    }
                    image={image}
                    key={image.id}
                    onOpen={() => editor.setLightboxImageId(image.id)}
                    onSelect={() =>
                      editor.markStatus(
                        image.id,
                        image.status === "kept" ? "pending" : "kept",
                      )
                    }
                    selectable
                    selected={image.status === "kept"}
                    showStatus={image.status !== "pending"}
                  />
                ))}
            </ImageListMedium>
          </div>
        ))
      )}
    </div>
  );
}
