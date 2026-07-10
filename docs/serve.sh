#!/bin/bash
# 一键起本地静态服务器 · 解决 file:// 协议的 CDN / CORS 限制
# 用法: cd docs && ./serve.sh    然后浏览器打开 http://localhost:8080

cd "$(dirname "$0")"
PORT=${1:-8080}

echo "==> 静态服务器启动中..."
echo "==> 访问: http://localhost:$PORT/index.html"
echo "==> 按 Ctrl+C 停止"
echo ""

# 优先用 python3(macOS 自带)
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server $PORT
elif command -v npx >/dev/null 2>&1; then
  npx http-server -p $PORT
else
  echo "错误:未找到 python3 或 npx,请安装其一"
  exit 1
fi
