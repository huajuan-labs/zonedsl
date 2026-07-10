---
name: zonedsl
version: 2.9.0
description: Render structured magazine-style content in streaming AI chat using ZoneDSL — a text-first Agent-to-UI protocol coexisting with markdown, covering recap, event decode, travel log, data report, science explainer. Use when the user asks to summarize, recap, decode, report, or explain a multi-section topic (3+ sections, data/lists/timeline/people involved). Do NOT use for single-line answers, simple Q&A, emotional support, or when the user explicitly asks for "brief" / "short" replies — use plain markdown for those.
homepage: https://github.com/huajuan-labs/zonedsl
---

# ZoneDSL 输出规范

在**对话式 AI 输出**里生成结构化内容时用 ZoneDSL。ZoneDSL 会被前端解析成真正的组件树,比 markdown 表达力强得多——共存不冲突,减 token,支持主题 / 意图交互。

## 何时使用

### 判断规则

**用 ZoneDSL**（同时满足以下 2 项及以上）：
- 用户要求"总结 / 复盘 / 梳理 / 科普 / 解读 / 汇总 / 分析 / 拆解"某个主题
- 输出**至少 3 个小节**，且各小节主题不同
- 至少 1 类结构化元素：**数据表 / 列表 / 时间线 / 人物阵容 / 事件对比 / 步骤流程**
- 目标输出长度 ≥ 400 字

**不用 ZoneDSL**（走纯 markdown 或纯文本）：
- 单句 / 两句的对话回答
- 追问澄清 / 反问用户
- 纯情感 / 建议 / 意见类文字（没有结构化事实）
- 代码块为主的技术回答
- 用户明确要"简短回复"、"一句话"、"简单说"

### 对话样本

**✅ 应该用 ZoneDSL**：

| 用户输入 | 触发原因 |
|---|---|
| "梳理下今天热点有哪些看点" | 复盘 + 多小节 |
| "帮我做个 Q4 财报分析报告" | 分析 + 数据 + 报告 |
| "讲讲梅雨季形成原理和历史" | 科普 + 多小节 |
| "林晚这一周去了哪些活动" | 多城行程 + 时间线 |
| "苏念这两天有哪些名场面" | 复盘 + 多个场景 |
| "帮我拆解周屿原名风波" | 解读 + 事件时间线 |
| "对比一下 Vision Pro 和 Quest" | 对比 + 数据 |

**❌ 不应该用 ZoneDSL**：

| 用户输入 | 不触发原因 |
|---|---|
| "今天几号？" | 单句回答 |
| "帮我改这句话" | 编辑任务，不是内容生成 |
| "我心情不好" | 纯情感 |
| "盛夏夜 主持人是谁？" | 单点事实，1-2 句能答 |
| "简短说下你的观点" | 用户要求简短 |
| "写段 Python 代码解析 JSON" | 代码为主 |
| "这个 URL 什么意思？" | 一次性问答 |

### 边界情况

- **中等长度问题**（如"介绍一下盛夏夜"）—— 判断你打算写多长：< 400 字用 markdown，≥ 400 字且有多小节用 zonedsl
- **用户主动要"用图 / 用卡片 / 用杂志式"** —— 强制触发 zonedsl，即使内容不长

## 三步生成流程

**Step 1 · 选主题** — **默认不声明主题**。走默认（`editorial`）就够了,视觉一致、暖橙杂志风、覆盖 95% 场景。

**除非以下明确情形,才显式声明主题**:
- 用户在这次对话里**明确要求**特定风格（"用人文风"/"要蓝色简报感"/"用波普风"）
- 内容主题跟默认橙气质**冲突到看着不对劲**（比如深度时政、金融速览用默认橙不合适）
- 你在做**多主题演示 demo**（如 demo-18/19,横向对比效果）

**其他情况一律不写 `::theme` 也不写 `theme=`**,让内容走默认。

**要写的时候可用主题**（12 套,详见 `@zonedsl/core/THEMES.md`）:

- **杂志系（7 套）**:`editorial`(默认) / `literary`(人文) / `serious`(严肃) / `data`(数据) / `serene`(人文青绿) / `warm`(温暖) / `luxe`(高端金融)
- **markdown 接管系（5 套,v2.8+）**:`purple` / `sky` / `pop` / `sage` / `note` —— 不写 zone 组件,纯 markdown 也能变成杂志视觉

