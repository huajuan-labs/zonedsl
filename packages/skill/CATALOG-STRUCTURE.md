# Structure 层组件速查

结构层 — 通用容器、布局、列表、时间线。装组件的盒子。

## card — 卡片容器

```
::card "Q4 核心指标"
  ::metric "1240万" desc="Q4 营收"
::card v=highlight "重要数据"
  ::text "..."
```

`v`（variant）：`default / highlight / outline / ghost / elevated`

## section — 章节容器

```
::section "渠道明细"
  ::table ...
```

## row / col — 行列布局

```
::row
  ::col span=6
    ::metric "..."
  ::col span=6
    ::metric "..."
```

`span`：6（半宽）/ 12（全宽），自动 clamp

**v2.9 · 支持 `align=center`**（水平居中子组件）：

```
::row align=center
  ::tag "热点"
  ::tag "上升"

::col align=center
  ::text size=hero "标题"
  ::text "副文"
```

## center — 通用居中容器（v2.9）

零参数，双向 flex 居中，宽度 100%。子组件水平永远居中，垂直方向在容器有额外高度时可见。

```
::center
  ::radar "六维评估"
    axis "工程" score=88
```

不需要外面套 section/card 才能居中——最短语义。

## grid — 网格布局

```
::grid cols=3 gap=md
  ::metric "..."
  ::metric "..."
```

`cols`：1-4；`gap`：`xs / sm / md / lg`

**列数选择规则**（看**单项内容宽度**，不看中文/数字）：

| 单项宽度 | 列数 |
|---|---|
| ≤ 4 字符（`"8位"` `"11h"` `"63%"`） | 3-4 列 ✅ |
| 5-8 字符（`"11h42m"` `"1240万"`） | 2-3 列 |
| ≥ 9 字符或长中文（`"哪些互动出圈"`） | **2 列或改用 `::list`** |
| 需要 3-4 列展示长内容 | 放进 `::hscroll` 横滚 |

**默认写 `cols=2`**，除非明确单项都很短。窄屏会自动换行成 2 列（min-width 兜底），但视觉上不如原生 2 列排版整齐。

## list — 圆点列表

```
::list "本周待办"
  item "确认 Q4 财报数据"
  item "组织周会同步进度"
```

## numbered-list — 编号列表

```
::numbered-list "看点在哪"
  item "第一点..."
  item "第二点..."
```

别名：`::ol`

## labeled-list — 标签+描述列表

```
::labeled-list "关键节点"
  item "福建舰" desc="..." color=accent
  item "相关热点" desc="..." color=primary
```

## table — 表格

```
::table "各分公司月度业绩"
  field "分公司"
  field "营收"
  field "增长率"
  row cells=北京,420万,↑12%
  row cells=上海,380万,↑8%
```

## timeline — 时间线

```
::timeline "项目里程碑"
  item "需求评审通过" when=2026-06-01
  item "原型设计完成" when=2026-06-08
  item "重点节点" when=2026-06-15 tag="里程碑" location="北京" highlight=true
```

支持属性：`when / tag / location / highlight`

## gallery — 图片九宫格

```
::gallery "美食三连拍"
  ::image url="..."
  ::image url="..."
  ::image url="..."
```

自动按数量选 1/2/3 列布局

## hscroll — 横划列表

```
::hscroll "本周热榜"
  ::card v=outline ...
  ::card v=outline ...
```

别名：`::scroller`

## swiper — 轮播

```
::swiper "本季度重点项目" height=520 circular
  ::card v=highlight ...
  ::card v=highlight ...
```

属性：`height / autoplay / circular / interval / dots`

## chapter — 章节标记

```
::chapter "01" title="引言"
::chapter "02" title="核心功能" subtitle="副标" category="DATA"
```

带 `category` 自动走 magazine 变体（深炭 tab）

## divider-fancy — 装饰分隔线

```
::divider-fancy "核心机制"
::divider-fancy "工作流程" prefix="//"
```

别名：`::section-mark`

## form — 表单容器

```
::form "问卷调查"
  ::checkbox "阅读" checked
  ::radio-group
    radio "男" selected
    radio "女"
```
