# 贡献指南

欢迎给 ZoneDSL 贡献！无论是修 bug、加组件、加主题、写渲染器，还是改进 skill，都有用。

## 先读

- [`protocol/spec.md`](./protocol/spec.md) —— 协议是源头，所有改动以它为准
- [`packages/wechat/toWxNodes.js`](./packages/wechat/toWxNodes.js) —— 组件 registry + 转换逻辑
- [`packages/core/VERSIONS.md`](./packages/core/VERSIONS.md) —— 变更记录

## 加一个组件（4 处登记）

1. `packages/wechat/toWxNodes.js` —— `COMPONENT_REGISTRY` 加 `{ layer, since }`
2. `packages/wechat/toWxNodes.js` —— `switch` 加 `case` 返回节点
3. 渲染器：web 在 `packages/web/src/web-renderer.js` 的 `R` map 加一条（或 `ZonePlayground.register()` 运行时注册）；wechat 在 zone-node wxml 加 `wx:elif` 分支
4.（推荐）`packages/skill/CATALOG-<LAYER>.md` 加文档，让 AI 知道有这组件

> Parser **不需要改**——它是组件无关的，只把 `::name attrs` 解析成 AST。详见 spec §10。

## 加一个 intent

1. `packages/core/INTENTS.md` 登记新 intent + value 语义
2. `packages/skill/CATALOG-INTERACTIVE.md` 更新白名单表
3. 宿主在自己的 `handleZoneAction` 加 `case`

平台专属 intent 不进通用白名单，各宿主自管。

## 开发流程

```bash
npm install            # 装 workspace 依赖
npm run build          # 重建 parser.mjs/umd
npm test               # 跑 parser 测试
npm run sync-docs      # 同步 packages → docs/assets(改完 web/core 后必跑)
npm run verify         # build + test + sync 检查三合一
```

改了 `packages/web/src/` 或 `packages/core/` 后，**必须跑 `npm run sync-docs`** 让 docs 站点吃到最新代码（CI 会用 `--check` 卡 stale）。

## 提交

- 遵循现有 commit 风格（`feat(scope):` / `fix(scope):` / `docs(scope):`）
- 改 spec 要 bump `protocol/spec.md` 顶部版本号
- 加组件/主题要在 `VERSIONS.md` 记一笔

## 渲染器贡献（高价值方向）

- **React / Vue / Svelte 绑定**：基于 `@zonedsl/core` 的 AST 写薄壳渲染器
- **React Native / Flutter**：parser 纯 JS 可复用，组件层按平台重写
- 跑通 conformance fixtures（规划中）即获 "ZoneDSL Compliant"

## 行为准则

保持友善、对事不对人、欢迎新人。问 issue 比直接 PR 更好沟通。
