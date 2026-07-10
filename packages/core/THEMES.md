# ZoneDSL 主题系统

ZoneDSL 内置 **12 套排版主题**：
- **杂志系（7 套）**：`editorial / literary / serious / data / serene / warm / luxe` —— 主要作用于 zone 组件（`.zn-*` 元素），封面/章节/时间线等
- **markdown 接管系（5 套，v2.8+）**：`purple / sky / pop / sage / note` —— 同时作用于 markdown 原生元素（h1-h6 / p / ul / li / table / blockquote / code 等），让**普通 markdown 消息**也能整体变成杂志视觉

主题通过 CSS 变量作用域实现，切换主题时**所有子组件自动跟随**。

## 快速开始

```
::magazine-cover theme=literary title="梅雨季" subtitle="..."
::text "章节内容..."
```

只要在**封面组件**上声明 `theme=xxx`，整块内容就切换到对应主题；也可以用顶格 `::theme xxx`（无封面时）或围栏 `\`\`\`zone theme=xxx`（纯 zone 内容块）。

**默认主题是 `editorial`**（暖橙杂志风），不写 `theme=` 就走默认。

## 杂志系 · 7 套主题

杂志系主题主要作用于 zone 组件（magazine-cover / chapter / editorial-hero / era-timeline / ...）。
**首选杂志系**：用了 zone 组件的场景（复盘、封面、时间线等），或者你要输出典型的"结构化杂志式内容"。

| Theme | 场景 | 底色 | 主字 | 强调 | 感觉 |
|---|---|---|---|---|---|
| **`editorial`** | 娱乐 / 热搜 / 快讯 | 暖米 `#FBF3E7` | 深炭 `#1A1A1A` | 亮橙 `#FF8200` | 轻盈、饱和、当代 |
| **`literary`** | 科普 / 文化 / 生活 | 象牙 `#FDF8EF` | 焦茶 `#4A3728` | 深金橙 `#A17141` | 素雅、克制、人文 |
| **`serious`** | 时政 / 深度 / 复盘 | 冷灰 `#F5F5F3` | 炭黑 `#1F1F1F` | 深炭 `#1F1F1F` | 冷静、严肃、单色 |
| **`data`** | 报告 / 榜单 / 图表 | 纯白 `#FFFFFF` | 蓝黑 `#0F172A` | 蓝 `#2563EB` | 理性、清爽、专业 |
| **`serene`**（v2.5） | 中式人文科普、节气 | 温白 `#FCFAF7` | 深炭 `#2A2A2A` | 青竹绿 `#5E8265` | 沉静、诗意、清雅 |
| **`warm`**（v2.5） | 情感疗愈、生活科普 | 温白偏米 `#FBF8F3` | 深炭 `#2A2A2A` | 朱橙 `#C56F3E` | 温暖、亲和、居中衬线 |
| **`luxe`**（v2.5） | 金融、奢品、财报 | 温白偏米 `#FAF7F0` | 深炭 `#2A2A2A` | 深金铜 `#A88232` | 高端、沉稳、居中衬线 |

## markdown 接管系 · 5 套主题（v2.8+）

markdown 接管系的**特点**：**不需要写 zone 组件**，只在消息首行加 `::theme <name>`，之后**全用普通 markdown**（h1-h6 / 段落 / 列表 / 表格 / 引用 / 代码块 / 加粗斜体 / 高亮 / 链接 / 上下标 / 图片 / task-list），样式就整体切换到该主题的杂志视觉。

**首选 markdown 接管系**：内容是**长文说明 / 讨论 / 观点 / 教程**这种"以 markdown 语法为主"的形态，不需要复杂 zone 组件。

| Theme | 视觉 | 场景 |
|---|---|---|
| **`purple`** | 紫底 `#7C6EE0` + 黄胶囊 `#F5C94A` H1H2 + 白卡片段落 + 虚线紫框引用 + 马克笔黄底加粗 | 绩效便签、备忘录、笔记类 |
| **`sky`** | 蓝底 `#4A87E8` + 白胶囊 H1 + 蓝深卡片段落 + 黄胶囊内联高亮 | 简报、每日总结、蓝色科技风 |
| **`pop`** | 白底 + 红粉胶囊 `#FF4D75` H1H2 + 红粉描边卡片 + 红粉高亮 | 波普风、活力型、宣传单 |
| **`sage`** | 深墨绿底 `#2F4F3F` + 米色描边卡 + 米色字 + 米色高亮 | 文娱榜、中式复盘 |
| **`note`** | 白底 + 深红大标题 `#4A1F2E` + 红粉胶囊 H2 + 无卡片极简 + 黄底 mark | 学习笔记、极简手账 |

## 主题选择指南

**第一步**：判断内容形态