**主题声明方式**:
- 杂志系:在第一个 `magazine-cover` 上写 `theme=xxx`,或用 `::theme xxx` 顶格一行
- markdown 接管系:**只能用顶格 `::theme xxx`**（不写 magazine-cover 时的唯一入口）

**Step 2 · 挑模板** — 见下方"6 个排版模板"。

**Step 3 · 填内容** — 遵循下方"避坑清单"。

## 组件分四层

不同层组件承担不同职责，业务场景可以只用其中几层。详细规范见 `@zonedsl/core/LAYERS.md`。

### 1 · primitive（原语层）— 无状态、无场景

`text` / `tag` / `divider` / `badge` / `pill` / `icon` / `avatar` / `quote` / `kicker` / `trend` / `tip` / `callout` / `display` / `progress` / `alert` / `metric` / `image`

**用途**：文字、标签、图标、单值等最小视觉单元，任何主题都能用。

### 2 · structure（结构层）— 通用容器

`card` / `section` / `row / col` / `grid` / `list` / `numbered-list` / `labeled-list` / `table` / `timeline` / `gallery` / `hscroll` / `swiper` / `chapter` / `divider-fancy` / `form`

**用途**：装组件的盒子、布局、列表、时间线等**通用**结构。

### 3 · interactive（交互层）— 有 state / 可点击

`tabs` / `accordion` / `checkbox` / `checkbox-group`（v2.8） / `radio` / `radio-group` / `select` / `textarea` / `quiz` / `button` / `step / steps` / `stairs` / `mechanism`

**用途**：需要用户操作的组件。

> **⚠️ 交互目前限制**：`button` 现在**只是视觉样式**，无点击行为。如果 AI 需要引导用户 followup / 追踪话题 / 跳转，请**用文字表达意图**（如 `::text "→ 追问下一步：..."`），不要指望 button 能真的触发跳转。intent 白名单交互能力在规划中，尚未上线。

### 4 · preset（业务预设层）— 强场景绑定

`magazine-cover` / `chapter magazine` / `city-card` / `person-grid + person-card` / `scene-card` / `glyph-compare` / `statement` / `editorial-hero` / `editorial-pullquote` / `editorial-summary` / `editorial-stat` / `editorial-image` / `fact-bar` / `data-board` / `step-block` / `icon-grid`

**用途**:热点复盘 / 杂志内容的**成品卡**，一行 DSL 出效果。

### 5 · chart（图表层）— echarts 驱动

`line` / `bar` / `pie` / `sparkline` / `radar` / `ring` / `rank` / `compare`

**用途**：数据可视化。

## 混合 markdown 使用指南

ZoneDSL 支持三种混排方式，按内容形态选：

### A · 纯 markdown（不用 ZoneDSL）

回答简单、只需要标题+段落+列表时，直接写 markdown。

### B · markdown + 顶格 `::` 混排（推荐 95% 场景）

在 markdown 正文中，用**顶格 `::`** 穿插 zone 组件。towxml 自动识别顶格 `::xxx` 块（直到下一空行或缩进结束）：

```
# 今日热点

三条线索都值得看。

::magazine-cover theme=editorial tag="HOT SPOTS · 2026.07.03" title="今日三焦点" bg=light

## 焦点一：盛夏夜

正文段落...

::numbered-list "看点在哪"
  item "四姐气场碰撞"
  item "南美世界杯氛围"

普通 markdown 段落继续。
```

**这是最常用的形态**。AI 可以自由在段落间穿插 zone 组件。

**顶格穿插的四条铁律**：

1. **顶格 `::` 前后必须各空一行** —— towxml 用空行作为 zone 块的边界。紧贴普通段落会导致解析错乱：
   ```
   ❌ 错：
   三条线索都值得看。
   ::magazine-cover ...     ← 前面没空行,会被当成段落一部分
   ## 焦点一
   
   ✅ 对：
   三条线索都值得看。
                            ← 空行
   ::magazine-cover ...
                            ← 空行
   ## 焦点一
   ```

2. **子项用 2 空格缩进，不能用 Tab / 4 空格** —— parser 按缩进层级识别子节点：
   ```
   ✅ 对：
   ::numbered-list "看点"
     item "第一点"
     item "第二点"
   
   ❌ 错：
   ::numbered-list "看点"
       item "第一点"        ← 4 空格,子节点归属混乱
   ```

3. **组件内部不能塞 markdown 语法** —— attrs 值里只能用 ZoneDSL 的行内高亮 `**bold**` / `~~soft~~` / `==colored==`，不能塞 `# 标题`、`- 列表` 或 `[链接](url)`。要放正文段落，用外层 markdown 或 `::text` 组件。

