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

\`\`\`zone 围栏或顶格 `::` 起空行止，整块当一个 zone 段处理（适合嵌入 markdown 文档）。

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

## 5. 组件契约

### 5.1 五层

| 层 | 职责 | 代表组件 |
|---|---|---|
| primitive | 叶子原子 | text / tag / badge / icon / divider / quote / metric / image / spacer |
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

## 6. 主题

`::theme <name>` 声明主题，整块继承。12 套：editorial（默认）/ literary / serious / data / serene / warm / luxe / purple / sky / pop / sage / note。主题作用于 zone 组件和 markdown 原生元素。详见 [`packages/core/THEMES.md`](../packages/core/THEMES.md)。

## 7. 与 markdown 共存

- 文档级：DSL 段（`::` / \`\`\`zone）与 markdown 段交替，parser 先抽 zone 块占位，再渲染 markdown，最后展开 zone 节点
- 组件内：`main` / 文本 attr 支持 inline markdown（`**加粗**` / `~~删除~~` / `==高亮==` / `\n` 换行）

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
