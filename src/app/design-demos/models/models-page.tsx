'use client';

import { useState } from 'react';
import {
  Upload, FolderOpen, File, ChevronRight, Search,
  MoreVertical, Edit2, Trash2, Move, X, Check,
  Folder, ArrowLeft, Plus
} from 'lucide-react';
import { Button } from "../ui/button";
import { SegmentedControl } from "../ui/segmented-control";
import { StatusBadge } from "../ui/status-badge";
import styles from './models-page.models.module.css';
import { modelFiles } from "./model-fixtures";
import type { BreadcrumbItem, FileItem } from "./model-types";

export function ModelsPage() {
  const [activeTab, setActiveTab] = useState<'lora' | 'checkpoint'>('lora');
  const [currentPath, setCurrentPath] = useState<string[]>(['models']);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);

  const files = modelFiles;

  const breadcrumbs: BreadcrumbItem[] = currentPath.map((segment, index) => ({
    label: segment,
    path: currentPath.slice(0, index + 1).join('/')
  }));

  const handleFileSelect = (file: FileItem) => {
    if (file.type === 'folder') {
      setCurrentPath([...currentPath, file.name]);
      setSelectedFile(null);
    } else {
      setSelectedFile(file);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
    setSelectedFile(null);
  };

  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => setIsUploading(false), 2000);
  };

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <header className={styles.pageHeader}>
        <div className={styles.pageTitleBlock}>
          <span className={styles.eyebrow}>模型</span>
          <h1 className={styles.pageTitle}>模型文件管理</h1>
          <div className={styles.pageSubtitle}>
            LoRA 和 checkpoint 统一在这里按文件夹浏览、上传、移动和维护备注。
          </div>
        </div>

        <div className={styles.toolbar}>
          <Button
            icon={Upload}
            onClick={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? '上传中...' : '上传文件'}
          </Button>

          <Button icon={Plus}>
            新建文件夹
          </Button>

          <Button icon={Search}>
            扫描目录
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className={styles.modelsLayout}>
        <ModelFileBrowser
          activeTab={activeTab}
          breadcrumbs={breadcrumbs}
          currentPath={currentPath}
          files={files}
          onBack={() => {
            setCurrentPath(currentPath.slice(0, -1));
            setSelectedFile(null);
          }}
          onBreadcrumbClick={handleBreadcrumbClick}
          onFileAction={() => setShowMoveDialog(true)}
          onFileSelect={handleFileSelect}
          onSearchChange={setSearchQuery}
          onTabChange={setActiveTab}
          onUpload={handleUpload}
          searchQuery={searchQuery}
          selectedFileId={selectedFile?.id ?? null}
        />

        {selectedFile ? (
          <ModelFileInspector
            editingNotes={editingNotes}
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
            onMove={() => setShowMoveDialog(true)}
            onToggleEditingNotes={() => setEditingNotes(!editingNotes)}
          />
        ) : null}
      </div>

      {/* Move Dialog */}
      {showMoveDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowMoveDialog(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h3 className={styles.dialogTitle}>移动文件</h3>
              <Button
                className={styles.iconButton}
                icon={X}
                iconOnly
                onClick={() => setShowMoveDialog(false)}
                ariaLabel="关闭移动文件对话框"
                tone="subtle"
              />
            </div>
            <div className={styles.dialogContent}>
              <p className={styles.dialogDescription}>
                选择目标文件夹
              </p>
              {/* Folder tree would go here */}
              <div className={styles.folderTree}>
                <div className={styles.folderTreeItem}>
                  <Folder className={styles.iconMd} />
                  <span>models</span>
                </div>
                <div className={`${styles.folderTreeItem} ${styles.folderTreeItemNested}`}>
                  <Folder className={styles.iconMd} />
                  <span>character</span>
                </div>
                <div className={`${styles.folderTreeItem} ${styles.folderTreeItemNested}`}>
                  <Folder className={styles.iconMd} />
                  <span>nsfw</span>
                </div>
              </div>
            </div>
            <div className={styles.dialogFooter}>
              <Button tone="subtle" onClick={() => setShowMoveDialog(false)}>
                取消
              </Button>
              <Button tone="primary" onClick={() => setShowMoveDialog(false)}>
                移动
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ModelFileBrowser({
  activeTab,
  breadcrumbs,
  currentPath,
  files,
  onBack,
  onBreadcrumbClick,
  onFileAction,
  onFileSelect,
  onSearchChange,
  onTabChange,
  onUpload,
  searchQuery,
  selectedFileId,
}: {
  activeTab: "lora" | "checkpoint";
  breadcrumbs: BreadcrumbItem[];
  currentPath: string[];
  files: FileItem[];
  onBack: () => void;
  onBreadcrumbClick: (index: number) => void;
  onFileAction?: (file: FileItem) => void;
  onFileSelect: (file: FileItem) => void;
  onSearchChange: (value: string) => void;
  onTabChange: (value: "lora" | "checkpoint") => void;
  onUpload?: () => void;
  searchQuery: string;
  selectedFileId: string | null;
}) {
  const visibleFiles = files
    .filter((file) => file.modelType === activeTab)
    .filter((file) => file.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className={styles.modelsBrowser}>
      <SegmentedControl
        ariaLabel="模型类型"
        items={[
          { value: "lora", label: "LoRA" },
          { value: "checkpoint", label: "Checkpoint" },
        ]}
        onChange={onTabChange}
        role="tablist"
        value={activeTab}
      />
      <div className={styles.breadcrumb}>
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className={styles.breadcrumbItem}>
            {index > 0 ? <ChevronRight className={`${styles.iconXs} ${styles.iconSubtle}`} /> : null}
            <button
              type="button"
              onClick={() => onBreadcrumbClick(index)}
              className={index === breadcrumbs.length - 1 ? styles.breadcrumbActive : ""}
            >
              {crumb.label}
            </button>
          </div>
        ))}
      </div>
      <div className={styles.searchBar}>
        <Search className={`${styles.iconMd} ${styles.iconSubtle}`} />
        <input
          type="text"
          placeholder="搜索文件..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className={styles.searchInput}
        />
        {searchQuery ? (
          <Button
            icon={X}
            iconOnly
            onClick={() => onSearchChange("")}
            className={styles.searchClear}
            ariaLabel="清除搜索"
            tone="subtle"
          />
        ) : null}
      </div>
      <div className={styles.fileList}>
        {currentPath.length > 1 ? (
          <button type="button" className={styles.fileRow} onClick={onBack}>
            <ArrowLeft className={`${styles.iconMd} ${styles.iconMuted}`} />
            <span className={styles.fileName}>返回上级</span>
          </button>
        ) : null}
        {visibleFiles.map((file) => (
          <ModelFileRow
            file={file}
            key={file.id}
            onAction={onFileAction}
            onSelect={onFileSelect}
            selected={selectedFileId === file.id}
          />
        ))}
      </div>
      {files.filter((file) => file.modelType === activeTab).length === 0 ? (
        <div className={styles.emptyState}>
          <FolderOpen className={`${styles.icon2xl} ${styles.iconFaint}`} />
          <p>当前目录为空</p>
          <Button icon={Upload} onClick={onUpload}>
            上传文件
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ModelFileRow({
  file,
  onAction,
  onSelect,
  selected,
}: {
  file: FileItem;
  onAction?: (file: FileItem) => void;
  onSelect?: (file: FileItem) => void;
  selected?: boolean;
}) {
  return (
    <div
      className={`${styles.fileRow} ${selected ? styles.fileRowActive : ""}`}
      onClick={() => onSelect?.(file)}
    >
      <div className={styles.fileIcon}>
        {file.type === "folder" ? <Folder className={styles.iconMd} /> : <File className={styles.iconMd} />}
      </div>
      <div className={styles.fileInfo}>
        <div className={styles.fileName}>{file.name}</div>
        {file.size ? <div className={styles.fileSize}>{file.size}</div> : null}
      </div>
      {file.type === "folder" ? <ChevronRight className={`${styles.iconMd} ${styles.iconSubtle}`} /> : null}
      {file.type === "file" ? (
        <Button
          className={styles.fileAction}
          icon={MoreVertical}
          iconOnly
          onClick={(event) => {
            event.stopPropagation();
            onAction?.(file);
          }}
          ariaLabel="文件操作"
          tone="subtle"
        />
      ) : null}
    </div>
  );
}

export function ModelFileInspector({
  editingNotes,
  file,
  onClose,
  onMove,
  onToggleEditingNotes,
}: {
  editingNotes: boolean;
  file: FileItem;
  onClose?: () => void;
  onMove?: () => void;
  onToggleEditingNotes?: () => void;
}) {
  return (
    <div className={styles.detailsPanel}>
      <div className={styles.detailsHeader}>
        <h3 className={styles.detailsTitle}>文件信息</h3>
        <Button className={styles.iconButton} icon={X} iconOnly onClick={onClose} ariaLabel="关闭文件信息" tone="subtle" />
      </div>
      <div className={styles.detailsContent}>
        <div className={styles.detailsSection}>
          <label className={styles.detailsLabel}>文件名</label>
          <div className={styles.detailsValue}>{file.name}</div>
        </div>
        <div className={styles.detailsSection}>
          <label className={styles.detailsLabel}>路径</label>
          <div className={styles.detailsValueMuted}>{file.path}</div>
        </div>
        {file.size ? (
          <div className={styles.detailsSection}>
            <label className={styles.detailsLabel}>大小</label>
            <div className={styles.detailsValue}>{file.size}</div>
          </div>
        ) : null}
        <div className={styles.detailsSection}>
          <label className={styles.detailsLabel}>类型</label>
          <StatusBadge status={file.modelType === "lora" ? "review" : "ready"} label={file.modelType === "lora" ? "LoRA" : "Checkpoint"} />
        </div>
        {file.modelType === "lora" ? (
          <div className={styles.detailsSection}>
            <label className={styles.detailsLabel}>触发词</label>
            <textarea className={styles.textarea} value={file.triggerWords || ""} placeholder="输入触发词..." rows={2} readOnly />
          </div>
        ) : null}
        <div className={styles.detailsSection}>
          <div className={styles.detailsSectionHeader}>
            <label className={styles.detailsLabel}>备注</label>
            <Button className={styles.iconButton} icon={editingNotes ? Check : Edit2} iconOnly onClick={onToggleEditingNotes} ariaLabel={editingNotes ? "完成备注编辑" : "编辑备注"} tone="subtle" />
          </div>
          {editingNotes ? (
            <textarea className={styles.textarea} value={file.notes || ""} placeholder="添加备注..." rows={4} readOnly />
          ) : (
            <div className={styles.detailsValue}>{file.notes || "暂无备注"}</div>
          )}
        </div>
        <div className={styles.detailsActions}>
          <Button icon={Move} onClick={onMove}>
            移动文件
          </Button>
          <Button tone="danger" icon={Trash2}>
            删除文件
          </Button>
        </div>
      </div>
    </div>
  );
}