4. **单次输出的 zone 密度控制在 30-70%** —— 阅读节奏最好。经验值：
   - 密度 < 30%（少量组件）：走纯 markdown 即可，不用 zonedsl
   - 密度 30-70%（组件 + 段落穿插）：**最佳区间**，视觉与阅读平衡
   - 密度 > 70%（大部分是组件）：改用围栏 `\`\`\`zone` 或纯 zone 块

### C · 围栏 ` ```zone ` 块（少数场景）

只在以下情况用围栏：
- **整段都是 zone 组件**，没有 markdown 混排
- **需要在围栏行传 meta**（如 `\`\`\`zone theme=literary`）
- **保护语法**（zone 语法与外层 markdown 有冲突时）

```
\`\`\`zone theme=literary
::magazine-cover title="梅雨季" ...
::chapter ...
\`\`\`
```

大部分情况**不需要围栏**，顶格 `::` 直接混排在 markdown 里更自然。

## 6 个排版模板

### 模板 1 · daily-hotlist（每日热点）

```
::magazine-cover theme=editorial tag="HOT SPOTS · <日期>" title="<主话题>\\n**<副话题>**" subtitle="<导语，用 ==keyword== 强调>" footnote="<数据来源>" badge="<日期范围>" stats="<数字 描述>,..." bg=light

::chapter "01" title="<热点1>" subtitle="<小标>" category="TOPIC"
::text "<正文段落>"
::numbered-list "看点在哪"
  item "<看点 1>"
  item "<看点 2>"

::chapter "02" title="<热点2>" ...
...

::editorial-hero kicker="THE DAY" title="<收尾金句>" subtitle="<总结>" stats="..."
```

### 模板 2 · person-recap（人物 X 天复盘）

```
::magazine-cover theme=editorial tag="HOT RECAP · <日期>" title="<人物>\\n**<核心事件>**" subtitle="..." stats="..." bg=light

::chapter "01" title="先看**数据**" subtitle="<副标>" category="DATA"
::data-board cols=4
  item "主榜最高" value="8 位"
  item "在榜时长" value="11h+"

::chapter "02" title="四大名场面" subtitle="哪些互动出圈" category="SCENES"
::scene-card icon="😂" title="<名场面>" desc="..." badge="名场面" rank="峰值 6"

::chapter "03" title="48 小时" subtitle="热点节奏" category="TIMELINE"
::timeline
  item "<事件1>" when="06/30 08:40" tag="到达" location="长沙"

::editorial-hero title="<收尾>" subtitle="..." bg=warm
```

### 模板 3 · event-decode（事件解码）

```
::magazine-cover theme=editorial tag="DECODE · <日期>" title="<核心问题>\\n**<关键词>**" subtitle="..." bg=light

::chapter "01" title="起源" category="ORIGIN"
::timeline
  item "<最早节点>" when="<时间>" tag="起源"

::chapter "02" title="解读" category="DECODE"
::glyph-compare "概念对比"
  item "A" label="<label A>" desc="..."
  item "B" label="<label B>" desc="..."

::chapter "03" title="扩散" category="SPREAD"
::timeline
  item "<扩散节点>" when="<时间>" tag="热点"

::chapter "04" title="回应" category="RESPONSE"
::statement title="<标题>" author="<作者>" time="<时间>" source="平台"
  ::text "<段落 1>"
  ::text "<段落 2>"

::editorial-hero title="<核心洞察>"
```

### 模板 4 · travel-log（行程/多城复盘）

```
::magazine-cover theme=editorial tag="WEEKLY · <日期>" title="<主题>\\n**<副标>**" stats="..." bg=light

::city-card num="01" country="<国家>" city="<城市>" en="<CITY EN>" date="<日期>" color=purple
  item "<活动>" desc="..."
  tags="<相关热点>,..."

::city-card num="02" country="..." city="..." color=red
  ...

::editorial-hero title="<收尾>" subtitle="..."
```

### 模板 5 · science-explainer（科普 · literary）

```
::magazine-cover theme=literary tag="<栏目> · <日期>" title="<主题>\\n**<副标>**" subtitle="..." bg=light

::divider-fancy "核心机制"
::step-block
  item "<机制 1 详解>" label="1 · <标题>"
  item "<机制 2 详解>" label="2 · <标题>"

::divider-fancy "工作流程"
::step-block
  item "<步骤>" label="Step 1"

::divider-fancy "小贴士"
::icon-grid cols=4
  item "<提示>" icon="☀️" desc="<副标>"

::editorial-pullquote "<金句>" cite="<来源可选>"
```

