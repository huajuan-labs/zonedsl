# ZoneDSL 变更记录

按语义化版本记录组件的**新增 / 修改 / 废弃 / 移除**，便于 skill / 业务 prompt / 前端渲染层同步演进。

## v2.12 · 2026-07-24 · 引文与行内链接(citation + inline link + item 级跳转)

### 背景

AI 输出的长文本需要「引文溯源」和「行内可点」能力。v2.12 把这套能力纳入 ZoneDSL 语法体系。**设计原则:形态由语法前缀决定,零标志位、不看 url**。

### 最终语法模型(行内)

`^` 前缀 = 引文家族(徽章/chip),`@` 前缀 = 提及,其余 = 普通链接:

| 写法 | 渲染 | 判定 |
|---|---|---|
| `[文字](url)` | 下划线链接 | 无特殊前缀 |
| `[1](url)` | 下划线链接 | 纯数字不特殊,就是普通链接 |
| `[@名](url)` | 橙色提及文字 | `@` 前缀,不看 url |
| `[^1](url)` | 数字徽章 | `^` + 数字,行内自包含 |
| `[^@名](url)` | 昵称 chip | `^` + `@`,行内自包含 |
| `[^n]` 裸写 | 数字徽章 | 注册表(内部保留,模型不写) |

### Added

- **行内链接/引文** — 任何流过 `splitInlineMd` 的正文性文本字段(text/quote/alert/list/timeline/era-timeline item/table cell)都支持。`parseLinkTarget` 把 target 映射 intent:宿主自定义 scheme → `open-scheme`,`/pages/` → `open-url`,`https://` → `open-web`,显式 `intent:value` 走白名单。
- **行内自包含引文** `[^1](url)` / `[^@名](url)` — url 就地写,不查注册表,一次性引用首选。
- **注册表引文** `[^n]` + `::sources` — 多次引用去重 / 文末列表。**`::sources` 是内部保留能力,不暴露给 agent**(见下「设计决策」)。
- **宿主引文数据桥接** — 宿主在 markdown 预处理阶段截下引文来源数据,经 `quoteListToRefMap` 建注册表,DSL `[^n]` 解析。只剥离被 `[^n]` 引用到的数据块,其余渲染逻辑不受影响。
- **item 级可点击** — `era-timeline`/`timeline`/`list` 的 `::item` 支持 `intent`/`value`,每项独立跳转。
- **新 intent**:`open-scheme`(宿主自定义 scheme)、`open-web`(https 外链走 webview)。
- **table cell 引文 + `|` 分隔符** — cell 走 splitInlineMd 支持引文/链接;`|` 优先分隔(内容可含逗号),逗号保留向后兼容。
- **gallery 支持 image + video 混排** — `gallery` 子节点从只收 `image` 扩展为 `image`/`video` 共存。video 子节点渲染为封面格(封面 + ▶ 角标),点击走自己的 intent 跳转(复用 `onButtonAction`,同独立 `::video`);image 仍走原生灯箱预览(`onGalleryTap`),灯箱集合 `imageUrls` 只含图、不含视频封面。列数按 image+video 总项数一起算(沿用 1/2/4→对应列数规则)。video 无 intent 或非法时降级纯封面。

### 设计决策(为什么这么做)

- **`::sources` 保留但不给 agent**:引擎完整支持(供宿主下发引文数据和未来扩展),但 SKILL.md 不教、不让 agent 手写。agent 一律用行内自包含写法 `[^1](url)`/`[^@名](url)`。
- **不接管宿主的 markdown 正文渲染体系**:引文/链接的 DSL 语法只在 zone 组件内解析;宿主自有的正文增强体系(如数据胶囊)与 ZoneDSL 可混排、各管各的。
- **不接 `[x](x)` 多属性**:行内式保持最简(agent 零学习成本)。要富数据用 `::source` 加 attr(内部),或未来新增 `::mention` 组件。
- **标题不做引文**:magazine-cover/chapter/editorial-hero 标题只认高亮(`**`/`~~`/`==`),不解析引文/链接 —— 大标题是 AI 自己的提炼,不是引用陈述。
- **`::source` 最小集**:只有 `name` + `url` 必需,`n=` 可选。

