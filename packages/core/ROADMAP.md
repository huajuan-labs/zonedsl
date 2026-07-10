# ZoneDSL Roadmap · v3 & v4 演进规划

> 从「小程序端生产实现（v2.9）」演进为「跨端主分支 ZoneDSL v3+」的路线图。
> 本文档只描述**规划**，不含实现代码。实施拆解到具体版本里。

---

## 当前基线：v2.9（2026-07-08）

- 位置：`packages/wechat/`
- 状态：**生产使用中**（生产环境每天跑）
- 核心能力：
  - Parser：`zone-dsl/parser.js`（纯 JS 无 DOM，CJS 单出），支持 `streamingSafe` / `dropPartialLastLine` / `looksPartial` 三档流式保护
  - 组件：**62 个**（primitive 18 / structure 16 / interactive 13 / chart 8 / preset 18），杂志系 preset 是我们独有
  - 主题：**12 套**（editorial / literary / serious / data / serene / warm / luxe + purple / sky / pop / sage / note）
  - Intent：11 个白名单意图（followup / send-message / search / open-* / login / open-my / copy / share / open-url）
  - Skill：`skill/`（AI 输出）+ `skill-dev/`（接入 + 扩展）
  - 文档站：`docs/index.html`（SPA 单入口，7 tab EXAMPLE，playground 用手写 web-renderer）

---

## 参照对象：hot_assistant/demo/zonedsl（官方 v0.1）

- 位置：`hot_assistant/demo/zonedsl/`（同人早期 Web 端产物）
- 状态：v0.1 开发中，未上线，API 未稳定
- 核心能力：
  - Parser：**同源 parser**（260 行，与我们前 260 行几乎一致），但 ESM 单出、无 `streamingSafe`
  - 组件：约 40+（primitive/structure/data/chart/mechanism/interactive/infographic）
  - 主题：10 套 Web 主题（warm-amber / liquid-glass / gold / swiss / ink / indigo / forest / kraft / dune / huajuan）
  - Runtime：`runtime.js` 806 行（morphdom diff + 结构化 key + chart-engine 实例池 + registry + updater）
  - Chart：真 echarts 实例池（`chart-engine.js` 369 行）
  - 分层：spec / runtime / sdk / server / adapters / samples（18 个官方样本）
  - 独立仓库：LICENSE + package.json + workspaces + README 完整

---

## 核心决策：以 v2.9 为主分支演进（v3）

**理由**：
1. streamingSafe 是我们独有的、真实解决过流式痛点的能力，不能丢
2. 62 组件 / 12 主题 / 杂志系 preset 都是内容形态验证过的，规范价值高于官方 v0.1
3. 官方 v0.1 未上线，我们生产验证过，"从生产版倒推规范"比"从规范正推适配"工程学更稳
4. 借鉴官方的 **runtime 层能力**（morphdom / chart-engine / RETROFIT 接入文档）而非**合并整体架构**

---

## 演进路径

### 阶段一 · v3.0 · 双出 Parser + Web 起步（当前）

**目标**：让 Parser 同源双出（CJS + ESM），Web 端能直接用；小程序继续 CJS 不改动。

- ✅ **已完成**：`zone-dsl/parser.mjs` 桥接层（`createRequire` 转发 CJS 源码），Web / Node 侧可 `import`
- ⏳ **待做**：
  - Playground 换用 `parser.mjs`（替换手写 `parser-browser.js` 全局脚本）
  - 移植流式优化（morphdom + 结构化 key + stickToBottom + 半截组件名兜底）到 playground web-renderer
  - Playground 引入官方 18 个 samples 作为示例下拉

### 阶段二 · v3.5 · Web Runtime 补齐

**目标**：把官方 hot_assistant runtime 的核心能力**借鉴过来**（不整体 vendor），作为 zone-plugin 的 web 侧兄弟目录。

- 新增 `zone-plugin/web-runtime/`（与现有 `zone-components/` 平级）：
  - `web-renderer.js` —— 升级：DOM 输出 + registry 分发 + updater（in-place 更新，取代 innerHTML 全量替换）
  - `chart-engine.js` —— echarts 实例池，Web 端图表 3D/交互都能保留
  - `key-assigner.js` —— 结构化 key（`name#bucket` 路径式，参考 hot_assistant `assignStableChartIds`）
  - `themes.css` —— 12 主题的 Web 版 CSS 变量（从 `zone-components/themes/*.wxss` 抽出）
