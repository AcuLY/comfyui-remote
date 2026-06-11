# ComfyUI Manager 自训练角色 LoRA 模块需求文档

> 历史状态：本文属于 2026-05 `CharacterLoraTraining*` 旧方案，只作背景参考。当前 LoRA Training v2 文档入口是 `docs/plans/2026-06-07-manager-lora-training-docs-index.md`，主设计以 `docs/plans/2026-06-07-manager-lora-training-final-technical-design.md` 为准。新开发不得从本文继承 `CharacterLoraTraining*` 命名、`/character-lora-training/**` 路由、benchmark/promotion 闭环或页面结构。

版本：v0.1（2026-05-22）
目标：把“参考图/设定图 → 训练集生成与审图 → LoRA 训练 → LoRA 测试 → 人工审核 → 正式角色 preset”系统化进 ComfyUI Manager。
关联背景：现有 `角色 lora 测试` 模板、角色 preset 7 变体结构、独立 LoRA Training MVP、Phase 7 冷门角色训练兜底 PRD。

## 1. 背景与问题
当前 Manager 已能管理角色预制、项目/小节模板、LoRA 测试项目和人工审图，但自训练 LoRA 仍主要依赖独立脚本、文件 manifest 和人工串流程。新模块要把上次金发偶像 LoRA pilot 中跑通的经验产品化：使用 GPT-Image-2 生成候选训练图，按小节/角度审图与重生，生成 caption 与 frozen dataset，调用隔离训练环境执行 sd-scripts，训练后自动进入现有 LoRA 测试流程，最后由人工决定是否 promotion 到正式角色 preset。

## 2. 总目标
在 ComfyUI Manager 中新增“角色 LoRA 自训练工作流”。用户可以从少量参考图开始，完成 canonical 正面图、Prompt Card、训练集小节、自然语言+图片定向重生、候选图审图、caption、训练、测试和正式 preset 创建。系统必须保留每一步产物路径、输入图、生成提示词、训练参数、模型 hash、benchmark 结果和人工决策。

## 3. 核心原则
- 不混训：一个 training job 只训练一个角色的一套主要服装/形态（以 canonical / Prompt Card 定义为准）；不同角色、不同官方服装、皮肤、形态或互相冲突的训练目标不能塞进同一个 job。Manager 最终 preset 的 7 个状态（默认、内裤、内裤+脱鞋、半脱、半脱+上半身、半脱+脱鞋、裸）属于同一训练结果的 prompt / linked-variant 应用，不等于 7 个 training job。第一版默认只用正常/主要服装训练；内裤、半脱、裸等派生状态不自动进入训练集，除非后续作为显式实验并带独立 caption / variant 标记和污染风险提示。
- 人工 gate 优先：canonical、Prompt Card、训练候选图、测试 LoRA 结果、最终 7 变体 prompt 都要可人工审核。
- 不自动 promotion：训练成功只代表产出 safetensors；必须跑 `角色 lora 测试` 并人工通过后才能创建正式角色 preset。
- 全流程留档：source、canonical、prompt、run、image、caption、config、log、hash、test result 都要可追溯。
- Manager 小节化：训练集生成沿用“模板 / 小节 / run / 审图”的心智模型；输出不是最终项目图，而是训练候选图。
- 训练依赖隔离：sd-scripts/kohya/训练 venv 保持在 Manager runtime 之外；Manager 负责 UI、状态、配置、调用和结果管理。

## 4. 用户主流程
1. 创建 LoRA training job：填写角色名、trigger token、底模 checkpoint、训练范围，上传/选择参考图。
2. 生成 canonical 正面图：用 GPT-Image-2 生成白底正面全身候选，用户选择一张作为 canonical；也可上传手动修正图。
3. 审核 Prompt Card：系统生成角色卡，包含头发、眼睛、服装、鞋袜、饰品、负面约束和最终默认 prompt 草案，用户可编辑。
4. 生成训练集小节：按小节模板生成多角度/多构图候选图，例如正面、45°、侧面、背面、半身、头部、鞋袜细节。
5. 小节审图与重生：每张图 keep/reject/pending；对某个小节或 canonical 可用自然语言 + 上传参考图重生，旧 run 不覆盖。
6. Freeze dataset：只纳入 keep 图，生成 caption 与 selected manifest，形成不可变 dataset revision。
7. 执行 LoRA 训练：按底模和配置训练，输出 safetensors、hash、日志、metadata。
8. 自动跑 LoRA 测试：复制/登记 LoRA，创建临时测试 preset/project，跑现有 `角色 lora 测试` 7 小节。
9. 人工审核测试结果：比较 checkpoint/weight/section 表现，决定是否通过。
10. Promotion：通过后创建正式 7 变体角色 preset；未通过则根据诊断建议回到训练集、caption、preset prompt、weight 选择或训练参数阶段重跑。

