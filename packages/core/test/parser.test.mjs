// parser.test.mjs · @zonedsl/core 行为锁定测试(零依赖,跑 `node --test`)
// 覆盖:tokenizeLine / parseAttrs(含 coerce) / buildAst / 流式三件套(streamingSafe/dropPartialLastLine/looksPartial)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOKEN, tokenizeLine, parseAttrs, buildAst, looksPartial } from '../parser.mjs';

// ---- tokenizeLine ----
test('tokenizeLine: 空行 → BLANK', () => {
  assert.equal(tokenizeLine('').kind, TOKEN.BLANK);
  assert.equal(tokenizeLine('   ').kind, TOKEN.BLANK);
});

test('tokenizeLine: ::comp attrs → COMPONENT', () => {
  const t = tokenizeLine('::magazine-cover tag="X"');
  assert.equal(t.kind, TOKEN.COMPONENT);
  assert.equal(t.name, 'magazine-cover');
  assert.equal(t.indent, 0);
});

test('tokenizeLine: :: 注释 → COMMENT', () => {
  assert.equal(tokenizeLine(':: 这是注释').kind, TOKEN.COMMENT);
});

test('tokenizeLine: 缩进 child keyword → CHILD_KEYWORD', () => {
  const t = tokenizeLine('  item "主榜" value="8 位"');
  assert.equal(t.kind, TOKEN.CHILD_KEYWORD);
  assert.equal(t.name, 'item');
  assert.equal(t.indent, 2);
});

test('tokenizeLine: option: → OPTION_HEADER', () => {
  assert.equal(tokenizeLine('option:').kind, TOKEN.OPTION_HEADER);
});

// ---- parseAttrs + coerce ----
test('parseAttrs: main + key=val + flag', () => {
  const r = parseAttrs('"主文本" key=val flag');
  assert.equal(r.main, '主文本');
  assert.equal(r.attrs.key, 'val');
  assert.equal(r.attrs.flag, true);
});

test('parseAttrs: coerce 数字/浮点/布尔/数组', () => {
  const r = parseAttrs('n=3 f=1.5 b=true arr=1,2,3');
  assert.equal(r.attrs.n, 3);
  assert.equal(r.attrs.f, 1.5);
  assert.equal(r.attrs.b, true);
  assert.deepEqual(r.attrs.arr, [1, 2, 3]);
});

test('parseAttrs: 含逗号非全数字 → 保持字符串(不拆)', () => {
  const r = parseAttrs('s=a,b,c');
  assert.equal(r.attrs.s, 'a,b,c');
});

test('parseAttrs: 转义引号 \"', () => {
  const r = parseAttrs('"say \\"hi\\""');
  assert.equal(r.main, 'say "hi"');
});

// ---- buildAst ----
test('buildAst: 组件 + 缩进子项', () => {
  const ast = buildAst('::data-board cols=2\n  item "A" value="1"\n  item "B" value="2"');
  assert.equal(ast.length, 1);
  assert.equal(ast[0].type, 'component');
  assert.equal(ast[0].name, 'data-board');
  assert.equal(ast[0].attrs.cols, 2);
  assert.equal(ast[0].children.length, 2);
  assert.equal(ast[0].children[0].name, 'item');
  assert.equal(ast[0].children[0].main, 'A');
});

test('buildAst: 注释与空行被忽略', () => {
  const ast = buildAst(':: 注释\n\n::text "hi"');
  assert.equal(ast.length, 1);
  assert.equal(ast[0].name, 'text');
});

// ---- 流式: streamingSafe ----
test('streamingSafe: 尾部未终止 bare 值被丢弃', () => {
  // 流式吐到 "key=hal" 还没空格终止 → key 不写入
  const ast = buildAst('::comp title="ok" key=hal', { streamingSafe: true });
  assert.equal(ast[0].attrs.title, 'ok');
  assert.equal(ast[0].attrs.key, undefined);
});

test('streamingSafe: 未闭合引号值被整个丢弃', () => {
  const ast = buildAst('::comp url="https://half', { streamingSafe: true });
  assert.equal(ast[0].attrs.url, undefined);
});

test('非流式: 未闭合引号值保留原样(不丢)', () => {
  const ast = buildAst('::comp url="https://half');
  // 非流式不裁,值保留(readQuoted 读到 src 末尾)
  assert.equal(ast[0].attrs.url, 'https://half');
});

// ---- 流式: dropPartialLastLine ----
test('dropPartialLastLine: 无换行尾行被缓冲', () => {
  // 第二行 ::half 没有 \n 结尾 → 整行丢弃,不出现在 AST
  const ast = buildAst('::text "ok"\n::half', { dropPartialLastLine: true });
  assert.equal(ast.length, 1);
  assert.equal(ast[0].name, 'text');
});

// ---- looksPartial ----
test('looksPartial: 半截符号识别', () => {
  assert.equal(looksPartial('::'), true);
  assert.equal(looksPartial('key='), true);
  assert.equal(looksPartial('"unclosed'), true);      // 奇数引号
  assert.equal(looksPartial('key=val,'), true);        // 尾逗号(带 =)
  assert.equal(looksPartial('normal text'), false);
  assert.equal(looksPartial(''), false);
});
