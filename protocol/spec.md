# ZoneDSL Protocol — spec v1

> ZoneDSL 是一个**文本优先的 Agent-to-UI 协议**，与 markdown 共存。AI 在需要结构化时输出 `::component` 语法，前端解析成组件树。本文是协议的唯一权威定义（source of truth）；`@zonedsl/core` 是规范解析器，`@zonedsl/web` 等是符合本 spec 的参考实现。

## 1. 设计目标

- **流式安全**：AI 边吐字边可渲染，半截属性/符号不闪烁
- **与 markdown 共存**：DSL 段落用 `::`，纯文本段走 markdown，互不干扰
- **运行时无关**：spec 不预设渲染端，DOM / 小程序 / RN / Flutter 各自实现
- **减 token**：语法紧凑， attrs 裸值优先

## 2. 语法

### 2.1 组件

顶格 `::` 开头 + 组件名 + attrs：

```
::magazine-cover tag="HOT RECAP" title="48小时刷屏" bg=light
```

- 组件名：`[a-z][a-z0-9-]*`
- 第一个引号字符串是 `main`（组件的主文本/标题），后续 `key=value` 或裸 flag

### 2.2 子节点

缩进 2 空格的子行，用 child keyword 或嵌套 `::component`：

```
::data-board cols=3
  item "主榜最高" value="8 位" desc="连续 6h"
  item "在榜时长" value="11h+"
```

child keyword：`series / row / field / item / option / step / radio / checkbox`。也可直接嵌套 `::child-component`。

### 2.3 围栏块

两种语法把一段文本强制隔离成一个 zone 段，与外层 markdown 完全不串味：

**A. 围栏**（` ```zone ` 起、` ``` ` 止，行首可有缩进）：

```
正文里插入一个 zone 块：

```zone
::data-board cols=3
  item "主榜最高" value="8 位"
```

块外继续 markdown。
```

**B. 顶格 `::`**（顶格 `::` + 组件名起，遇**空行**止）：

```
# 标题

::data-board cols=3
  item "主榜最高" value="8 位"

正文回到 markdown。
```

两种都整块当一个 zone 段处理，parser 先抽成占位、再渲染 markdown、最后展开 zone 节点。

#### 何时必须用围栏（强隔离）

顶格 `::` 遇空行止，对 95% 场景够用。但下面几类内容**必须用 ` ```zone ` 围栏**，否则会和 markdown 解析器打架：

| 场景 | 为什么顶格 `::` 会出问题 | 围栏怎么救 |
|---|---|---|
| **块内含空行** | 顶格 `::` 遇第一个空行就结束，后半截被当 markdown | 围栏吃光中间所有空行，到结束围栏才止 |
| **块内含行首 markdown 字符**（`#` / `-` / `>` / `1.` / `*`） | 这些行不是顶格 `::` 也不在 child 缩进里，被 markdown 抢去当标题/列表 | 围栏内全是 zone 正文，markdown 不碰 |
| **嵌入长 markdown / 代码块** | zone 段里又想放一段 md 代码块，` ``` ` 会被外层 markdown 误判 | 围栏层级匹配，内层代码块不穿透 |
| **多 zone 块紧贴** | 两个 `::xxx` 之间想留空行分隔，但空行会提前终止第一个块 | 围栏各自闭合，中间空行自由 |

一句话：**块内容里只要出现"空行"或"行首是 markdown 标记字符"，就上围栏**。纯连续行、无空行、行首都是 `::` 或 child 缩进的简单块，顶格 `::` 即可。

### 2.4 注释

`:: 注释内容`（`::` 后跟空格）—— 解析时丢弃，不渲染。

### 2.5 option 块

`option:` 行开启 YAML 风格配置块（如 echarts-raw），缩进采集。

### 2.6 markdown 段

非 `::` 开头的段落走 markdown 渲染。`::md` 组件显式声明一段 markdown。

## 3. 属性解析

### 3.1 值类型

| 写法 | 类型 | 例 |
|---|---|---|
| `"quoted"` | 字符串（main 或 value） | `title="X"` |
| `bare` | 自动 coerce | `cols=3` → number |
| `flag` | boolean true | `checked` |

### 3.2 coerce 规则

- `true` / `false` → boolean
- `^-?\d+$` → int，`^-?\d+\.\d+$` → float
- 含 `,` 且全数字 → number[]；含 `,` 非全数字 → 保持原字符串（不拆，由渲染层 split 兜底）
- 其它 → 字符串

### 3.3 转义

引号内：`\"` → 字面 `"`，`\\` → 字面 `\`，`\n` / `\t` 保留字面（供渲染层归一化为换行/空格）。

## 4. 流式语义（核心）

AI 流式吐字时，缓冲区末尾常有半截内容。spec 定义三个流式安全机制，由 parser 的 `opts` 开关：

### 4.1 `streamingSafe`

尾行未闭合时，丢弃最后一个**未终止**的属性值：
- bare 值读到 src 末尾（无空格/换行终止）→ 丢弃该 attr
- 引号值未闭合（没读到结束 `"`）→ 丢弃整个 attr
- 裸 key 在尾部无空格 → 丢弃（可能是半截 key 名如 `selecte`）