## 5. 功能需求

### 5.1 Training Job 创建
创建 job 时需要配置角色名称、trigger token、底模 checkpoint、训练范围、参考图、caption 策略和训练强度。底模必须记录 path、文件名、hash、base family；trigger token 必须唯一且固定为 caption 第一位；训练范围必须明确当前主要服装/形态，默认禁止混训。这里的“主要服装/形态”指用于训练身份与默认外观的 canonical 目标，不把最终 preset 的内裤/半脱/裸等 7 状态拆成多个 job；这些状态默认由最终生图底模、prompt 和 linked clothing variant 共同发挥。若将派生状态素材纳入训练，必须作为后续高级实验：单独标记 variant、caption 中明确状态、限制比例、生成独立 dataset revision，并在 UI 中提示它可能污染默认服装稳定性。验收：创建 job 后生成独立工作区，所有 source images 计算 hash 并记录 provenance，job 明确绑定一个 base checkpoint，不允许把多个角色或多个官方服装/皮肤/形态塞入同一个训练目标。MVP 不需要额外做“角色维度聚合视图”；每个 job 独立展示，用户可通过 job 名称/标签自行关联同一角色的不同实验。

### 5.2 Canonical 正面图
系统从原始参考图生成白底正面全身 canonical 候选，用户选择一张作为后续扩展的主 anchor。需求：支持多张候选、reject/select/regenerate、用户上传手动 canonical、canonical version 留档。Canonical 可以在中途更新，但更新行为必须是版本化的：新 canonical 生成新的 canonical version，不覆盖旧 version；已有小节 run、已 keep/reject 的候选图、已 frozen 的 dataset revision 默认保留原 lineage，不自动作废、不自动删除、不自动重生。用户可以选择继续用旧结果、只重生受影响小节、从新 canonical 开始生成新 dataset revision，或重新跑整个 job；UI 需要提示当前 job 中哪些 run 来自旧 canonical、哪些来自新 canonical。验收：每个 candidate 记录输入图、prompt、模型、生成时间、文件路径；选择 canonical 后，后续 Prompt Card 和训练集小节绑定具体 canonical version；训练时只能选择一个明确的 frozen dataset revision。

### 5.3 Prompt Card / 角色卡
Prompt Card 是训练集生成、caption、测试 prompt、最终 preset prompt 的共同基础。字段：trigger token、identity traits、outfit traits、negative traits、final prompt draft。identity traits 包括发色、发型、刘海、眼睛、瞳孔、耳朵、角、头饰等；outfit traits 包括衣服结构、颜色、裙摆、袖子、袜子、鞋子、饰品。验收：用户可编辑每组 traits，Prompt Card 有版本号，小节生成引用具体版本；canonical 改变时提示是否新建/更新 Prompt Card。

### 5.4 训练集小节模板
训练集生成做成类似 Manager 项目小节模板的结构，每个小节代表一个角度/构图/细节目标。默认小节建议：正面全身、左前45°、右前45°、左侧、右侧、背面、半身、头部特写、鞋袜/下半身细节、简单坐姿、简单动作、表情变化。每个小节字段：名称、目标角度/构图、section prompt template、negative template、目标候选数、目标 keep 数、关联 Prompt Card version、关联参考图、runs 列表。验收：可以按小节单独生成/重生/暂停，可以复制训练集模板，可以看到每个小节 keep/reject/pending 数，可以只重生某个小节不影响其他小节。

### 5.5 自然语言 + 图片定向重生
用户可以对 canonical 或某个小节 run 做自然语言调整，例如“刘海应该更像参考图1，左侧有一束更长的弧形刘海，不要变成齐刘海；鞋子保持黑色玛丽珍鞋”。需求：每个小节 run 有 prompt 输入框；支持上传/选择参考图并标记用途（canonical、原始设定、局部参考、上一轮近似图）；支持基于某个 run 创建 rerun；rerun 不覆盖旧 run，记录 parentRunId；用户自然语言修正默认只作用于当前小节，不自动污染全局 Prompt Card；只有选择“提升为全局修正”才写入 Prompt Card 新版本。“提升为全局修正”只影响之后新生成的 run；已有小节 run、其他小节结果、已 frozen dataset revision 不自动标记过期、不自动重生，UI 只提示“存在更新版 Prompt Card，可选择重跑相关小节”。验收：每次 rerun 保存 userInstruction、inputImageIds、renderedPrompt、输出图和 review 状态；支持 canonical 重生和单角度小节重生；prompt 记录明确区分通用 instruction 与真实视觉 prompt。

