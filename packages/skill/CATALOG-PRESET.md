# Preset 层组件速查

业务预设层 — 强场景绑定的成品卡。一行 DSL 出效果，杂志内容首选。

## magazine-cover — 杂志封面头

```
::magazine-cover theme=editorial tag="HOT SPOTS · 2026.07.03" title="今日三焦点" subtitle="导语,用 ==关键词== 强调" footnote="数据来源" badge="07/03" stats="3 大话题,7 个看点" bg=light
```

属性：
- `theme`：12 套主题任选（详见 `@zonedsl/core/THEMES.md`），只声明一次，整块继承
- `tag` / `date`：顶部胶囊标签（如 `HOT SPOTS · 日期`），tag/date 之间自动加 `·` 分隔
- `tag-style`：顶部胶囊样式 —— `pill`（默认，白底米线）/ `dark`（深炭底 + 白字）/ `accent`（橙底 + 白字）/ `light`（同 pill）
- `title`：主标题，支持行内高亮语法 + `\\n` 换行
- `subtitle`：副标题（白卡片包裹）
- `footnote`：左下角说明（带橙色圆点）
- `badge`：右下角橙色渐变胶囊
- `stats`：底部数据胶囊列表，逗号分隔（前缀数字自动染橙）
- `bg`：**默认 `light`（暖米底）**（v2.8 起）/ `accent`（鲜橙渐变）/ `warm` / `dark`。不写就是 light 底,视觉柔和；要浓烈的鲜橙渐变才显式写 `bg=accent`

### title/subtitle 行内高亮三档

| 语法 | 视觉 | 适用 |
|---|---|---|
| `**text**` **primary** | **亮金黄块 `#FFB700` + 深炭字**（最重） | 主强调,视觉重量拉满 |
| `~~text~~` **soft** | **橙色字 + 底部半高浅金橙块**（马克笔效果） | 次强调,不抢主标题 |
| `==text==` **colored** | title 里：深炭字 + 橙下划线；subtitle 里：**橙色加粗字（无块无线）** | 轻强调 |

**语法选择建议**：
- 主话题 / 关键数字 / 核心词汇 → `**...**`
- 修饰语 / 时间 / 数字辅助信息 → `~~...~~`
- 长句里的关键词 → `==...==`

别名：`::cover`

## chapter magazine — 杂志分栏

```
::chapter "01" title="先看**数据**" subtitle="刷屏有多猛" category="DATA"
```

带 `category` 自动走 magazine 变体：深炭 tab `01 / DATA` + 大字标题

## city-card — 城市行程卡

```
::city-card num="01" country="意大利" city="米兰" en="MILANO" date="6月19日 — 6月21日" color=purple
  item "米兰出发" desc="6月19日启程前往米兰"
  item "米兰自拍" desc="分享米兰行程随拍"
  tags="示例艺人甲米兰出发,示例艺人甲米兰自拍"
```

`color`：`purple / red / green / blue / pink / accent`（决定卡片 tint 底色）

item 自动加 `[n]` 橙色索引；tags 显示为 `#xxx` 话题样式

别名：`::itinerary-card`

## person-grid + person-card — 人物阵容

```
::person-grid cols=2
  ::person-card name="大姐 吴君如" desc="香港资深演员" avatar="https://..."
  ::person-card name="二姐 那英" desc="天后级歌手" avatar="https://..."
```

`cols`：1-4；无 avatar 时显示名字首字作 fallback。**列数选择规则**同 `::grid`（见 CATALOG-STRUCTURE.md），人名 ≤ 4 字用 3-4 列，长人名/长描述用 2 列。

## scene-card — 名场面卡

```
::scene-card icon="😂" title="示例艺人乙手怎么了" desc="7月1日晚登上热点榜第13位..." tags="名场面,综艺" badge="名场面" rank="峰值 6"
```

属性：
- `icon`：emoji
- `title` / `desc`：标题描述
- `tags`：底部标签
- `badge`：顶部元信息（如"名场面"）
- `rank`：顶部排名信息（如"文娱榜峰值 6"）

别名：`::moment-card`

## glyph-compare — 字/词对比

```
::glyph-compare "一个字的两张脸"
  item "䔍" label="本名·古字" desc="古异体字,电脑字库无法显示..."
  item "甯" label="艺名·通用字" desc="日常更常用,作名时读 nìng"
```

单外框共享 + 顶部深色 tab 分栏，宋体大字

别名：`::character-compare`

## statement — 回应/声明卡

```
::statement title="一个美丽的误会" author="示例艺人丙" time="2026.06.25 20:57" source="平台"
  ::text "一个美丽的误会,不存在原名艺名的区别..."
  ::text "「钧甯」二字,藏着父母对我人生的深深寄望..."
```

米色底 + 标题虚线分隔 + 段落列表 + 底部署名行

## editorial-hero — 编辑体大字块

