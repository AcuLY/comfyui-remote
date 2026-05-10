import s from "../design-demo.module.css";

export default function Loading() {
  return (
    <div className={`${s.shell} ${s.shellLight}`}>
      <div className={s.routeLoading}>
        <section className={s.routeLoadingPanel} aria-label="页面载入中">
          <div className={s.routeLoadingHeader}>
            <span className={s.brandMark} />
            <span>正在载入工作台</span>
          </div>
          <div className={s.routeLoadingGrid}>
            <span className={s.skeletonLine} />
            <span className={s.skeletonLine} />
            <span className={`${s.skeletonLine} ${s.skeletonLineShort}`} />
          </div>
        </section>
      </div>
    </div>
  );
}
