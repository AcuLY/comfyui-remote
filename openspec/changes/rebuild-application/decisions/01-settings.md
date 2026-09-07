# 设置与执行环境

本文件记录本轮对话已确认的新版目标，尚不代表运行代码已实现。编号保留原清单 ID；冲突时采用最新用户决策、[最终口径](00-final-decisions.md)及[生产模块前向兼容补充](09-forward-compatibility.md)，旧实现列仅供数据转换核对。

## A1. Shared 设置细化决策

| ID | 设置项 | 所有权 / 持久化 | 决策 |
| --- | --- | --- | --- |
| `SH-01` | 设置持久化边界 | shared | 启动必需配置使用环境变量，可动态修改的应用设置存 SQLite，主题/SFW/导航等个人偏好存浏览器；三者不得互相 fallback |
| `SH-02` | 单 Token | 环境变量 | `AUTH_TOKEN` 只通过环境变量配置，不在 SQLite 保存，也不允许网页查看或修改原值；设置页只显示已配置/未配置并提供注销 |
| `SH-03` | 登录有效期 | 固定协议 | 浏览器登录固定使用 30 天 HttpOnly Cookie，不增加有效期设置；注销立即清除 Cookie，API Token 不受 Cookie 有效期影响 |
| `SH-04` | 主题 | 浏览器偏好 | 未保存人工选择时实时跟随操作系统深浅模式，不设默认深色或浅色；用户手工选择深色/浅色后长期保持，直到明确执行“改为跟随系统”。两个模块共用同一偏好但使用各自强调色，不跨浏览器或设备同步，也不使用永久三态主选择器 |
| `SH-05` | SFW | 浏览器偏好 | 全局 SFW 默认关闭，同时作用于两个模块并保存在浏览器，不写数据库或跨设备同步 |
| `SH-06` | 应用数据根目录 | 环境变量 | 新增必填 `APP_DATA_ROOT`；网页只读显示/复制。SQLite、项目媒体、训练文件、临时文件和日志从该根派生，不允许在线修改根目录或 SQLite 路径；导出目录遵循独立交付规则 |
| `SH-07` | 日志配置 | SQLite 动态设置 | 文件固定 JSON、控制台固定友好文本；允许修改最低级别、单文件大小和保留文件数，默认 info/10MB/5；日志目录只读展示，不提供格式切换或实时 tail |
| `SH-08` | 慢事件阈值 | SQLite 动态设置 | 默认启用慢事件诊断；页面加载、服务端请求、内部阶段默认阈值分别为 2500/1000/500ms，可在线修改，只影响是否记录 `performance` 日志，不影响请求执行 |

## A2. Shared compute target 设置细化决策

| ID | 设置项 | 所有权 / 持久化 | 决策 |
| --- | --- | --- | --- |
| `CT-01` | Target 数量与模式 | shared / SQLite | 全应用固定一个 compute target，只能为本机或 SSH 远程；不提供 Target 列表、多 GPU 或负载均衡 |
| `CT-02` | 本机模式 | shared / SQLite | 不显示 SSH 字段，GPU 检查在应用机器执行；ComfyUI 与训练模块分别配置本机 Adapter 路径 |
| `CT-03` | SSH 连接 | shared / SQLite | 配置 user@host、端口和本机私钥绝对路径；不支持网页上传私钥或保存 SSH 密码，私钥路径允许认证用户查看/复制 |
| `CT-04` | SSH 隧道 | shared 内部实现 | 固定自动管理，不提供普通开关；自动选择/占用本地转发端口并按需重建，状态页显示连接错误 |
| `CT-05` | 保存与切换 | shared / SQLite | 保存前只验证 SSH 连通和目标 `nvidia-smi`，不得启动/停止/重启进程；验证失败不替换当前配置。存在 submitted/running 图像任务或 pending/running TrainingRun 时禁止切换 |
| `CT-06` | GPU 检查频率 | shared 固定协议 | 每 30 秒低频执行一次，并在任务准备提交或 GPU 恢复前立即检查；命令固定为目标机器 `nvidia-smi --list-gpus`，不提供用户设置 |
| `CT-07` | GPU 恢复状态 | shared / SQLite | 持久化 gpuState、restartRequired、最后检查时间和最后错误；GPU 恢复且 ComfyUI restart 成功后清除 restartRequired |
| `CT-08` | 历史 Target 快照 | 模块任务数据 | Task、TrainingRun 和文件记录保存执行时实际目标及绝对路径快照；修改当前 Target 不重写历史记录 |
| `CT-09` | 模块边界 | shared | Shared Target 不保存 ComfyUI API/根目录/start-stop 命令，也不保存 Python/sd-scripts/staging/checkpoint 路径；由对应模块拥有 |

