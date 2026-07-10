<div align="center">

# ::ZoneDSL

**The streaming-first rendering layer for conversational AI.**

让 AI 的流式回复从「一堵 markdown 墙」变成「会排版、有图表、能交互的杂志页面」。ZoneDSL 是一种广义 **A2UI（AI-to-UI）协议**——AI 产出结构化文本，前端渲染成 UI。

[![License: MIT](https://img.shields.io/badge/License-MIT-FF8200.svg)](./LICENSE)
[![npm @zonedsl/core](https://img.shields.io/npm/v/@zonedsl/core?label=%40zonedsl%2Fcore&color=FF8200)](https://www.npmjs.com/package/@zonedsl/core)
[![spec](https://img.shields.io/badge/spec-v1-FFB347.svg)](./protocol/spec.md)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-5E8265.svg)](./CONTRIBUTING.md)

**🎯 [Live Playground](https://zonedsl.huajuan-labs.com)** · **📖 [Spec](./protocol/spec.md)** · **🤖 [AI Skill](./packages/skill/SKILL.md)**

🌐 English: [README.en.md](./README.en.md)

</div>

---

> ### 💡 为什么要 ZoneDSL?
> 大模型流式输出越来越长，但前端只能渲染成**一坨滚不完的 markdown**——没有版式、没有图表、没有交互。ZoneDSL 让 AI 在该结构化时输出 `::component` 语法，前端解析成真正的组件树：杂志封面、数据看板、时间线、雷达图、可点击按钮——**全程流式安全**，半截属性不闪、半截符号不漏。

## ✨ 一眼看清

把这段 DSL 丢给前端：

```zone
::magazine-cover tag="HOT RECAP" title="48小时刷屏" subtitle="从开票到收官"
::data-board cols=3
  item "主榜最高" value="8 位" desc="连续 6h"
  item "在榜时长" value="11h+" desc="全平台"
::callout "开票即是起点，现场惊喜才是爆点。"
```

AI 边吐字，前端边渲染成有 tag、有 stats、有高亮的杂志卡片——不是 markdown，是**真组件**。

## 🚀 为什么不是"又一个 markdown 扩展"

机械上 ZoneDSL 是"结构化块与 markdown 共存"，但值钱的不在语法，在三样没人占的：

- **🌊 流式安全是写进 parser 的语义** —— `streamingSafe` 丢半截属性、`dropPartialLastLine` 缓冲未换行尾行、`looksPartial` 识别半截符号。MDX/remark 假设输入完整，**AI 是流式的**，这一层它们没有。
- **🤖 AI 是一等作者** —— `@zonedsl/skill` 教 AI *何时*输出 ZoneDSL、*怎么*写每个组件。这是协议的"生成方向"，没有任何 markdown 库带。
- **🔌 协议优先，非框架绑定** —— 一份 spec，多端渲染（web ✅ / WeChat ✅ / RN / Flutter 规划中），第三方跑通 conformance 套件即获 "Compliant"。MDX 官方绑 React。

## 🎨 参考实现随附

- **70+ 组件** · 5 层（primitive / structure / interactive / chart / preset）
- **12 套主题** · editorial / literary / data / serene / luxe / purple / sky / sage / note / pop / serious / warm
- **零魔法** · parser 纯 JS 无依赖，三态分发（CJS/ESM/UMD）

> 组件和主题是"精选参考集"，不是头条——你可以 `register()` 加自己的组件、覆盖内置，parser 零改动（见 [spec §10](./protocol/spec.md)）。

## 🛠️ 任意定制扩展

ZoneDSL 的 parser **组件无关**——`::任何名字` 都能解析成 AST，组件是否存在是渲染层的事。所以：

- **加组件**：渲染器 `register('my-comp', fn)`，`::my-comp` 立刻可用
- **加 intent**：宿主 `handleZoneAction` 加 `case`，button 透传 intent/value，parser 零改动
- **加主题**：override `--mz-*` 变量或新增 theme 文件
- **禁用/替换**：不注册即丢弃（`UNKNOWN_MODE=silent`），同名重写即覆盖

协议层只管通用可移植集，平台专属的一切由宿主自管。

## 📦 Packages

| Package | 作用 | 状态 |
|---|---|---|
| [`@zonedsl/core`](./packages/core) | Parser + AST（纯 JS，零依赖） | ✅ v1 |
| [`@zonedsl/web`](./packages/web) | DOM 渲染器 + 图表 recipes + 主题 | ✅ v1 |
| [`@zonedsl/wechat`](./packages/wechat) | 微信小程序运行时（zone-node + towxml + 12 主题，生产验证） | ✅ v1 |
| [`@zonedsl/skill`](./packages/skill) | AI 输出规范 + 模板 + 组件目录 | ✅ v1 |

## ⚡ 30 秒上手

```html
<script src="https://unpkg.com/@zonedsl/core/dist/parser.umd.js"></script>
<script src="https://unpkg.com/@zonedsl/web/dist/zonedsl-web.umd.js"></script>
<div id="out"></div>
<script>
  ZonePlayground.mount(document.getElementById('out'), '::callout "Hello **ZoneDSL**"');
</script>
```

> npm 包发布前，可 clone 本仓用 `docs/assets/parser.umd.js` + `docs/assets/web-renderer.js` 替代 CDN。

或直接玩 **[在线 Playground](https://zonedsl.huajuan-labs.com)** —— 12 主题实时切、流式播放、70+ 组件全览。（本地跑：`cd docs && bash serve.sh`）

## 🧠 协议是重心

ZoneDSL 是**协议优先**：spec 是源头，渲染器是实现。真相在 [`protocol/spec.md`](./protocol/spec.md)——语法、流式语义、组件契约。`@zonedsl/core` 是规范解析器，`@zonedsl/web` 和 `@zonedsl/wechat` 都是符合 spec 的参考实现。

```
protocol/          ← spec（source of truth）
packages/core/     ← 规范解析器: text → AST
packages/web/      ← 渲染器: AST → DOM
packages/wechat/   ← 渲染器: AST → zone-node(小程序)
packages/skill/    ← 生成器: intent → DSL（给 AI 用）
```

未来任何第三方都能写 React/Vue/RN 渲染器，跑通 conformance 套件即获 "ZoneDSL Compliant" 徽章。

## 🤖 让 AI 学会 ZoneDSL

把 [`packages/skill/SKILL.md`](./packages/skill/SKILL.md) 放进你的 agent（Claude Code: `.claude/skills/zonedsl/`）。AI 就知道：什么时候该用 ZoneDSL（多小节+结构化）、什么时候退回纯 markdown（单句问答）、每个组件怎么写。

## 🤝 贡献

详见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。要点：parser 组件无关，**加组件无需改 parser**——在所用运行时里注册即可（web：`ZonePlayground.register('my-comp', fn)`；wechat：`toWxNodes.js` 加 case + `zone-node` 加分支 + `COMPONENT_REGISTRY` 登一条）。扩展 intent / 主题同理，见 [spec §10](./protocol/spec.md)。

欢迎的方向：补 React/Vue/RN/Flutter 渲染器（跑通 conformance 套件即 "Compliant"）、贡献领域模板（金融/医疗/教育）、补组件与主题、完善文档与示例。issue / PR / ⭐ star 都欢迎。

## 📄 License

MIT © [花卷实验室 / huajuan-labs](https://github.com/huajuan-labs)

---

<div align="center">

**如果 ZoneDSL 帮到你，给个 ⭐ 让更多人看到。**

Made with care by [花卷实验室](https://github.com/huajuan-labs) · 为对话式 AI 的美感而生

</div>