### 流式安全

- `trimUnclosedInline` 加 `[` 系列裁剪:`[^1` / `[^@名](` / `[文字](url` 半截裁到未闭合标记前
- 普通 `Array[0]` 等非标记用法不误裁

### 落地登记

- `zone-dsl/toWxNodes.js`:`parseLinkTarget`(target→intent);`pickIntent`(item intent);`splitInlineMd` 加 cite/link/mention part;`makeCitePart`/`makeInlineCite`;`trimUnclosedBracket`;`parseSourceNode`/`assignSourceNumbers`/`buildRefMapFromAst`/`buildSourcesRefMap`/`quoteListToRefMap`;`sources`/`source` case(返回 null,纯数据);`splitCells`(table `|` 分隔);REGISTRY `sources v2.12`;白名单加 `open-scheme`/`open-web`
- `towxml/index.js`:入口 `buildSourcesRefMap` 预扫 + `option.quoteList` 合并建消息级 refMap,透传 `dslToNodes`;`expandLinkNodes` 把 markdown 正文 navigator 节点接管为 zone-link/zone-cite
- `zone-components/zone-node/index.wxml`:新增 `znParts` 共享模板;text/quote/alert/list/timeline/era-timeline/table 接 parts;item 可点击;新增 zone-cite/zone-link 独立节点
- `zone-components/zone-node/index.wxss`:`.zn-link`/`.zn-mention`(橙色)/`.zn-cite-num`/`.zn-cite-name`/`.zn-cite-dead`/`.zn-item-clickable`(引文样式对齐宿主正文胶囊)
- `agentChat/index.js`:onZoneAction 加 `open-scheme`/`open-web` 分发;宿主预处理截引文数据传 towxml;demo 调试原文弹窗
- `agentChat/libs/demo-data.js`:demo-magazine-25(DSL 引文)/ demo-magazine-26(宿主数据桥接)
- gallery 混排落地:`zone-dsl/toWxNodes.js` gallery case 改收 image+video、输出 `items`+`imageUrls`;`zone-components/zone-node/index.wxml` gallery 分支按 `gi.type` 两路渲染(image→`onGalleryTap`,video→`onButtonAction`);`zone-components/zone-node/index.wxss` 补 `.zn-gallery-video-*`;`demo-data.js` gallery demo 补图文混排示例(原 `urls` 字段废弃)

## v2.11 · 2026-07-14 · 多媒体流式视觉稳定性(image fit + video + 媒体骨架屏)

### Added

- **`::video`**(primitive)— 视频封面组件:poster + ▶ + title + 点击跳转(复用 button intent `open-url`,不内嵌原生 video),fit 默认 16:9
- **`::image` `fit`** — `width`(默认兼容)/`16:9`/`9:16`/`4:3`/`3:4`/`square`/`cover`/`contain`/`fixed`,padding-bottom hack 撑比例(不用 aspect-ratio),非法值 fallback width,9:16 限宽 60%
- **媒体骨架屏** — 流式态注入 `_streaming`;image/video src/poster 未闭合时显示 `.zn-skeleton`(按 fit 比例 + `@keyframes zn-shimmer`);gallery 过滤空 url

### Changed

- `injectTheme`→`injectMeta`,同时注入 `_theme` + `_streaming`
- image case:`mode` 由 fit 决定;gallery:`urls.filter(Boolean)`

### 落地登记

- `zone-dsl/toWxNodes.js`:`normalizeFit`/`FIT_WHITELIST`;image fit;video case;gallery 过滤;`injectMeta` + `_streaming`;REGISTRY `video v2.11`
- `zone-components/zone-node/index.wxml`:zone-image fit 容器+守卫+骨架;新增 zone-video
- `zone-components/zone-node/index.wxss`:`.zn-image-fit-*`/`.zn-video-*`/`.zn-skeleton`+`@keyframes zn-shimmer`