### 5.6 GPT-Image-2 Prompt Layering
推荐拼接顺序：全局规则（单人、白底、无文字、无 logo、无道具、保持角色一致）+ 角色卡（头发、眼睛、服装、鞋袜、饰品）+ 小节模板（具体角度/构图）+ 用户修正 + 参考图说明 + 输出限制。参考图说明必须明确 input1 是 canonical、input2 是原始设定、input3 只参考局部特征，避免模型平均混合所有图。`you are a helpful...` 这类通用助手 instruction 只能作为行为前缀，不应承载视觉要求；真正影响图像的约束必须记录在 renderedPrompt / visualPrompt 中。

### 5.6.1 GPT-Image-2 调用契约
第一版以现有独立脚本 `/mnt/d/Luca/Code/LoRATrainingMVP/scripts/codex_gpt_image2.py` 为参考实现：通过 Codex / ChatGPT OAuth `POST {CODEX_BASE_URL}/responses`（默认 `https://chatgpt.com/backend-api/codex/responses`）调用 Responses 风格接口，host model 负责强制调用 `image_generation` tool，图片模型为 `gpt-image-2`。Manager 集成时要把它封装为 provider adapter，而不是把业务 prompt 决策散落到调用脚本中。

请求 header 至少包含：OAuth 授权头（只在内存中用于请求，不落盘）、JSON 请求 Content-Type、`Accept: text/event-stream`、Codex 风格 `User-Agent` / `originator`，以及可选的 `ChatGPT-Account-ID`；所有 token 只用于请求，不写入日志或 metadata。

请求分层必须固定为三类字段：
- `hostInstruction` / request body 的 `instructions`：只告诉外层 host model 如何执行，例如“必须使用 image_generation tool”。它不是画面描述，不承载角色外观、服装、角度、负面约束。
- `visualPrompt` / `renderedPrompt` / `input.content[].text`：真正的视觉提示词，来自 5.6 的 Prompt Layering，是生成图片的主要语义来源。
- `toolParams` / request body 的 `tools[0]`：模型、尺寸、质量、背景、输出格式、partial images 等机械参数。

参考请求 body（图片 bytes 需在留档版本中 redacted）：
```json
{
  "model": "gpt-5.5",
  "store": false,
  "instructions": "You are an assistant that must fulfill image generation requests by using the image_generation tool when provided.",
  "input": [
    {
      "type": "message",
      "role": "user",
      "content": [
        { "type": "input_image", "image_url": "data:image/png;base64,<redacted>" },
        { "type": "input_text", "text": "<visualPrompt/renderedPrompt>" }
      ]
    }
  ],
  "tools": [
    {
      "type": "image_generation",
      "model": "gpt-image-2",
      "size": "1024x1536",
      "quality": "high",
      "output_format": "png",
      "background": "opaque",
      "partial_images": 1
    }
  ],
  "tool_choice": {
    "type": "allowed_tools",
    "mode": "required",
    "tools": [{ "type": "image_generation" }]
  },
  "stream": true
}
```

调用语义：单次请求不是 Hermes/Agent 式多步自主工作流；响应侧会由 host model 读取 `instructions + input content + tool params`，然后按 `tool_choice.required` 调用 `image_generation`，返回 `image_generation_call.result` 的 base64 PNG。它不会自动查文件、自动审图、自动重试、自动修改 Prompt Card；这些循环必须由 Manager/worker 显式实现。若使用 SSE，需处理 `response.image_generation_call.partial_image` 与 `response.output_item.done`，并在非标准 Content-Type 但 body 是 `event:/data:` 时仍按 SSE 解析。失败时记录 HTTP status / backend error，不吞错。

每次 GPT-Image-2 run 必须保存：`provider=openai-codex`、`hostModel`、`imageModel=gpt-image-2`、`hostInstruction`、`visualPrompt/renderedPrompt`、redacted request payload、resolved tool params、input image ids/paths/hashes/roles、output path、output bytes、elapsed seconds、createdAt、auth source shape（只记录来源和是否有 refresh token，绝不记录 token 值）、response/error 摘要。生产配置建议使用专用 Codex auth file，避免多个进程同时轮换同一 refresh token。