- 需要**杂志式复杂结构**（封面 + 分栏 + 时间线 + 数据卡） → 用**杂志系**（editorial/literary/...）
- 需要**长文说明**（标题 + 段落 + 列表 + 表格） → 用 **markdown 接管系**（purple/sky/pop/sage/note）

**第二步**：看内容气质

杂志系：
- 明星八卦、名场面复盘、当日热点 → `editorial`（活泼）
- 节气介绍、心理科普、生活方式随笔 → `literary`（沉静）
- 国际动向、事件调查、政策解读 → `serious`（冷峻）
- 财报数据、排行榜、指标复盘 → `data`（专业）
- 中式人文科普、诗意节气 → `serene`（清雅）
- 情感疗愈、亲和生活科普 → `warm`（温暖）
- 金融、奢品、财报速览 → `luxe`（高端）

markdown 接管系：
- 便签、备忘、绩效记录 → `purple`（紫底）
- 每日简报、报表总结 → `sky`（蓝底）
- 活力宣传、波普风 → `pop`（红粉）
- 文娱榜、中式榜单 → `sage`（深绿）
- 学习笔记、极简手账 → `note`（白底红粉）

如果不确定，默认 `editorial` 永远不错。

## 三种声明入口（等价）

### 入口 A：magazine-cover 属性（推荐，95% 场景）

```
::magazine-cover theme=literary title="..." ...
::chapter ...   # 自动继承 literary
::text ...
```

### 入口 B：顶格 ::theme（无封面时）

```
::theme literary

::chapter ...
::text ...
```

`::theme` 是伪组件，只影响主题，不会渲染任何 UI。

### 入口 C：围栏 meta（纯 zone 块）

```
\`\`\`zone theme=literary
::chapter ...
::text ...
\`\`\`
```

**三种入口都写等价**。如果同时出现，`magazine-cover.theme` 优先级最高。

## 主题作用域 / 文件组织（v2.8）

12 个主题都独立成文件放在 `packages/wechat/themes/`，由 `themes/index.wxss` 做 barrel 导出。

**双入口引入**：
- `zone-components/shared.wxss` → 被 zone-node 组件 @import → 命中 `.zn-*` 元素（杂志系组件）
- `towxml/towxml.wxss` → 被 towxml 组件 @import → 命中 `.h2w__*` 元素（markdown 原生标签）

**同一份主题文件被两处 import**：zone-node 作用域下匹配 `.zn-*` 规则、towxml 作用域下匹配 `.h2w__*` 规则，各自命中不冗余。

**主题选择器**：`.zone-theme-<name>`（挂在最外层 view 上）。作用域**只覆盖当前消息内容块**，不会污染上下文（比如聊天气泡的背景色）。

## 主题下的组件表现

大多数组件在所有主题下都能工作，只是**颜色跟着变**。少数组件对某些主题有偏好：

| 组件 | editorial | literary | serious | data |
|---|---|---|---|---|
| `magazine-cover` | 主用 | 主用 | 用 | 用 |
| `chapter magazine` | 深炭 tab | 焦茶 tab | 炭 tab | 蓝 tab |
| `numbered-list` | 橙圆 | 金橙圆 | 炭圆 | 蓝圆 |
| `scene-card` | 主用 | 用 | 用 | 用 |
| `city-card` | 主用 | 用 | 用 | 用 |
| `data-board` | 深炭底 | 深炭底 | 深炭底 | 白底 + 蓝色 |
| `fact-bar` | 深炭底 | 深炭底 | 深炭底 | 白底 |
| `step-block` | 用 | **主用** | 用 | 用 |
| `icon-grid` | 用 | **主用** | 用 | 用 |
| `divider-fancy` | 用 | **主用** | 用 | 用 |
| `statement` | 用 | **主用** | 用 | 用 |
| `editorial-pullquote` | 用 | **主用** | 用 | 用 |
| `editorial-hero` | **主用** | 用 | 用 | 用 |
| `person-card / person-grid` | **主用** | 用 | 用 | 用 |

"主用"= 在这个主题下最能发挥语义。

## CSS 变量清单

所有主题变量以 `--mz-*` 命名，在 `packages/wechat/shared.wxss` 定义。开发者自定义主题只需 override 这些变量：

| 变量 | 用途 |
|---|---|
| `--mz-bg` | 页底 |
| `--mz-panel` | 内容卡底 |
| `--mz-panel-soft` | 次级卡底 |
| `--mz-ink` | 主字 |
| `--mz-ink-soft` | 次字 |
| `--mz-ink-mute` | 弱字 |
| `--mz-line` | 分隔线 |
| `--mz-line-strong` | 强调分隔线 |
| `--mz-accent` | 主强调色 |
| `--mz-accent-warm` | 强调块底色 |
| `--mz-accent-soft` | 浅强调 |
| `--mz-accent-tint` | 微染背景 |
| `--mz-gradient-warm` | 渐变（封面/hero） |
| `--mz-ink-panel` | 深色对比板（fact-bar/data-board） |
| `--mz-font`（v2.2） | 主题级默认字体族 |
| `--mz-title-tracking`（v2.2） | 主标题字距（如 `-1rpx / 0.5rpx / 2rpx`） |

