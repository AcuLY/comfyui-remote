import type { FileItem } from "./model-types";

export const modelFiles: FileItem[] = [
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