### 5.7 审图系统
训练候选图使用类似当前 Manager 审图系统的 UI，但状态服务于训练集筛选。状态：pending、keep、reject、excluded/disabled、includedInTraining。reject reason：脸不像、发型/刘海错误、发色/眼色错误、服装漂移、鞋袜错误、饰品缺失、角度不对、肢体错误、多角色、背景污染、画风漂移、低质量/artifact。需求：支持 contact sheet / grid、按小节过滤、批量 keep/reject、原图/canonical/候选图对比、从 reject reason 生成下一轮重生建议。验收：pending 图不会进入训练；freeze dataset 前必须达到最小 keep 数；每张训练图都能追溯到 source/run/prompt/review 决策。

### 5.8 Caption 与 Dataset Freeze
默认 caption 策略改为 `controllable_identity`：caption 中明确写出角色核心特征、服装、鞋袜、饰品和可变姿态/角度信息。规则：trigger token 永远第一位；保留头发、眼睛、服装、鞋袜、饰品等可控身份特征；写入角度、姿势、构图、表情、背景等变量；清理水印、UI、文字、作者名、生成器噪声 tag；支持人工编辑 caption；支持 shuffle caption，但 trigger 必须固定第一位；如启用 text encoder cache，则自动禁用 shuffle/dropout 等冲突项。验收：freeze 后生成不可变 dataset revision；训练只能选择某个 frozen revision；如果用户改 caption 或 keep/reject，需要生成新 revision。

### 5.9 训练执行
训练执行使用独立 worker/CLI，Manager 负责配置、启动、状态和结果展示。默认配置：base checkpoint 用户选择，resolution 1024，bucket 开启，standard LoRA，rank 32，alpha 16，AdamW8bit，bf16，batch size 1，target steps 约 2000，UNet LR `1e-4` 或 `7e-5`，text encoder LR `2e-5` 可关闭，min SNR gamma 5，noise offset 关闭，save every 250–500 steps，source 图权重略高于 synthetic。验收：训练前生成 training config 和 dry-run summary；训练中展示 step、loss、ETA、当前 checkpoint；训练后输出 safetensors、hash、训练日志、配置、metadata；safetensors 必须能打开并读取 metadata/key count；训练依赖不进入 Manager runtime。

### 5.10 参数 UI 分层
普通模式：base checkpoint、trigger token、目标 keep 图片数、训练强度（保守/标准/强）、是否训练 text encoder、测试模板。高级模式：target steps、rank/alpha、UNet LR、text encoder LR、batch size、gradient accumulation、resolution、source/synthetic 权重、save interval、LoRA weight test matrix。专家模式默认隐藏：optimizer、scheduler、dropout、cache latents、cache text encoder outputs、clip skip、network args、noise offset、min SNR、其他 sd-scripts/kohya 参数。验收：普通用户不需要看到专家参数；agent/管理员可打开专家入口调整；每次训练保存完整 resolved config，而不只保存 UI 中显示的参数。

### 5.11 GPU 调度
第一版调度保持简单，但必须有状态与防误触。需求：记录当前 GPU task（ComfyUI generation / LoRA training / LoRA benchmark）；训练正在跑时提示 ComfyUI 生成可能受影响；ComfyUI 队列有任务时启动训练前提示或排队；暂时假设用户不会同时主动启用两类任务，不做复杂抢占；不默认中断已有任务；支持 cancel 当前 LoRA training job；训练结束后释放状态锁。验收：不会在用户无感情况下同时启动长训练和大批量 ComfyUI 任务；UI 能看到当前任务类型、开始时间、预计完成时间；cancel 后 job 状态明确且日志保留。

### 5.12 LoRA 测试与 Promotion
训练完成后自动进入“测试角色 LoRA”流程，复用现有 `角色 lora 测试` 模板。需求：将训练输出 LoRA 复制/登记到 `models/loras/character`；创建临时测试角色 preset，不直接创建正式 preset；使用 7 小节测试模板；支持测试多个 checkpoint 和 LoRA weight，例如 0.65 / 0.85 / 1.0，必要时加 0.45；每张测试图记录 checkpoint、LoRA weight、section、seed、base checkpoint；人工审核后选择最佳 checkpoint 和默认推荐 LoRA weight；通过后创建正式角色 preset；不通过则允许回到训练集、caption、preset prompt 或训练参数阶段重跑。正式 preset 结构：角色 category，7 个标准变体（默认、内裤、内裤+脱鞋、半脱、半脱+上半身、半脱+脱鞋、裸），7 个变体来自同一个 training job 的同一个通过审核 LoRA，不为每个变体单独训练。promotion 默认用一个 `defaultRecommendedWeight` 初始化所有变体，保证行为可预测；如果测试报告明确显示某些变体在不同 weight 下更稳定，可为单个变体保存 `perVariantWeightOverride`（例如默认 1.0、半脱/裸 0.85），但每个正式 variant 最终只能绑定一个明确的 resolved weight，而不是把测试矩阵留到运行时再选择。`lora1` 使用选定角色 LoRA 与 resolved weight，`lora2` 使用角色 LoRA + breast size slider weight 0，半脱相关变体链接 `服装-半脱`，裸变体链接 `服装-全裸`，metadata 记录训练 job、dataset revision、LoRA hash、base checkpoint、测试矩阵、选择理由和最终每个变体的 resolved weight。验收：没有人工通过时不能创建正式 preset；通过 promotion 后正式 preset 可被普通 Manager 项目直接使用；临时测试 preset/project 可清理，但训练产物和报告保留。