## A3. 生产模块的 ComfyUI Adapter、图片 Workflow 与任务提交设置

| ID | 设置项 | 所有权 / 持久化 | 决策 |
| --- | --- | --- | --- |
| `IP-01` | ComfyUI API | production / SQLite | 本机模式配置完整 API URL；SSH 模式配置远程 API Host/Port，本地转发 URL 由 Shared Target 自动生成 |
| `IP-02` | ComfyUI 根目录 | production / SQLite | 配置目标机器真实绝对根目录；模型目录固定派生为 `<ComfyUI 根>/models`，输出目录默认 `<ComfyUI 根>/output` 且允许单独覆盖；路径向认证用户显示/复制 |
| `IP-03` | 进程命令 | production / SQLite | 配置可选 start、stop 命令，本机模式另配命令工作目录；不配置独立 restart。自动 GPU 恢复和手工 restart 都串行执行 stop→确认停止→start→等待健康；缺少任一命令时只提示手工处理 |
| `IP-04` | Workflow 文件目录 | production / 文件系统 | 固定 `<APP_DATA_ROOT>/workflows/image-production`，当前仅存放生产模块的图片 Workflow；本次技术命名空间调整不改运行数据目录，后续布局见前向兼容补充。用户通过机器文件系统添加/更新 JSON 后刷新扫描，不提供浏览器上传或在线编辑 |
| `IP-05` | 当前 Workflow | production / SQLite | 为生产模块的图片生成能力，从扫描且验证通过的图片 Workflow 中选择唯一当前版本；切换只影响之后创建的 ProductionImageTask，历史图片任务使用自身 Workflow 快照；不把该配置扩张为所有未来小节类型的统一 Workflow |
| `IP-06` | Workflow 验证 | production | 扫描时解析 JSON 并检查图片生成注入协议所需节点；失败文件显示错误且不能激活，原始/调试图片 Workflow 下载保持不变 |
| `IP-07` | 图像任务提交 | production 固定协议 | 不限制 ComfyUI 队列中 submitted 任务数量；条件允许时按应用顺序把所有 unsubmitted 任务提交到 ComfyUI 自有队列。仅对 HTTP 提交请求做内部有界并发/批处理，不能作为业务并发上限；TrainingRun pending 后停止继续提交，已经 submitted/running 的任务仍按既定互斥规则处理 |
| `IP-08` | 状态同步与超时 | production 固定协议 | ComfyUI WebSocket 只负责即时执行/进度事件；存在 submitted/running 任务时，系统后台固定每 1 秒执行一次 HTTP queue/history 权威对账，不使用 500ms fallback 或 250ms 队列缓存。没有活动任务时停止队列轮询，只维持 WebSocket reconnect 与 shared GPU 检查；请求超时固定 10 秒，不提供用户频率设置 |
| `IP-09` | 手工 start/stop/restart | production | 只出现在模块设置，不进入任务创建流程；存在真实 submitted/running 图像任务或 running TrainingRun 时禁止 stop/restart。restart 复用 IP-03 的 stop/start 串行流程，操作前显示影响并确认 |
| `IP-10` | 设置持久化 | production | ComfyUI API、路径、命令和当前图片 Workflow 存生产模块 SQLite 配置；Workflow JSON 存应用数据目录；不再从多组环境变量和旧 target JSON 互相 fallback；本期不增加未来小节类型的空设置 |

## A4. 生产模块的图片自动打码与导出设置

