# 上游 v0.8.1 ～ v0.8.9 可移植性评估

评估对象：`CookSleep/gpt_image_playground` 自分叉点（v0.8.0）之后发布的全部改动。
本仓库分叉点：`864f101`（`chore: release v0.8.0`，2026-10-12）。

## 1. 现状

- 上游最新 `76b0869`（v0.8.9，2026-11-06）。分叉点之后共 **174 个文件、+22972 / −1390** 行。
- 本地相对分叉点有 9 个自有提交，改动 **30 个文件、+815 / −2827**，集中在：
  - 设置页重写：「API 配置」→「密钥管理」（按服务商/接口分组共用密钥、多密钥切换，新增 `src/components/settings/ApiKeySettingsTab.tsx`），`SettingsModal.tsx` 被精简 1472 行。
  - 输入栏参数区改成行内胶囊控件（`input/inputParamsPanel.tsx` 115+/304−），删除「更多 / 批量」弹层。
  - `Header.tsx` 重写（去掉安装、客户端下载、关于页入口，加「一分钱生图」）。
  - 删除 `AboutSettingsTab.tsx`、`CustomProviderModal.tsx`、`FontLicensesModal.tsx`、`ProfileImportUrlModal.tsx`、公告里的客户端介绍页。

### 冲突面（双方都动过的文件）

```
.github/*（4 个工作流 + Issue 模板）      README.md / AGENTS.md
public/announcements.json                 public/announcements/client-intro.*（本地已删）
src/components/Header.tsx                 src/components/HelpModal.tsx
src/components/InputBar.tsx               src/components/SettingsModal.tsx
src/components/icons.tsx                  src/components/input/inputParamsPanel.tsx
src/components/settings/GeneralSettingsTab.tsx
src/components/settings/{About,CustomProviderModal,FontLicenses,ProfileImportUrl}*（本地已删）
src/lib/apiProfiles.ts (+ .test.ts)       src/lib/presetConfig.ts
src/store.ts (+ .test.ts)                 src/types.ts
```

其余上游改动落在**本地一行未动**的文件上，可以按 patch 近乎原样套用——这是本次能低成本跟进的根本原因。

## 2. 结论速览

| 上游功能 | 版本 | 代码量 | 难度 | 建议 |
|---|---|---|---|---|
| GPT Image 2.6 参数体系（复杂度 / GIF / SVG / fal 2.6） | 0.8.5 | 核心 ~300 行 + UI | 中 | **接** |
| 不可用参数置灰并说明原因 | 0.8.8 | 依赖 2.6 + Select | 低（随 2.6） | **接** |
| 内容审核拦截信息（阶段 + 类别） | 0.8.5 | ~20 行 | 低 | **接**（可先单独上） |
| 下拉菜单 / 字体候选项滚动条裁进圆角 | 0.8.4 | 2 个文件 | 低 | **接** |
| Markdown 不再先闪原文 + 空闲预加载 | 0.8.7 | ~25 行 | 低 | **接** |
| 收藏夹页新建任务自动加入当前收藏夹 | 0.8.4 | ~40 行 | 低 | **接** |
| 链接导入复用相同配置 / 关闭导入确认 | 0.8.9 | ~50 行 | 低 | **接** |
| 移动端参数胶囊溢出输入框 | 0.8.6 | **1 行 CSS** | 低 | **接** |
| 客户端任务详情里任务 ID / 图片 ID 布局 | 0.8.9 | ~34 行 | 低 | **接**（仅客户端显示） |
| 输入框「+ → 添加链接」+ `$inputImages.base64/urls` | 0.8.1（PR #153） | ~120 行 | 低-中 | 接（独立，可先上） |
| 参考图标注存独立 markup 图层 | 0.8.5 | ~150 行 | 中高 | 可选（建议随 2.6 一起做） |
| 主题：跟随系统 / 浅色 / 深色 + 外观分页 | 0.8.1 | ~120 行 | 中 | 可选（一次性全链路） |
| 隐私模式（快捷键一键隐藏） | 0.8.1 | ~600 行，散在 15 个文件 | 中高 | 可选 |
| Windows 客户端 CLI + Skill | 0.8.2 / 0.8.7 | Rust ~1380 行 + 前端 ~570 行 + NSIS +348 | 高 | 不建议（除非要桌面端能力） |
| 第三方许可清单 / 关于页开源协议 | 0.8.1 | 1.4 万行文本 + 脚本 | 低 | 不建议（关于页已删） |
| 自绘标题栏、换 logo、PWA 图标 | 0.8.1 | 组件 + Tauri 配置 | 中 | 不建议（与你的 Header/品牌冲突） |
| 公告、赞助预置、README / 工作流 | 全程 | — | — | 不建议 |

