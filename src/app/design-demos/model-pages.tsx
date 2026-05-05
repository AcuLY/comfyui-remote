"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Database, FileText, FolderTree, Save, Search, Upload, X } from "lucide-react";

import type { DemoAsset, DemoData } from "./design-demo-data";
import s from "./design-demo.module.css";
import { Button, ButtonLink, Field, PageHeader, Panel, StatusBadge, TextAreaField } from "./design-demo-ui";
import { assetKind, assetPath, cx, entriesForPath, folderEntriesForAssets, parentPath, pathParts } from "./design-demo-utils";
import type { ModelBrowserState, ModelKind } from "./design-demo-utils";
function ModelDirectoryState({
  state,
  onReset,
}: {
  state: Exclude<ModelBrowserState, "ready">;
  onReset: () => void;
}) {
  const copy = {
    loading: {
      title: "正在读取目录",
      detail: "扫描当前路径、合并备注和触发词信息。",
      action: "完成读取",
    },
    error: {
      title: "目录不可访问",
      detail: "路径不存在或权限不足，请返回上级目录后重新扫描。",
      action: "返回目录",
    },
    empty: {
      title: "空目录",
      detail: "这里还没有模型文件，可以直接上传到当前目录。",
      action: "返回目录",
    },
  }[state];

  return (
    <div className={cx(s.modelState, s[`modelState_${state}`])}>
      <div className={s.modelStateIcon}>
        {state === "loading" ? <RefreshIcon /> : state === "error" ? <X className="size-4" /> : <FolderTree className="size-4" />}
      </div>
      <div className={s.modelStateText}>
        <strong>{copy.title}</strong>
        <span>{copy.detail}</span>
      </div>
      <Button tone="subtle" onClick={onReset}>{copy.action}</Button>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 7v5h-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M4 17a8 8 0 0 0 13.4 2.9L20 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M20 7A8 8 0 0 0 6.6 4.1L4 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function ModelMoveTargetSheet({
  assets,
  selectedPath,
  fileName,
  onCancel,
  onConfirm,
  onSelect,
}: {
  assets: DemoAsset[];
  selectedPath: string;
  fileName: string;
  onCancel: () => void;
  onConfirm: () => void;
  onSelect: (path: string) => void;
}) {
  const targetFolders = folderEntriesForAssets(assets);
  const childFolders = entriesForPath(assets, selectedPath).folders;
  const targetParts = pathParts(selectedPath);

  return (
    <div className={s.modelMoveBackdrop} role="presentation" onClick={onCancel}>
      <section className={s.modelMoveSheet} role="dialog" aria-modal="true" aria-label="选择移动目标" onClick={(event) => event.stopPropagation()}>
        <header className={s.modelMoveHeader}>
          <div>
            <span>移动文件</span>
            <h2>{fileName}</h2>
          </div>
          <button className={s.iconButton} type="button" onClick={onCancel} aria-label="关闭">
            <X className="size-4" />
          </button>
        </header>
        <div className={s.modelMoveBreadcrumbs}>
          <button type="button" onClick={() => onSelect("")}>根目录</button>
          {targetParts.map((part, index) => {
            const path = targetParts.slice(0, index + 1).join("/");
            return (
              <button type="button" key={path} onClick={() => onSelect(path)}>
                {part}
              </button>
            );
          })}
        </div>
        <div className={s.modelMoveBody}>
          <div className={s.modelMoveColumn}>
            <span className={s.modelMoveLabel}>常用目录</span>
            {targetFolders.slice(0, 10).map((folder) => (
              <button
                className={cx(s.modelTargetRow, selectedPath === folder.path && s.modelTargetRowActive)}
                type="button"
                key={folder.path || "root"}
                onClick={() => onSelect(folder.path)}
              >
                <FolderTree className="size-4" />
                <strong style={{ paddingLeft: `${folder.depth * 8}px` }}>{folder.name}</strong>
                <span>{folder.count} 个文件</span>
              </button>
            ))}
          </div>
          <div className={s.modelMoveColumn}>
            <span className={s.modelMoveLabel}>当前目录下级</span>
            {selectedPath ? (
              <button className={s.modelTargetRow} type="button" onClick={() => onSelect(parentPath(selectedPath))}>
                <ArrowLeft className="size-4" />
                <strong>返回上级</strong>
                <span>{parentPath(selectedPath) || "根目录"}</span>
              </button>
            ) : null}
            {childFolders.length ? childFolders.map((folder) => (
              <button className={s.modelTargetRow} type="button" key={folder.path} onClick={() => onSelect(folder.path)}>
                <FolderTree className="size-4" />
                <strong>{folder.name}</strong>
                <span>{folder.count} 个文件</span>
              </button>
            )) : (
              <div className={s.modelMoveEmpty}>没有子文件夹</div>
            )}
          </div>
        </div>
        <footer className={s.modelMoveFooter}>
          <span>目标：{selectedPath || "根目录"}</span>
          <Button tone="primary" icon={FolderTree} onClick={onConfirm} feedback={{ title: "文件移动已排队", detail: selectedPath || "根目录" }}>移动到这里</Button>
        </footer>
      </section>
    </div>
  );
}

export function ModelsPage({ data }: { data: DemoData }) {
  const [kind, setKind] = useState<ModelKind>("lora");
  const [currentPath, setCurrentPath] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [browserState, setBrowserState] = useState<ModelBrowserState>("ready");
  const [movingAssetId, setMovingAssetId] = useState<string | null>(null);
  const [moveTargetPath, setMoveTargetPath] = useState("");
  const assets = data.models.filter((asset) => assetKind(asset) === kind);
  const { folders, files } = entriesForPath(assets, currentPath);
  const visibleFolders = browserState === "ready" ? folders : [];
  const visibleFiles = browserState === "ready" ? files : [];
  const selectedAsset = browserState === "ready" ? (assets.find((asset) => asset.id === selectedAssetId) ?? visibleFiles[0] ?? assets[0]) : null;
  const movingAsset = assets.find((asset) => asset.id === movingAssetId) ?? null;
  const breadcrumbParts = pathParts(currentPath);

  function switchKind(nextKind: ModelKind) {
    setKind(nextKind);
    setCurrentPath("");
    setSelectedAssetId(null);
    setBrowserState("ready");
    setMovingAssetId(null);
  }

  function openPath(path: string) {
    setCurrentPath(path);
    setSelectedAssetId(null);
    setBrowserState("ready");
  }

  function showLoadingState() {
    setBrowserState("loading");
    window.setTimeout(() => setBrowserState("ready"), 520);
  }

  function openMoveTarget(asset: DemoAsset) {
    setSelectedAssetId(asset.id);
    setMoveTargetPath(parentPath(assetPath(asset)) || currentPath);
    setMovingAssetId(asset.id);
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="模型"
        title="模型文件管理"
        subtitle="LoRA 和 checkpoint 统一在这里按文件夹浏览、上传、移动和维护备注。"
        actions={<Button icon={Search} onClick={showLoadingState} feedback={{ title: "目录扫描已开始", detail: data.source.modelBaseLabel }}>扫描目录</Button>}
      />
      <div className={s.modelManagerLayout}>
        <aside className={s.modelSidebar}>
          <div className={s.segmented}>
            <button
              className={cx(s.segment, kind === "lora" && s.segmentActive)}
              type="button"
              onClick={() => switchKind("lora")}
            >
              LoRA
            </button>
            <button
              className={cx(s.segment, kind === "checkpoint" && s.segmentActive)}
              type="button"
              onClick={() => switchKind("checkpoint")}
            >
              Checkpoint
            </button>
          </div>
          <div className={s.modelRootCard}>
            <span>根目录</span>
            <strong>{data.source.modelBaseLabel}</strong>
            <em>{assets.length} 个文件</em>
          </div>
          <div className={s.modelUploadBox}>
            <Upload className="size-4" />
            <strong>上传到当前目录</strong>
            <span>{currentPath || "根目录"}</span>
          </div>
        </aside>
        <section className={s.modelBrowserPanel}>
          <div className={s.modelBrowserHeader}>
            <div className={s.breadcrumbsLine}>
              <button type="button" onClick={() => openPath("")}>根目录</button>
              {breadcrumbParts.map((part, index) => {
                const pathValue = breadcrumbParts.slice(0, index + 1).join("/");
                return (
                  <button type="button" key={pathValue} onClick={() => openPath(pathValue)}>
                    {part}
                  </button>
                );
              })}
            </div>
            <div className={s.inlineControls}>
              <Button icon={FolderTree} onClick={() => {
                openPath(currentPath ? `${currentPath}/新建文件夹` : "新建文件夹");
                setBrowserState("empty");
              }} feedback={{ title: "文件夹草稿已创建", detail: currentPath || "根目录" }}>新建文件夹</Button>
              <Button tone="subtle" onClick={() => setBrowserState("error")} feedback={{ tone: "warning", title: "路径检查返回异常状态" }}>路径检查</Button>
              <Button tone="primary" icon={Upload} feedback={{ title: "上传面板已准备", detail: currentPath || "根目录" }}>上传</Button>
            </div>
          </div>
          <div className={s.fileBrowser}>
            {browserState !== "ready" ? (
              <ModelDirectoryState state={browserState} onReset={() => setBrowserState("ready")} />
            ) : (
              <>
                {currentPath ? (
                  <button className={s.folderRow} type="button" onClick={() => openPath(parentPath(currentPath))}>
                    <ArrowLeft className="size-4" />
                    <strong>返回上级</strong>
                    <span>{parentPath(currentPath) || "根目录"}</span>
                  </button>
                ) : null}
                {visibleFolders.map((folder) => (
                  <button className={s.folderRow} type="button" key={folder.path} onClick={() => openPath(folder.path)}>
                    <FolderTree className="size-4" />
                    <strong>{folder.name}</strong>
                    <span>{folder.count} 个文件</span>
                  </button>
                ))}
                {visibleFiles.map((asset) => (
                  <div
                    className={cx(s.fileRow, selectedAsset?.id === asset.id && s.fileRowActive)}
                    role="button"
                    tabIndex={0}
                    key={asset.id}
                    onClick={() => setSelectedAssetId(asset.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedAssetId(asset.id);
                      }
                    }}
                  >
                    <FileText className="size-4" />
                    <strong>{asset.name || asset.fileName}</strong>
                    <span>{assetPath(asset)}</span>
                    <em>{asset.sizeLabel}</em>
                    <button
                      className={s.fileRowAction}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openMoveTarget(asset);
                      }}
                    >
                      移动
                      <ArrowRight className="size-3" />
                    </button>
                  </div>
                ))}
              </>
            )}
            {browserState === "ready" && visibleFolders.length === 0 && visibleFiles.length === 0 ? (
              <div className={s.empty}>当前目录没有模型文件</div>
            ) : null}
          </div>
        </section>
        <aside className={s.modelInspector}>
          <div className={s.panelHeader}>
            <div>
              <h2>文件信息</h2>
              <p>{selectedAsset ? assetPath(selectedAsset) : "未选择文件"}</p>
            </div>
          </div>
          <div className={s.panelBody}>
            {selectedAsset ? (
              <div className={s.grid}>
                <Field label="文件名" value={selectedAsset.fileName} />
                <Field label="类型" value={assetKind(selectedAsset)} />
                <TextAreaField label="备注" value={selectedAsset.notes || "用途、来源、推荐权重和维护记录。"} />
                {assetKind(selectedAsset) === "lora" ? (
                  <Field label="触发词" value={selectedAsset.triggerWords || "trigger words"} />
                ) : null}
                <div className={s.modelPathSummary}>
                  <span>当前位置</span>
                  <strong>{currentPath || "根目录"}</strong>
                </div>
                <div className={s.toolbar}>
                  <Button icon={Save} feedback={{ title: "文件备注已保存", detail: selectedAsset.fileName }}>保存</Button>
                  <Button icon={FolderTree} onClick={() => openMoveTarget(selectedAsset)} feedback={{ title: "选择移动目标", detail: selectedAsset.fileName }}>移动</Button>
                </div>
              </div>
            ) : (
              <div className={s.empty}>选择一个模型文件查看详情</div>
            )}
          </div>
        </aside>
      </div>
      {movingAsset ? (
        <ModelMoveTargetSheet
          assets={assets}
          selectedPath={moveTargetPath}
          fileName={movingAsset.fileName}
          onCancel={() => setMovingAssetId(null)}
          onConfirm={() => {
            setCurrentPath(moveTargetPath);
            setMovingAssetId(null);
            setBrowserState("ready");
          }}
          onSelect={setMoveTargetPath}
        />
      ) : null}
    </div>
  );
}

export function LorasPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="LoRA"
        title="LoRA 文件"
        subtitle="LoRA 已并入模型文件管理，旧入口会进入统一文件页。"
        actions={<ButtonLink href="/models" tone="primary" icon={Database}>进入模型文件</ButtonLink>}
      />
      <Panel title="统一入口">
        <div className={s.grid}>
          <div className={s.switchRow}>
            <div className={s.switchText}>
              <strong>LoRA</strong>
              <span>{data.loras.length} 个文件会在模型文件页的 LoRA 类型下展示。</span>
            </div>
            <StatusBadge status="ready" label="已合并" />
          </div>
        </div>
      </Panel>
    </div>
  );
}