| ID | 设置项 | 所有权 / 持久化 | 决策 |
| --- | --- | --- | --- |
| `IC-01` | 自动打码运行时 | production / 应用依赖 | Python 运行时、Ultralytics、OpenCV 和 Pillow 作为应用随附且版本固定的自包含依赖安装，不提供 Python/venv 路径设置，也不依赖用户机器预装环境 |
| `IC-02` | YOLO 模型 | production / SQLite | 配置应用机器上的 `.pt` 模型绝对路径；网页显示、复制并在实际执行时检查文件存在，不提供上传 |
| `IC-03` | 环境验证 | production | 不提供用户主动“验证环境”操作；创建打码任务不预跑 Python，真正领取/执行失败时将缺少运行时、依赖或模型等原因写入任务错误并允许复制 |
| `IC-04` | 马赛克尺寸 | production / SQLite | 手工与自动打码共用一个值，默认 100、最小 20；修改只影响之后生成的打码版本 |
| `IC-05` | Python 批量大小 | production / SQLite | 允许设置一次交给 Python 的图片数，默认 64；只影响内部处理效率，不改变一个用户任务对应一个批次的领域模型 |
| `IC-06` | 检测类别 | production 固定协议 | 保持旧版固定类别 `[2,4]`，不向普通设置暴露技术类别 ID；只支持与该类别合同兼容的 YOLO 模型 |
| `IC-07` | 推理设备 | production 固定协议 | 固定在应用机器使用 CPU，避免自动打码与唯一 GPU 上的生成/训练竞争；不增加 CPU/GPU 设备选择 |
| `EX-01` | 导出根目录 | production / 环境变量 | 新增启动配置 `EXPORT_ROOT`，默认 `<APP_DATA_ROOT>/exports`；网页只读显示/复制，不允许在线修改，项目删除不清理其中交付包 |
| `EX-02` | JPEG 质量 | production / SQLite | 允许调整，默认 90、范围 1～100；同一次打包的普通图、P站、预览和封面统一使用该值 |
| `EX-03` | 文件结构 | production 固定协议 | 固定 `<slug>.zip`、`<slug>_01.jpg`、`pixiv/`、`preview/`、`cover.jpg`、`cover_censored.jpg`，不提供命名设置 |
| `EX-04` | 导出版本 | production 固定协议 | 每个 ProductionProject 只保留并覆盖最新图片打包结果，不维护历史导出版本或相关设置；本版导出只包含图片包 |

## A5. LoRA 训练素材图片 Provider 设置

2026-09-02 对 OpenAI 官方图片生成文档、当前 Codex 图片桥接和 `D:\Luca\Code\MyProject\gpt-image-2-generator` 做了只读复核。官方 `gpt-image-2` 确实支持 `size`、`quality` 和 `background`；`aspect` 不是独立官方参数，只能作为界面快捷选择换算为 `size`。Image API 虽支持 `n=1..10`，当前应用实际使用的 Responses/Codex bridge 没有传 `n`，且一次调用只提取一张最终图片。Generator 的 274 条历史任务也只持久化 `size/quality/background`，每条任务只有一个输出；实际参数为 160 条 `1024x1536/high/opaque`、113 条 `1536x1024/high/opaque` 和 1 条 `1024x1024/high/opaque`。269 次成功 Attempt 耗时为 45.8～242.2 秒，P95 约 190.6 秒，没有超过 300 秒。官方只说明复杂 Prompt 可能耗时约两分钟，并未规定 600 秒超时；600 秒是现有本地配置，不是官方限制。

| ID | 设置项 | 所有权 / 持久化 | 决策 |
| --- | --- | --- | --- |
| `TG-01` | Provider | training 固定协议 | 训练素材生成在生产环境固定使用 `openai-codex`，图片模型固定 `gpt-image-2`；不提供 Provider 或图片模型选择器 |
| `TG-02` | Python Bridge | training / 应用依赖 | `codex_gpt_image2.py`、Python 运行时及其依赖作为应用随附运行时，不提供 Python 或脚本路径设置 |
| `TG-03` | Codex 鉴权 | 环境变量 | 只通过启动环境变量 `CODEX_IMAGE_AUTH_FILE` 指向认证 JSON；不存 SQLite、不上传、不显示文件内容。设置页只显示是否配置及文件是否存在 |
| `TG-04` | Base URL 与宿主模型 | training 固定协议 | Codex Base URL 和宿主模型固定为应用支持值，不放入普通设置；升级时随应用版本一起调整 |
| `TG-05` | 图片参数来源 | TrainingTemplate / TrainingProject / TrainingSection | 只持久化真实请求参数 `size`、`quality`、`background`；界面可将横向、纵向、方形等快捷选项即时换算成 `size`，不再保存独立 `aspect`。候选数量是 Section 的产品参数，不是 Provider 参数。以上参数继续按 TrainingTemplate → TrainingProject → TrainingSection 继承，不在 Provider 设置中维护另一套默认值 |
| `TG-06` | 超时 | training 固定协议 | 每个独立候选图片的 Provider 调用固定使用 300 秒超时，不提供用户设置；这不是官方规定值，而是官方约两分钟延迟说明、Generator 历史最大 242.2 秒和现有 bridge 300 秒默认值之间的应用保护边界。超时作为同一生成 Task 的可重试技术错误记录 |
| `TG-07` | 输出位置 | training 固定协议 | 固定写入当前 TrainingProject 的项目媒体区，由 TrainingImageArtifact / TrainingImage 管理；不允许配置输出路径模板 |
| `TG-08` | 执行并发与多候选 | training 固定协议 | 执行器一次只领取一个训练素材生成 Task，不提供 Worker 数量或并发设置；一个 Task 的候选数量通过若干次“一次一张”的 Provider 调用实现，结果仍统一属于该 Task，不谎称 bridge 支持 Image API 的 `n`。候选调用如何做内部有界调度属于实现细节，不成为业务设置；该任务不占用 shared GPU 锁 |
| `TG-09` | 可用性检查 | training | 不提供用户主动测试按钮。内部执行器启动时自动检查认证文件和 Provider 基本可用性；不可用时不领取任务，pending 任务显示“训练素材生成环境不可用”及错误 |