## 3. A 级：建议接过来

### A1. GPT Image 2.6 参数体系（v0.8.5 主体 + v0.8.6 默认模型 + v0.8.8 置灰）

上游能力：`complexity`（low/medium/high/auto）、GIF 输出（帧数 2–16、每帧时长）、SVG 输出（由文本模型编写，`profile.svgModel`，默认 `gpt-6.1-sol`）、fal.ai 的 2.6 端点、自定义服务商用 `$params.complexity / $params.frame_count / $params.frame_duration_ms / $params.svg` 映射、Codex CLI 也可用复杂度与 GIF/SVG、不适用的参数置灰并说明原因。

**纯逻辑层可近乎照抄**（这些文件本地与 v0.8.0 完全一致）：

| 文件 | 上游改动 | 说明 |
|---|---|---|
| `src/lib/imageModels.ts` | +45/−3 | 新增 `parseGptImageVersion`、`isGptImage25PlusModel`、`isGptImage26PlusModel`、`supportsExtendedQuality`、`supportsGptImage26Params`、`supportsImageMarkup`、`isVectorOrAnimatedFormat`；`isGptImage25Model` 被替换 |
| `src/lib/paramCompatibility.ts` | +49/−10 | 新增 `getParamDisabledReasons`、`supportsTransparentOutput`，`normalizeParamsForSettings` 改按 disabled 清洗 |
| `src/lib/imageApiShared.ts` | +43/−4 | `applyGptImage26Params`、MIME 表加 svg/gif、`pickActualParams` 用 `OUTPUT_FORMATS` |
| `src/lib/openaiCompatibleImageApi.ts` | +46/−7 | Images / Responses 工具 / 编辑接口 / 自定义服务商上下文统一挂 2.6 参数；SVG 强制单张、禁用流式 |
| `src/lib/falAiImageApi.ts` | +25/−7 | fal 2.6 端点映射 |
| `src/lib/canvasImage.ts` | +36/−1 | SVG 固有尺寸兜底、`toApiInputImageDataUrl`（输入图不接受 SVG/GIF）、`composeMarkupDataUrl` |
| `src/types.ts` | +52/−1 | `OUTPUT_FORMATS`、`IMAGE_COMPLEXITIES`、GIF 范围常量、`ParamDisabledReasons`、`TaskParams` 新字段、`ApiProfile.svgModel` |
| `src/lib/persistedState.ts` / `src/lib/db.ts` | +21/−4、+14/−2 | 旧任务数据归一化（缺字段补默认值），向后兼容 |
| `src/lib/transparentImage.ts` | 1 行 | 透明背景下的格式转换 |
| `src/lib/exportZip.ts` | +2 | 备份带上新字段 |
| `src/lib/settingsCustomProvider.ts` | +39/−29（只取模板变量说明） | 自定义服务商文档 |

**需要按你的 UI 重写/手工接线的部分**（因为参数区已被你改成行内胶囊）：

- `input/inputParamsPanel.tsx`：上游把复杂度、格式（PNG/JPEG/WebP/SVG/GIF）、GIF 帧参数放在「更多」弹层里，你用不上。按现有胶囊风格加 3 处即可：
  - 新增「复杂度」Select 胶囊（4 个值，`disabledReason` 置灰）；
  - 「格式」列的 options 从 3 项扩到 5 项，SVG/GIF 按 `disabledReasons` 置灰并提示原因；
  - 输出 GIF 时在格式胶囊后追加「帧数」「每帧时长」两个小输入框（上游 `GifParamInput` 逻辑可直接抄：越界取边界、清空保留原值、卸载时补提交）。
- `InputBar.tsx`：`getParamDisabledReasons(...)` 计算一次传下去；质量选项改为始终渲染 6 项并带 `disabledReason`；`panelParams`（Agent 模式把 svg/gif 视为 png）；`compressionDisabled` 加 svg/gif 判断。
- `DetailModal.tsx` / `TaskCard.tsx`：展示复杂度、帧参数（接口不回传 complexity，只显示设置值）。
- `store.ts`：提交时把参数带到请求、恢复任务的 `params` 归一化。
- 设置页：给 `ApiProfile` 加「SVG 编写模型 ID」输入框——**你的密钥管理页需要单独加一处**（上游在 API 配置 tab 里）。

