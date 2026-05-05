"use client";

import { useState } from "react";
import { Archive, Check, ChevronDown, ChevronUp, Eye, SlidersHorizontal, Square, Star, Trash2 } from "lucide-react";

import type { DemoProject, DemoSection } from "./design-demo-data";
import s from "./design-demo.module.css";
import { Button, ButtonLink, DemoTabs, EmptyPage, ImageGrid, PageHeader } from "./design-demo-ui";
import { filterImages, rawSectionId, resultRunGroups, sectionAnchorId } from "./design-demo-utils";
import type { ResultDemoFilter } from "./design-demo-utils";
import { ProjectSectionShell } from "./project-pages";
export function SectionResultsPage({ project, section }: { project: DemoProject | undefined; section: DemoSection | undefined }) {
  const [filter, setFilter] = useState<ResultDemoFilter>("all");
  const [collapsedRuns, setCollapsedRuns] = useState<Set<string>>(new Set());
  if (!project || !section) return <EmptyPage title="没有小节结果" />;
  const images = filterImages(section.images, filter);
  const groups = resultRunGroups(images);

  function toggleRun(runId: string) {
    setCollapsedRuns((current) => {
      const next = new Set(current);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/projects/${project.id}`, label: "返回项目" }}
        eyebrow="小节结果"
        title={`${section.name} / 结果`}
        subtitle="按 run 分组管理图片、lightbox 查看、p站/预览标记和审核状态。"
        actions={<ButtonLink href={`/projects/${project.id}/sections/${rawSectionId(section)}`} icon={SlidersHorizontal}>编辑小节</ButtonLink>}
      />
      <ProjectSectionShell project={project} activeSection={section} mode="section-results">
        <div className={s.sectionStack} data-section-card={section.id} id={sectionAnchorId(section)}>
          <DemoTabs
            tabs={[
              { key: "all", label: "全部", count: section.images.length },
              { key: "pending", label: "待审", count: section.images.filter((image) => image.status === "pending").length },
              { key: "kept", label: "已保留", count: section.images.filter((image) => image.status === "kept").length },
              { key: "pstation", label: "p站", count: section.images.filter((image) => image.featured).length },
              { key: "preview", label: "预览", count: section.images.filter((image) => image.featured2).length },
              { key: "cover", label: "封面", count: section.images.filter((image) => image.cover).length },
            ]}
            value={filter}
            onChange={setFilter}
          />
          {groups.map((group) => (
            <RunResultBlock
              collapsed={collapsedRuns.has(group.id)}
              group={group}
              key={group.id}
              onToggle={() => toggleRun(group.id)}
              totalCount={images.length}
            />
          ))}
        </div>
      </ProjectSectionShell>
    </div>
  );
}

function RunResultBlock({
  collapsed,
  group,
  onToggle,
  totalCount,
}: {
  collapsed: boolean;
  group: ReturnType<typeof resultRunGroups>[number];
  onToggle: () => void;
  totalCount: number;
}) {
  const visibleImages = collapsed ? group.images.slice(0, 4) : group.images;

  return (
    <section className={s.resultSectionBlock}>
      <div className={s.resultSectionHeader}>
        <div className={s.resultSectionTitle}>
          <strong>{group.title}</strong>
          <span>{group.meta} · {group.images.length} / {totalCount} 张</span>
        </div>
        <div className={s.resultSectionActions}>
          <Button tone="subtle" icon={collapsed ? ChevronDown : ChevronUp} onClick={onToggle}>
            {collapsed ? "展开" : "折叠"}
          </Button>
        </div>
      </div>
      <div className={s.resultActionBar}>
        <Button tone="subtle" icon={Square}>选择本轮</Button>
        <Button icon={Check} feedback={{ title: "本轮图片已加入保留队列" }}>保留</Button>
        <Button tone="pink" icon={Star} feedback={{ title: "本轮图片已加入 p站 标记队列" }}>p站</Button>
        <Button tone="pink" icon={Eye} feedback={{ title: "本轮图片已加入预览标记队列" }}>预览</Button>
        <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "本轮图片已加入删除队列" }}>删除</Button>
        <Button tone="subtle" icon={Archive} feedback={{ tone: "info", title: "最近结果操作已撤销" }}>撤销</Button>
      </div>
      <ImageGrid images={visibleImages} />
    </section>
  );
}
