# ZoneDSL 组件分层规范

ZoneDSL 组件按职责分成 5 层。分层不是文档分类，而是**代码组织 + skill 加载 + 业务隔离**的运行时约定。

## 5 层清单

| 层 | 关键词 | 特点 | 组件数 |
|---|---|---|---|
| **primitive** | 原语 | 无状态、无场景、任何主题可用 | 17 |
| **structure** | 结构 | 通用容器、布局、列表 | 16 |
| **interactive** | 交互 | 有 state / 用户可点击 | 13 |
| **chart** | 图表 | echarts 驱动的数据可视化 | 8 |
| **preset** | 业务预设 | 强场景绑定的成品卡 | 16 |

## 分层原则

### primitive（原语层）— 最小视觉单元

单一职责的展示组件，不带业务假设，任何主题下都能用。

**清单**：
```
text / tag / divider / badge / pill / icon / avatar / quote
kicker / trend / tip / callout / display / progress / alert
metric / image
```

**判定标准**：
- 只做一件事（显示一段文字 / 一个标签 / 一条分隔线）
- 不装其他组件
- 不带交互（除了图片预览）

### structure（结构层）— 通用容器

装组件的盒子、布局、列表、分栏、时间线等**通用**结构。

**清单**：
```
card / section / row / col / grid / center / list / numbered-list
labeled-list / table / timeline / gallery / hscroll / swiper
chapter / divider-fancy / form
```

**判定标准**：
- 主要作用是**装其他组件**或组织多个 item
- 不含业务场景假设（`card` 装什么都行，`city-card` 只装城市行程）
- 可以嵌套自身或其他结构层组件

### interactive（交互层）— 有 state / 可点击

需要用户操作、内部维护状态的组件。

**清单**：
```
tabs / accordion / checkbox / radio / radio-group / select
textarea / quiz / button / step / steps / stairs / mechanism
```

**判定标准**：
- 组件内部有 state（selected / open / value）
- 用户点击/输入会改变视觉

**⚠️ 当前限制**：`button` 组件只有样式，**没有点击行为**。intent 白名单机制在规划中。

### chart（图表层）— 数据可视化

由 echarts 驱动的图表组件，输出 `{ tag: 'echarts', attrs: { value: 序列化 option } }`。

**清单**：
```
line / bar / pie / sparkline / radar / ring / rank / compare
```

**判定标准**：
- 需要 echarts 渲染
- 或视觉表现为"数据 → 图形"

### preset（业务预设层）— 场景绑定的成品卡

针对特定内容场景（杂志封面、人物阵容、行程图鉴、事实条、名场面）设计的成品卡。**一行 DSL 出效果**，AI 输出成本最低。

**清单**：
```
magazine-cover / chapter-magazine / city-card / person-grid
person-card / scene-card / glyph-compare / statement
editorial-hero / editorial-pullquote / editorial-summary
editorial-stat / editorial-image / fact-bar / data-board
step-block / icon-grid
```

**判定标准**：
- 名字暗示业务场景（`city-card` = 城市行程；`fact-bar` = 事实条）
- 内部结构复杂，包含多个 primitive/structure 元素的组合
- 换个场景就用不上（`glyph-compare` 只适合字/词对比）

## 业务隔离建议

不同 prompt 场景应该只加载相关层，避免 AI 用不到的组件占用上下文：

| 场景 | 加载层 |
|---|---|
| **对话页 / 通用 agent** | primitive + structure + interactive + chart + preset（全部） |
| **杂志内容生成** | primitive + structure + preset + chart |
| **表单 / 问卷 / 投票** | primitive + interactive + structure |
| **数据报告** | primitive + structure + chart + preset(data-board/editorial-summary) |
| **短对话回答** | 只用 markdown，不加载 zonedsl |

**运行时白名单**（规划中，尚未实现）：`dslToNodes(dsl, { allowLayers: ['preset', 'primitive'] })` — 其他层组件走 silent fallback。

## 版本演进约定

每个组件的 case 顶部加注释：

```js
// @since v1.0 @layer primitive
case 'text': { ... }

// @since v1.5 @layer preset
case 'magazine-cover': { ... }

// @deprecated v2.0 use ::line/::bar instead
case 'echarts-raw': return null
```

- **`@since <version>`**：组件首次出现的版本
- **`@layer <name>`**：所属层
- **`@deprecated <version> <reason>`**：标记废弃，指向替代品

变更记录见 `VERSIONS.md`。

## 层与主题的关系

**层**决定组件能力，**主题**决定颜色/字重/间距。组合是 M × N：

- 同一 `magazine-cover`（preset），在 `editorial` 主题下是黄橙块，在 `literary` 主题下是焦茶块
- 同一 `text`（primitive），在 4 个主题下都能工作，只是字色跟着变

组件不应该硬编码主题色。**所有颜色走 `--mz-*` CSS 变量**，让主题层统一控制（见 `THEMES.md`）。

## 新增组件的决策流程

写新组件前先问：

1. **能用现有组件组合出来吗？**
   - 能 → 不要新增，教 AI 组合
2. **是否是**特定业务场景**的固化模板？**
   - 是 → preset 层
3. **是否是**通用布局/容器**？**
   - 是 → structure 层
4. **是否是**最小视觉单元**？**
   - 是 → primitive 层
5. **是否需要 state / 用户操作？**
   - 是 → interactive 层
6. **是否是**数据图表**？**
   - 是 → chart 层

## 层与文件（规划）

当前所有组件在 `@zonedsl/wechat/toWxNodes.js` 一个大 switch 里。**远期**会拆分到独立模块：

```
@zonedsl/core/
├── toWxNodes.js               # 主入口 + 主题提取 + 层分发
├── components/
│   ├── primitive.js
│   ├── structure.js
│   ├── interactive.js
│   ├── chart.js
│   └── preset.js
├── parser.js
├── THEMES.md
├── LAYERS.md
└── VERSIONS.md
```

拆分优先级：**P2**（等大 switch 超过 2000 行再动）。

## 相关文档

- **`SKILL.md`（.claude/skills/zonedsl/SKILL.md）** — AI 输出规范、模板、避坑清单
- **`THEMES.md`** — 主题作用域、CSS 变量、场景选择
- **`VERSIONS.md`** — 增量变更记录
