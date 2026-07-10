---
name: zonedsl-dev
version: 2.9.0
description: Help developers integrate ZoneDSL into their platform (WeChat Mini Program / Web / React Native / Flutter), extend the DSL with new components / themes / intents, and maintain the plugin. Use when the developer asks about "接入 zonedsl", "集成 ZoneDSL", "让我的 X 平台支持 zone-DSL", "给 zonedsl 加新组件 / 主题 / intent", "port zonedsl to Y", "扩展 zone-DSL 语法", "自定义组件到 zone-DSL".
homepage: https://github.com/huajuan-labs/zonedsl
---

# ZoneDSL 开发者指南

面向**接入方 / 扩展方 / 平台适配方**。如果你的角色是让 AI 输出 zone-DSL 内容,请用 `zonedsl` skill；本 skill 讲怎么**在平台上渲染 DSL**、**给 DSL 加东西**。

## 三种典型任务

| 任务 | 走哪条路径 |
|---|---|
| 我要在 Web 上渲染 zone-DSL | 装 `@zonedsl/web`，见「接入 · Web」 |
| 我要在 WeChat 小程序里渲染 | 装 `@zonedsl/wechat`（zone-node + towxml，生产验证），见「接入 · WeChat 小程序」 |
| 我要在 RN / Flutter 上支持 | parser 纯 JS 可复用,组件层按平台重写,见「跨平台接入」 |
| 我要给 zone-DSL 加一个新组件 / 主题 / intent | 见「扩展 · 4 处登记流程」 |

## 接入 · Web（v1 已就绪）

```html
<script src="https://unpkg.com/@zonedsl/core/dist/parser.umd.js"></script>
<script src="https://unpkg.com/@zonedsl/web/dist/zonedsl-web.umd.js"></script>
<div id="out"></div>
<script>
  ZonePlayground.mount(document.getElementById('out'), '::callout "Hello"');
</script>
```

