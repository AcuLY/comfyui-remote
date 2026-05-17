import s from "./loading.shell.module.css";

export default function Loading() {
  return (
    <div className={s.shell}>
      <div className={s.routeLoading}>
        <section className={s.routeLoadingPanel} aria-label="页面载入中" aria-busy="true">
          <aside className={s.routeLoadingSidebar} aria-hidden="true">
            <span className={s.brandMark} />
            {Array.from({ length: 6 }).map((_, index) => (
              <span className={s.loadingNavItem} key={index} />
            ))}
          </aside>
          <main className={s.routeLoadingWorkspace}>
            <header className={s.routeLoadingHeader}>
              <div>
                <span className={s.skeletonLineShort} />
                <strong>正在载入工作台</strong>
              </div>
              <div className={s.loadingHeaderActions} aria-hidden="true">
                <span />
                <span />
              </div>
            </header>
            <div className={s.routeLoadingGrid} aria-hidden="true">
              <span className={s.loadingCardLarge} />
              <span className={s.loadingCard} />
              <span className={s.loadingCard} />
              <span className={s.loadingCardWide} />
            </div>
          </main>
        </section>
      </div>
    </div>
  );
}
