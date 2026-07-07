import {
  ProjectLoadingActionBar,
  ProjectLoadingBlock,
} from "../project-loading-skeletons";

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2 border-b border-white/[0.06] bg-[var(--bg)]/80 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex-1" />
        <ProjectLoadingActionBar
          buttonWidths={["w-20", "w-20", "w-20"]}
          itemClassName="h-9"
        />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProjectLoadingBlock
            key={i}
            className="h-32 rounded-2xl border border-white/10 bg-white/[0.03]"
          />
        ))}
      </div>
    </div>
  );
}
