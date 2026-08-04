// toWxNodes.test.mjs · @zonedsl/wechat 行内 markdown 流式安全锁定测试
// 跑 `node --test`(零依赖,toWxNodes.js 只依赖 parser,测试用 mock 注入绕开 require).
//
// 覆盖 spec §4.5: splitInlineMd / splitCoverHighlights 的 streamingSafe 半截裁剪.
// 策略:流式态下未配对的标记符号裁到最后一个未闭合标记之前(标记+其后文本丢弃);
//       非流式/最终态不裁,正则照旧,向后兼容.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { copyFileSync, rmSync, existsSync } from 'node:fs';

// ---- 加载 toWxNodes.js(其内部 require('./parser.js');wechat 包不带 parser,拷真实 @zonedsl/core parser 顶替) ----
// 用真实 parser 而非 mock:splitInlineMd 纯函数不依赖 parser,dslToNodes 端到端测试需要真 parser.
// 两个测试文件都拷同一份 core parser,无竞争.
const here = dirname(fileURLToPath(import.meta.url));
const coreParser = join(here, '..', '..', 'core', 'parser.js');
const fakeParserPath = join(here, '..', 'parser.js');
copyFileSync(coreParser, fakeParserPath);

const require_ = createRequire(join(here, 'noop.js'));
let mod;
try {
  mod = require_(join(here, '..', 'toWxNodes.js'));
} finally {
  // 保留 parser.js 供 test 用,进程退出时清理
}
const { splitInlineMd, splitCoverHighlights } = mod;
process.on('exit', () => { try { if (existsSync(fakeParserPath)) rmSync(fakeParserPath); } catch (e) {} });

// ============ splitInlineMd 非流式(向后兼容) ============
test('splitInlineMd 非流式: **紧急** → bold', () => {
  const r = splitInlineMd('**紧急**');
  assert.deepEqual(r, [{ type: 'bold', text: '紧急' }]);
});

test('splitInlineMd 非流式: 未配对 **紧急 → 当文本(老行为不变)', () => {
  const r = splitInlineMd('**紧急');
  assert.deepEqual(r, [{ type: 'text', text: '**紧急' }]);
});

test('splitInlineMd 非流式: *斜* → italic', () => {
  const r = splitInlineMd('*斜* 正常');
  assert.deepEqual(r, [{ type: 'italic', text: '斜' }, { type: 'text', text: ' 正常' }]);
});

// ============ splitInlineMd 流式(streamingSafe) ============
test('splitInlineMd 流式: **紧急 → 裁到 ** 前(空)', () => {
  const r = splitInlineMd('**紧急', { streamingSafe: true });
  assert.deepEqual(r, [{ type: 'text', text: '' }]);
});

test('splitInlineMd 流式: **紧急** 优先级 `cod → bold 保留,未闭合 ` 裁掉', () => {
  const r = splitInlineMd('**紧急** 优先级 `cod', { streamingSafe: true });
  assert.deepEqual(r, [
    { type: 'bold', text: '紧急' },
    { type: 'text', text: ' 优先级 ' },
  ]);
});

test('splitInlineMd 流式: *斜 → 裁到 * 前(空)', () => {
  const r = splitInlineMd('*斜', { streamingSafe: true });
  assert.deepEqual(r, [{ type: 'text', text: '' }]);
});

test('splitInlineMd 流式: *斜* 正常 → 闭合,正常渲染', () => {
  const r = splitInlineMd('*斜* 正常', { streamingSafe: true });
  assert.deepEqual(r, [{ type: 'italic', text: '斜' }, { type: 'text', text: ' 正常' }]);
});

test('splitInlineMd 流式: **粗* → ** 奇数先裁(空)', () => {
  // ** 数=1 奇数 → 先裁到第一个 ** 前 → s='' → 单 * 也无 → 整体空
  const r = splitInlineMd('**粗*', { streamingSafe: true });
  assert.deepEqual(r, [{ type: 'text', text: '' }]);
});

test('splitInlineMd 流式: 无标记普通文本 → 不受影响', () => {
  const r = splitInlineMd('普通文本', { streamingSafe: true });
  assert.deepEqual(r, [{ type: 'text', text: '普通文本' }]);
});

test('splitInlineMd 流式: 完整 `code` → 正常 code', () => {
  const r = splitInlineMd('前 `code` 后', { streamingSafe: true });
  assert.deepEqual(r, [
    { type: 'text', text: '前 ' },
    { type: 'code', text: 'code' },
    { type: 'text', text: ' 后' },
  ]);
});

// ============ splitCoverHighlights 非流式 ============
test('splitCoverHighlights 非流式: **高** → primary highlight', () => {
  const r = splitCoverHighlights('**高**');
  assert.deepEqual(r, [{ type: 'highlight', style: 'primary', text: '高' }]);
});

// ============ splitCoverHighlights 流式 ============
test('splitCoverHighlights 流式: **高 → 裁到 ** 前(空 text 占位)', () => {
  const r = splitCoverHighlights('**高', { streamingSafe: true });
  assert.equal(r.length, 1);
  assert.equal(r[0].type, 'text');
  assert.equal(r[0].text, '');
});

test('splitCoverHighlights 流式: ~~软 → 裁到 ~~ 前(空)', () => {
  const r = splitCoverHighlights('~~软', { streamingSafe: true });
  assert.equal(r.length, 1);
  assert.equal(r[0].type, 'text');
  assert.equal(r[0].text, '');
});

test('splitCoverHighlights 流式: ~~软~~ ==色== → 闭合正常', () => {
  const r = splitCoverHighlights('~~软~~ ==色==', { streamingSafe: true });
  assert.deepEqual(r, [
    { type: 'highlight', style: 'soft', text: '软' },
    { type: 'text', text: ' ' },
    { type: 'colored', text: '色' },
  ]);
});
