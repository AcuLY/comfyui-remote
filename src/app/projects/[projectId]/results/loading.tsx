import {
  ProjectLoadingBlock,
  ProjectLoadingGrid,
  ProjectLoadingSidebar,
} from "../../project-loading-skeletons";

export default function Loading() {
  return (
    <div className="-mx-5 min-h-[calc(100dvh-5rem)] w-[calc(100%+2.5rem)] sm:-mx-6 sm:w-[calc(100%+3rem)]">
      <div className="flex h-full">
        <ProjectLoadingSidebar />
        <main className="flex-1 px-4 py-4 sm:px-6">
          <ProjectLoadingBlock className="mb-4 h-12 w-full rounded-xl" />
          <ProjectLoadingGrid
            count={12}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
            itemClassName="h-44 rounded-xl"
          />
        </main>
      </div>
    </div>
  );
}
