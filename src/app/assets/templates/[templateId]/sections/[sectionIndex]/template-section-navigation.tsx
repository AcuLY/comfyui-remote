"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NeighborNavigation } from "@/components/neighbor-navigation";

type TemplateSectionNavigationProps = {
  basePath: string;
  previousSectionIndex: number | null;
  nextSectionIndex: number | null;
  sectionPosition: number;
  totalSections: number;
  onNavigateToSection: (index: number | null) => void;
};

export function TemplateSectionNavigation({
  basePath,
  previousSectionIndex,
  nextSectionIndex,
  sectionPosition,
  totalSections,
  onNavigateToSection,
}: TemplateSectionNavigationProps) {
  return (
    <div className="flex items-center justify-between">
      <Link
        href={basePath}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
      >
        <ArrowLeft className="size-4" /> 返回模板
      </Link>
      <NeighborNavigation
        previousOnClick={() => onNavigateToSection(previousSectionIndex)}
        nextOnClick={() => onNavigateToSection(nextSectionIndex)}
        previousDisabled={previousSectionIndex === null}
        nextDisabled={nextSectionIndex === null}
        previousLabel={null}
        nextLabel={null}
        previousTitle="上一节"
        nextTitle="下一节"
        previousAriaLabel="上一节"
        nextAriaLabel="下一节"
        positionText={`${sectionPosition + 1} / ${totalSections}`}
        className="gap-2"
        controlClassName="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-zinc-400 transition hover:bg-white/[0.08] disabled:opacity-30"
        disabledControlClassName="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-zinc-400 opacity-30"
        iconClassName="size-4"
      />
    </div>
  );
}