```
::editorial-hero kicker="THE WEEK" title="收尾金句" subtitle="总结段落" stats="3 座城市,59 条热点" bg=warm
```

属性：
- `kicker`：顶部小标签（如 `THE WEEK`）
- `title`：大字标题，支持 `**高亮**` / `\\n` 换行
- `subtitle`：副标题
- `stats`：底部白色胶囊列表
- `bg`：`accent / warm / dark`（暖橙渐变 / 深炭）

## editorial-pullquote — 大字引言

```
::editorial-pullquote "衣裳润润的,书页软软的,这就是江南人对梅雨季最切肤的记忆。" cite="江南随笔"
```

米色底 + 橙左条 + 大字衬线引言

## editorial-summary — TL;DR 摘要

```
::editorial-summary title="TL;DR" "一句话结论,概括全文要点。"
```

## editorial-stat — 编辑体数字

```
::editorial-stat "10M+" desc="全球活跃用户" trend="↑34%"
```

## editorial-image — 编辑体图片

```
::editorial-image url="https://..." caption="创新引领未来" search="关键词"
```

## fact-bar — 深色横向事实条

```
::fact-bar
  item "场地" value="麦迪逊广场花园·包场 3 天"
  item "宾客" value="约 1100 人"
  item "保密" value="全员禁手机"
```

深炭底 + 横向键值对

## data-board — 深色数据面板

```
::data-board cols=4
  item "主榜最高" value="8位" tag="热点榜"
  item "文娱榜最高" value="6位" tag="文娱榜"
  item "最长在榜" value="11h42m"
  item "互动占比" value="63%" tag="互动比"
```

两种布局：
- `layout=grid`（默认）：N 列网格大数字
- `layout=row`：行式 label 左 + value 右（**value 超 8 字符时优先用 row**）

`cols`：1-4。**列数选择规则**同 `::grid`（见 CATALOG-STRUCTURE.md）：value ≤ 4 字符（`"8位"` `"63%"`）用 4 列，5-8 字符（`"11h42m"` `"1240万"`）用 2-3 列，≥ 9 字符改用 `layout=row`。

## step-block — Step 1-N 米色块列表

```
::step-block
  item "分析内容,判断需要哪类可视化组件" label="Step 1"
  item "调用对应技能获取组件 ID" label="Step 2"
  item "在 HTML 中插入占位符" label="Step 3"
```

米色底 + 左侧 Step 标签 + 右侧描述。literary 主题主用

## era-timeline — 横向历史时间条（v2.1）

```
::era-timeline "梅雨极端年份"
  item "1954" label="百年一遇" desc="长江流域大梅雨,超警戒水位..."
  item "1998" label="二度梅+洪水" desc="千亿损失,29 省受灾..."
  item "2020" label="超长梅" desc="60 天不停歇..."
```

每张卡片：**年份大字（橙）+ 小 label（灰）+ 描述**。适合展示：
- 历史极端事件（气候、灾害）
- 品牌/人物大事记
- 版本演进（v1.0 / v2.0 / v3.0 关键节点）

**双布局自动切换（v2.8+）**：

- **≤3 张 item**（特别是 2 或 4 张）自动走 **`grid` 2 列布局**：铺满宽度、视觉整齐
- **4+ 张**自动走 **`scroll` 横滑**：内嵌 `inline-flex + stretch` 严格等高
- 可显式覆盖：`layout=grid` 或 `layout=scroll`

别名：`::history-strip`

## media-card — 图片+叠加标题（v2.1）

```
::media-card
  url="https://example.com/cover.jpg"
  tag="TOP STORY"
  title="示例综艺 北京开录"
  subtitle="7 月 3 日 · 首都机场"
  tags="示例综艺,综艺"
  height=400
  align=bottom
  overlay=gradient
```

图片作背景，文字叠加。属性：
- `url`：背景图 URL
- `tag`：左上角小胶囊标签（白底黑字）
- `title`：主标题（白字带阴影）
- `subtitle`：副标题
- `tags`：底部胶囊列表
- `height`：卡片高度（rpx，默认 360）
- `align`：文字位置 `top / center / bottom`（默认 bottom）
- `overlay`：图片遮罩 `gradient / solid / none`（默认 gradient）

用途：杂志封面卡、专题头图、影视/商品卡片

## icon-grid — emoji 网格

```
::icon-grid cols=4
  item "晒太阳" icon="☀️" desc="早晨 15 分钟"
  item "规律睡眠" icon="🕐" desc="每晚 7 小时"
  item "深呼吸" icon="🧘" desc="4-7-8 呼吸法"
  item "适度运动" icon="🏃" desc="每周 150 分钟"
```

`cols`：1-4。**列数选择规则**同 `::grid`（见 CATALOG-STRUCTURE.md）：icon 是 emoji 天然窄，`main` 短标签（≤ 4 字）适合 4 列；长标签（`"每周 150 分钟"`）改用 2 列。

别名：`::tip-grid`