- 组件层规范化：
  - 从 `toWxNodes.js` case 分支里**抽出 spec**，每个组件写一份平台无关的 `spec/{name}.md`（attrs 定义 + 子项规则 + 主题变量 + 示例）
  - 从 spec 生成小程序端和 Web 端两套 renderer

### 阶段三 · v4.0 · Monorepo 化 + 独立仓库

**目标**：整个 ZoneDSL 从 wx-hot-search 分离出来，成为独立开源仓库。

**推荐目录结构**（monorepo，pnpm workspaces）：

```
zonedsl/                          ← 独立仓库(带 LICENSE / README / CI)
├── packages/
│   ├── core/                     ← @zonedsl/core:parser + spec + intent + theme 变量
│   │   ├── src/parser.js         (源码,CJS)
│   │   ├── dist/parser.cjs.js    (rollup 出 CJS)
│   │   ├── dist/parser.mjs       (rollup 出 ESM)
│   │   ├── spec/*.md             (组件规范文档)
│   │   ├── themes/*.tokens.json  (主题变量,平台无关)
│   │   └── intents.md            (11 个白名单)
│   │
│   ├── wechat/                   ← @zonedsl/wechat:小程序 adapter
│   │   ├── toWxNodes.js
│   │   ├── zone-components/
│   │   ├── themes/*.wxss         (从 core themes tokens 生成)
│   │   └── towxml/
│   │
│   ├── web/                      ← @zonedsl/web:Web adapter(借鉴 hot_assistant)
│   │   ├── renderer.js           (registry + updater + morphdom)
│   │   ├── chart-engine.js       (echarts 实例池)
│   │   ├── components/*.js
│   │   └── themes/*.css          (从 core themes tokens 生成)
│   │
│   ├── skill-ai/                 ← @zonedsl/skill-ai:AI 输出规范 skill
│   │   ├── SKILL.md
│   │   └── CATALOG-*.md
│   │
│   └── skill-dev/                ← @zonedsl/skill-dev:接入/扩展 skill
│       └── SKILL.md
│
├── apps/
│   ├── docs/                     ← 文档站 SPA(现 packages/wechat/docs)
│   │   ├── index.html
│   │   ├── assets/
│   │   └── playground(用 @zonedsl/web 直接跑)
│   │
│   └── examples/                 ← 18+ 个官方样本(合并 hot_assistant samples + 我们 demo-data)
│       └── *.md
│
├── tools/                        ← 工具脚本
│   ├── theme-gen.mjs             (tokens.json → wxss + css 双出)
│   └── spec-to-catalog.mjs       (spec/*.md → skill CATALOG-*.md 生成)
│
├── LICENSE
├── README.md
├── CLAUDE.md
├── package.json
└── pnpm-workspace.yaml
```

**演进步骤**：
1. 现有 `wx-hot-search/packages/wechat/` **保留副本**（vendored）确保小程序不受影响
2. 独立 `zonedsl/` 仓库创建，把 `zone-plugin/` 内容按上表拆分到 packages
3. `wx-hot-search` 通过 npm 或 git subtree/submodule 消费 `@zonedsl/wechat`
4. 反向吸收 hot_assistant `demo/zonedsl/` 的独有能力：
   - `RETROFIT.md` / `DOM-COUPLING.md`（业务方接入指南）
   - `spec/zone-dsl-spec.md`（顶层协议规范文档）
   - 三档兜底（90% 组件 → 9% `option:` 覆盖 → 1% `echarts-raw` 逃生舱）
   - Web runtime 的 morphdom + chart 实例池
5. 我们主打的能力**贡献到官方 spec**：
   - streamingSafe（流式属性半截丢弃）→ 规范化为 parser 标准选项
   - 12 主题设计标准 → 官方主题目录
   - 62 组件（尤其杂志系 preset）→ 官方组件规范
   - Intent 白名单 11 个 → 官方 intent 规范

### 阶段四 · v5.0 · 生态扩展

**目标**：让 ZoneDSL 覆盖主流跨端方案。

- **@zonedsl/rn** —— React Native adapter（`View` / `Text` / `Image` + Skia 图表）
- **@zonedsl/flutter** —— Flutter Widget adapter（Dart parser port）
- **@zonedsl/vue** / **@zonedsl/react** —— 前端框架 wrapper（在 web runtime 之上）
- **@zonedsl/node** —— Node SDK（AI 后端预校验 DSL 合法性、生成缩略预览）
- **社区 skill 市场** —— 业务方可发布自己的 CATALOG-*（扩展组件），AI 侧动态加载