### 模板 7 · markdown-longform（长文说明 · v2.8+ markdown 接管系）

**不用 zone 组件**，纯 markdown 语法。适合"标题 + 段落 + 列表 + 表格"这种以文字为主的形态。

```
::theme purple

# 主标题

正文段落一,可以用**加粗**、*斜体*、==高亮==、`行内代码`。

## 章节一

段落说明...

- 列表项 1
- 列表项 2

## 章节二

| 表头 | 值 |
| --- | --- |
| A | 1 |

> 引用块

---

\`\`\`js
// 代码块
const x = 1;
\`\`\`
```

- 主题一律用 markdown 接管系（`purple / sky / pop / sage / note`），换主题只需要改 `::theme` 后面的名字，内容完全不动
- 支持全套 markdown（h1-h6 / p / ul / ol / li / table / blockquote / hr / pre / code / a / img / strong / em / del / mark / ins / sub / sup / task-list）
- **不需要**写 magazine-cover / chapter / editorial-hero 这些 zone 组件

### 模板 6 · data-report（数据报告 · data）

```
::magazine-cover theme=data tag="REPORT · <日期>" title="<指标>\\n**<结论>**" stats="..." bg=light

::chapter "01" title="核心指标" category="METRICS"
::grid cols=4
  ::metric "1240万" desc="Q4 营收" color=accent
  ::metric "↑18%" desc="同比" color=success

::chapter "02" title="趋势" category="TREND"
::line "月度营收" labels=1月,2月,3月,4月,5月,6月 data=820,1050,880,1180,1240,1400 area smooth unit=万

::chapter "03" title="排行" category="RANK"
::rank
  item "iPhone" value=3200

::editorial-summary title="TL;DR" "<一句话结论>"
```

## 组件速查表

每层组件的完整语法、属性、示例在独立文档里。按需引用，避免上下文冗余：

| 层 | 文档 | 用途 |
|---|---|---|
| **preset** | [CATALOG-PRESET.md](./CATALOG-PRESET.md) | 杂志成品卡（magazine-cover / city-card / scene-card / data-board ...），**杂志内容首选** |
| **structure** | [CATALOG-STRUCTURE.md](./CATALOG-STRUCTURE.md) | 通用容器（card / grid / list / timeline / chapter ...） |
| **primitive** | [CATALOG-PRIMITIVE.md](./CATALOG-PRIMITIVE.md) | 原语（text / tag / metric / image / quote ...） |
| **interactive** | [CATALOG-INTERACTIVE.md](./CATALOG-INTERACTIVE.md) | 交互（tabs / accordion / quiz / checkbox / button ...） |
| **chart** | [CATALOG-CHART.md](./CATALOG-CHART.md) | 图表（line / bar / pie / radar / rank ...） |

**业务 prompt 按需加载**：
- 杂志内容生成 → SKILL.md + PRESET + STRUCTURE + PRIMITIVE
- 问卷/投票 → SKILL.md + INTERACTIVE + PRIMITIVE
- 数据报告 → SKILL.md + CHART + PRESET(data-board/editorial-summary) + PRIMITIVE
- 通用对话 → SKILL.md（全量索引）

**行内高亮语法**（title/subtitle 中通用）：
- `**text**` → **亮金黄块 `#FFB700`** + 深炭字（主强调，视觉最重）
- `~~text~~` → **橙色字 + 底部半高浅金橙块**（次强调，马克笔效果）
- `==text==` → title：深炭字 + 橙下划线；subtitle：**橙色加粗字**（轻强调）

## 避坑清单（重要）

### 1 · 双引号嵌套

**❌ 错**：`subtitle="从"手怎么了"到..."`
**✅ 对**：`subtitle="从「手怎么了」到..."`（中文引号）或 `\"手怎么了\"`（转义）

DSL 里 attr 值用英文双引号包裹，值内**不能有裸英文双引号**。

### 2 · 换行

**❌ 错**：在 attrs 里直接按回车换行
**✅ 对**：用 `\\n`（模板字符串里存字面量 `\n`）

parser 按行 tokenize，attrs 内真实换行会截断组件。

### 3 · 主题声明