### 5.13 训练失败诊断与返工入口
测试未通过时，系统应该给出诊断建议，但不能自动决定返工路径；最终由用户选择回到训练集、caption、preset prompt 还是训练参数。诊断来源包括：测试小节 reject reason、不同 checkpoint/weight 的对比、训练集 section 分布、caption audit、synthetic/source 比例、loss/step 日志和用户备注。

建议规则：
- 脸不像、发型/刘海/眼睛持续错误：优先检查 canonical、Prompt Card、source anchor 和训练集角度覆盖；建议补充/重生 identity anchor、小节重生或重新 freeze dataset。
- 默认服装漂移、鞋袜/饰品丢失：优先检查 Prompt Card 与 caption 是否显式写出关键服装细节，检查 synthetic 是否过多或质量不稳；建议修 caption、提高 source/高质量图比例、重筛训练集。
- 低 weight 不生效、高 weight 才像但同时变形：可能训练不足或 caption/trigger 绑定不稳定；建议检查 steps、rank、caption 策略和 trigger token。
- 高 weight 脸崩/肢体崩/过拟合，低 weight 可用：优先尝试选择较低 final weight 或更早 checkpoint；必要时降低训练强度/steps。
- identity 可用但 7 小节构图失败：通常不是训练失败，优先修改测试/正式 preset prompt、section prompt 或 ComfyUI 工作流参数。
- 画风、背景、artifact 被带入 LoRA：优先回到训练集审图和 caption 清理，剔除污染图或降低 synthetic 比例。

诊断报告输出 `recommendedReturnPoint`（`dataset` / `caption` / `prompt` / `trainingConfig` / `weightSelection`）、原因、证据图片、建议动作和风险提示；用户确认后才创建新的 dataset revision、训练 run 或 promotion run。

## 6. 时间预期
正常一轮系统化流程预期：训练集生成 + 筛选约 2–5 小时，LoRA 训练约 1–1.5 小时，LoRA 测试 + 人工审核约 1 小时，整体约 6–9 小时。快速顺利版约 3.5–5 小时；如果多角度反复重生或训练后返工，可能到 10–14 小时甚至分两天。主要瓶颈不是训练本身，而是 canonical 是否稳定、多角度生成是否漂移、审图效率、caption / Prompt Card 是否完整。

## 7. 数据与产物结构
建议每个 training job 产物结构：
```text
lora-training/<characterSlug>/<jobId>/
  input/sources/
  input/source-manifest.json
  analysis/character-card-v*.json
  canonical/
  sections/<sectionId>/runs/<runId>/
    prompt.txt
    prompt.json
    provider-request.redacted.json
    metadata.json
  dataset/revisions/<revisionId>/
  configs/training.toml
  runs/train-*.log
  outputs/*.safetensors
  outputs/hashes.json
  benchmark/
  promotion/
  report.md
```
必须记录 source images hash、canonical versions、Prompt Card versions、每次 GPT-Image-2 的 hostInstruction、renderedPrompt/visualPrompt、redacted request payload、resolved tool params、每张候选图 review 状态、每张训练图 caption、training config、safetensors hash、benchmark sections/images/decisions、promotion decision。

## 8. 非目标 / 暂不做
第一版暂不做完全自动判断角色像不像、自动 promotion、复杂 GPU 抢占/暂停/恢复、局部 mask inpaint 精修、自动混合多个服装/形态成一个 LoRA、把内裤/半脱/裸素材自动混入训练集、角色维度聚合视图、自动发布/分享模型、生产级自动删除坏图。后续可扩展 mask/inpaint fallback、自动审图排序、多训练参数矩阵自动对比、checkpoint/LoRA weight 自动推荐、section-aware dataset balance、派生状态素材训练 A/B 实验。