或 `import { ZonePlayground } from '@zonedsl/web'`（ESM）。流式渲染传 `{ streaming: true }`，骨架传 `{ skeleton: true }`。完整 API 见 [在线 playground](https://zonedsl.huajuan-labs.com) 源码 `docs/`。

## 接入 · WeChat 小程序

`@zonedsl/wechat`（zone-node 派发组件 + towxml + 12 主题，生产验证）。源码在 `packages/wechat/`，结构：

```
packages/wechat/
├── zone-node/        ← 统一派发组件
├── towxml/           ← markdown 渲染器
├── themes/           ← 12 主题 wxss
└── shared.wxss
```

### Step 1 · 注册组件

页面 `index.json`:

```json
{
  "usingComponents": {
    "towxml": "@zonedsl/wechat/towxml/towxml",
    "zone-node": "@zonedsl/wechat/zone-node/index"
  }
}
```

### Step 2 · 渲染消息

```js
const { dslToNodes } = require('@zonedsl/wechat')

// content 是 AI 后端返回的字符串,markdown + zone-DSL 混排
const ast = dslToNodes(content, { streamingSafe: true })  // 流式渲染保护,推荐开
this.setData({ ast })
```

WXML:

```xml
<towxml nodes="{{ast}}" bindzoneaction="onZoneAction"/>
```

### Step 3 · 实现 zone-action 分发器

`::button intent=xxx value=yyy` 触发时会冒泡到你的 `onZoneAction`:

```js
onZoneAction(e) {
  const { intent, value, source } = e.detail
  switch (intent) {
    case 'followup':
      this.sendMessage(value)
      break
    case 'search':
      wx.navigateTo({ url: `/pages/search/index?q=${encodeURIComponent(value)}` })
      break
    case 'copy':
      wx.setClipboardData({ data: value })
      break
    // ...
    default:
      // 未识别 intent 静默降级,不会报错
  }
}
```

intent 白名单见项目 `@zonedsl/core/INTENTS.md`。业务方按需实现,未实现的组件会降级为纯样式按钮。

### Step 4 · 打包忽略 docs / skill

`project.config.json`:

```json
{
  "packOptions": {
    "ignore": [
      { "value": "docs",  "type": "folder" },
      { "value": "skill", "type": "folder" }
    ]
  }
}
```

## 跨平台接入

### parser 是平台无关的

`@zonedsl/core/parser.js` 是 **纯 CJS + 无 DOM 依赖**——任何 JS runtime 都能直接跑:

```js
const { buildAst } = require('@zonedsl/core')
const ast = buildAst(content, { streamingSafe: true })
// ast 是 { type, name, attrs, children } 树,可以给任何前端框架消费
```

### 各平台需要重写的:组件层

- **Web / React**:实现 `<ZoneNode item={item} />` 组件,内部按 `item.tag` switch case 渲染成 React 组件树
- **Vue**:类似,`<zone-node :item="item" />`
- **React Native**:同上,组件用 RN 原生
- **Flutter**:Dart 里重写 parser 或 JS Bridge 保留 parser,组件用 Flutter Widget

### CSS/样式层

`zone-components/themes/theme-*.wxss` 是 12 个主题变量的**唯一来源**。跨平台时:

- **Web**:直接改写成 `.css`,变量名同步
- **RN**:把变量抽成 JS 对象注入 StyleSheet
- **Flutter**:抽成 ThemeData

12 主题的 CSS 变量清单见 `@zonedsl/core/THEMES.md`。

## 扩展 · 4 处登记流程(v2.9 主流)

给 zone-DSL 加一个**新组件**,需要在 **4 个地方登记**:

### 1 · `@zonedsl/wechat/toWxNodes.js` · REGISTRY

```js
const COMPONENT_REGISTRY = {
  // ...
  'my-widget': { layer: 'preset', since: 'v3.0' },  // ← 加这行
}
```

### 2 · `@zonedsl/wechat/toWxNodes.js` · case 分支

```js
case 'my-widget': {
  const foo = attrs.foo || 'default'
  return {
    tag: 'zone-my-widget',
    attrs: { foo, align: attrs.align === 'center' ? 'center' : '' },
    children: kids,
  }
}
```

### 3 · `packages/wechat/zone-node/index.wxml` · wx:elif 分支

```xml
<block wx:elif="{{item.tag==='zone-my-widget'}}">
  <view class="zn-my-widget {{item.attrs.align==='center' ? 'zn-my-widget-center' : ''}}">
    <text>{{item.attrs.foo}}</text>
    <zone-node wx:for="{{item.children}}" wx:for-item="child" wx:key="index" item="{{child}}"/>
  </view>
</block>
```

### 4 · `packages/wechat/zone-node/index.wxss` · 样式

```wxss
.zn-my-widget {
  /* 用主题变量,不用硬色 */
  color: var(--mz-ink);
  background: var(--mz-panel);
  border: 2rpx solid var(--mz-line);
}
.zn-my-widget-center {
  display: flex;
  justify-content: center;
}
```

### 5 · (推荐)`@zonedsl/skill/CATALOG-<LAYER>.md` · 文档

在对应 layer catalog 里加一条:

```markdown
## my-widget — 我的组件

```
::my-widget foo="value"
```

`foo`: xxx / yyy / zzz
`align`: `center`(v2.9,让子组件居中)
```

让 AI 后端知道有这个组件。

### 层归属决策

看 `@zonedsl/core/LAYERS.md`——5 层:primitive / structure / interactive / chart / preset。判断依据:

- 无 state、纯视觉 → primitive
- 通用容器 / 布局 → structure
- 需要用户操作 → interactive
- 图表 / echarts 驱动 → chart
- 强场景绑定(magazine-cover 之类)→ preset

## 扩展 · 加新主题

`packages/wechat/themes/theme-<name>.wxss`:

```wxss
.zone-theme-mytheme {
  --mz-ink: #1A1A1A;
  --mz-ink-soft: #4A4A4A;
  --mz-ink-mute: #8B8B8B;
  --mz-accent: #FF8200;
  --mz-accent-warm: #FFB347;
  --mz-accent-soft: #FFE4C4;
  --mz-accent-tint: #FFF3E0;
  --mz-line: #EFE0CC;
  --mz-panel: #FFFFFF;
  --mz-panel-soft: #FFF9F0;
  --mz-hl: #FFB700;
}
/* markdown 接管系还要 h2w__* 前缀 */
.zone-theme-mytheme .h2w__h1 { ... }
.zone-theme-mytheme .h2w__blockquote { ... }
```

然后:
1. `themes/index.wxss` 里 `@import` 一行
2. `@zonedsl/wechat` 的 `VALID_THEMES` 里加 `mytheme: 1`
3. `@zonedsl/skill/SKILL.md` 里"12 主题"章节加说明

## 扩展 · 加新 intent

1. `@zonedsl/core/INTENTS.md` 里登记新 intent + value 格式约束
2. AI 侧的 `skill/CATALOG-INTERACTIVE.md` 更新意图白名单表
3. 业务侧在 `onZoneAction` 里实现 case

**注意**:intent 是**平台无关**约定,业务方按需实现。加 intent 不需要改 parser。

## 常见问题

**Q: 加了组件但渲染不出来?**
A: 4 处登记检查一遍——REGISTRY 有没有登记决定 parser 是否识别,wxml 分支决定组件层是否画。

**Q: 主题切换后我的新组件不跟随?**
A: 检查 wxss 里是不是用了硬色。全站规则:主题相关的色/线用 `--mz-*` 变量,不用硬色。

**Q: 流式渲染我的组件闪烁?**
A: parser `streamingSafe` 模式下,不闭合的 bare attr 会被丢弃到下次刷新。如果你的组件依赖某个必需属性,做默认值兜底。

**Q: 想在 Web 平台复用,parser 能跨端吗?**
A: 是。parser 是纯 JS,无 DOM,无 wx。只需要重写 `toWxNodes` → `toReactNodes / toVueVNode` 之类,组件层跟着换。

**Q: 加组件要走 PR 流程还是自己 fork?**
A: 业务专属组件建议 fork 私有维护;通用组件欢迎提 PR 到主仓。

## 参考文档

- `@zonedsl/core/LAYERS.md` — 分层职责与决策流程
- `@zonedsl/core/THEMES.md` — 12 主题变量清单
- `@zonedsl/core/INTENTS.md` — intent 白名单
- `@zonedsl/core/VERSIONS.md` — 变更记录
- `@zonedsl/skill/SKILL.md` — AI 输出规范
- 在线文档 https://\<你的域名\>/index.html
