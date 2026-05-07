'use client';

import { useState } from 'react';
import {
  Upload, FolderOpen, File, ChevronRight, Search,
  MoreVertical, Edit2, Trash2, Move, X, Check,
  Folder, ArrowLeft, Plus
} from 'lucide-react';
import styles from './design-demo.module.css';

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: string;
  path: string;
  notes?: string;
  triggerWords?: string;
  modelType?: 'lora' | 'checkpoint';
}

interface BreadcrumbItem {
  label: string;
  path: string;
}

export function ModelsPage() {
  const [activeTab, setActiveTab] = useState<'lora' | 'checkpoint'>('lora');
  const [currentPath, setCurrentPath] = useState<string[]>(['models']);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);

  // Mock data
  const files: FileItem[] = [
    {
      id: '1',
      name: 'character',
      type: 'folder',
      path: 'models/character',
      modelType: 'lora'
    },
    {
      id: '2',
      name: 'nsfw',
      type: 'folder',
      path: 'models/nsfw',
      modelType: 'lora'
    },
    {
      id: '3',
      name: 'civitai_2491032_2800411_Cartethyia IL.safetensors',
      type: 'file',
      size: '144.2 MB',
      path: 'models/character/civitai_2491032_2800411_Cartethyia IL.safetensors',
      notes: 'High quality character model',
      triggerWords: 'cartethyia, 1girl, long hair',
      modelType: 'lora'
    },
    {
      id: '4',
      name: 'style_anime_v2.safetensors',
      type: 'file',
      size: '156.8 MB',
      path: 'models/style_anime_v2.safetensors',
      triggerWords: 'anime style, vibrant colors',
      modelType: 'lora'
    }
  ];

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
          <button
            type="button"
            className={styles.button}
            onClick={handleUpload}
            disabled={isUploading}
          >
            <Upload className="size-4" />
            {isUploading ? '上传中...' : '上传文件'}
          </button>

          <button type="button" className={styles.button}>
            <Plus className="size-4" />
            新建文件夹
          </button>

          <button type="button" className={styles.button}>
            <Search className="size-4" />
            扫描目录
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className={styles.modelsLayout}>
        {/* Left: File Browser */}
        <div className={styles.modelsBrowser}>
          {/* Model Type Tabs */}
          <div className={styles.segmented}>
            <button
              className={`${styles.segment} ${activeTab === 'lora' ? styles.segmentActive : ''}`}
              type="button"
              onClick={() => setActiveTab('lora')}
            >
              LoRA
            </button>
            <button
              className={`${styles.segment} ${activeTab === 'checkpoint' ? styles.segmentActive : ''}`}
              type="button"
              onClick={() => setActiveTab('checkpoint')}
            >
              Checkpoint
            </button>
          </div>

          {/* Breadcrumb Navigation */}
          <div className={styles.breadcrumb}>
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.path} className={styles.breadcrumbItem}>
                {index > 0 && <ChevronRight className="size-3 opacity-40" />}
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(index)}
                  className={index === breadcrumbs.length - 1 ? styles.breadcrumbActive : ''}
                >
                  {crumb.label}
                </button>
              </div>
            ))}
          </div>

          {/* Search Bar */}
          <div className={styles.searchBar}>
            <Search className="size-4 opacity-40" />
            <input
              type="text"
              placeholder="搜索文件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={styles.searchClear}
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* File List */}
          <div className={styles.fileList}>
            {currentPath.length > 1 && (
              <button
                type="button"
                className={styles.fileRow}
                onClick={() => {
                  setCurrentPath(currentPath.slice(0, -1));
                  setSelectedFile(null);
                }}
              >
                <ArrowLeft className="size-4 opacity-60" />
                <span className={styles.fileName}>返回上级</span>
              </button>
            )}

            {files
              .filter(f => f.modelType === activeTab)
              .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((file) => (
                <div
                  key={file.id}
                  className={`${styles.fileRow} ${selectedFile?.id === file.id ? styles.fileRowActive : ''}`}
                  onClick={() => handleFileSelect(file)}
                >
                  <div className={styles.fileIcon}>
                    {file.type === 'folder' ? (
                      <Folder className="size-4" />
                    ) : (
                      <File className="size-4" />
                    )}
                  </div>

                  <div className={styles.fileInfo}>
                    <div className={styles.fileName}>{file.name}</div>
                    {file.size && (
                      <div className={styles.fileSize}>{file.size}</div>
                    )}
                  </div>

                  {file.type === 'folder' && (
                    <ChevronRight className="size-4 opacity-40" />
                  )}

                  {file.type === 'file' && (
                    <button
                      type="button"
                      className={styles.fileAction}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMoveDialog(true);
                      }}
                    >
                      <MoreVertical className="size-4" />
                    </button>
                  )}
                </div>
              ))}
          </div>

          {/* Empty State */}
          {files.filter(f => f.modelType === activeTab).length === 0 && (
            <div className={styles.emptyState}>
              <FolderOpen className="size-8 opacity-20" />
              <p>当前目录为空</p>
              <button type="button" className={styles.button} onClick={handleUpload}>
                <Upload className="size-4" />
                上传文件
              </button>
            </div>
          )}
        </div>

        {/* Right: File Details Panel */}
        {selectedFile && (
          <div className={styles.detailsPanel}>
            <div className={styles.detailsHeader}>
              <h3 className={styles.detailsTitle}>文件信息</h3>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setSelectedFile(null)}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className={styles.detailsContent}>
              {/* File Name */}
              <div className={styles.detailsSection}>
                <label className={styles.detailsLabel}>文件名</label>
                <div className={styles.detailsValue}>{selectedFile.name}</div>
              </div>

              {/* File Path */}
              <div className={styles.detailsSection}>
                <label className={styles.detailsLabel}>路径</label>
                <div className={styles.detailsValueMuted}>{selectedFile.path}</div>
              </div>

              {/* File Size */}
              {selectedFile.size && (
                <div className={styles.detailsSection}>
                  <label className={styles.detailsLabel}>大小</label>
                  <div className={styles.detailsValue}>{selectedFile.size}</div>
                </div>
              )}

              {/* Model Type */}
              <div className={styles.detailsSection}>
                <label className={styles.detailsLabel}>类型</label>
                <div className={styles.badge}>
                  {selectedFile.modelType === 'lora' ? 'LoRA' : 'Checkpoint'}
                </div>
              </div>

              {/* Trigger Words (LoRA only) */}
              {selectedFile.modelType === 'lora' && (
                <div className={styles.detailsSection}>
                  <label className={styles.detailsLabel}>触发词</label>
                  <textarea
                    className={styles.textarea}
                    value={selectedFile.triggerWords || ''}
                    placeholder="输入触发词..."
                    rows={2}
                  />
                </div>
              )}

              {/* Notes */}
              <div className={styles.detailsSection}>
                <div className={styles.detailsSectionHeader}>
                  <label className={styles.detailsLabel}>备注</label>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => setEditingNotes(!editingNotes)}
                  >
                    {editingNotes ? (
                      <Check className="size-3" />
                    ) : (
                      <Edit2 className="size-3" />
                    )}
                  </button>
                </div>
                {editingNotes ? (
                  <textarea
                    className={styles.textarea}
                    value={selectedFile.notes || ''}
                    placeholder="添加备注..."
                    rows={4}
                  />
                ) : (
                  <div className={styles.detailsValue}>
                    {selectedFile.notes || '暂无备注'}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className={styles.detailsActions}>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => setShowMoveDialog(true)}
                >
                  <Move className="size-4" />
                  移动文件
                </button>
                <button type="button" className={styles.buttonDanger}>
                  <Trash2 className="size-4" />
                  删除文件
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Move Dialog */}
      {showMoveDialog && (
        <div className={styles.dialogOverlay} onClick={() => setShowMoveDialog(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h3 className={styles.dialogTitle}>移动文件</h3>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setShowMoveDialog(false)}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className={styles.dialogContent}>
              <p className={styles.dialogDescription}>
                选择目标文件夹
              </p>
              {/* Folder tree would go here */}
              <div className={styles.folderTree}>
                <div className={styles.folderTreeItem}>
                  <Folder className="size-4" />
                  <span>models</span>
                </div>
                <div className={styles.folderTreeItem} style={{ paddingLeft: '1.5rem' }}>
                  <Folder className="size-4" />
                  <span>character</span>
                </div>
                <div className={styles.folderTreeItem} style={{ paddingLeft: '1.5rem' }}>
                  <Folder className="size-4" />
                  <span>nsfw</span>
                </div>
              </div>
            </div>
            <div className={styles.dialogFooter}>
              <button
                type="button"
                className={styles.button}
                onClick={() => setShowMoveDialog(false)}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={() => setShowMoveDialog(false)}
              >
                移动
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