**注意点**：

1. `DEFAULT_IMAGES_MODEL` 上游从 `gpt-image-2.5-sunburst` 改成 `gpt-image-2.6-sunburst`。你如果有锁定预置配置（`presetConfig`），会影响新建配置的默认模型，需明确决策。
2. `supportsImageMarkup` 依赖 markup 图层（见 B2），先不做图层时该函数保持返回 false 即可，不必急着接。
3. 上游 `gptImage26.test.ts`（332 行）和 `falAiImageApi.test.ts`、`api.test.ts` 的新增用例基本可以照搬，但 `createDefaultOpenAIProfile` 等 helper 在你的 `apiProfiles.ts` 里有改动，需小改。
4. 涉及 IndexedDB 旧数据，务必保留 `normalize*` 兼容处理，并按 AGENTS.md 跑 `npm run build` + `npm test`。

**工作量**：逻辑层 0.5～1 天（近乎照抄 + 跑测试），UI 接线 1 天左右。

### A2. 下拉菜单滚动条 / 置灰原因（v0.8.4 + v0.8.8 的基础设施）

上游把下拉面板拆成「外壳裁切 + 内层滚动」，并抽出 `getDropdownSpace` 同时算上下可用高度。

| 文件 | 上游改动 | 说明 |
|---|---|---|
| `src/lib/dropdown.ts` | +18/−4 | 新增 `DROPDOWN_PANEL_CLASS`、`DROPDOWN_SCROLL_CLASS`、`getDropdownSpace` |
| `src/components/Select.tsx` | +272/−288 | 结构调整 + 选项支持 `disabledReason`（置灰并显示原因）+ 重命名 `Option` → `export interface SelectOption` |
| `src/index.css` | 少量 | `custom-scrollbar`、`ios-rounded-scroll-fix` 两个类 |

这两个文件你**一行没改过**。已核对上游 `Select` 的 props（`value` / `onChange` / `onReorder` / `options` / `disabled` / `className` / `onOpenChange` / `showValueTooltips` / `prefix` / `menuClassName`）是 v0.8.0 的超集，`Option` 的字段也只增不减（新增可选 `disabledReason`），所以**整文件替换是类型兼容的**；唯一改名是 `Option` → 导出的 `SelectOption`，你的调用点都没有按名字引用它。

上游 `SizePickerModal` 同期把 `allowAuto` 换成 `autoDisabledReason`（+27/−40），那是配合置灰原因的额外改动，**换 Select 时不必跟**——不跟也不会报错。

如果你只想拿最小收益（菜单向上弹 + 滚动条不伸边），也可以只取 `lib/dropdown.ts` 的 22 行 + `Select.tsx` 里 placement 那 20 行；但 A1 的「参数置灰并说明原因」要用 `disabledReason`，整份替换更省事。

### A3. Markdown 渲染不再先闪原文（v0.8.7）

- `MarkdownRenderer.tsx` +20/−6：模块级缓存已加载的渲染器；加载慢于 300ms 才回退显示原文（`visibility: hidden` 占位）；导出 `preloadMarkdownRenderer()`。
- `App.tsx`：`requestIdleCallback` 空闲预加载（超时 3s 兜底）。

改动小、零耦合、体验提升明显，适合顺手带上。

### A4. 收藏夹页新建/重试任务自动加入当前收藏夹（v0.8.4）

- 新增 `src/lib/favoriteState.ts`（19 行）；
- `store.ts` 的提交与重试路径各加一处判定；
- `types.ts` + `apiProfiles.ts` 加 `saveTasksToActiveFavoriteCollection`（默认 true）；
- `GeneralSettingsTab.tsx` 的「任务与下载」分组加开关。

体量很小，且你的设置页仍保留「任务与下载」分组，落点清晰。

### A5. 链接导入复用相同配置 / 关闭导入确认弹窗（v0.8.9）

