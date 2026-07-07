import {
  ProjectLoadingActionBar,
  ProjectLoadingBlock,
  ProjectLoadingGrid,
} from "../../../../project-loading-skeletons";

export default function SectionResultsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProjectLoadingBlock className="h-5 w-28 rounded bg-white/10" />
        <ProjectLoadingActionBar
          buttonWidths={["w-20", "w-20", "w-16", "w-16"]}
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
        <ProjectLoadingBlock className="h-6 w-48 rounded bg-white/10" />
        <ProjectLoadingBlock className="h-4 w-64 rounded bg-white/10" />
        <ProjectLoadingGrid
          count={8}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          itemClassName="aspect-[3/4] rounded-xl bg-white/[0.06]"
        />
      </div>
    </div>
  );
}
