<div align="center">

# ::ZoneDSL

**The streaming-first rendering layer for conversational AI.**

Turn AI's streaming replies from "an endless wall of markdown" into "a magazine page with layout, charts, and interaction". ZoneDSL is a broad **A2UI (AI-to-UI) protocol** — AI emits structured text, the frontend renders it into UI.

[![License: MIT](https://img.shields.io/badge/License-MIT-FF8200.svg)](./LICENSE)
[![npm @zonedsl/core](https://img.shields.io/npm/v/@zonedsl/core?label=%40zonedsl%2Fcore&color=FF8200)](https://www.npmjs.com/package/@zonedsl/core)
[![spec](https://img.shields.io/badge/spec-v1-FFB347.svg)](./protocol/spec.md)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-5E8265.svg)](./CONTRIBUTING.md)

**🎯 [Live Playground](https://zonedsl.huajuan-labs.com)** · **📖 [Spec](./protocol/spec.md)** · **🤖 [AI Skill](./packages/skill/SKILL.md)**

📖 中文版：[README.md](./README.md)

</div>

---

> ### 💡 Why ZoneDSL?
> LLM streaming output keeps getting longer, yet the frontend can only render it as **an endless scroll of markdown** — no layout, no charts, no interaction. ZoneDSL lets AI emit `::component` syntax when structure is called for; the frontend parses it into a real component tree: magazine covers, data boards, timelines, radar charts, clickable buttons — **all streaming-safe**, no half-typed flicker, no broken symbols.

## ✨ At a glance

Feed this DSL to the frontend:

```zone
::magazine-cover tag="HOT RECAP" title="48h trending" subtitle="from start to finish"
::data-board cols=3
  item "Peak rank" value="#8" desc="6h straight"
  item "On-chart" value="11h+" desc="all platforms"
::callout "The kickoff is the start; the live surprise is the spark."
```

AI streams, the frontend renders a magazine card with tag, stats, highlights — not markdown, but **real components**.

## 🚀 Why it's not "yet another markdown extension"

Mechanically ZoneDSL is "structured blocks coexisting with markdown", but the value isn't in the syntax — it's in three things nobody else owns:

- **🌊 Streaming-safe is baked into the parser** — `streamingSafe` drops half-typed attrs, `dropPartialLastLine` buffers the unterminated last line, `looksPartial` detects half-symbols. MDX/remark assume complete input; **AI is streaming** — they don't have this layer.
- **🤖 AI is a first-class author** — `@zonedsl/skill` teaches AI *when* to emit ZoneDSL and *how* to write each component. This is the protocol's "generation direction"; no markdown library ships it.
- **🔌 Protocol-first, not framework-locked** — one spec, multiple renderers (web ✅ / WeChat ✅ / RN / Flutter planned). Third parties run the conformance suite to earn "Compliant". MDX is officially React-bound.

## 🎨 Reference implementation included

- **70+ components** · 5 layers (primitive / structure / interactive / chart / preset)
- **12 themes** · editorial / literary / data / serene / luxe / purple / sky / sage / note / pop / serious / warm
- **Zero magic** · parser is pure JS, zero deps, triple-distributed (CJS/ESM/UMD)

> Components and themes are a "curated reference set", not the headline — you can `register()` your own components, override built-ins, parser unchanged (see [spec §10](./protocol/spec.md)).

## 🛠️ Customize & extend freely

ZoneDSL's parser is **component-agnostic** — `::any-name` parses into an AST; whether a component exists is the renderer's concern. So:

- **Add a component**: renderer `register('my-comp', fn)`; `::my-comp` works immediately
- **Add an intent**: host adds a `case` in `handleZoneAction`; button passes intent/value through; parser unchanged
- **Add a theme**: override `--mz-*` vars or add a theme file
- **Disable/replace**: not registering = dropped (`UNKNOWN_MODE='silent'`); same-name re-register = override

The protocol layer governs only the portable common set; everything platform-specific is the host's call.

## 📦 Packages

| Package | What | Status |
|---|---|---|
| [`@zonedsl/core`](./packages/core) | Parser + AST (pure JS, zero deps) | ✅ v1 |
| [`@zonedsl/web`](./packages/web) | DOM renderer + chart recipes + themes | ✅ v1 |
| [`@zonedsl/wechat`](./packages/wechat) | WeChat mini-program runtime (zone-node + towxml + 12 themes, production-proven) | ✅ v1 |
| [`@zonedsl/skill`](./packages/skill) | AI output spec + templates + component catalog | ✅ v1 |

## ⚡ 30-second start

```html
<script src="https://unpkg.com/@zonedsl/core/dist/parser.umd.js"></script>
<script src="https://unpkg.com/@zonedsl/web/dist/zonedsl-web.umd.js"></script>
<div id="out"></div>
<script>
  ZonePlayground.mount(document.getElementById('out'), '::callout "Hello **ZoneDSL**"');
</script>
```

> Before the npm packages are published, clone this repo and use `docs/assets/parser.umd.js` + `docs/assets/web-renderer.js` in place of the CDN.

Or play with the **[live Playground](https://zonedsl.huajuan-labs.com)** — 12 live themes, streaming playback, 70+ components. (Run locally: `cd docs && bash serve.sh`)

## 🧠 The protocol is the center

ZoneDSL is **protocol-first**: the spec is the source of truth, renderers are implementations. The truth lives in [`protocol/spec.md`](./protocol/spec.md) — grammar, streaming semantics, component contract. `@zonedsl/core` is the canonical parser; `@zonedsl/web` and `@zonedsl/wechat` are reference implementations conforming to the spec.

```
protocol/          ← spec (source of truth)
packages/core/     ← canonical parser: text → AST
packages/web/      ← renderer: AST → DOM
packages/wechat/   ← renderer: AST → zone-node (mini-program)
packages/skill/    ← generator: intent → DSL (for AI)
```

Any third party can write a React/Vue/RN renderer; running the conformance suite earns the "ZoneDSL Compliant" badge.

## 🤖 Teach AI to use ZoneDSL

Drop [`packages/skill/SKILL.md`](./packages/skill/SKILL.md) into your agent (Claude Code: `.claude/skills/zonedsl/`). The AI then knows: when to use ZoneDSL (multi-section + structured) vs. plain markdown (single-line Q&A), and how to write each component.

## 🤝 Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Key point: the parser is component-agnostic — **adding a component needs no parser change**; just register it in your runtime (web: `ZonePlayground.register('my-comp', fn)`; wechat: add a case in `toWxNodes.js` + a branch in `zone-node` + an entry in `COMPONENT_REGISTRY`). Same for intents / themes — see [spec §10](./protocol/spec.md).

Welcome directions: React/Vue/RN/Flutter renderers (conformance suite → "Compliant"), domain templates (finance/medical/education), more components & themes, docs & examples. Issues / PRs / ⭐ stars all welcome.

## 📄 License

MIT © [huajuan-labs](https://github.com/huajuan-labs)

---

<div align="center">

**If ZoneDSL helps you, give it a ⭐ so more people see it.**

Made with care by [huajuan-labs](https://github.com/huajuan-labs) · for the beauty of conversational AI

</div>