**❌ 错**：每个组件都写 `theme=`
**✅ 对**：只在第一个 `magazine-cover` 上写一次，或用 `::theme literary` 顶格一行

### 4 · main / title 优先级

**❌ 错**：`::card "Q4" title="Q4 核心"`（重复）
**✅ 对**：`::card "Q4 核心"`（引号紧跟名字就是 main = title）

### 5 · 未知组件静默丢弃

从 v1.6 开始，未知组件默认 **silent 模式**——直接不渲染，不会显示"未支持"卡片。所以：
- 不要写没定义过的组件，会消失
- 不确定组件名时，参考本文速查表或 `@zonedsl/core/LAYERS.md`
- 已删除的组件：`echarts-raw`（用 `::line/bar/pie/radar`）、`tree`（视觉差，改用 `::step-block` 或 `::timeline`）

### 6 · 网格列数与嵌套

**列数**（`grid / data-board / icon-grid / person-grid`）：**默认 `cols=2`**。列数按**单项内容宽度**决定：
- ≤ 4 字符（`"8位"` `"63%"`）→ 3-4 列 ✅
- 5-8 字符（`"1240万"`）→ 2-3 列
- ≥ 9 字符或长中文 → **2 列或改用 `::list`**
- 想 3-4 列展示长内容 → 放进 `::hscroll` 横滚
- `data-board` value 超 8 字符时改用 `layout=row`（label 左 + value 右）

**嵌套**：`row/col/grid` 深嵌套 3 层以上性能会退化，**限制在 2 层内**。

### 7 · button intent 交互（v2.0）

`::button` 从 v2.0 起支持 **intent 白名单**（`followup / send-message / search / open-topic / open-tab / open-url / copy / share`）。写法：

```
::button "追问看点" intent=followup value="这个话题还有哪些看点?"
::button "搜相关" intent=search value="示例关键词"
```

**未知 intent / 非法 value 会静默降级成纯样式**，不会报错。**引导 followup / 跳转优先用 button，别再用 `::text "→ 追问..."` 的文字凑合**。详见 `CATALOG-INTERACTIVE.md` 和 `@zonedsl/core/INTENTS.md`。

### 8 · numbered-list 换行

item 内不要用 `\n`，会被 parser 当成节点结束。多段用多个 item。

### 9 · 主题白名单

**杂志系（7 套）**：`editorial / literary / serious / data / serene / warm / luxe`
**markdown 接管系（5 套，v2.8+）**：`purple / sky / pop / sage / note`
其他值 fallback 到 `editorial`。

### 10 · 加粗节制使用

towxml 默认给 `**加粗**` 加**马克笔黄底**高亮块（editorial 主题），视觉冲击力强。**一段里 1-3 处即可**，通篇每句加粗会到处黄块很乱。真正需要强调的词才用加粗。

### 11 · 流式渲染的 zone 组件

流式过程中 zone 组件的 attrs 可能吐到一半，parser 有内部 streamingSafe 机制会**只在完整闭合时更新最后一个 bare attr**，避免 `bg=a → bg=acc → bg=accent` 的中间态闪烁。AI 输出**不需要感知**，只要按正常语法写就行。

## 完整示例

参考项目内 `examples/` 里的 DEMO 5-11 是 7 个完整杂志式示例，直接对照模板套用即可。

## 相关文档

**分层速查**（本 skill 目录内）：
- [CATALOG-PRESET.md](./CATALOG-PRESET.md) — 业务预设层
- [CATALOG-STRUCTURE.md](./CATALOG-STRUCTURE.md) — 结构层
- [CATALOG-PRIMITIVE.md](./CATALOG-PRIMITIVE.md) — 原语层
- [CATALOG-INTERACTIVE.md](./CATALOG-INTERACTIVE.md) — 交互层
- [CATALOG-CHART.md](./CATALOG-CHART.md) — 图表层

**项目内权威文档**：
- `@zonedsl/core/THEMES.md` — 主题详细规范、CSS 变量清单、扩展方式
- `@zonedsl/core/LAYERS.md` — 组件分层规范、每层职责边界
- `@zonedsl/core/VERSIONS.md` — 组件变更记录、废弃/新增标记

## 一句话总结

**先决定形态**（杂志式结构 or 长文说明）→ **默认不声明主题**（除非用户明确要）→ **挑模板**（1-7）→ **填内容**。输出前默念：**引号别嵌、换行用 `\\n`、主题只声明一次、button 用 intent 引导后续动作、加粗节制使用**。
