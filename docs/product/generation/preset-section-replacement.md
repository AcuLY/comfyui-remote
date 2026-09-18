---
schemaVersion: 1
document:
  type: product
  status: current
  owner: product-generation
  authority:
    subject: generation-preset-section-replacement
    kind: reference
  readWhen:
    - 批量替换 Generation 项目或模板小节中的普通预制时
    - 修改替换预演、阻塞、应用复查或 LoRA 分离规则时
  sources:
    - src/server/services/preset-section-replacement-core.ts
    - src/server/services/preset-section-replacement-service.ts
    - src/components/preset-section-replacement-dialog.tsx
    - src/server/services/section-lora-service.ts
    - src/server/prompt-config/template-resolver.ts
    - src/lib/lora-types.ts
  verifiedBy:
    - node --import tsx --test tests/test-product-design-doc-governance.test.ts tests/test-preset-section-replacement-core.test.ts tests/test-preset-section-replacement-dialog-source.test.ts tests/test-preset-section-replacement-ui.test.ts tests/test-preset-section-replacement-entrypoints.test.ts tests/test-lora-detach-persistence.test.ts tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts
---

# 小节预制批量替换

## 作用范围

批量替换用于当前 `Generation` 项目全部小节，或当前 `Generation` 模板全部小节。它修改小节中的普通预制绑定，不修改预制库内容，也不跨到 `Training` 资源。

预制组绑定不属于本流程：只有同时具有来源 `presetId`、且没有 `presetGroupId` 和 `groupBindingKey` 的普通绑定会进入计划。无匹配项是一条合法的 `noop` 规则，不会仅因为更新数为零而阻塞。

## 预演与阻塞

请求的 `dryRun` 只有显式设为 `false` 才进入写入；省略时默认预演。每条规则在预演中执行以下检查：

- 来源与目标预制都必须存在、处于活动状态且属于普通 `Generation` 预制；
- 来源与目标必须属于同一分类；
- 目标必须有可用的活动变体；
- 显式目标变体必须属于目标预制且处于活动状态；省略时选择按 `sortOrder`、名称排序后的第一个活动变体；
- 同一请求中不能重复使用同一个来源预制。

任一规则或全局检查产生阻塞项时，服务拒绝写入。界面会在修改规则后清空旧预演，要求重新执行 `Dry Run`；只有已有无阻塞预演且当前没有请求进行时，才允许进入确认 `Apply`。

## 应用与复查

应用阶段在一个 `Prisma` 事务中逐条更新计划内绑定。每次更新同时匹配绑定记录标识和原来源预制，因此并发变化不会被无条件覆盖。响应分别报告计划更新数和实际更新数；提交后服务重新加载目标并再次生成同一组规则的计划。

界面只有在后验计划无阻塞且剩余计划数为零时显示成功；否则显示“已应用但仍有剩余计划”的警告。当前服务不会因为计划数与实际更新数不同而自动回滚，也不会把后验仍有计划直接转成请求失败，因此调用方必须保留这次复查结果。

## LoRA 分离不变量

批量替换只更新预制绑定行，不重写手动 `LoRA` 行。干净、仍从预制继承的 `LoRA` 继续由绑定解析；经过手工编辑、分离或抑制的条目保存在独立的手动行中：

- 手动、分离或抑制条目不保留 `sectionBindingId` 或 `templateSectionBindingId` 外键；
- 分离来源通过 `detachedFromBindingKey`、`detachedFromPresetId`、`detachedFromVariantId` 与 `detachedFromPath` 保留；
- 抑制条目以禁用状态保存，并记录抑制元数据；
- 项目小节与模板小节使用同一分离判断。

因此，替换普通预制不会把已经独立保存的 `LoRA` 编辑重新附着到新预制，也不会把预制组成员当作普通绑定一起替换。

## 上级导航

- [返回 Generation 产品](README.md)