---

## 短期优先级（今天 - 未来 2 周）

| 优先级 | 事项 | 状态 |
|---|---|---|
| P0 | Parser ESM 桥接 (`parser.mjs`) | ✅ 完成 |
| P0 | Playground 换用 `parser.mjs`(替换 `parser-browser.js`) | ⏳ 下一步 |
| P0 | 移植流式优化到 playground(morphdom + 结构化 key + stickToBottom) | ⏳ 下一步 |
| P1 | 引入 hot_assistant `zonedsl/samples/` 18 个样本 | 待议 |
| P1 | 抽 spec 层(核心 20 组件先抽,写在 `zone-dsl/spec/{name}.md`) | 待议 |
| P1 | echarts 实例池(playground 图表从占位升级为真 echarts) | 待议 |
| P2 | 三档兜底(`option:` 覆盖 / `echarts-raw` 逃生舱)引入规范 | 待议 |
| P2 | v4 monorepo 结构原型(不迁移代码,先建骨架验证 build 链路) | 待议 |

---

## 决策记录

### 为什么不合并 hot_assistant 官方 zonedsl 到主分支

- 官方 v0.1 未上线未稳定，API 会 breaking
- 缺 streamingSafe / 12 主题 / 62 组件 / 杂志系 preset
- 无小程序 adapter，合并会打破我们生产环境

### 为什么不完全另起炉灶

- hot_assistant runtime 的 morphdom + chart-engine + registry + updater 是**验证过的 Web 侧最佳实践**，重造轮子浪费
- 官方规范化程度高（LICENSE / spec / samples / workspaces / RETROFIT 文档），值得吸收

### 为什么保留 CJS parser 而不改 ESM 单出

- 小程序 vendor 生态（towxml / mobx-miniprogram / echarts）都是 CJS，混用 ESM 会有 default 语义/tree-shaking 差异坑
- 双出（`parser.js` CJS + `parser.mjs` ESM 桥接）零维护成本，两端各取所需

### 为什么杂志系 preset 该保留而不精简

- magazine-cover / era-timeline / person-grid / editorial-* / fact-bar / data-board / step-block / scene-card / glyph-compare / statement 这一整套是**内容形态驱动**抽出的组件（复盘 / 报告 / 科普 / 人物 / 事件 / 数据），不是拍脑袋
- 官方 v0.1 缺这套，是因为没做过热搜 Agent Chat 这类真实内容场景
- 未来贡献回官方，让"杂志系 preset"成为标准的一部分

---

## 附：需要"反向吸收"的官方能力清单

| 能力 | 来源 | 借鉴到 |
|---|---|---|
| ESM 单一 spec 文档 | `zonedsl/spec/zone-dsl-spec.md` | 未来 `packages/core/spec/` |
| 18 个官方 samples | `zonedsl/samples/*.md` | Playground 示例下拉 + `apps/examples/` |
| Web runtime (morphdom + registry) | `demo/public/stream-md/runtime.js` | 未来 `packages/web/renderer.js` |
| Chart 实例池 | `demo/public/stream-md/chart-engine.js` | 未来 `packages/web/chart-engine.js` |
| RETROFIT 接入文档 | `zonedsl/runtime/RETROFIT.md` | 未来 `packages/wechat/RETROFIT.md` + `packages/web/RETROFIT.md` |
| 三档兜底(option override) | 官方 registry `applyOptionOverride` | 未来 core spec |
| 独立 LICENSE / package.json / workspaces 结构 | 官方顶层 | 未来独立仓库 |

## 附：需要"贡献给官方"的独有能力清单

| 能力 | 我方 | 目标 |
|---|---|---|
| streamingSafe 三档流式保护 | `parser.js` v2.8 | 官方 parser 标准选项 |
| 12 主题（杂志系 7 + 接管系 5）| `zone-components/themes/*` | 官方主题目录 |
| 杂志系 18 个 preset 组件 | `zone-components/zone-node/index.wxml` | 官方 preset 规范 |
| 11 个 intent 白名单 | `zone-dsl/INTENTS.md` | 官方 intent 规范 |
| `::center` / `::row align=center`（v2.9）| `toWxNodes.js` | 官方 structure 规范 |
| Skill 双分层（AI 输出 + 开发者）| `skill/` + `skill-dev/` | 官方 skill 规范 |
