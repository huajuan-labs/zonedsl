// 临时验证:oss 版 v2.12 引文/链接逻辑(toWxNodes + towxml)
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
const { dslToNodes, parseLinkTarget, buildSourcesRefMap, splitInlineMd, COMPONENT_REGISTRY } = mod;
process.on('exit', () => { try { if (existsSync(fakeParserPath)) rmSync(fakeParserPath); } catch (e) {} });

function firstChild(dsl) { return dslToNodes(dsl, {})[0].children[0]; }

// ============ parseLinkTarget(脱敏版) ============
test('parseLinkTarget: https → open-web', () => {
  assert.deepEqual(parseLinkTarget('https://example.com/a'), { intent: 'open-web', value: 'https://example.com/a' });
});
test('parseLinkTarget: /pages → open-url', () => {
  assert.deepEqual(parseLinkTarget('/pages/detail?id=1'), { intent: 'open-url', value: '/pages/detail?id=1' });
});
test('parseLinkTarget: xxx:// scheme → open-scheme(脱敏泛化,非 sinaweibo://)', () => {
  assert.deepEqual(parseLinkTarget('xxx://detail?id=1'), { intent: 'open-scheme', value: 'xxx://detail?id=1' });
});
test('parseLinkTarget: 显式 intent → 白名单校验', () => {
  assert.deepEqual(parseLinkTarget('search:abc'), { intent: 'search', value: 'abc' });
});
test('parseLinkTarget: 非法 target → null', () => {
  assert.equal(parseLinkTarget('javascript:alert(1)'), null);
});

// ============ splitInlineMd 引文 ============
test('splitInlineMd: [^1](url) → cite 数字徽章', () => {
  const parts = splitInlineMd('正文[^1](https://example.com/a)结尾');
  assert.equal(parts[1].type, 'cite');
  assert.equal(parts[1].display, '1');
  assert.equal(parts[1].intent, 'open-web');
  assert.equal(parts[1].dead, undefined);
});
test('splitInlineMd: [@名](url) → link mention', () => {
  const parts = splitInlineMd('[@张三](https://example.com/u/1)');
  assert.equal(parts[0].type, 'link');
  assert.equal(parts[0].mention, 1);
  assert.equal(parts[0].name, '张三');
});
test('splitInlineMd: [文字](url) → 普通链接', () => {
  const parts = splitInlineMd('[查看](https://example.com)');
  assert.equal(parts[0].type, 'link');
  assert.equal(parts[0].mention, undefined);
});
test('splitInlineMd: 非法 url → 降级纯文本', () => {
  const parts = splitInlineMd('[文字](javascript:x)');
  assert.equal(parts[0].type, 'text');
  assert.equal(parts[0].text, '文字');
});

// ============ dslToNodes 引文(注册表 [^n] + ::sources) ============
test('dslToNodes: ::sources + [^1] 裸引文 → cite part 带 refMap 数据', () => {
  const dsl = '::sources\n  ::source "来源A" url="https://example.com/a"\n\n::text "引用[^1]在此"';
  const block = dslToNodes(dsl, {});
  const text = block[0].children.find(n => n.tag === 'zone-text');
  const cite = text.attrs.parts.find(p => p.type === 'cite');
  assert.ok(cite);
  assert.equal(cite.display, '1');
  assert.equal(cite.intent, 'open-web');
  assert.equal(cite.dead, undefined);
});
test('dslToNodes: buildSourcesRefMap 消息级预扫', () => {
  const map = buildSourcesRefMap('::sources\n  ::source "来源A" url="https://example.com/a"');
  assert.ok(map);
  assert.equal(map[1].name, '来源A');
});
test('REGISTRY: sources 登记 v2.12', () => {
  assert.deepEqual(COMPONENT_REGISTRY.sources, { layer: 'structure', since: 'v2.12', note: '引文来源列表,配合 [^n] 使用' });
});