效果：组件始终可显示，attrs 只含「已闭合」的值，半截值不闪。

### 4.2 `dropPartialLastLine`

缓冲区末尾若不以 `\n` 结尾，把最后一行整个缓冲掉（不参与解析），等下一 tick 换行到再出。用于「半截组件头」`::magaz` 不被当未知组件渲染。

### 4.3 `looksPartial(line)`

判断单行是否「半截」，用于更激进的尾部裁剪：
- 顶格 `::` 或 `::?` 空行
- 尾部 `=`（属性值还没来）
- 引号数为奇数（未闭合）
- 尾部 `,`（数组值没写完）

### 4.4 流式使用建议

渲染层在流式态传 `{ streamingSafe: true, dropPartialLastLine: true }`；最终态（流式结束）传 `{}` 拿完整 AST。半截组件名由渲染层前缀匹配兜底（显示骨架）。

### 4.5 组件内行内标记流式安全

§4.1–4.3 保护的是 **parser 层**：组件头、attr 值、整行。但 zone 组件的 `main` / 文本 attr（如 `::text` main、`magazine-cover` title/subtitle、`chapter` title、`editorial-hero` title）里常带**行内 markdown 标记**（`**bold**` / `*italic*` / `` `code` `` / `~~del~~` / `==hl==`）。parser 不解析这些标记，只把字符串原样放进 `main`，由渲染层 `splitInlineMd` / `splitCoverHighlights` 拆成富文本 parts。

流式吐字时，这些标记常处于**未配对**状态（如 `::text "**紧急` 还没吐到闭合 `**`）。渲染层的正则要求成对，匹配失败时半截标记会当裸字符显示，用户看见闪烁的 `**` / `` ` ``。spec 规定：这是**渲染层职责**，渲染层在流式态下做如下裁剪：

**规则**：流式态（`streamingSafe=true`）下，若某行内标记符号在文本中出现奇数次（未配对），裁到最后一个未闭合标记**之前**——标记本身及其后文本整段丢弃，等下一 tick 闭合标记到了再整体渲染。绝不闪裸符号；代价是半截词临时不可见（延迟出现）。

**裁剪顺序**（必须，避免 `*` 与 `**` 互相干扰）：
- `splitInlineMd`（`::text` 等）：`**` → `` ` `` → 单 `*`（数单 `*` 前先剔除 `**`）
- `splitCoverHighlights`（`magazine-cover` / `chapter` / `editorial-hero` 的 title/subtitle）：`**` → `~~` → `==`

**非流式态 / 最终态**：不裁剪，正则照旧，拿完整富文本。签名向后兼容（`splitInlineMd(text)` 无第二参时行为零变化）。

> 裁剪算法以 `@zonedsl/web` 的 `inline()` / `bufferMarkdown()` 为参考实现，各端须对齐以保证 ZoneDSL Compliant 跨端一致（§9）。

## 5. 组件契约

### 5.1 五层

| 层 | 职责 | 代表组件 |
|---|---|---|
| primitive | 叶子原子 | text / tag / badge / icon / divider / quote / metric / image / video / spacer |
| structure | 容器布局 | card / section / row / col / grid / center / list / table / timeline / chapter |
| interactive | 可交互 | tabs / accordion / checkbox / radio / select / quiz / button / steps |
| chart | 图表 | line / bar / pie / sparkline / radar / ring / rank |
| preset | 业务预设 | magazine-cover / data-board / era-timeline / person-grid / city-card / editorial-* |

### 5.2 registry

每个组件在 `COMPONENT_REGISTRY`（`@zonedsl/wechat/toWxNodes.js`）登记 `{ layer, since }`。加组件 = registry 登一条 + toWxNodes 加 case + 渲染器加分支。

### 5.3 未知组件

`UNKNOWN_MODE = 'silent'`（默认）—— 未知组件名静默丢弃，不报错、不渲染。保证 AI 吐错组件名不崩。

### 5.4 intent 白名单

`button` 组件支持 `intent` 属性触发交互，白名单 11 个（会话操作 / 跳转 / 账号 / 通用）。未知 intent 或非法 value 静默降级为纯样式。详见 [`packages/core/INTENTS.md`](../packages/core/INTENTS.md)。

### 5.5 多媒体组件 · image / video / gallery（v2.11）

**`::image`** — 图片，支持 `fit` 宽高适配：

```
::image url="https://..." caption="说明" fit=16:9
```

`fit` 值（对 AI 友好的 `16:9` 口语化写法，渲染层转容器约束，**不用 `aspect-ratio` CSS** 以兼容老基础库，用 padding-bottom hack）：

| fit | 语义 | 流式稳定 |
|---|---|---|
| `width`（默认） | 宽度满，高度按图片（widthFix，向后兼容） | 靠骨架兜底 |
| `16:9` / `9:16` / `4:3` / `3:4` / `square` | 固定宽高比容器 | ✅ |
| `cover` | 填满裁切（默认 16:9） | ✅ |
| `contain` | 完整留白 | ✅ |
| `fixed` | `height` attr 固定高 rpx | ✅ |