## 9. 风险与应对
- GPT-Image-2 漂移：所有 synthetic 图默认 pending，必须人工 keep 后才能训练。
- 参考图混淆：prompt 中明确 input1/canonical、input2/source、input3/local reference 的用途。
- 派生状态污染默认服装：第一版不把内裤/半脱/裸等最终 preset 状态自动纳入训练集；若后续实验纳入，必须独立标记、限制比例并和正常服装稳定性做 A/B 对比。
- caption 不一致：freeze 前批量检查，trigger 第一位固定，关键特征如鞋子/刘海必须在 Prompt Card 和 caption 中显式存在。
- 过拟合：控制 steps、source/synthetic 权重、保存中间 checkpoint，通过测试模板选择最佳 checkpoint/weight。
- GPU 冲突：简单调度锁 + 状态提示，第一版不做抢占。
- 训练依赖污染 Manager：训练 worker 独立环境，Manager 只调度和记录。
- 测试通过但最终 preset prompt 不佳：promotion 前再次人工审核 7 个正式变体 prompt。

## 10. MVP 验收标准
MVP 完成后，应能跑通一个真实角色：创建 training job，上传参考图并选择底模；生成并选择 canonical；生成/编辑 Prompt Card；按训练集小节生成候选图；对某个小节用自然语言 + 参考图重生一次；审图 keep/reject 并 freeze dataset；生成 caption 和 training config；启动训练并产出 safetensors；自动跑 `角色 lora 测试` 临时项目；人工选择通过的 checkpoint/weight；创建正式 7 变体角色 preset；能从正式 preset 创建普通 Manager 项目并生成有效角色图；report 中能追溯每张训练图、每个 prompt、训练参数、模型 hash、测试结果和 promotion 决策。

## 11. 上次自训练 LoRA Pilot 参考资产
以下文件是金发偶像自训练 LoRA pilot 的实际产物，用于实现时对齐数据结构、prompt 留档、训练配置、测试 handoff 和报告格式。注意：上次 pilot 的 captionMode 是 `bind_identity_to_trigger`，本需求的新默认策略改为 `controllable_identity`。

### 11.1 Pilot 根目录与报告
- 训练 job root：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow`
- 最终报告：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/report.md`
- 当前 Phase 7 简版 PRD：`/mnt/d/Luca/Code/MyProject/comfyui-manager/docs/prd/auto-review-compatibility-router/phase-7-cold-character-training-prd.md`
- 独立 MVP README：`/mnt/d/Luca/Code/LoRATrainingMVP/README.md`
- 研究记录：`/mnt/d/Luca/Code/LoRATrainingMVP/docs/research-2026-05-20-character-lora.md`

### 11.2 生图提示词与 GPT-Image-2 生成记录
Canonical/front 候选的 prompt 存在 JSON 的 `prompt` 字段中：
- `/mnt/d/Luca/Code/LoRATrainingMVP/outputs/gptimage2_reference_prompt_20260522_124403/repeat_01.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/outputs/gptimage2_reference_prompt_20260522_124403/repeat_02.json`

Canonical/front 候选图片：
- `/mnt/d/Luca/Code/LoRATrainingMVP/outputs/gptimage2_reference_prompt_20260522_124403/repeat_01.png`
- `/mnt/d/Luca/Code/LoRATrainingMVP/outputs/gptimage2_reference_prompt_20260522_124403/repeat_02.png`

最终训练扩图 round 的 prompt 文本目录：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts`（共 44 个 `.txt`）
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/003_turn_front_000.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/004_turn_front_right_045.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/005_turn_right_side_090.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/006_turn_back_right_135.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/007_turn_back_180.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/008_turn_back_left_225.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/009_turn_left_side_270.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/010_turn_front_left_315.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/011_front_arms_relaxed.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/012_front_hands_near_skirt.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/013_front_one_hand_chest.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/014_front_hand_on_waist.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/015_front_slight_contrapposto.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/016_front_small_wave.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/017_front_skirt_visible.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/018_front_idle_model_pose.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/019_threeq_right_relaxed.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/020_threeq_right_hand_waist.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/021_threeq_left_relaxed.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/022_threeq_left_small_wave.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/023_expr_gentle_smile.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/024_expr_big_smile.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/025_expr_neutral.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/026_expr_shy.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/027_expr_surprised.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/028_expr_wink.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/029_expr_determined.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/030_expr_soft.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/031_crop_cowboy_front_smile.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/032_crop_cowboy_threeq_right.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/033_crop_cowboy_threeq_left.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/034_crop_upper_front.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/035_crop_upper_threeq_right.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/036_crop_upper_threeq_left.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/037_crop_portrait_front.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/038_crop_portrait_shy.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/039_fullbody_clean_line_front.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/040_fullbody_clean_line_threeq_right.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/041_fullbody_clean_line_threeq_left.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/042_fullbody_symmetric_front_detail.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/043_fullbody_sleeve_detail.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/044_fullbody_skirt_tights_detail.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/045_fullbody_bodice_detail.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/prompts/046_fullbody_final_anchor.txt`