## 主题差异化视觉

除了变量替换，各主题还有**组件级微调**（详见 shared.wxss `.zone-theme-<name>` 作用域）：

- **literary**：`magazine-cover / chapter / editorial-hero / editorial-pullquote / statement / step-block / divider-fancy` 强制使用**衬线宋体**
- **serious**：主标题 `letter-spacing: 2rpx`，冷灰底 + 纯黑强调
- **data**：`fact-bar / data-board` **反色成白底**，数字用蓝色 `--mz-accent`，卡片有细阴影
- **editorial**：默认基调，暖橙渐变 + 无衬线

## 避坑清单

1. **主题名必须是白名单里的**：`editorial / literary / serious / data / serene / warm / luxe / purple / sky / pop / sage / note`，其他值 fallback 到 `editorial`
2. **一个 zone 块只能一个主题**：多次声明取第一个（`magazine-cover` 优先）
3. **不能中途切换主题**：主题作用域是整块，不能"这个 card literary、那个 card serious"
4. **主题不影响交互**：只改颜色/字重/间距，不改组件结构和行为

## 扩展新主题

1. 在 `zone-components/themes/` 下新建 `theme-<name>.wxss`，写 `.zone-theme-<name>` 作用域下的 CSS 变量 override + 可选的组件微调 + markdown 元素规则（如果想接管 markdown）
2. 在 `themes/index.wxss` barrel 里 @import 这个新文件
3. 在**三处** VALID_THEMES 白名单里加入新主题名：
   - `zonedsl/toWxNodes.js` 里的 `VALID_THEMES`
   - `towxml/index.js` 里的 `VALID_THEMES_FOR_MD`
   - `agentChat/index.js` 里的 `VALID_DOC_THEMES`
4. 在本文档补充主题的**内容气质**说明和典型场景

## 业务侧定制化（不改核心）

业务方（各业务方 / 独立品牌）可以**不改 ZoneDSL 核心代码**，在自己的 wxss 里覆盖 `--mz-*` 变量，实现品牌色定制。

### 步骤 1：在业务页面的 wxss 里定义 override class

```css
/* 业务侧 wxss: pages/xxx/index.wxss */
.brand-magenta .zone-block {
  --mz-accent: #E91E63;       /* 品牌粉色替代橙色 */
  --mz-accent-warm: #F06292;
  --mz-accent-soft: #FCE4EC;
  --mz-accent-tint: #FDF2F8;
  --mz-bg: #FDF7F9;           /* 淡粉底 */
  --mz-gradient-warm: linear-gradient(135deg, #E91E63 0%, #F06292 100%);
}
```

### 步骤 2：给 towxml 外层套 override class

```html
<view class="brand-magenta">
  <towxml nodes="{{msg.ast}}" />
</view>
```

**收益**：
- 所有子组件（cover / chapter / card / metric / button ...）自动跟随新配色
- 不需要改 ZoneDSL parser 或组件模板
- 一份组件模板服务多个业务品牌

### 允许 override 的变量（稳定 API）

以下变量是**稳定公开的**，业务方可以放心覆盖：

| 变量 | 建议覆盖策略 |
|---|---|
| `--mz-accent` / `--mz-accent-warm` / `--mz-accent-soft` / `--mz-accent-tint` | 品牌主色系（4 档层次） |
| `--mz-bg` / `--mz-panel` / `--mz-panel-soft` | 底色系 |
| `--mz-ink` / `--mz-ink-soft` / `--mz-ink-mute` | 文字色 3 档 |
| `--mz-line` / `--mz-line-strong` | 分隔线 |
| `--mz-gradient-warm` | 封面/hero 渐变 |
| `--mz-font` | 主题级默认字体族 |

**不建议覆盖**：
- `--mz-ink-panel`（fact-bar/data-board 深色底，改了对比度会崩）
- 组件内硬编码的具体值（如 button 阴影颜色）

### 与主题的关系

主题 = 平台默认配色（editorial / literary / serious / data 四套）  
业务定制 = 业务方在主题之上再叠加品牌色  
**优先级**：业务 `.brand-*` 覆盖 > `.zone-theme-*` 主题 > 默认变量

举例：`<view class="brand-magenta"><zone-block class="zone-theme-editorial">` → 走 editorial 主题的结构 + 粉色系配色。