## A6. LoRA 训练执行器与机器设置

2026-09-02 对现有 `D:\\Luca\\Code\\LoRATraining` 后端做了只读核对：当前 `run_manager_training.cmd` 硬编码 Python、`sd-scripts`、Accelerate、数据库和 checkpoint 路径，再由 Python Runner 直接读取 Manager SQLite 并启动 `sdxl_train_network.py`。新版保留 `sd-scripts + Accelerate` 的轻量执行路线，但删除任意 shell command、Runner 直读数据库和多处硬编码路径；执行器只消费应用下发的 TrainingRun 快照，并通过正式接口回报进度、checkpoint 和结果。

| ID | 设置项 | 所有权 / 持久化 | 决策 |
| --- | --- | --- | --- |
| `LE-01` | 执行位置 | shared compute target | 始终使用全应用唯一 compute target：本机模式在本机训练，SSH 模式在远程 GPU 机器训练；不增加独立训练 Target 或 Target 选择器 |
| `LE-02` | Python 环境 | training / SQLite | 配置目标机器上训练 venv 的 Python 绝对路径并向认证用户显示；CUDA、PyTorch、bitsandbytes 等与目标显卡和驱动相关，不随 Web 应用打包 |
| `LE-03` | sd-scripts | training / 应用依赖 | `sd-scripts` 作为应用锁定版本的依赖随应用安装和升级，不提供根目录或入口脚本路径设置；入口固定为随附版本的 `sdxl_train_network.py`。本机直接使用随附副本；SSH 模式由应用把同一版本同步到目标训练根下的受管运行时目录，用户不需要预装或指定路径 |
| `LE-04` | Accelerate | training 固定协议 | 不要求配置 `default_config.yaml` 路径；应用按单机、单 GPU、单进程设置为每次 TrainingRun 生成 Accelerate 配置 |
| `LE-05` | 训练工作区 | training / SQLite | 配置目标机器上的训练数据根目录；应用在其下按 TrainingRun 派生 staging、TOML、日志和 checkpoint 目录，所有本机/远程绝对路径可查看和复制 |
| `LE-06` | Base checkpoint | shared 模型管理 | 只能从 shared 模型管理模块选择，不配置执行器默认 checkpoint 路径，也不允许手填任意绝对路径 |
| `LE-07` | 启动方式 | training 固定协议 | 删除任意 `TRAINING_RUNNER_COMMAND`；应用直接构造并启动 `Python -m accelerate.commands.launch ...`，本机直接创建受管进程，远程通过受管 SSH 创建进程。执行器不得直接读取应用 SQLite |
| `LE-08` | 机器参数 | training / SQLite | 当前真实训练环境使用 `bf16`，不是旧清单误写的固定 `fp16`。只提供机器级 `bf16/fp16` 选择，默认 `bf16`；SDPA、gradient checkpointing、缓存和单进程固定启用，不在每次 TrainingRun 重复暴露 |
| `LE-09` | 进度与 checkpoint | training 固定协议 | 逐行读取训练输出；进度最多每 2 秒写回一次，发现 checkpoint 后立即登记。刷新频率属于内部协议，不提供设置 |
| `LE-10` | 超时与取消 | training 固定协议 | 训练不设置总时长超时，以最大训练步数结束；用户取消时必须终止该 TrainingRun 的精确进程树，不得停止其他 Python、Node 或训练进程 |
| `LE-11` | 环境检查 | training | 不提供主动测试按钮；TrainingRun 准备执行时检查 Python、Accelerate、随附 sd-scripts、CUDA 和已选 Base checkpoint。环境不可用时保持 pending，并显示具体等待原因 |
