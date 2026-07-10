# ZoneDSL 变更记录

按语义化版本记录组件的**新增 / 修改 / 废弃 / 移除**，便于 skill / 业务 prompt / 前端渲染层同步演进。

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
- `packages/wechat/towxml/`
- `packages/core/`
- `packages/wechat/`

统一移到:
- `packages/towxml/`
- `packages/zone-dsl/`(重命名 zonedsl → zone-dsl,连字符风格更规范)
- `packages/zone-components/`

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

- `packages/wechat/index.json`: `/packages/wechat/towxml/towxml` → `/packages/towxml/towxml`
- `agentChat/index.js`: `require('../towxml/index.js')` → `require('../zone-plugin/towxml/index.js')`
- `message-item/index.json`: 同上更新
- `packages/wechat/towxml/decode.json`: 全部改指 `/packages/xxx`
- `zone-plugin/towxml/index.js`: `require('../zonedsl/toWxNodes.js')` → `require('../zone-dsl/toWxNodes.js')`
- `zone-plugin/zone-components/zone-node/index.json`: echarts 引用路径更新

同步更新的外部文档:
- `CLAUDE.md`
- `.claude/skills/zonedsl/{SKILL,CATALOG-INTERACTIVE,CATALOG-PRESET}.md`
- `packages/zone-dsl/{THEMES,LAYERS}.md`

### Roadmap · v2.9(下一步)

- 抽出平台专属 preset 到 `packages/wechat/preset/`(city-card / scene-card / person-card / person-grid / glyph-compare / statement)
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
- **项目跳转**：`search` / `open-weibo` / `open-topic` / `open-tab` / `track-topic`
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
