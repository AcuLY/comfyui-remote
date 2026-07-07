import {
  ProjectLoadingActionBar,
  ProjectLoadingBlock,
} from "../../../project-loading-skeletons";

export default function SectionEditLoading() {
  return (
    <div className="-mx-5 -mt-4 min-h-[calc(100dvh-5rem)] bg-[var(--panel)] px-5 pt-4 sm:-mx-6 sm:px-6">
      <div className="min-w-0 space-y-4">
        <div className="sticky top-0 z-20 -mx-5 -mt-4 border-b border-white/[0.08] bg-[var(--panel)]/95 px-5 pb-3 pt-4 shadow-[0_14px_30px_rgba(0,0,0,0.22)] backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <ProjectLoadingBlock className="h-5 w-24 rounded bg-white/10" />
            <ProjectLoadingActionBar
              buttonWidths={["w-16", "w-16", "w-20"]}
              className="gap-1.5"
              itemClassName="h-7 rounded-lg"
            />
          </div>
          <ProjectLoadingBlock className="mt-3 h-8 w-72 max-w-full rounded-lg bg-white/10" />
        </div>

        <div className="space-y-4">
          <ProjectLoadingBlock className="h-36 rounded-xl border border-white/10 bg-white/[0.03]" />
          <ProjectLoadingBlock className="h-72 rounded-xl border border-white/10 bg-white/[0.03]" />
          <ProjectLoadingBlock className="h-40 rounded-xl border border-white/10 bg-white/[0.03]" />
        </div>
      </div>
    </div>
  );
}
