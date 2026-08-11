// 临时验证:oss 版 gallery 混排(image+video)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { copyFileSync, rmSync, existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const coreParser = join(here, '..', '..', 'core', 'parser.js');
const fakeParserPath = join(here, '..', 'parser.js');
copyFileSync(coreParser, fakeParserPath);

const require_ = createRequire(join(here, 'noop.js'));
let mod;
try {
  mod = require_(join(here, '..', 'toWxNodes.js'));
} finally {}
const { dslToNodes } = mod;
process.on('exit', () => { try { if (existsSync(fakeParserPath)) rmSync(fakeParserPath); } catch (e) {} });

function galleryNode(dsl, opts) {
  const block = dslToNodes(dsl, opts);
  // dslToNodes 返回 [{tag:'zone-root'/isZone:true, children:[...]}] 结构
  const zone = Array.isArray(block) ? block[0] : block;
  return (zone.children || []).find(n => n.tag === 'zone-gallery');
}

test('gallery 混排: image+video 输出 items/imageUrls', () => {
  const g = galleryNode('::gallery "混排"\n  ::image url="https://a.com/1.jpg"\n  ::video poster="https://a.com/2.jpg" intent=open-url value="/pages/v?id=1"\n  ::image url="https://a.com/3.jpg"');
  assert.ok(g, 'gallery 节点存在');
  assert.equal(g.attrs.cols, 3);
  assert.deepEqual(g.attrs.items, [
    { type: 'image', src: 'https://a.com/1.jpg' },
    { type: 'video', poster: 'https://a.com/2.jpg', intent: 'open-url', value: '/pages/v?id=1' },
    { type: 'image', src: 'https://a.com/3.jpg' },
  ]);
  assert.deepEqual(g.attrs.imageUrls, ['https://a.com/1.jpg', 'https://a.com/3.jpg']);
});

test('gallery 纯图: 4 图 → cols=2, items 全 image', () => {
  const g = galleryNode('::gallery "四宫格"\n  ::image url="https://a.com/1.jpg"\n  ::image url="https://a.com/2.jpg"\n  ::image url="https://a.com/3.jpg"\n  ::image url="https://a.com/4.jpg"');
  assert.equal(g.attrs.cols, 2);
  assert.equal(g.attrs.items.length, 4);
  assert.equal(g.attrs.imageUrls.length, 4);
  assert.equal(g.attrs.items.every(i => i.type === 'image'), true);
});

test('gallery 流式半截: 未闭合 url 不混入', () => {
  const g = galleryNode('::gallery "流式"\n  ::image url="https://a.com/1.jpg"\n  ::image url="https://a.com/2', { streamingSafe: true });
  assert.equal(g.attrs.items.length, 1);
  assert.equal(g.attrs.cols, 1);
});

test('gallery video 非法 intent: 降级纯封面(无 intent/value)', () => {
  const g = galleryNode('::gallery "混排"\n  ::image url="https://a.com/1.jpg"\n  ::video poster="https://a.com/2.jpg" intent=not-exist value="x"');
  const v = g.attrs.items.find(i => i.type === 'video');
  assert.equal(v.intent, '');
  assert.equal(v.value, '');
  assert.equal(v.poster, 'https://a.com/2.jpg');
});
