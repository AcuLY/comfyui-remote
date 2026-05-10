export interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  size?: string;
  path: string;
  notes?: string;
  triggerWords?: string;
  modelType?: 'lora' | 'checkpoint';
}

export interface BreadcrumbItem {
  label: string;
  path: string;
}
