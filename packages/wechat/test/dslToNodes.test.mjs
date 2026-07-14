// dslToNodes.test.mjs · @zonedsl/wechat image fit / video / 流式骨架端到端测试(v2.11)
// 用真实 @zonedsl/core parser(临时拷贝)跑 dslToNodes,锁定 spec §5.5 行为.
// 跑 `node --test`(零依赖).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { copyFileSync, rmSync, existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
// 用真实 core parser 顶替 toWxNodes 的 './parser.js' require
const coreParser = join(here, '..', '..', 'core', 'parser.js');
const fakeParserPath = join(here, '..', 'parser.js');
copyFileSync(coreParser, fakeParserPath);

const require_ = createRequire(join(here, 'noop.js'));
let mod;
try {
  mod = require_(join(here, '..', 'toWxNodes.js'));
} finally {
  // 加载完保留 parser.js 供后续 test 用,node --test 同进程;进程退出时清理
  // (不在这里删,测试函数还要用 mod)
}
const { dslToNodes, COMPONENT_REGISTRY } = mod;

// 进程退出时清理临时 parser
process.on('exit', () => { try { if (existsSync(fakeParserPath)) rmSync(fakeParserPath); } catch (e) {} });

// 取 zone-block 下第 0 个子节点
function firstChild(dslBlock) { return dslBlock[0].children[0]; }

// ============ REGISTRY ============
test('REGISTRY: video 登记 primitive v2.11', () => {
  assert.deepEqual(COMPONENT_REGISTRY.video, { layer: 'primitive', since: 'v2.11' });
});

// ============ image fit ============
test('image: 默认 fit=width 向后兼容 widthFix', () => {
  const n = firstChild(dslToNodes('::image url="https://x.jpg"'));
  assert.equal(n.tag, 'zone-image');
  assert.equal(n.attrs.fit, 'width');
  assert.equal(n.attrs.mode, 'widthFix');
});

test('image: fit=16:9 → mode aspectFill', () => {
  const n = firstChild(dslToNodes('::image url="https://x.jpg" fit=16:9'));
  assert.equal(n.attrs.fit, '16:9');
  assert.equal(n.attrs.mode, 'aspectFill');
});

test('image: fit=contain → mode aspectFit', () => {
  const n = firstChild(dslToNodes('::image url="https://x.jpg" fit=contain'));
  assert.equal(n.attrs.fit, 'contain');
  assert.equal(n.attrs.mode, 'aspectFit');
});

test('image: fit=1:1 归一为 square', () => {
  const n = firstChild(dslToNodes('::image url="https://x.jpg" fit=1:1'));
  assert.equal(n.attrs.fit, 'square');
});

test('image: 非法 fit fallback width', () => {
  const n = firstChild(dslToNodes('::image url="https://x.jpg" fit=bogus'));
  assert.equal(n.attrs.fit, 'width');
});

test('image: fit=9:16 竖屏', () => {
  const n = firstChild(dslToNodes('::image url="https://x.jpg" fit=9:16'));
  assert.equal(n.attrs.fit, '9:16');
});

// ============ video ============
test('video: 封面 + intent=open-url 跳转', () => {
  const n = firstChild(dslToNodes('::video poster="https://p.jpg" title="T" fit=16:9 intent=open-url value="/pages/video?id=1"'));
  assert.equal(n.tag, 'zone-video');
  assert.equal(n.attrs.poster, 'https://p.jpg');
  assert.equal(n.attrs.title, 'T');
  assert.equal(n.attrs.fit, '16:9');
  assert.equal(n.attrs.intent, 'open-url');
  assert.equal(n.attrs.value, '/pages/video?id=1');
});

test('video: 默认 fit=16:9', () => {
  const n = firstChild(dslToNodes('::video poster="https://p.jpg"'));
  assert.equal(n.attrs.fit, '16:9');
});

test('video: 非法 intent 静默降级(纯展示)', () => {
  const n = firstChild(dslToNodes('::video poster="https://p.jpg" intent=evil value="x"'));
  assert.equal(n.attrs.intent, '');
  assert.equal(n.attrs.value, '');
});

test('video: 空 value 降级(open-url 要求非空 value)', () => {
  const n = firstChild(dslToNodes('::video poster="https://p.jpg" intent=open-url value=""'));
  assert.equal(n.attrs.intent, '');
  assert.equal(n.attrs.value, '');
});

// ============ 流式骨架 _streaming 注入 ============
test('流式态: image 节点注入 _streaming=true', () => {
  const n = firstChild(dslToNodes('::image url="https://x.jpg"', { streamingSafe: true }));
  assert.equal(n.attrs._streaming, true);
});

test('非流式态: 不注入 _streaming', () => {
  const n = firstChild(dslToNodes('::image url="https://x.jpg"'));
  assert.equal(n.attrs._streaming, undefined);
});

test('流式态: video 节点注入 _streaming', () => {
  const n = firstChild(dslToNodes('::video poster="https://p.jpg"', { streamingSafe: true }));
  assert.equal(n.attrs._streaming, true);
});

test('流式态: zone-block 根节点不注入 _streaming', () => {
  const block = dslToNodes('::image url="https://x.jpg"', { streamingSafe: true });
  assert.equal(block[0].attrs._streaming, undefined);
});

// ============ gallery 过滤空 url ============
test('gallery: 流式时未闭合 url 子图被过滤', () => {
  // 第二张 url 引号未闭合 → streamingSafe 丢弃 → 该子图 url 为空 → 被过滤
  const block = dslToNodes('::gallery "三连"\n  ::image url="https://a.jpg"\n  ::image url="https://b.jpg"', { streamingSafe: true });
  const g = firstChild(block);
  assert.equal(g.tag, 'zone-gallery');
  assert.equal(g.attrs.urls.length, 2);
});

test('gallery: 非流式 3 图 cols=3', () => {
  const g = firstChild(dslToNodes('::gallery\n  ::image url="https://a.jpg"\n  ::image url="https://b.jpg"\n  ::image url="https://c.jpg"'));
  assert.equal(g.attrs.urls.length, 3);
  assert.equal(g.attrs.cols, 3);
});
