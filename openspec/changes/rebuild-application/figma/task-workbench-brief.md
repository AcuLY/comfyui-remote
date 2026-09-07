# 生产任务工作台：本版图片功能首稿说明

状态：待设计审核。关联 IA-01～IA-16、VD-01～VD-14、CA-01～CA-14、ARCH-006/010、GEN-RUN-001/003/005/007/008、IAPI-06/07。

设计前先读 [前向兼容边界](../decisions/09-forward-compatibility.md)。统一生产项目与任务入口承载各类型的组织关系，配置、执行、结果和计数仍按类型分别表达。本首稿聚焦 ProductionImageTask，ProductionImageCensoringBatchTask 保留另有的已确认任务视图，不合并两者布局；本版不新增视频页面、类型占位控件或空接口。

FC-15（SC-01～03）确定小节公共组织与图片配置一对一：ProductionSection 保存项目、文件夹、名称、类型和排序，ProductionImageSection 只保存图片配置及关联。公共列表、面包屑和选中项采用 ProductionSection 的身份；用户与 API 仍操作一个小节资源，不增加先建公共记录再建图片配置的流程。

## 目标

无有效导航记录时首页进入 `/production/tasks`；能快速辨认图片任务进度、等待原因、最近成功/失败，以及所属 ProductionProject 和 ProductionSection。图片任务配置由该公共小节的一对一 ProductionImageSection 提供。用户可以按状态独立管理，按时间或项目分组查看，并从失败任务直接重试。项目内固定同一 ProductionProject 范围复用任务交互，不建立通用任务业务表；“运行整个项目”在本版表示生成全部图片小节。

## 桌面构成

- 可折叠侧栏：突出“生产 / 训练”切换，对应 `/production/**` 与 `/training/**`；一级入口项目、任务、预制、模板；全局模型、监控与日志、设置。
- 页头：任务标题和简洁范围说明，主要操作就近呈现。
- 状态筛选：全部、未提交、已提交、运行中、已暂停、已完成、失败、已取消，计数与文本结合。
- 工具栏：项目、小节/关键词、时间排序、项目分组与多选；小节名称与选中身份取自 ProductionSection。
- 任务区域：项目分组标题、选择框、图片任务名称/小节、状态、等待原因、进度、耗时和适用操作；图片结果数量明确按图片统计。
- 详情：按需展开 ProductionImageTask 的固定输入、ProductionImageAttempt、错误与阶段耗时，保持列表上下文。小节链接使用 ProductionSection 身份进入小节资源，再调用图片专属编辑器；结果链接仍进入图片审核。

## 状态约束

| 状态 | 页面表达 |
| --- | --- |
| 未提交 | 显示等待原因；可暂停或取消；不提示启动 ComfyUI |
| 已提交 | 显示已进入 ComfyUI 队列；读取外部权威状态 |
| 运行中 | 当前进度与耗时；暂停/取消须确认实际停止 |
| 已暂停 | 明确恢复从头执行 |
| 已完成 | 进入本任务图片审核；ProductionImageResult 保留图片能力的来源关联，公共导航回到所属 ProductionProject/ProductionSection |
| 失败 | 可复制错误并重试同一 ProductionImageTask；旧 ProductionImageAttempt 留存 |
| 已取消 | 可按既定终态清理规则管理 |

## 视觉与组件

默认主题跟随系统；首稿展示浅色和深色对照，不能将其中一个视为优先。生产青绿、训练品红/粉，其余状态按标准语义色；本次不改既有 Token ID。采用柔和表面与紧凑但可读的信息布局。PrimeReact v10 对应 Button、Dropdown、SelectButton/TabView、Checkbox、DataTable、Tag、ProgressBar、Menu、Dialog/Sidebar；实际选用以页面适配为准，不把这份清单当作必须全部出现的控件。共享基础展示能力，图片任务配置、审核操作和生命周期保留所属类型实现。

## 移动构成

顶部保持模块识别与切换，底部四个主入口；任务列转换成易触摸的任务卡片，筛选收进独立面板；保留项目分组和状态入口，不压缩桌面表格。