非法 `fit` 值 fallback 到 `width`。`9:16` 竖屏容器限宽 60% 居中（full-width 竖屏过高）。

**`::video`** — 视频封面（不内嵌原生 video，只渲染封面 + ▶ + 点击跳转）：

```
::video poster="https://封面.jpg" title="标题" fit=16:9 intent=open-url value="/pages/video?id=1"
```

- `poster` 封面图，`title`/`subtitle` 叠加文字，`fit` 复用 image 体系（默认 `16:9`）
- 点击复用 `button` intent 链路（§5.4），`intent=open-url` + `value`（站内 `/pages/` 路径），非法 intent 静默降级为纯展示
- 流式态 `poster` 未闭合 → 骨架（同 image）

**`::gallery`** — 图片集，子 `::image` 的 `url` 未闭合者被过滤（流式时不混入空 src）。

**流式骨架**（§4.5 同源机制）：流式态下 `image`/`video` 的 `src`/`poster` 未闭合时，渲染层显示骨架块（按 `fit` 比例撑高 + shimmer 动画），不撑大、不空白。骨架由渲染层 `_streaming` 标记驱动（`dslToNodes` 流式态注入），对齐 web `.pending` 语义。

## 6. 主题

`::theme <name>` 声明主题，整块继承。12 套：editorial（默认）/ literary / serious / data / serene / warm / luxe / purple / sky / pop / sage / note。主题作用于 zone 组件和 markdown 原生元素。详见 [`packages/core/THEMES.md`](../packages/core/THEMES.md)。

## 7. 与 markdown 共存

- 文档级：DSL 段（`::` / \`\`\`zone）与 markdown 段交替，parser 先抽 zone 块占位，再渲染 markdown，最后展开 zone 节点。两种语法的隔离边界与"何时必须用围栏"见 §2.3
- 组件内：`main` / 文本 attr 支持 inline markdown（`**加粗**` / `*斜体*` / `` `代码` `` / `~~删除~~` / `==高亮==` / `\n` 换行）。流式态下半截标记的裁剪规则见 §4.5

## 8. 分发

`@zonedsl/core` 三态：
- `parser.js` — CJS（Node / 小程序）
- `parser.mjs` — ESM（现代浏览器 / Node ≥18）
- `parser.umd.js` — UMD（`<script src>` / AMD / CDN）

由 `build.mjs` 从 `parser.js` 单源生成，保证三态同步。

## 9. 一致性

未来第三方渲染器跑通 `packages/test-suite/`（规划中）的 conformance fixtures，即获 "ZoneDSL Compliant"。spec 改 → core 跟改 → test-suite 报红 → 渲染器跟进，三角治理。

## 10. 扩展性（核心设计）

**Parser 是组件无关的**——它只把 `::任意名 attrs` 解析成 `{ type:'component', name, attrs, children }`，不校验 name 是否存在。"某组件是否存在"是**渲染层**职责，不是协议层。这是 ZoneDSL 可扩展的根基：加组件 / 加 intent 都**不需要改 parser**。

### 10.1 加组件

| 渲染端 | 做法 |
|---|---|
| web | `ZonePlayground.register('my-comp', (node) => htmlString)` —— 往渲染器 `R` map 加一条 |
| wechat | zone-node wxml 加 `wx:elif` 分支 + wxss 加样式 |
| 通用 | `COMPONENT_REGISTRY` 加 `{ layer, since }` 元数据（仅用于文档/catalog 生成） |

加完即用，`::my-comp ...` 立刻可渲染。未注册的组件名走 `UNKNOWN_MODE='silent'` 静默丢弃。

### 10.2 加 intent

宿主在自己的 `handleZoneAction(intent, value, ctx)` 分发器里加 `case`，parser 不需要改（button 组件已透传 intent/value）。平台专属 intent（如电商 `open-cart`、视频 `play-video`）由宿主自管，**不进通用白名单**——通用白名单只收跨端可移植的。详见 [`packages/core/INTENTS.md`](../packages/core/INTENTS.md)「扩展」节。

### 10.3 禁用 / 替换组件

渲染层不注册某组件 = 该组件被 silent 丢弃。覆盖注册 = 同名重写 `R['name']`，可替换内置实现。无需配置开关。

### 10.4 定制边界

- **协议层**（spec + core + 通用 registry/whitelist）：跨端一致，提 PR 改 spec 版本
- **宿主层**（平台组件 / 平台 intent / 主题）：各端自管，不污染协议

这样既保证 "ZoneDSL Compliant" 的可移植性，又给宿主充分定制空间。AI skill 教的是通用集；宿主若定义了专属组件/intent，应额外给 AI 一份宿主补充说明。

---

本 spec 是描述性 v1，从 `@zonedsl/core` v2.9 的实现行为反推。后续变更走 [`packages/core/VERSIONS.md`](../packages/core/VERSIONS.md) 记录，spec 主版本号独立递增。
