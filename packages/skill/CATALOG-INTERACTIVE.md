# Interactive 层组件速查

交互层 — 有 state、用户可点击/输入的组件。

> **✅ v2.0 起 `button` 支持 intent 白名单交互**（详见下方 button 章节及 `@zonedsl/core/INTENTS.md`）。不带 `intent` 的旧写法仍保持纯样式，向后兼容。

## tabs — 标签页切换

```
::tabs
  item "实时"
  item "历史"
  item "分析"
```

内部 state 自动切换，第一个 item 默认激活

## accordion — 手风琴展开

```
::accordion
  item "常见问题 1:如何注册账号?"
    ::text "打开 App → 我的 → 点击注册..."
  item "常见问题 2:忘记密码怎么办?"
    ::text "在登录页点击「忘记密码」..."
```

item 内可嵌套任意子组件作为展开内容

## checkbox — 复选框

```
::checkbox "阅读" checked
::checkbox "运动"
::checkbox "音乐" checked
```

## checkbox-group — 多选组（v2.8）

同组多选 + 顶部标题。跟 radio-group 对称，语义清晰，未来支持 form-submit 时能一次收集所有选中值。

```
::checkbox-group "兴趣爱好"
  checkbox "阅读" checked
  checkbox "运动"
  checkbox "音乐" checked
```

- 每个子 checkbox 独立点击切换选中态（复用现有 cbState）
- 未选中态是灰框，选中态是主题色胶囊
- **多选场景优先用 group**，独立 checkbox 只在真的只有一项时用

## radio — 单选按钮

```
::radio "男" selected
::radio "女"
```

## radio-group — 单选组（同组共享单选）

```
::radio-group
  radio "男" selected
  radio "女"
```

## select — 下拉选择

```
::select "北京" options=北京,上海,广州
```

走各端原生 picker

## textarea — 多行输入

```
::textarea "请填写姓名"
::textarea placeholder="请输入..."
```

## quiz — 选择题

```
::quiz "你觉得哪个正确?"
  option "A. 选项 1"
  option "B. 选项 2"
  option "C. 选项 3"
```

## button — 按钮（v2.0 支持 intent 交互）

### 纯样式用法（无 intent，向后兼容）

```
::button "确认" variant=primary
::button "取消" variant=outline
::button "了解更多" variant=ghost
```

`variant`：`primary / outline / ghost`  
`size`：`sm / md / lg`

### intent 白名单用法（v2.0 推荐）

给 button 加 `intent=` 属性，用户点击会触发对应行为。**未知 intent 或非法 value 会静默降级成纯样式**（不会报错）。

**会话相关**

```
::button "追问更多" intent=followup value="示例综艺 还有哪些看点?"
::button "直接发送" intent=send-message value="订阅这个热点"
```

- `followup` — value 填入输入框（不发送），≤ 200 字
- `send-message` — 立即发送 value 到会话，≤ 200 字

**内容跳转(通用 intent,宿主在 handleZoneAction 里实现具体跳转)**

```
::button "搜相关" intent=search value="示例关键词"
::button "打开链接" intent=open-url value="https://example.com"
::button "看话题" intent=open-topic value="示例话题"
::button "切到首页" intent=open-tab value="home"
::button "复制口令" intent=copy value="zone-1234"
```

| Intent | value | 校验 |
|---|---|---|
| `search` | 搜索关键词 | ≤ 50 字 |
| `open-url` | URL（站内或外链，宿主校验白名单） | 协议白名单 |
| `open-topic` | 话题名（不带 `#`） | ≤ 50 字 |
| `open-tab` | tab 标识 | 宿主白名单 |
| `copy` | 要复制的文本 | ≤ 500 字 |

> 平台专属 intent（如电商 `open-cart`、视频 `play-video`）由宿主自管，不进通用白名单。完整规范见 `@zonedsl/core/INTENTS.md`。

**账号/个人中心（宿主能力就绪后再启用，暂不进通用白名单）**

```
::button "登录后追踪" intent=login
::button "去我的" intent=open-my
```

- `login` — 未登录时跳登录页，value 可空或 `sms / quick`（登录不应是 AI 决策，建议放在需要鉴权的 intent 分发器内部前置检查）
- `open-my` — 跳个人中心，value 空（宿主无独立"我的"页面时不需要）

> 这两个 intent 通用白名单暂未列入，宿主可自行实现。详见 `@zonedsl/core/INTENTS.md`「暂未列入」节。

**通用操作**

```
::button "复制文本" intent=copy value="示例综艺 复盘全文"
::button "分享" intent=share value="示例综艺 复盘"
::button "看更多" intent=open-url value="https://example.com/more"
```

- `copy` — 复制到剪贴板，≤ 500 字
- `share` — 分享提示(各端能力不同,如小程序需右上角触发)，≤ 200 字
- `open-url` — URL 跳转，**宿主校验协议白名单**（站内路径或 https 外链，拒绝 `javascript:` 等危险协议）

### 推荐用法

- 每段内容底部放 1-3 个 button，引导后续行为
- 用 `::row` 让 button 并排显示
- `variant=primary` 主推动作（如追问），`outline / ghost` 次要动作

完整规范：`@zonedsl/core/INTENTS.md`

## steps — 步骤列表

```
::steps direction=horizontal
  step "登录" desc="账号密码"
  step "验证" desc="短信验证"
  step "完成" desc="进入首页"
```

`direction`：`horizontal / vertical`

别名：单 `::step` 作为叶子

## stairs — 阶梯

```
::stairs
  step "初级" desc="0-2 年"
  step "中级" desc="3-5 年"
  step "高级" desc="6+ 年"
```

## mechanism — 流程机制

```
::mechanism
  step "输入"
  step "解析"
  step "输出"
```
