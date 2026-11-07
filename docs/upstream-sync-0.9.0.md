# 上游 v0.9.0 移植评估

评估对象：`CookSleep/gpt_image_playground` 自分叉点（v0.8.0）之后、截至 `6bd4fc0` 的全部改动。
本仓库的分叉点：`864f101`（`chore: release v0.8.0`，2026-10-12）。

## 1. 现状

- 上游 v0.8.9 之后的提交为 `b863137`（Google / xAI 图像接口与多模型异步任务）、`7f0caea`（配置导入提示）、`2c80f80`（多模型参数与搜索来源界面）、`4d789d9`（图像提示词与任务详情）、`5e1f5e7`（v0.9.0 发布）以及两条文档提交。
- v0.8.9 → `6bd4fc0` 共 **62 个文件、+2407 / −545**，其中约三分之一是设置页、CLI、公告、README 和部署配置。
- 本仓库此前已跟进 v0.8.1–v0.8.9 的 A 级改动，设置页、Header、输入参数栏和公告策略仍与上游不同，因此这次继续按“能独立接入的先行、依赖上游设置页的不接”处理。

## 2. 结论速览

| 上游功能 | 代码量 | 难度 | 建议 | 本次处理 |
|---|---|---|---|---|
| 删除页面上的版本更新提示 | — | 低 | **删** | 已删除 |
| Gemini / Grok 模型识别与参数体系 | 核心 ~300 行 + UI | 中 | **接** | 已接入 |
| Google / xAI 原生图像接口 | ~140 行 | 中 | 接 | 已接入核心，设置页不提供新增入口 |
| 搜索来源、Google 搜索建议展示 | ~150 行 | 低 | **接** | 已接入 |
| 图像生成 / 搜索附加提示词 | ~30 行 | 低 | **接** | 已接入，设置页可关闭 |
| 自定义服务商按模型覆盖映射 | ~60 行 | 低-中 | **接** | 已接入 |
| OpenAI 兼容接口的异步任务查询与恢复 | ~80 行 | 中 | **接** | 已接入 |
| 配置导入确认与切换提示修复 | ~120 行 | 低 | **接** | 已接入 |
| 设置页原生服务商选项 / 服务商拖动排序 | ~40 行 | 中 | 不接 | 设置页已重写为密钥管理，没有服务商编辑入口 |
| 公告、README、部署配置、CLI / Skill | — | — | 不接 | 与本仓库的产品和部署策略无关 |

## 3. 已落地内容

### 3.1 删除版本更新提示

- 删除 `src/components/UpdateModal.tsx`、`src/hooks/useReleaseUpdates.ts`、`src/hooks/useClientUpdate.ts`、`src/lib/clientUpdate.ts`、`src/lib/releaseUpdates.ts` 及其测试。
- 顶栏左上角的 `NEW` 角标、启动时检查 GitHub Release、设置页更新开关、公告因更新弹窗而延后显示的逻辑一并移除。
- `compareVersions` 仍被公告条件使用，移到 `src/lib/version.ts`，不再保留任何 Release 数据请求。
- `AppSettings.autoCheckUpdate` 从类型和清洗逻辑中移除；旧备份或 localStorage 中的该字段会被 `normalizeSettings` 直接忽略。

### 3.2 多模型图像参数

新增或替换的核心文件：

- `src/lib/googleImageApi.ts`：Google `generateContent` 请求、inlineData 参考图、思考图片过滤、搜索 grounding 解析、`n > 1` 拆分为并发单图。
- `src/lib/imageModelParams.ts`：按 Gemini / Grok 模型给出比例、分辨率、质量选项，并生成实际请求参数。
- `src/lib/imageSearch.ts`：Google Search / Image Search / 思考等级的能力判断与 grounding 解析。
- `src/lib/imageProviderMappings.ts`：OpenAI Images 异步任务协议、按模型匹配自定义服务商映射。
- `src/lib/imageModels.ts`：`getImageModelFamily`、`supportsGrokQuality`、`usesGrokSizeParams`。
- `src/lib/openaiCompatibleImageApi.ts`：Gemini / Grok 走 OpenAI 兼容接口时的参数替换、异步任务轮询、JSON 字符串结果解析、`{model}` 占位符。
- `src/lib/imageApiShared.ts`：并发结果合并、搜索 grounding 透传、JPEG / WebP Base64 MIME 识别。
- `src/lib/paramCompatibility.ts`：多模型参数清洗、任务参数支持标记、不可用参数的置灰原因。
- `src/types.ts`：`google` / `xai` 内置服务商、`modelOverrides`、`aspect_ratio` / `resolution` / 搜索 / 思考等级、`ImageSearchGrounding`、`promptHints` 等字段。

