#!/usr/bin/env bash
# build-skill-zips.sh · 从 packages/skill/ 重新打包成 docs/assets/zonedsl-skill.zip
# (AI 用的输出规范) + zonedsl-dev-skill.zip (开发者指南).
# skill 内容清理后必须重跑此脚本,否则下载到的是旧版.
set -e
cd "$(dirname "$0")/../.."   # zonedsl/

SKILL_SRC="packages/skill"
OUT="docs/assets"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# zonedsl-skill.zip: SKILL.md + CATALOG-*.md → 解压到 ~/.claude/skills/zonedsl/
mkdir -p "$TMP/zonedsl"
cp "$SKILL_SRC/SKILL.md" "$SKILL_SRC"/CATALOG-*.md "$TMP/zonedsl/"
( cd "$TMP" && zip -qr "$OLDPWD/$OUT/zonedsl-skill.zip" zonedsl/ )

# zonedsl-dev-skill.zip: SKILL-DEV.md → 解压到 ~/.claude/skills/zonedsl-dev/
mkdir -p "$TMP/zonedsl-dev"
cp "$SKILL_SRC/SKILL-DEV.md" "$TMP/zonedsl-dev/SKILL.md"
( cd "$TMP" && zip -qr "$OLDPWD/$OUT/zonedsl-dev-skill.zip" zonedsl-dev/ )

echo "✓ $OUT/zonedsl-skill.zip"
echo "✓ $OUT/zonedsl-dev-skill.zip"
