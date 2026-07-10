#!/usr/bin/env node
// build.mjs · 从 parser.js(CJS 唯一源)生成 parser.mjs(ESM) + parser.umd.js(UMD)
//
// 输出:
//   parser.js       — CJS 唯一源码(不生成,只被读),Node/小程序用
//   parser.mjs      — ESM,Node ≥18 / 现代浏览器 import
//   parser.umd.js   — UMD,老式 <script src>、AMD、CDN 分发用
//
// 用法:
//   node zone-dsl/build.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'parser.js'), 'utf8');

// 剥掉末尾 module.exports 块,拿到纯函数声明主体
const body = src
  .replace(/\n?module\.exports\s*=\s*\{[\s\S]*?\}\s*$/, '\n')
  .trimEnd();

const NAMES = ['TOKEN', 'tokenizeLine', 'parseAttrs', 'buildAst', 'looksPartial'];
const HEADER =
  '// AUTO-GENERATED from parser.js — DO NOT EDIT.\n' +
  '// Run `node zone-dsl/build.mjs` to regenerate.\n';

// ---- ESM ----
const esm = HEADER +
  '// 通用 ESM(Node + 现代浏览器都能 import)\n\n' +
  body + '\n\n' +
  'export { ' + NAMES.join(', ') + ' };\n';
writeFileSync(join(here, 'parser.mjs'), esm);
console.log('✓ parser.mjs (' + esm.length + ' bytes)');

// ---- UMD ----
// UMD 通用样板:CJS(exports/module) / AMD(define) / 全局(window.ZoneDSLParser) 三合一
const returnObj = '{ ' + NAMES.map(n => n + ': ' + n).join(', ') + ' }';
const umd = HEADER +
  '// UMD: <script src> 挂 window.ZoneDSLParser / AMD define / CJS require\n' +
  '(function (root, factory) {\n' +
  "  if (typeof exports === 'object' && typeof module !== 'undefined') {\n" +
  '    module.exports = factory();\n' +
  "  } else if (typeof define === 'function' && define.amd) {\n" +
  '    define([], factory);\n' +
  '  } else {\n' +
  '    root.ZoneDSLParser = factory();\n' +
  '  }\n' +
  "}(typeof self !== 'undefined' ? self : this, function () {\n\n" +
  body + '\n\n' +
  '  return ' + returnObj + ';\n' +
  '}));\n';
writeFileSync(join(here, 'parser.umd.js'), umd);
console.log('✓ parser.umd.js (' + umd.length + ' bytes)');

console.log('\nSource: parser.js (' + src.length + ' bytes)');