- `apiProfiles.ts` +5：`getApiProfileContentKey`（比较时忽略 id / isDefault）；
- `urlSettings.ts` +34/−5：导入时先按内容匹配已有配置，命中就复用其 id（不再造重复配置），并保留本地默认标记；
- `importLink.ts` +5/−2：`describeImportLink` 增加 `hasConfigChanges`、列出「SVG 编写模型 ID」；
- `useImportLinks.ts` +10/−5：无配置变化时不再弹窗，直接走切换；
- 新增 `VITE_SHOW_CONFIG_CHANGE_DIALOG` 环境变量（Docker 用 `SHOW_CONFIG_CHANGE_DIALOG`）。

你的链接导入链路（`useImportLinks` + `ImportLinkDiff` + `ConfirmDialog`）与上游结构一致，只有「生成分享链接」的 `ProfileImportUrlModal` 被你删了——不影响这条链路。属于低风险小补丁。

### A6. 内容审核拦截信息（v0.8.5 附带）

`imageApiShared.ts` 的 `appendModerationDetails`：把 `moderation_blocked` 的 `moderation_details` 翻成「拦截来源：提示词或参考图 / 生成结果；类别：…」。约 20 行，独立可先上（A1 会顺带带入）。

### A7. 一堆成本极低的小修（建议顺手带走）

| 文件 | 改动 | 效果 |
|---|---|---|
| `src/index.css` | **1 行**：`.collapse-section > .collapse-inner { min-width: 0 }` | 参数胶囊摘要变长时不再撑出输入框（v0.8.6 的移动端修复；你的 `inputParamsPanel` 改成胶囊后同样会遇到） |
| `src/components/DetailModal.tsx` | ~34 行 | 客户端任务详情把任务 ID / 图片 ID 排成 `grid-cols-[3rem_minmax(0,1fr)_1.5rem]`，等宽字体 + 截断 + 复制按钮（同文件其余 diff 属 2.6/markup/隐私模式，要剔除） |
| `src/components/ConfirmDialog.tsx` | +2 | `renderMessage` 改为导出（「」加粗、`**…**` 去掉星号、反引号转 code），`startupNotice.tsx` 同步用上 |
| `src/hooks/useHintTooltip.ts` | +4 | 弹层关闭后提示一并清除 |
| `src/components/input/paramPopoverChip.tsx` | +9 | 关闭弹层时 `dismissAllTooltips()` |
| `src/components/settings/saveDirMigration.tsx` | +4 | 迁移清单滚动条裁进圆角 |

## 4. B 级：看需求，值得做但要动 UI

### B1. 输入框「+ → 添加链接」+ `$inputImages.base64/urls`（v0.8.1，PR #153）

新增 `input/addImageUrlsModal.tsx`（195 行）与 `lib/inputImages.ts`（只取 `toReferenceImage` 18 行）；`InputBar.tsx` 加一个菜单项 + 弹窗（你的上传菜单还在，冲突很小）；`store.ts` 的 `addImageFromUrl` 增强（`res.ok` 校验、SVG/GIF 转 PNG、记录 `imageSourceUrls`）；`persistedState.ts`/`exportZip.ts`/`types.ts` 记 `sourceUrl`；`createCustomProviderContext` 加 `base64`/`urls` 两个模板变量，只写 `$inputImages.urls` 的服务商在遇到非链接参考图时明确报错。

**注意**：`addImageUrlsModal.tsx` 里有 3 处 `privacyModeEpoch` 判断，不移植隐私模式时删掉；同一文件里的 `persistTaskInputImages` 属于 markup 图层，不要一起搬。

### B2. 参考图标注存独立 markup 图层（v0.8.5）

画板标注不再烧进原图，而是单独存一张同尺寸透明层（`InputImage.markupImageId` / `TaskRecord.markupImageId`），第一张参考图在支持的情况下以 `markup` 表单字段发送，否则 `composeMarkupDataUrl` 合成后发送；缩略图、Lightbox、任务详情都要显示标注。

涉及 `SketchBoardModal.tsx`（+77）、`InputBar.tsx`、`store.ts`（19 处）、`DetailModal`、`Lightbox`、`inputDraftState`、`types`。与 2.6 同一批代码，建议一起做，否则 `supportsImageMarkup` 只能恒为 false。

### B3. 主题：跟随系统 / 浅色 / 深色（v0.8.1）

