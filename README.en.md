<div align="center">

# ::ZoneDSL

**The streaming-first A2UI protocol for conversational AI.**
<sub>A2UI = AI-to-UI: AI emits structured text, the frontend renders it into UI.</sub>

Turn AI streaming replies from "an endless wall of markdown" into "a magazine page with layout, charts, and interaction".

[![Live Playground](https://img.shields.io/badge/Playground-online-FF8200.svg)](https://zonedsl.huajuan-labs.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-5E8265.svg)](./LICENSE)
[![spec](https://img.shields.io/badge/spec-v1-FFB347.svg)](./protocol/spec.md)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-FFB347.svg)](./CONTRIBUTING.md)

**👉 [Live Playground](https://zonedsl.huajuan-labs.com)** · **📖 [Spec](./protocol/spec.md)** · **🤖 [AI Skill](./packages/skill/SKILL.md)** · **🌐 [中文](./README.md)**

![ZoneDSL Playground](./assets/screenshots/playground.png)

</div>

---

## 📋 Table of Contents

- [Why ZoneDSL](#why-zonedsl)
- [How it differs from json-render](#how-it-differs-from-json-render)
- [30-second try](#30-second-try)
- [Core features](#core-features)
- [Packages](#packages)
- [Protocol & architecture](#protocol--architecture)
- [Customize & extend](#customize--extend)
- [Teach AI to use ZoneDSL](#teach-ai-to-use-zonedsl)
- [FAQ](#faq)
- [Contributing](#contributing)

## Why ZoneDSL

LLM streaming output keeps getting longer, yet the frontend renders it as **an endless scroll of markdown**. Four pain points:

- 🔸 **Plain markdown has no layout**: no charts, no interaction, no magazine feel — long replies read poorly.
- 🔸 **JSON-class A2UI (e.g. json-render) can't mix with markdown prose**, and is mostly web-framework-bound (rarely mini-program)
- 🔸 **No AI output spec**: models don't know when to emit structured components or how.
- 🔸 **No cross-platform standard**: Web / mini-program / RN each roll their own, no protocol.

ZoneDSL fixes all four: **streaming-safe parser** + **AI skill spec** + **unified multi-platform protocol** + **70+ built-in components**.

## How it differs from json-render

[json-render](https://json-render.dev) (Vercel, 16k stars) is the mainstream JSON-class A2UI framework. Both stream and ship prebuilt components — the difference is the paradigm:

| | ZoneDSL | json-render |
|---|---|---|
| Streaming render | ✅ parser `streamingSafe` | ✅ partial-JSON streaming |
| Coexists with markdown prose | ✅ text interleaved, `::` inside prose | ❌ JSON can't mix into prose |
| AI generation paradigm | text-first, LLM emits DSL natively | JSON-first, schema-constrained |
| Form | protocol + multi-platform reference impls | Web framework (+ RN) |
| Mini-program runtime | ✅ `@zonedsl/wechat` | ❌ web + RN, no mini-program |
| AI output spec | ✅ `@zonedsl/skill` portable | ⚠️ bundled component prompt |

> ZoneDSL owns **long-form magazine content** (recap/decode/report, prose + components interleaved); json-render owns **dashboard/widget generation**. Different markets, no head-on clash.

## 30-second try

**Fastest: open the [Live Playground](https://zonedsl.huajuan-labs.com)** — 12 live themes, streaming playback, 70+ components, zero install.

**Integrate into a project** (before npm publish, install from git; after, `npm i @zonedsl/core @zonedsl/web`):

```bash
npm install github:huajuan-labs/zonedsl#main
# or clone and use docs/assets/parser.umd.js + web-renderer.js
```

Minimal Web usage:

```html
<script src="docs/assets/parser.umd.js"></script>
<script src="docs/assets/web-renderer.js"></script>
<div id="out"></div>
<script>
  ZonePlayground.mount(document.getElementById('out'), '::callout "Hello **ZoneDSL**"');
</script>
```

Streaming render passes `{ streaming: true }`, skeleton `{ skeleton: true }`, custom components via `ZonePlayground.register('my-comp', fn)`.

## Core features

- **🌊 Streaming-safe is parser semantics** — `streamingSafe` drops half-typed attrs, `dropPartialLastLine` buffers the unterminated last line, `looksPartial` detects half-symbols. Zero flicker while streaming.
- **🤖 AI is a first-class author** — `@zonedsl/skill` teaches AI *when* to emit ZoneDSL and *how* to write each component. The protocol's "generation direction"; no markdown lib has it.
- **🔌 Protocol-first, not framework-locked** — one spec, web ✅ / WeChat ✅ / RN / Flutter planned. Third parties run the conformance suite → "Compliant".
- **🎨 70+ components · 12 themes** — primitive / structure / interactive / chart / preset layers; editorial / literary / data / serene / luxe / purple / sky / sage / note / pop / serious / warm.
- **📦 Zero magic** — parser is pure JS, zero deps, triple-distributed (CJS/ESM/UMD).

## Packages

| Package | What | Status | Use case |
|---|---|---|---|
| [`@zonedsl/core`](./packages/core) | Parser + AST (pure JS, zero deps) | ✅ v1 | Base for all renderers |
| [`@zonedsl/web`](./packages/web) | DOM renderer + chart recipes + themes | ✅ v1 | Web AI chat, Playground |
| [`@zonedsl/wechat`](./packages/wechat) | WeChat mini-program runtime (zone-node + towxml + 12 themes, production-proven) | ✅ v1 | Mini-program AI assistant |
| [`@zonedsl/skill`](./packages/skill) | AI output spec + templates + catalog | ✅ v1 | Claude / Cursor / any Agent |

> 🎨 **Theme tool**: [MD Theme Lab](https://github.com/huajuan-labs/md-theme-lab) — visually design ZoneDSL themes (20+ presets + AI generation + live preview), export `.wxss` for ZoneDSL. Also works standalone for markdown styling + image export.

> ZoneDSL is the **only A2UI protocol with a WeChat mini-program runtime** — both web and mini-program are production-ready, not demos.

## Protocol & architecture

ZoneDSL is **protocol-first**: the spec is the source of truth, renderers are implementations. `@zonedsl/core` is the canonical parser; `@zonedsl/web` and `@zonedsl/wechat` are reference implementations.

```
AI Agent (loads @zonedsl/skill)
      ↓  ::component DSL text (streaming)
@zonedsl/core  parser (streamingSafe → AST)
      ├─ @zonedsl/web      → DOM
      ├─ @zonedsl/wechat   → zone-node (mini-program)
      └─ third-party       → RN / Flutter (planned)
```

The truth lives in [`protocol/spec.md`](./protocol/spec.md) — grammar, streaming semantics, component contract, extensibility. Any third party can write a renderer; passing the conformance suite earns the "ZoneDSL Compliant" badge.

## Customize & extend

The parser is **component-agnostic** — `::any-name` parses into an AST; whether a component exists is the renderer's concern. So:

- **Add a component**: renderer `register('my-comp', fn)`; `::my-comp` works immediately, parser unchanged.
- **Add an intent**: host adds a `case` in `handleZoneAction`; button passes intent/value through.
- **Add a theme**: override `--mz-*` vars or add a theme file.
- **Disable/replace**: not registering = dropped (`UNKNOWN_MODE='silent'`); same-name re-register = override.

The protocol layer governs only the portable common set; everything platform-specific is the host's call. See [spec §10](./protocol/spec.md).

## Teach AI to use ZoneDSL

Download the skill zip and unzip into your agent's skills directory:

```bash
# Claude Code
curl -L https://zonedsl.huajuan-labs.com/assets/zonedsl-skill.zip -o /tmp/zonedsl.zip
unzip /tmp/zonedsl.zip -d ~/.claude/skills/
```

The AI then knows: when to use ZoneDSL (multi-section + structured) vs. plain markdown (single-line Q&A), and how to write each component.

> Developers (integrate/extend/cross-platform) use the [dev skill](https://zonedsl.huajuan-labs.com/assets/zonedsl-dev-skill.zip).
> If you've cloned the repo, `cp packages/skill/SKILL.md packages/skill/CATALOG-*.md ~/.claude/skills/zonedsl/` also works.

## FAQ

**Can I use ZoneDSL commercially?**
Yes. MIT license, no附加 restrictions.

**How to integrate with Claude Code locally?**
See "Teach AI to use ZoneDSL" above — copy the skill files to `~/.claude/skills/zonedsl/` and restart the session.

**Streaming half-typed content renders garbled/flickery — what to do?**
Enable parser `streamingSafe` + `dropPartialLastLine` (auto-on in streaming mode), use skeleton state in the renderer. See [spec §4 streaming semantics](./protocol/spec.md).

**How to register a custom component?**
`ZonePlayground.register('my-comp', fn)` (web), or add a case in `toWxNodes.js` (wechat). Parser stays unchanged. See [spec §10](./protocol/spec.md).

**When will npm packages publish?**
On demand. For now install from git or use the live Playground. We'll publish when there's `npm install` demand.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). The parser is component-agnostic — **adding a component needs no parser change**; just register it in your runtime. Welcome directions:

- React / Vue / RN / Flutter renderers (conformance → "Compliant")
- Domain templates (finance / medical / education)
- More components, themes, docs, examples
- Issues / PRs / ⭐ stars all welcome

## 📄 License

MIT © [huajuan-labs](https://github.com/huajuan-labs)

---

<div align="center">

**If ZoneDSL helps solve the pain of rendering AI chat as plain markdown, give it a ⭐ so more AI Agent developers find it.**

Made with care by [huajuan-labs](https://github.com/huajuan-labs) · for the beauty of conversational AI

</div>