界面侧：

- `inputParamsPanel.tsx` 在 Gemini / Grok 模型下显示比例、分辨率，Grok 额外显示质量，Gemini 显示思考等级、网页搜索、图片搜索；非多模型配置仍使用原来的尺寸、质量、复杂度、格式、GIF、压缩率和审核胶囊。
- `InputBar.tsx` 按实际模型计算搜索 / 思考能力和 `panelParams`，Agent 模式与画廊共用同一套参数清洗。
- `TaskCard.tsx` 与 `DetailModal.tsx` 展示比例、分辨率、思考等级、搜索开关和搜索来源；详情中的提示词会显示实际附加的前缀和后缀。
- `store.ts` 在提交、重试、Agent 图片任务、断线恢复和自定义异步任务恢复时带上新参数与 `searchGrounding`。

### 3.3 Google / xAI 原生服务商

- `apiProfiles.ts` 增加 `google` / `xai` 内置服务商、默认地址和模型，以及 `switchApiProfileProvider` 的切换逻辑。
- `api.ts` 按 provider 分发到 `callGoogleImageApi` 或 OpenAI 兼容接口。
- 设置页没有新增服务商入口，原生服务商可通过部署预置配置或导入带有 `provider: "google" | "xai"` 的配置使用；设置页保存时按 Google 使用 `v1beta` 规整地址。

### 3.4 附加图像生成提示词

- `AppSettings.imagePromptHints` 默认开启。
- `api.ts` 为 Google 请求添加“生成图像：”前缀；启用搜索但当前模型 / 服务商没有对应工具时，追加搜索提示词。
- `DetailModal` 展示附加内容；`GeneralSettingsTab` 增加“附加图像生成提示词”开关。

### 3.5 自定义服务商按模型覆盖

- `CustomProviderDefinition.modelOverrides` 支持 `models` 通配符、独立 `submit` / `editSubmit` / `poll`。
- 提交路径、轮询路径、query 和状态查询支持 `{model}`、`{task_id}`、`{taskId}` 占位符。
- 结果路径支持 JSON 字符串包裹的对象，以及结果数组中的字符串链接。
- `settingsCustomProvider.ts` 的 Manifest 说明同步更新，导入配置时可保留 `modelOverrides`。

### 3.6 搜索来源展示

- 新增 `src/components/ImageSearchSources.tsx`：展示 Google 搜索建议（隔离 iframe）和图片来源缩略图。
- `DetailModal` 在参数卡片和创建时间之间展示 `task.searchGrounding`。

### 3.7 配置导入提示

- 导入链接只切换活动配置时提示“已切换到「配置名」”，不再显示“配置已导入”。
- 同 ID 的自定义服务商被覆盖时会列出“修改 N 个 / 新增 N 个”，并说明具体服务商名称。
- 相关 `importLink`、`urlSettings`、`useImportLinks` 与测试已同步。

## 4. 刻意保留的差异

1. **设置页不提供新增 / 切换服务商入口**。本仓库的设置页是密钥管理，不是上游的 API 配置页；原生 Google / xAI 配置通过预置配置或导入链接进入。
2. **没有移植 CLI / Skill、自绘标题栏、主题切换、隐私模式、参考图 markup 图层**。这些仍属于上游的分支能力，与本仓库现有 UI 的接线成本较高。
3. **客户端 Rust 更新模块保留但前端不再调用**。页面上的更新提示和客户端下载 / 安装入口已删除；Rust 侧命令没有后台定时检查，不会主动弹出提示。

默认图像模型使用不带变体后缀的 `gpt-image-2.6`，新配置和默认出图都使用该 ID。

## 5. 验证

- `npm run build` 通过。
- `npm test`：63 个测试文件、949 项通过、1 项跳过。
- 新增 `src/lib/nativeImageApi.test.ts`（Google / xAI / 多模型 / 异步任务 / 自定义映射）与 `src/lib/imageSearch.test.ts`（模型能力与 grounding 解析）。