新增 `lib/colorMode.ts`(7)、`hooks/useColorMode.ts`(34)、`public/color-mode.js`(10，首屏防闪)、`settings/AppearanceSettingsTab.tsx`(56)；改 `tailwind.config.js`（`darkMode: 'media'` → `'class'`）、`index.html`、`index.css` 里 5 处 `@media (prefers-color-scheme: dark)`、`sw.js` 预缓存、`SketchBoardModal` 的深色判定、`AnnouncementModal` 的 iframe 主题。

**这是一次性开关**：`tailwind` 切成 `class` 后如果 `color-mode.js` / `useColorMode` 没同时上线，全站深色样式立即失效。

**建议**：不要照搬上游新增「外观配置」tab——你的 `GeneralSettingsTab` 里已经有「外观」分组（放字体），把颜色模式下拉加在那里，再顺手把字体设置留在原地，可以完全绕开 `SettingsTab` 类型和设置页 tab 列表的改动。

### B4. 隐私模式（v0.8.1）

上游实现：快捷键（默认 `Ctrl+Shift+H`，可自定义）一键把已有任务、对话、输入框内容和收藏夹入口隐藏并回到主页；期间新建的任务保留，退出时恢复进入前的输入框草稿。

逻辑层零耦合，可整文件搬：`lib/privacyMode.ts`(89)、`lib/keyboardShortcut.ts`(81)、`hooks/usePrivacyMode.ts`(46)、`lib/pageScroll.ts`(14)、`settings/ShortcutRecorder.tsx`(71) + 两个测试。

代价在接线：`store.ts` 有 13 个隐藏判定点（通知、持久化、图片引用计数、超时/恢复提示、完成提示、`setDetailTaskId`）、`AppState` 加 3 个字段与 `togglePrivacyMode`；UI 侧 11 个组件要接（`TaskGrid`/`TaskCard`/`SearchBar`/`DetailModal`/`HistoryModal`/`SupportPromptModal`/`AgentWorkspace`/`AnnouncementModal` 与 v0.8.0 一致，可抽 hunk；`Header`/`InputBar`/`App`/`GeneralSettingsTab` 要手改）。

上游 `togglePrivacyMode` 里两处依赖你本地没有的东西（`useSettingsDataTransfer`、`dismissAllTooltips`），搬的时候要删。

## 5. C 级：不建议接

| 改动 | 理由 |
|---|---|
| Windows 客户端 CLI：Rust 新增 ≈1380 行（`cli.rs` 152、`cli/command.rs` 374、`cli/pipe.rs` 188、`cli/skill.rs` 273 + 测试 185、`bin/cli.rs`、`permissions/cli.toml`），改造 `lib.rs` +34、`Cargo.toml` +24、`storage/images.rs` +16、`windows/installer.nsi` +348；前端 `lib/cliBridge.ts`(434)、`settings/SkillSettingsSection.tsx`(134)、`skills/`(233) | 网页版完全用不到（非 Windows 下 `cli::start` 是空实现、`installCliBridge` 有 `isTauri` 守卫）。且与你的分支正面冲突：`settingsActions.ts` 你没有；`cliBridge` 直接写 `profile.apiKey`，与你的分组密钥模型（`apiKeys[]` + `activeApiKeyId`）冲突；`generate_image` 要改 `store.submitTask` 的签名；`--complexity/--format svg` 依赖 2.6 参数。要做必须重打并签名安装包、实测三种安装路径 |
| 客户端启动自动更新已安装 Skill（v0.8.7） | 代码在 `cli/skill.rs` 里，无法只挑自动更新；前提是先有 CLI/Skill 体系 |
| 第三方许可清单（`src/assets/third-party-notices.txt` 14060 行 / 724 KB、`scripts/build-notices.mjs`、`third-party-licenses/*`、`src-tauri/about.toml`） | 该文件唯一消费点是 `FontLicensesModal.tsx`，入口在 `AboutSettingsTab` —— 两个文件你已删除，直接搬进来是个没有入口的死资源。要做必须先恢复入口，并每版本重跑 `cargo-about` |
| 自绘标题栏（`components/TitleBar.tsx` + `tauri.conf.json` 的 `decorations:false` + 6 条 `core:window:*` 权限 + `lib.rs` 的 window-state 排除 + `--safe-area-top` 变量） | 安装包级行为变更（失去系统边框与原生最大化/贴边），与你的 Header 改造、`index.css` 顶栏高度变量互相纠缠，需实机验证拖动/双击最大化 |
| 换 logo / PWA 图标 / `manifest.webmanifest` | 品牌决策，与你自己的品牌无关 |
| `index.css` 里经典滚动条 + `--header-height` + `--page-scrollbar-width` 的整体重构 | 为自绘标题栏服务，与你的 Header 重写冲突（只挑下一行的「胶囊溢出」1 行和 `custom-scrollbar`、`ios-rounded-scroll-fix` 两个类） |
| 窄窗口 Agent 页滚轮展开/收起顶栏（v0.8.3） | 依赖上游 Header 结构与 `data-page-scroll` 包裹层，你的 Header 已重写，收益小、改动面大 |
| Rust 侧 60/72/28/10 行的 `update.rs`、`http.rs`、`proxy.rs`、`close_watch.rs` 改动 | 全是 `cargo fmt` 换行重排，零收益、纯制造冲突 |
| 公告 / `sponsor-presets.json` / README / `.github` 工作流（含 `actions/checkout@v7`、node 24 升级）/ `deploy/*` | 与你的部署和公告策略不同 |
| `package.json` 的 `allowScripts` 段 | 新版 npm 的安装脚本开关，与功能无关 |
| 上游 `icons.tsx` 新增的 `SparklesIcon`、`BrandIcon`、`ClaudeCodeIcon`、`CodexIcon`、`FolderIcon` | 只被 Skill/CLI 相关界面引用，你要接的功能不需要（`LinkIcon` 你本来就有） |