详见 spec §5.5。与 `@zonedsl/wechat` v2.11 对齐。

## v2.10 · 2026-07-14 · 组件内行内标记流式安全

### 背景

流式吐字时,zone 组件 `main` 文本里的行内标记(`**` / `*` / `` ` `` / `~~` / `==`)常处于未配对状态。
渲染层 `splitInlineMd` / `splitCoverHighlights` 的正则匹配失败,半截标记当裸字符显示,视觉闪烁。
本次给 wechat 渲染层补上"裁到未闭合标记前"的流式保护,对齐 web 端 `inline()` 既有行为(详见 spec §4.5)。

### Added

- **`splitInlineMd(text, opts)` / `splitCoverHighlights(text, opts)`** 加 `opts.streamingSafe`:
  流式态下未配对的标记符号裁到最后一个未闭合标记之前(标记+其后文本丢弃),等下一 tick 闭合再整体显示。
  - `splitInlineMd` 裁剪顺序 `**` → `` ` `` → 单 `*`(单 `*` 计数前先剔除 `**`)
  - `splitCoverHighlights` 每行裁剪 `**` → `~~` → `==`;半截裁光时占位空 text 避免兜底闪裸符号
  - 签名向后兼容:无第二参时行为零变化
- **`zoneToNode(node, ctx)`** 加 ctx 参,`dslToNodes` 构造 `{ streamingSafe }` 透传给 4 个调用点(`::text` main、`magazine-cover` title/subtitle、`chapter` title、`editorial-hero` title)及 4 处递归 map

### 落地登记

- `zone-dsl/toWxNodes.js`:`splitInlineMd` / `splitCoverHighlights` 加参 + 新增 `trimUnclosedInline` / `trimUnclosedCover`;`zoneToNode` 加 ctx 透传;`dslToNodes` 构造 ctx
- 算法对齐 `@zonedsl/web` 的 `inline()` / `bufferMarkdown()`,保证跨端一致

### 未改动

- parser(`zone-dsl/parser.js`)未改 —— 行内标记是渲染层职责
- web 端 `inline()` 已符合规范,不动

## v2.9 · 2026-07-08 · 通用居中容器 + row/col 居中

### Added

- **`::center`** (structure 层) — 通用居中包装器,零参数,双向 flex 居中,宽度 100%。
  子组件水平永远居中;垂直居中的可见性取决于容器是否比内容高。适合让 chart / hero
  文字 / 空态提示等在父容器里自然居中,不用套 section/card。

  ```
  ::center
    ::radar "六维评估"
      axis "工程" score=88
  ```

### Changed

- **`::row`** 支持 `align=center`:横向 flex 中让子组件水平 + 垂直居中
  (`justify-content: center + align-items: center`)
- **`::col`** 支持 `align=center`:纵向 flex 中让子组件水平居中(`align-items: center`)

  ```
  ::row align=center
    ::tag "热搜"
    ::tag "上升"

  ::col align=center
    ::text size=hero "居中标题"
  ```

### 落地登记

- `zone-dsl/toWxNodes.js`:REGISTRY 加 `center: {layer:'structure', since:'v2.9'}`;
  row/col case 透传 attrs.align;新增 center case
- `zone-components/zone-node/index.wxml`:新增 zone-center 分支;
  zone-row / zone-col 加 `zn-row-center` / `zn-col-center` class
- `zone-components/zone-node/index.wxss`:新增 `.zn-center` / `.zn-row.zn-row-center` /
  `.zn-col.zn-col-center` 三条样式
- `skill/CATALOG-STRUCTURE.md`:补 row/col 的 align 说明 + center 独立小节
- `zone-dsl/LAYERS.md`:structure 层清单加 `center`

## v2.8.1 · 2026-07-07 · 模块化重构

### Changed — 三个模块聚合到 zone-plugin/(方案 A vendored plugin)

三个之前分散的目录:
- `packageChat/towxml/`
- `packageChat/zonedsl/`
- `packageChat/zone-components/`

统一移到:
- `packageChat/zone-plugin/towxml/`
- `packageChat/zone-plugin/zone-dsl/`(重命名 zonedsl → zone-dsl,连字符风格更规范)
- `packageChat/zone-plugin/zone-components/`

**动机**:让 Zone 这一整套(markdown 渲染 + zone-DSL 引擎 + 组件视觉层)成为一个**可复制的独立模块**,其他小程序只要:
1. 复制整个 `zone-plugin/` 目录到自己项目
2. 改 `agentChat` 相关引用路径为 `zone-plugin/...`
3. 实现自己的 onZoneAction 分发器(参考 handlers-example,规划中)

即可获得完整的 Zone 渲染能力(markdown + 12 主题 + zone-DSL 组件 + 流式渲染保护 + intent 交互).

### Removed — hljs 语法高亮

- 删除整个 `parse/highlight/` 目录(19 种语言 + core + wxss = 132KB)
- 精简 `parse/markdown/index.js`(不再 require hljs,不注册 highlight 回调)
- 移除 `towxml.wxss` 里的 `@import github.wxss`
- 精简 `config.js`(288 → 71 行,移除 highlight/latex/yuml/showLineNumber 字段)
- 清理 5 个 markdown 主题 wxss 里的 `.hljs-comment / .hljs-quote` 死规则

**副作用**:代码块变纯文本渲染(黑底浅字,无关键字高亮),demo-18/19/22 里的 js 代码块能看内容但无颜色.生产环境代码块极少,收益(132KB 减包体) >> 视觉损失.

### 引用路径变更

- `agentChat/index.json`: `/packageChat/towxml/towxml` → `/packageChat/zone-plugin/towxml/towxml`
- `agentChat/index.js`: `require('../towxml/index.js')` → `require('../zone-plugin/towxml/index.js')`
- `message-item/index.json`: 同上更新
- `zone-plugin/towxml/decode.json`: 全部改指 `/packageChat/zone-plugin/xxx`
- `zone-plugin/towxml/index.js`: `require('../zonedsl/toWxNodes.js')` → `require('../zone-dsl/toWxNodes.js')`
- `zone-plugin/zone-components/zone-node/index.json`: echarts 引用路径更新

同步更新的外部文档:
- `CLAUDE.md`
- `.claude/skills/zonedsl/{SKILL,CATALOG-INTERACTIVE,CATALOG-PRESET}.md`
- `packageChat/zone-plugin/zone-dsl/{THEMES,LAYERS}.md`

### Roadmap · v2.9(下一步)

- 抽出业务专属 preset 到独立子包(city-card / scene-card / person-card / person-grid / glyph-compare / statement)
- 加 `zone-plugin/README.md` / `INSTALL.md` / `handlers-example.js`
- toWxNodes 支持 `registerPresets(map)` 让业务 preset 可选注册
- CSS 变量分层:`tokens.wxss`(业务方 override)+ `zone-core.wxss`(不动)

## v2.8 · 2026-07-07

### Added — checkbox-group 组件

- `::checkbox-group "标题"` + 子 `checkbox` 支持成组多选（对齐已有的 radio-group）
- parser CHILD_KEYWORDS 白名单加入 `checkbox / radio`（之前 radio-group 里子 radio 都识别不了）
- 复用现有 cbState 和 onCheckboxTap,视觉与独立 checkbox 一致

### Added — 5 套 markdown 接管系主题

- **`purple / sky / pop / sage / note`** 5 个新主题,同时作用于 zone 组件(`.zn-*`)和 markdown 原生元素(`.h2w__*`),让"纯 markdown 消息"也能整体切换成杂志视觉
- 覆盖全套 markdown 元素:h1-h6 / p / ul / ol / li / table / blockquote / hr / pre / code / a / img / strong / em / del / mark / ins / sub / sup / task-list
- 详见 THEMES.md 里的"markdown 接管系"章节

### Changed — 主题物理集中

- 12 个主题都从散落位置(shared.wxss / towxml/style/)统一移到 **`zone-components/themes/`** 单文件夹
- `themes/index.wxss` barrel 导出所有主题
- shared.wxss 和 towxml.wxss 各一行 `@import "./themes/index.wxss"` —— 同一份主题文件被两处引入,zone-node 作用域下命中 `.zn-*` 规则、towxml 作用域下命中 `.h2w__*` 规则

### Changed — magazine-cover 默认 bg 从 `accent` 改为 `light`

- 不写 `bg=xxx` 时从"鲜橙渐变"变成"暖米色 light"
- 目的:流式过程中 magazine-cover 属性未吐完时,不再默认闪橙色
- **兼容性**:显式写 `bg=accent` 依然走鲜橙渐变

### Changed — era-timeline 双布局自动切换

- ≤3 张 item(尤其 2/4 张)自动 grid 2 列;其他自动横滑 scroll
- 显式 `layout=grid` / `layout=scroll` 覆盖自动策略
- 横滑严格等高:scroll-view 内嵌 `.zn-era-scroll-inner` 用 `inline-flex + align-items:stretch`

### Changed — zone.wxss 从 1242 → 28 行

- 老 `.zone-*` 前缀规则(接近 100 个死选择器)清理,只留 `.zone` 和 `.zone-block` 兜底
- 新组件全部走 `.zn-*` 前缀
- 备份保留 `zone.wxss.bak`

### Added — 流式渲染保护

- **parser `streamingSafe` 模式**:流式过程中尾行未换行的最后一个 bare attr 值不写入 attrs,避免 `bg=a → bg=acc → bg=accent` 半截值导致组件视觉闪烁
- **buildSegments 合并 pass**:text 段和已闭合 code 段被合并成一大段 text,一次性喂 towxml,消除代码块导致的 `.mi-md-body` 断层
- **demo 流式播放**:content 前缀 `__STREAM__` 触发自动流式播放(100 字符/秒 = 40ms/4chars),`onUnload`/`onHide` 自动停止

## v2.5 · 2026-07-07

### Added — 3 套新杂志系主题

- **`serene`**:中式青绿(青竹绿 `#5E8265`)+ 温白底 + 居中衬线,配 numbered-list 淡绿描边圆
- **`warm`**:朱橙 `#C56F3E` + 温白底 + 淡米黄重点卡,居中衬线,配 icon-grid
- **`luxe`**:深金铜 `#A88232` + 温白底 + 巨字居中,配 display + pill 涨跌指标

### Added — 相应 demo

- demo-15 serene(梅雨季)/ demo-16 warm(阳光疗法)/ demo-17 luxe(黄金行情)

## v2.3 · 2026-07-06

### Added

- **`::spacer`（别名 `::gap`）**：primitive 层留白组件。支持 5 档预设 `h=xs/sm/md/lg/xl`（8 / 16 / 32 / 60 / 96 rpx）或精确 rpx 值（`h=24` / `h=48rpx`）。让 AI 显式表达"留白意图"，替代空 text 硬撑

### Changed — 窄屏 3/4 列自适应

`grid` / `data-board` / `icon-grid` / `person-grid` 的 **3/4 列布局**加 `min-width` 兜底：
- 3 列：`min-width: 200rpx`
- 4 列：`min-width: 180rpx`
- `flex: 0 0` → `flex: 1 1`，允许在窄屏时自动换行成 2 列

**收益**：AI 不用小心翼翼避免 4 列布局，组件在窄屏时会自动降级为 2 列避免挤压

## v2.2 · 2026-07-06

### Changed — 主题视觉微调

- **literary 主题**：默认字体切换为**衬线宋体**（`Songti SC / STSong / SimSun`），只作用于 `magazine-cover / chapter / editorial-hero / editorial-pullquote / statement / step-block / divider-fancy`——普通正文仍用系统字体保持易读
- **serious 主题**：字距放宽到 `2rpx`（`--mz-title-tracking`），底色更冷（`#F4F4F2`），强调色改成更纯的黑 `#0F0F0F`
- **data 主题**：`fact-bar` / `data-board` **反色成白底 + 蓝色数字**（不再是深炭底），配色更贴近数据报告
- 新增 `--mz-font` / `--mz-title-tracking` 主题级 CSS 变量

### Added — 主题专属 demo

- `demo-magazine-8` 从 editorial 切换到 `theme=serious`（时政三焦点）
- `demo-magazine-14` 新增 `theme=data`（Q4 财报速览）—— 展示 data-board 反色 + line/pie/rank 图表

## v2.1 · 2026-07-06

### Added — preset 层新组件

- `::era-timeline`（别名 `::history-strip`）—— 横向历史时间条，每张卡片显示年份/label/描述。适合极端年份、品牌大事记、版本演进
- `::media-card` —— 图片作背景 + 叠加标题的杂志封面卡，支持 `align=top/center/bottom` 和 `overlay=gradient/solid/none`

## v2.0 · 2026-07-06

### Added — button intent 交互能力

`::button` 支持 **intent 白名单**（详见 `INTENTS.md`）：

- **会话相关**：`followup`（填输入框） / `send-message`（直接发送）
- **内容跳转**：`search` / `open-topic` / `open-tab` / `open-scheme` / `open-url` / `open-web`
- **账号中心**：`login` / `open-my`
- **通用操作**：`copy` / `share` / `open-url`（仅站内 `/pages/`）

### Changed

- `parser.js` 的 `coerce` 修复 bug：**不再把含逗号的普通字符串错误地拆成数组**（只有全数字才拆），修复 subtitle/footnote 等含中文逗号或英文逗号的文本 attr
- `zone-node/index.js` 加 `onButtonAction` 冒泡 `zoneaction` 事件
- `message-item` 组件的 3 处 `<towxml>` 都挂上 `bind:zoneaction` 转发到页面
- `agentChat/index.js` 加 `onZoneAction` 分发器，映射 11 个 intent 到项目现有能力

### Compat

- 不带 `intent` 的 `::button` 保持纯样式（v1.x 完全兼容）
- 未知 intent 或非法 value → 静默降级为纯样式，不报错

## v1.6 · 2026-07-06

### Breaking

- **移除组件** `echarts-raw` — 不支持直接渲染 YAML option，使用 `::line` / `::bar` / `::pie` / `::radar` 等具体图表替代
- **移除组件** `tree` — 视觉效果差，使用 `::step-block` / `::timeline` / `::mechanism` 替代

### Changed

- **未知组件默认静默** — `toWxNodes.js` 加 `UNKNOWN_MODE = 'silent'` 常量，默认丢弃未知组件不渲染。debug 模式可显示"未支持"卡片
- **magazine-cover title/subtitle 支持行内高亮** — `**text**` / `~~text~~` / `==text==` 三种标记 + `\\n` 换行
- **parser 支持 `\"` 转义** — attrs 值内可安全嵌入英文双引号
- **默认 badge 用橙色渐变** — `linear-gradient(135deg, #FF8200, #FFB347)`

## v1.5 · 2026-07-04

### Added — 主题系统

- **主题作用域** `editorial / literary / serious / data` — 通过 CSS 变量 `--mz-*` 实现，详见 `THEMES.md`
- **三种主题声明入口**：
  - `magazine-cover theme=<name>`（推荐 95% 场景）
  - `::theme <name>` 顶格伪组件
  - ` ```zone theme=<name> ` 围栏 meta

### Added — preset 层组件（业务预设）

- `magazine-cover` — 杂志封面头（tag/title/subtitle/footnote/badge/stats）
- `chapter-magazine` — 杂志分栏（`01 / CATEGORY` 深炭 tab）
- `city-card` — 城市行程卡片（num/country/city/en/date/color + items + tags）
- `person-grid` + `person-card` — 人物阵容网格
- `scene-card` — 名场面卡片（icon/title/desc/tags/badge/rank）
- `glyph-compare` — 字/词大字对比（单外框 + 顶部深色 tab）
- `statement` — 人物回应/声明卡片（title/author/time/source）
- `editorial-hero` — 编辑体大字块（kicker/title/subtitle/stats）
- `editorial-pullquote` — 大字引言（cite）
- `editorial-summary` — TL;DR 摘要
- `editorial-stat` / `editorial-image` — 编辑体数字/图片
- `fact-bar` — 深色横向事实条
- `data-board` — 深色数据面板（layout=grid/row）
- `step-block` — Step 1-N 米色块列表（literary 主题主用）
- `icon-grid` — 4/2×2 emoji 网格
- `divider-fancy` — `//` 装饰分隔线
- `labeled-list` — 左标签 + 右描述的列表
- `numbered-list` — 数字圆圈编号列表

### Changed

- **杂志系配色** — 从聊天橙(`--hj-*`) 迁移到编辑体变量(`--mz-*`)
- **fact-bar / data-board** — 使用 `--mz-ink-panel` 深色对比板
- **card / chapter / list / rank / compare** 等结构层组件标题色 — 从 `--hj-accent-deep` 改为 `--mz-ink` 深炭
- **metric 默认字色** — 从橙色改为深炭，只有 `color=accent` 才染橙

## v1.0 · 2026-07-02

### Added — 初始版本

**primitive 层**：
- `text` / `tag` / `divider` / `badge` / `pill` / `icon` / `avatar` / `quote` / `kicker` / `trend` / `tip` / `callout` / `display` / `progress` / `alert` / `metric` / `image`

**structure 层**：
- `card` / `section` / `row` / `col` / `grid` / `list` / `table` / `timeline` / `gallery` / `hscroll` / `swiper` / `chapter` / `form`

**interactive 层**：
- `tabs` / `accordion` / `checkbox` / `radio` / `radio-group` / `select` / `textarea` / `quiz` / `button` / `steps` / `stairs` / `mechanism`

**chart 层**：
- `line` / `bar` / `pie` / `sparkline` / `radar` / `ring` / `rank` / `compare`

**核心机制**：
- `dslToNodes(dsl)` → `[{ tag: 'zone-block', children: [...] }]`
- 顶格 `::xxx` 和围栏 ` ```zone ` 语法支持
- 行内 markdown（`**bold**` / `*italic*` / `\`code\``）
- 未知组件降级为 `zone-unknown` 卡片（v1.6 改成 silent）

## Roadmap

### Planned · v1.7（近期）

- **`@since` / `@layer` / `@deprecated` 注释**加到每个组件 case
- **CLAUDE.md 加 ZoneDSL 指引**
- **demo-magazine-12 / 13** 复刻梅雨季 / 阳光疗法（验证 literary 主题）

### Planned · v2.0（中期）

- **interactive 层 `button` 支持 intent 白名单**：`intent=followup/track/open-topic/open-url/share`
- **前端 `handleZoneAction(intent, value)` 分发器**接入项目现有能力
- **`::followup-questions` 打包组件**：本质是 `button intent=followup` 的语义包装

### Planned · v2.x（远期）

- **`dslToNodes(dsl, { allowLayers })`** — 运行时层过滤
- **`toWxNodes.js` 拆分到 `components/` 目录**
- **主题定制化 API** — 业务侧覆盖 `--mz-*` 变量
- **组件级 deprecation 工具** — 扫码里的 `@deprecated` 自动生成迁移文档

## 版本策略

- **MAJOR**（v2.0）：Breaking change（删除组件、改语义、改主题变量名）
- **MINOR**（v1.5）：新增组件 / 主题 / 能力，不破坏现有
- **PATCH**（v1.5.1）：bug 修复、样式微调、文档补全

任何 preset 层新增组件建议同步在 `SKILL.md` 组件速查表加一行。
