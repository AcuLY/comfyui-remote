import { ArrowLeft, ArrowRight } from "lucide-react";

import { cx } from "../design-demo-utils";
import { Button } from "../ui/button";
import s from "./demo-pager.runs.module.css";

export function DemoPager({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  const pages = Array.from(new Set([
    1,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    totalPages,
  ])).filter((page) => page >= 1 && page <= totalPages);

  return (
    <div className={s.pagerControls} aria-label="分页">
      <Button className={s.pagerButton} tone="subtle" icon={ArrowLeft} iconOnly disabled={currentPage <= 1} ariaLabel="上一页" />
      {pages.map((page, index) => {
        const previous = pages[index - 1];
        return (
          <span className={s.pagerChunk} key={page}>
            {previous && page - previous > 1 ? <span className={s.pagerEllipsis}>…</span> : null}
            <Button
              className={cx(s.pagerButton, page === currentPage && s.pagerButtonActive)}
              pressed={page === currentPage}
            >
              {page}
            </Button>
          </span>
        );
      })}
      <Button className={s.pagerButton} tone="subtle" icon={ArrowRight} iconOnly disabled={currentPage >= totalPages} ariaLabel="下一页" />
    </div>
  );
}
