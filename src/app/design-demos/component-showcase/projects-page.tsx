"use client";

import { useMemo } from "react";
import { Check, CheckSquare, ChevronRight, Copy, Folder, FolderInput, GripVertical, Pencil, Play, Square, Star, Trash2, X } from "lucide-react";

import type { DemoData } from "../design-demo-data";
import type { DemoProject } from "../data/types";
import { ProjectDetailHeader } from "../projects/project-detail-header";
import s from "../styles/showcase.module.css";
import { Button } from "../ui/button";
import { ImageListSmall } from "../ui/image-list-small";
import { PageHeader } from "../ui/page-header";
import { StatusBadge } from "../ui/status-badge";
import showcaseCss from "./component-showcase.module.css";
import { makeImages } from "./helpers";
import { ShowcaseItem } from "./showcase-item";

export function ComponentShowcaseProjects({ data: _data }: { data: DemoData }) {
  void _data;
  const images = useMemo(() => makeImages(6), []);

  return (
    <div className={s.showcasePage}>
      <PageHeader back={{ href: "/component-showcase", label: "返回总览" }} eyebrow="组件展示" title="项目卡片和列表" subtitle="项目列表页和详情页中的卡片、行和导航组件" />

      {/* ProjectDetailHeader 模拟 */}
      <ShowcaseItem name="ProjectDetailHeader" desc="项目详情页头部（返回 + 标题 + 视图切换 + 命令栏 + 运行控制）">
        <ProjectDetailHeader
          isResultView={false}
          project={MOCK_PROJECT}
          subtitle="12 个小节 · 3 个预制"
          view="sections"
        />
      </ShowcaseItem>

      {/* ProjectListItem 模拟 */}
      <ShowcaseItem name="ProjectListItem" desc="项目卡片（选中框 + 缩略图条 + 标题/状态 + 统计 + 操作）">
        <div className={`${s.projectFolderWorkspace} ${s.showcaseProjectListPreview} ${showcaseCss.previewWide}`}>
          <div className={s.projectListGrid}>
            <article className={`${s.projectListCard} ${s.projectListCardSelected}`}>
              <Button className={s.projectSelectButton} icon={CheckSquare} iconOnly pressed ariaLabel="取消选择" />
              <div className={s.projectListOpenArea}>
                <ImageListSmall images={images} />
                <div className={s.cardHeader}>
                  <div className={s.projectCardTitle}>
                    <strong>夏日人像合集</strong>
                    <span>3 个预制</span>
                  </div>
                  <StatusBadge status="running" label="运行中" />
                </div>
                <div className={s.projectCardStats}>
                  <StatusBadge status="sections" label="12 小节" />
                  <StatusBadge status="checkpoint" label="dreamshaper_v8" />
                </div>
                <div className={`${s.small} ${s.faint}`}>更新：2026-05-09</div>
              </div>
              <div className={s.projectItemActions}>
                <Button tone="subtle" icon={FolderInput} iconOnly ariaLabel="移动" />
                <Button tone="danger" icon={Trash2} iconOnly ariaLabel="删除" />
              </div>
            </article>
            <article className={s.projectListCard}>
              <Button className={s.projectSelectButton} icon={Square} iconOnly ariaLabel="选择项目" />
              <div className={s.projectListOpenArea}>
                <ImageListSmall images={images.slice(0, 3)} />
                <div className={s.cardHeader}>
                  <div className={s.projectCardTitle}>
                    <strong>风景写意</strong>
                    <span>1 个预制</span>
                  </div>
                  <StatusBadge status="done" label="完成" />
                </div>
                <div className={s.projectCardStats}>
                  <StatusBadge status="sections" label="6 小节" />
                  <StatusBadge status="checkpoint" label="sdxl_base_1.0" />
                </div>
                <div className={`${s.small} ${s.faint}`}>更新：2026-05-08</div>
              </div>
              <div className={s.projectItemActions}>
                <Button tone="subtle" icon={FolderInput} iconOnly ariaLabel="移动" />
                <Button tone="danger" icon={Trash2} iconOnly ariaLabel="删除" />
              </div>
            </article>
          </div>
        </div>
      </ShowcaseItem>

      {/* ProjectFolderRow 模拟 */}
      <ShowcaseItem name="ProjectFolderRow" desc="文件夹行（拖拽手柄 + 名称 + 条目数 + 操作）">
        <div className={showcaseCss.previewMedium}>
          <div className={s.projectFolderRow}>
            <Button className={s.projectFolderGrip} tone="subtle" icon={GripVertical} iconOnly ariaLabel="排序手柄" />
            <button className={s.projectFolderOpen} type="button">
              <Folder className={s.icon} />
              <strong>人物</strong>
              <span>8 项</span>
              <ChevronRight className={s.icon} />
            </button>
            <div className={s.projectFolderRowActions}>
              <Button tone="subtle" icon={Pencil} iconOnly ariaLabel="重命名" />
              <Button tone="danger" icon={Trash2} iconOnly ariaLabel="删除" />
            </div>
          </div>
          <div className={s.projectFolderRow}>
            <Button className={s.projectFolderGrip} tone="subtle" icon={GripVertical} iconOnly ariaLabel="排序手柄" />
            <button className={s.projectFolderOpen} type="button">
              <Folder className={s.icon} />
              <strong>风景</strong>
              <span>3 项</span>
              <ChevronRight className={s.icon} />
            </button>
            <div className={s.projectFolderRowActions}>
              <Button tone="subtle" icon={Pencil} iconOnly ariaLabel="重命名" />
            </div>
          </div>
        </div>
      </ShowcaseItem>

      {/* ProjectFolderBreadcrumb 模拟 */}
      <ShowcaseItem name="ProjectFolderBreadcrumb" desc="文件夹面包屑导航">
        <div className={s.projectFolderBreadcrumbs}>
          <Button tone="subtle">根目录</Button>
          <span><ChevronRight className={s.icon} /><Button tone="subtle">人物</Button></span>
          <span><ChevronRight className={s.icon} /><Button tone="subtle" disabled>写实</Button></span>
        </div>
      </ShowcaseItem>

      {/* ProjectBatchBar 模拟 */}
      <ShowcaseItem name="ProjectBatchBar" desc="批量操作栏">
        <div className={showcaseCss.previewMedium}>
          <div className={s.projectBatchBar}>
            <strong>已选 3 个项目</strong>
            <div>
              <Button tone="subtle" icon={FolderInput}>移至文件夹</Button>
              <Button icon={CheckSquare}>全选</Button>
              <Button tone="subtle" icon={X} iconOnly ariaLabel="清除选择" />
            </div>
          </div>
        </div>
      </ShowcaseItem>

      {/* ProjectSectionCard 模拟 */}
      <ShowcaseItem name="ProjectSectionCard" desc="小节卡片（拖拽手柄 + 选中 + 标题 + 缩略图 + 运行/复制/删除）">
        <div className={showcaseCss.previewMedium}>
          <article className={s.sectionCard}>
            <Button className={s.dragHandle} tone="subtle" icon={GripVertical} iconOnly ariaLabel="排序手柄" />
            <Button className={s.sectionSelectButton} icon={Square} iconOnly ariaLabel="选择" />
            <div className={s.sectionCardMain}>
              <div className={s.sectionCardHeader}>
                <div className={s.sectionCardTitle}>
                  <div className={s.sectionCardTitleLine}>
                    <span>01</span>
                    <strong>肖像 - 女性角色</strong>
                  </div>
                </div>
              </div>
              <div className={s.sectionCardBody}>
                <ImageListSmall images={images.slice(0, 3)} />
                <div className={s.projectCardStats}>
                  <StatusBadge status="ratio" label="2:3" />
                  <StatusBadge status="steps" label="20 步" />
                  <StatusBadge status="lora" label="2 LoRA" />
                </div>
              </div>
              <div className={s.sectionCardActions}>
                <Button tone="primary" icon={Play}>运行</Button>
                <Button tone="subtle" icon={Copy}>复制</Button>
                <Button tone="danger" icon={Trash2}>删除</Button>
              </div>
            </div>
          </article>
        </div>
      </ShowcaseItem>

      {/* ProjectSectionResultCard 模拟 */}
      <ShowcaseItem name="ProjectSectionResultCard" desc="小节结果卡片（标题 + 状态标签 + 操作栏 + 图片列表）">
        <div className={showcaseCss.previewMedium}>
          <section className={s.resultSectionBlock}>
            <div className={s.resultSectionHeader}>
              <div className={s.resultSectionTitle}>
                <div className={s.sectionCardTitleLine}>
                  <span>01</span>
                  <strong>肖像 - 女性角色</strong>
                </div>
              </div>
              <div className={s.resultSectionActions}>
                <StatusBadge status="pending" label="4 待审" />
                <StatusBadge status="kept" label="6 保留" />
                <StatusBadge status="review" label="2 p站/预览" />
              </div>
            </div>
            <div className={s.resultActionBar}>
              <Button tone="subtle" icon={Square}>选择本节</Button>
              <Button icon={Check}>保留</Button>
              <Button tone="pink" icon={Star}>p站</Button>
            </div>
          </section>
        </div>
      </ShowcaseItem>

      {/* ProjectMoveMenu 模拟 */}
      <ShowcaseItem name="ProjectMoveMenu" desc="移动到文件夹下拉菜单">
        <div className={showcaseCss.previewNarrow}>
          <div className={s.projectMoveMenu}>
            <Button tone="subtle" icon={FolderInput}>移动</Button>
          </div>
        </div>
        <div className={showcaseCss.sectionNoteSmall}>
          完整交互请查看项目列表页面（/design-demos/projects）
        </div>
      </ShowcaseItem>
    </div>
  );
}

const MOCK_PROJECT: DemoProject = {
  id: "p1",
  title: "夏日人像合集",
  slug: "summer-portrait",
  folderId: null,
  status: "active",
  updatedAt: "2026-05-09",
  notes: "夏日人像主题合集",
  checkpointName: "dreamshaper_v8.safetensors",
  presetNames: ["写实人像", "风格化"],
  sectionCount: 12,
  sections: [],
  images: [],
};
