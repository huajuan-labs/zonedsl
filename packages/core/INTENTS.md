# ZoneDSL Intent 白名单

`button` 组件通过 `intent=` 属性声明用户点击意图。intent 是**协议层枚举**，value 语义由 spec 定义；**具体跳转/行为由宿主平台在 `handleZoneAction(intent, value, ctx)` 里实现**——spec 不规定跳哪个页面。**未知 intent 静默忽略**，确保 AI 输出错误时用户不感知。

## 白名单

### 会话操作

| Intent | Value 语义 | 宿主行为建议 | 校验 |
|---|---|---|---|
| `followup` | 追问的问题文本 | 填入输入框并聚焦，不自动发送 | ≤ 200 字 |
| `send-message` | 直接发送的消息文本 | 立即发送到当前会话 | ≤ 200 字 |

### 内容跳转

| Intent | Value 语义 | 宿主行为建议 | 校验 |
|---|---|---|---|
| `search` | 搜索关键词 | 打开宿主搜索，query=value | ≤ 50 字，非空 |
| `open-topic` | 话题名（不带 `#`） | 打开话题详情/话题搜索 | ≤ 50 字 |
| `open-tab` | tab 标识 | 切到宿主指定 tab | 宿主白名单 |
| `open-url` | URL（站内或外链） | 宿主 navigateTo / openExternal | 协议白名单见下 |

### 通用操作

| Intent | Value 语义 | 宿主行为建议 | 校验 |
|---|---|---|---|
| `copy` | 要复制的文本 | 写剪贴板 + Toast | ≤ 500 字 |
| `share` | 分享标题/文本 | 触发宿主分享 | ≤ 200 字 |

### `open-url` 安全边界

`open-url` 的 value 由宿主校验。建议宿主维护协议白名单（如只允许 `http(s)://` 外链，或只允许站内路径），**拒绝**未授权协议（`javascript:` / `data:` 等）。spec 不强制具体白名单，由宿主按平台能力决定。

## 暂未列入（待宿主能力就绪再加回）

| Intent | 说明 |
|---|---|
| ~~`login`~~ | 登录不应是 AI 决策，应放在需要鉴权的 intent 分发器内部前置检查 |
| ~~`open-my`~~ | 宿主无独立"我的"页面时不需要 |
| ~~`track-topic`~~ | 宿主无订阅能力时不实现 |

> 历史版本曾含 `open-weibo`（绑特定平台 mid），v1 起移除——平台专属 intent 不进通用白名单，由各宿主在自己的分发器里扩展。

## 使用语法

```
::button "追问下一步" intent=followup value="这个话题还有哪些看点?"
::button "搜索相关" intent=search value="演唱会 复盘"
::button "复制口令" intent=copy value="zone-1234"
::button "分享给朋友" intent=share value="看看这个复盘"
```

**规则**：
- `intent` 是**白名单枚举**，未知值静默忽略
- `value` 必须是**字符串**，建议最大 200 字符（超长宿主可截断）
- `button` 视觉沿用 `variant` 属性（`primary/outline/ghost`）

## 宿主实现要点

- 未知 `intent` → **不 attach 点击事件**，button 回退纯样式
- `share` 在小程序端通常需渲染成原生 `<button open-type="share">`（平台限制），宿主自行适配，AI 用法不变
- 鉴权类操作（如登录态）由宿主在分发器内部前置检查，不让 AI 决定

## 扩展

宿主可扩展平台专属 intent，但**不应进通用白名单**。通用白名单的新增需提 PR 改本文件 + spec 版本号，并保证至少两个宿主实现达成共识。

添加流程：
1. 本文档表格新增行，注明 value 语义和宿主行为建议
2. 各宿主 `handleZoneAction` 分发器补 case
3. **不需要改** parser（button 组件已透传 intent/value）

## 与无 intent 的兼容

`::button "文字"`（不带 intent）仍然工作 —— **保持纯样式**，无点击行为。业务方可以逐步迁移到带 intent 的版本。