### 依赖：这批改动一个包都不用装

- `package.json` 的差异只有 `version`、`scripts.notices`、`allowScripts` 三处；`package-lock.json` 只有 2 个 `version` 字段。
- `rehype-katex` / `remark-math` / `robot3` 不是新增依赖，它们是 `streamdown` / `@streamdown/math` 的传递依赖，v0.8.0 就已经装上；它们出现在 `third-party-licenses/npm/` 只是因为 tarball 里没有 LICENSE 文件。
- 唯一「新包」在 Cargo 侧（`base64 = "0.22"`，lock 里本来就有），只在你决定做 CLI 时才需要。

## 6. 建议的落地顺序

1. **A7 小修 + A3 Markdown 预加载 + A2 下拉菜单**（1 个 CSS 行 + 三个文件，风险最低，先验证一遍构建与测试）。
2. **A6 审核拦截信息**（20 行，可单独提交验一次发布）。
3. **A1 GPT Image 2.6**：先逻辑层 + 测试（`npm test`），再改 `inputParamsPanel` / `InputBar` / `DetailModal` / `TaskCard`，最后设置页加 SVG 模型输入框。
4. **A4 收藏夹自动加入**、**A5 链接导入复用**（小补丁，可合并成一次提交）。
5. **B1 添加链接**（独立、可验证）。
6. 视需要：**B2 markup 图层**（与 A1 同源）、**B3 主题**（一次性全链路，最后做）、**B4 隐私模式**（先搬逻辑层，UI 分批接）。

## 7. 版本与发布

- 当前 `package.json` 是 `0.8.0`，与上游版本号已经脱钩。跟进这批改动后建议升到 `0.8.10`（继续跟上游序列）或 `0.9.0`（视为一次较大的能力更新），并同步 `package-lock.json`、`public/sw.js` 的 `CACHE_NAME`、`RELEASE.md`、`src-tauri/Cargo.toml` / `Cargo.lock`（见 AGENTS.md「发布版本升级」）。
- 合并前跑 `npm run build` + `npm test`；涉及 IndexedDB 结构（`TaskParams` 新字段）的部分要确认旧任务能正常显示与重试。

## 8. 附：本次评估的做法（下次同步可复用）

本机 `git fetch https://github.com/CookSleep/gpt_image_playground.git` 会被重置连接，但普通 HTTPS 下载可用，所以改用源码压缩包 + `git diff --no-index` 对比：