最终训练扩图 round 的 metadata 目录：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata`（共 44 个 `.json`，含 provider、host_model、image_model、size、quality、input_images、prompt、created_at 等）
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/003_turn_front_000.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/004_turn_front_right_045.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/005_turn_right_side_090.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/006_turn_back_right_135.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/007_turn_back_180.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/008_turn_back_left_225.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/009_turn_left_side_270.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/010_turn_front_left_315.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/011_front_arms_relaxed.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/012_front_hands_near_skirt.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/013_front_one_hand_chest.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/014_front_hand_on_waist.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/015_front_slight_contrapposto.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/016_front_small_wave.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/017_front_skirt_visible.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/018_front_idle_model_pose.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/019_threeq_right_relaxed.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/020_threeq_right_hand_waist.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/021_threeq_left_relaxed.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/022_threeq_left_small_wave.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/023_expr_gentle_smile.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/024_expr_big_smile.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/025_expr_neutral.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/026_expr_shy.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/027_expr_surprised.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/028_expr_wink.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/029_expr_determined.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/030_expr_soft.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/031_crop_cowboy_front_smile.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/032_crop_cowboy_threeq_right.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/033_crop_cowboy_threeq_left.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/034_crop_upper_front.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/035_crop_upper_threeq_right.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/036_crop_upper_threeq_left.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/037_crop_portrait_front.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/038_crop_portrait_shy.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/039_fullbody_clean_line_front.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/040_fullbody_clean_line_threeq_right.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/041_fullbody_clean_line_threeq_left.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/042_fullbody_symmetric_front_detail.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/043_fullbody_sleeve_detail.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/044_fullbody_skirt_tights_detail.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/045_fullbody_bodice_detail.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/metadata/046_fullbody_final_anchor.json`

最终扩图 manifest：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/expansion/round-001/manifest.json`

相关 GPT-Image-2 实验/参考 prompt 文件（不一定全部进入最终训练集，但用于确定 canonical/turnaround 策略）：
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/gpt_image2_direction_test/img_ff53db3e_gpt55_original_input/prompt_front.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/gpt_image2_direction_test/img_ff53db3e_gpt55_simple/prompt_front.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/gpt_image2_direction_test/img_ff53db3e_high/front_prompt.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/gpt_image2_repeat_generate_clean/20260522_091533_img_ff53db3e_gpt55/prompt_generate_clean.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/gpt_image2_repeat_randomness/img_ff53db3e_original_front_prompt_gpt55_20260521_231105/prompt_front.txt`

相关非主路径图像工作流/回退实验文件（Qwen Image Edit / RunningHub 方向，供后续 fallback 设计参考；不是本次最终训练集主路径）：
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/qwen_image_examples/qwen_edit_2509_gguf_smoke_prompt_id.txt`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/qwen_image_examples/qwen_image_edit_2509_basic_example.prompt.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/qwen_image_examples/qwen_image_edit_2509_basic_example.workflow.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/qwen_image_examples/qwen_image_edit_basic_example.prompt.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/qwen_image_examples/qwen_image_edit_basic_example.workflow.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/runninghub_1988155372768813058/webapp_detail.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/runninghub_1988155372768813058/workflow_detail_id.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/runninghub_1988155372768813058/workflow_detail_postId.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/runninghub_1988155372768813058/workflow_detail_templateId.json`
- `/mnt/d/Luca/Code/LoRATrainingMVP/data/runninghub_1988155372768813058/workflow_detail_workflowId.json`

