#!/usr/bin/env node
// sync-deps.mjs · 把 packages/core + packages/web 的源同步到 docs/assets/,
// 让 docs 站点是"消费者",packages 是"源头",杜绝 stale 副本.
//
// 用法: node docs/scripts/sync-deps.mjs   (在 zonedsl/ 仓库根跑)
// CI 可加 --check 模式:若目标与源不一致则非零退出.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');  // zonedsl/

const PAIRS = [
  // core → docs/assets
  ['packages/core/parser.umd.js', 'docs/assets/parser.umd.js'],
  ['packages/core/parser.mjs', 'docs/assets/parser.mjs'],
  // web src → docs/assets
  ['packages/web/src/web-renderer.js', 'docs/assets/web-renderer.js'],
  ['packages/web/src/echarts-preview.js', 'docs/assets/echarts-preview.js'],
  ['packages/web/src/theme-switcher.js', 'docs/assets/theme-switcher.js'],
];

const check = process.argv.includes('--check');
let stale = 0;

for (const [src, dst] of PAIRS) {
  const srcPath = join(root, src);
  const dstPath = join(root, dst);
  if (!existsSync(srcPath)) { console.error(`✗ 源不存在: ${src}`); stale++; continue; }
  const srcContent = readFileSync(srcPath, 'utf8');
  const dstContent = existsSync(dstPath) ? readFileSync(dstPath, 'utf8') : null;
  if (dstContent !== srcContent) {
    if (check) { console.error(`✗ stale: ${dst}`); stale++; }
    else { writeFileSync(dstPath, srcContent); console.log(`✓ sync ${src} → ${dst}`); }
  } else {
    console.log(`· up-to-date ${dst}`);
  }
}

if (stale > 0) {
  console.error(`\n${stale} 个文件不同步,跑 \`node docs/scripts/sync-deps.mjs\` 修复`);
  process.exit(1);
}
console.log('\n✓ docs/assets 与 packages 同步');
