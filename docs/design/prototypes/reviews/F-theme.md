---
schemaVersion: 1
document:
  type: design
  status: current
  owner: product-design
  authority:
    subject: prototype-foundations-unified-theme-review
    kind: reference
  readWhen:
    - 审核新版原型的统一组件主题时
    - 判断统一主题、页面布局与组件定制的边界时
  sources:
    - docs/design/prototypes/design-foundations.md
    - docs/design/prototypes/reviews/F-responsive.md
    - prototypes/app/package.json
    - prototypes/app/src/theme.ts
    - prototypes/app/src/preferences.ts
  verifiedBy:
    - npm --prefix prototypes/app run build
    - npm run docs:check
---

# 统一主题方案与审核

用户要求制作真正统一的组件主题，并沿用“**如非必要，不要对组件库做侵入式改动**”的原则。当前新版原型已按该原则重建为独立入口，主题与交互仍待用户审核；已有检查不等同于用户确认，也不扩大为真机或全部状态组合已验收。

## 职责边界

| 层次 | 当前实现 | 职责 |
| --- | --- | --- |
| 组件运行库 | `PrimeReact` `10.9.9` `Styled` | 承载组件内部结构、状态与焦点样式 |
| 主题入口 | 原型入口的 `theme-link` | 按当前主题加载官方深浅主题，由 `src/theme.ts` 切换 |
| 偏好与跟随 | `src/preferences.ts` | 记录“跟随系统／浅色／深色”，响应系统外观变化，不建立第二份颜色表 |
| 页面布局 | 原型自有 `styles.css` | 只负责外壳、页面布局与内容结构，不重写组件内部样式 |
| 业务语义 | `Tag` 与状态文字 | 状态语义独立于模块强调色，同时提供文字，不把颜色作为唯一信号 |

官方生成的内部样式仍需验证可读性、焦点可见性、真实点击和错误反馈；确需额外覆盖时，先说明公开能力无法满足的产品或无障碍必要性，并记录验证。

## 版本与状态

运行组件库保持 `PrimeReact` `10.9.9` 与 `PrimeIcons` `7.0.0`，不因主题呈现调整而改变组件库版本。历史统一主题记录只保留职责边界与非侵入原则，具体色值与尺寸属视觉风格内容，不在本契约维护。

| 日期 | 事项 | 状态 |
| --- | --- | --- |
| 2026-09-08 | 用户要求先做真正统一主题的一版，基础采用官方完整主题与统一入口 | 已制作，待用户审核 |
| 2026-09-08 | 用户要求非必要不侵入组件库 | 已作为基础规范保留 |
| 2026-09-16 | 原契约文档被删除后恢复，去掉视觉风格内容 | 当前版本待用户审核 |

## 上级路由

- [设计文档](../../README.md)
- [新版应用原型契约](../README.md)