### 11.3 角色卡、caption、dataset 文件
- source manifest：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/input/source-manifest.json`
- character card：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/analysis/character-card.json`
- caption audit：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/analysis/caption-audit.json`
- selected manifest：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/dataset/selected-manifest.json`
- metadata jsonl：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/dataset/metadata.jsonl`
- dataset prep summary：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/runs/dataset-prep-summary.json`
- 训练图目录：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/dataset/train/4_blondeidolchar`
- caption sidecar 数量：46 个 `.txt`；目录中还包含对应 `.png` 与缓存 `.npz`。

### 11.4 训练 workflow / 配置 / 日志
- LoRA Training MVP CLI：`/mnt/d/Luca/Code/LoRATrainingMVP/src/lora_mvp/cli.py`
- 数据导入：`/mnt/d/Luca/Code/LoRATrainingMVP/src/lora_mvp/ingest.py`
- 角色卡：`/mnt/d/Luca/Code/LoRATrainingMVP/src/lora_mvp/character_card.py`
- caption：`/mnt/d/Luca/Code/LoRATrainingMVP/src/lora_mvp/caption.py`
- dataset assemble：`/mnt/d/Luca/Code/LoRATrainingMVP/src/lora_mvp/dataset.py`
- 扩图计划/导入：`/mnt/d/Luca/Code/LoRATrainingMVP/src/lora_mvp/expansion.py`
- pipeline dry-run：`/mnt/d/Luca/Code/LoRATrainingMVP/src/lora_mvp/pipeline.py`
- sd-scripts config 生成：`/mnt/d/Luca/Code/LoRATrainingMVP/src/lora_mvp/training_config.py`
- AI Toolkit config 候选后端：`/mnt/d/Luca/Code/LoRATrainingMVP/src/lora_mvp/ai_toolkit_config.py`
- GPT-Image-2 独立脚本：`/mnt/d/Luca/Code/LoRATrainingMVP/scripts/codex_gpt_image2.py`
- 训练配置：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/configs/training.toml`
- run metadata：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/runs/run-metadata.json`
- 训练日志 1：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/runs/train-001.log`
- 训练日志 2：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/runs/train-002-lowram.log`
- 训练 launcher：`/mnt/d/Luca/Code/LoRATraining/run_sdxl_lora.sh`
- accelerate config：`/mnt/d/Luca/Code/LoRATraining/accelerate/default_config.yaml`
- 训练 venv 指针：`/mnt/d/Luca/Code/LoRATraining/VENV_PATH.txt`
- sd-scripts 根目录：`/mnt/d/Luca/Code/LoRATraining/sd-scripts`

上次实际训练摘要：base checkpoint `/mnt/d/Luca/Code/ComfyUI/models/checkpoints/oneObsession_v19Atypical.safetensors`，dataset 46 张图，repeats 4，有效训练图 184，trigger `blondeidolchar`，resolution `1024,1024` + buckets，network `networks.lora` dim 32 alpha 16，bf16，AdamW8bit，UNet LR `1e-4`，text encoder LR `2e-5`，batch size 1，epochs 11，steps 2024，最终 LoRA SHA256 `357ad08847c17741fc02be54f930fc24532db5ea326fd180cf44301254e50154`。

### 11.5 LoRA 输出、hash、Manager 测试 handoff
- 输出目录：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/outputs`
- final LoRA：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/outputs/blonde_idol_gptimage2_mvp_v1.safetensors`
- hashes manifest：`/mnt/d/Luca/Code/LoRATrainingMVP/data/lora-training/blonde-idol-gptimage2/job-20260522-fullflow/outputs/hashes.json`
- copied Manager LoRA：`/mnt/d/Luca/Code/ComfyUI/models/loras/character/blonde_idol_gptimage2_mvp_v1_20260522_fullflow.safetensors`
- Manager relative path：`character/blonde_idol_gptimage2_mvp_v1_20260522_fullflow.safetensors`
- 临时测试 manifest：`/root/.hermes/comfyui-tests/blonde_idol_selftrain_lora_test_manifest_20260522-155558.json`
- 临时测试 status：`/root/.hermes/comfyui-tests/blonde_idol_selftrain_lora_test_status_20260522-155558.json`
- 测试输出 root：`/mnt/d/Luca/Code/MyProject/comfyui-manager/data/images/lora-blonde-idol-gptimage2-mvp-v1-20260522-fullflow-20260522-155558`
- 测试项目：`金发偶像-LoRA测试-blonde_idol_gptimage2_mvp_v1_20260522_fullflow-20260522-155558`
- 测试结果：7/7 sections done，14 images total，无 failures。

## 12. 实现备注
实现 Manager 集成时，优先把上面 pilot 的文件结构抽象成 DB + artifact store：DB 保存 job/section/run/image/revision/status/decision 的索引，artifact store 保存原始 prompt、图像、caption、训练配置和日志。不要把 pilot 中的“所有 synthetic 图直接 includeInTrain=true”照搬为默认行为；新流程里 synthetic 图必须先 pending，人工 keep 后才能进入 frozen dataset。专家参数入口默认隐藏，但要保留给 agent 调参。
