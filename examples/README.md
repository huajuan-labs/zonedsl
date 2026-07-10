# examples

独立可跑的 ZoneDSL 示例。

## 规划中（v1.5+）

- `vanilla-web/` —— 一个 HTML 文件，`<script src>` 引 `@zonedsl/web`，接模拟流式，30 秒跑起来
- `claude-skill/` —— 把 `@zonedsl/skill` 挂进 Claude Code 项目，展示 AI 自动产出 DSL
- `wechat-demo/` —— 干净的微信小程序工程，clone 即跑（随 `@zonedsl/wechat` 发布）

## 当前怎么看效果？

v1 阶段直接看 [`../docs/`](../docs/) 的 playground —— 它就是 web 渲染器的完整演示（流式、12 主题、60+ 组件、echarts）。

```bash
cd ../docs && bash serve.sh
# 浏览器开 http://localhost:3000
```
