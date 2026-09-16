import {
  DESIGN_DEMO_THEME_ATTRIBUTE,
  DESIGN_DEMO_THEME_COOKIE,
  DESIGN_DEMO_THEME_STORAGE_KEY,
} from "@/app/design-demos/routing";

/**
 * 主题持久化沿用组件外壳的存储键与文档属性，仅把 Cookie 路径限定在本原型路由。
 */
export const PROTOTYPE_THEME_PERSISTENCE = {
  storageKey: DESIGN_DEMO_THEME_STORAGE_KEY,
  cookieName: DESIGN_DEMO_THEME_COOKIE,
  cookiePath: "/prototype",
  documentAttribute: DESIGN_DEMO_THEME_ATTRIBUTE,
  maxAgeSeconds: 60 * 60 * 24 * 365,
};