```powershell
# 1. 取上游最新代码
Invoke-WebRequest 'https://codeload.github.com/CookSleep/gpt_image_playground/zip/refs/heads/main' -OutFile "$env:TEMP\upstream-main.zip"
Expand-Archive "$env:TEMP\upstream-main.zip" -DestinationPath "$env:TEMP\gip-upstream" -Force

# 2. 导出本仓库的分叉点（v0.8.0）作为基线
git archive 864f101 -o "$env:TEMP\gip-base.tar"
tar -x -f "$env:TEMP\gip-base.tar" -C "$env:TEMP\gip-base"

# 3. 上游自 0.8.0 以来的全部改动（退出码 1 = 有差异，正常）
git diff --no-index --stat "$env:TEMP\gip-base" "$env:TEMP\gip-upstream\gpt_image_playground-main"

# 4. 单个文件的改动（移植时的主要参考）
git diff --no-index "$env:TEMP\gip-base/src/lib/imageModels.ts" "$env:TEMP\gip-upstream\gpt_image_playground-main/src/lib/imageModels.ts"
```

版本与功能对照可以用 Releases 的 atom 源（每个版本的说明都在里面，不受 API 限流影响）：

```powershell
[xml]$x = (Invoke-WebRequest 'https://github.com/CookSleep/gpt_image_playground/releases.atom' -UseBasicParsing).Content
$x.feed.entry | ForEach-Object { "$($_.title)" }
```

## 9. 本次已落地（A 级）

45 个文件改动、+1185/−437，`npm run build` 与 `npm test`（63 个测试文件 / 878 项）均通过。

| 项 | 落地内容 |
|---|---|
| 小修 | `index.css` 的 `.collapse-section > .collapse-inner { min-width: 0 }`；`ConfirmDialog` 导出 `renderMessage` 并用于启动提示；`useHintTooltip` 随全局关闭清提示；`paramPopoverChip` 关闭弹层时清提示；`saveDirMigration` 的滚动条裁进圆角 |
| Markdown | `MarkdownRenderer.tsx` 换成上游版（`loadedRenderer` 缓存、300ms 后才回退原文、`preloadMarkdownRenderer`），`App.tsx` 加空闲预加载 |
| 下拉菜单 | `lib/dropdown.ts`、`components/Select.tsx` 换成上游版（`getDropdownSpace`、外壳/滚动层分离、`SelectOption.disabledReason`、向上弹），并补 `dropdown.test.ts` |
| 2.6 逻辑层 | `imageModels`、`paramCompatibility`、`imageApiShared`、`openaiCompatibleImageApi`、`falAiImageApi`、`canvasImage`、`api`、`agentApi`、`transparentImage`、`exportZip`、`persistedState`、`db`、`inputDraftState`、`settingsCustomProvider`、`dataUrl`、`downloadImages` 换成上游版；`types.ts` 合入新参数与常量；`store.ts` 按 hunk 接入（并发判定、SVG 需文生图、透明背景判定、Agent 强制位图、SVG/GIF 输入图转 PNG） |
| 2.6 UI | `inputParamsPanel` 新增「复杂度」胶囊，格式扩到 PNG/JPEG/WebP/SVG/GIF（不可用置灰并说明原因），GIF 时追加「帧数」「每帧 ms」；`InputBar` 计算 `getParamDisabledReasons` 并传参、质量选项带置灰原因；`DetailModal` 显示复杂度与 GIF 帧参数；`TaskCard` 显示复杂度 |
| 内容审核 | `appendModerationDetails`（随 `imageApiShared` 带入） |
| 收藏夹自动加入 | `favoriteState.getNewTaskFavoritePatch`、提交与重试路径、`GeneralSettingsTab` 开关 |
| 链接导入复用 | `getApiProfileContentKey`、`urlSettings`、`importLink`、`useImportLinks`（无配置变化直接应用）、`VITE_SHOW_CONFIG_CHANGE_DIALOG` |

### 与上游的两处刻意差异

1. **默认图像模型仍是 `gpt-image-2.5-sunburst`**（上游 0.8.6 起改为 2.6），避免影响现有部署的默认行为。需要切换时改 `src/lib/imageModels.ts` 的 `DEFAULT_IMAGES_MODEL` 一行即可；模型 ID 不含 `gpt-image-2.6` 时，复杂度、SVG、GIF 会置灰并提示原因。
2. **没有加「SVG 编写模型 ID」的设置项**：设置页已被重写成密钥管理，不便插入单配置字段；未设置时使用默认值 `gpt-6.1-sol`，也可以通过导入链接写入 `svgModel`。要在界面配置可在密钥管理页按配置加一个输入框。

### 未移植

参考图 markup 标注图层（B2）、主题跟随系统（B3）、隐私模式（B4）、添加链接（B1）、客户端 CLI 与 Skill、第三方许可清单、自绘标题栏与品牌资源。

