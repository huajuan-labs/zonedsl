const md = require('./parse/markdown/index'),
    parse = require('./parse/index'),
    zonedsl = require('../zone-dsl/toWxNodes.js');

/**
 * 在 markdown 之前抽取 zone 块,两种语法都支持:
 * A. 围栏版: ```zone ... ``` (web 版惯例)
 * B. 无围栏: 以 :: 开头的连续行,遇空行结束
 * 都替换成 <div class="zone-dsl-placeholder" data-src="..."></div>.
 */
function extractZoneBlocks(text) {
    if (!text) return text;
    if (text.indexOf('::') === -1 && text.indexOf('```zone') === -1) return text;
    const lines = String(text).split('\n');

    // v2.5: 全文预扫描 ::theme <name>,把主题注入到每个后续 zone 块首行,
    // 解决 extractZoneBlocks 逐块拆分导致的主题只对第一块生效问题.
    // v2.8: 流式吐字过程中主题名可能只吐了前缀(如 ::theme pur),用前缀匹配兜底 —— 只要能匹配到某个已知主题的前缀,就先按那个走.
    const VALID_THEMES = { editorial: 1, literary: 1, serious: 1, data: 1, serene: 1, warm: 1, luxe: 1, purple: 1, sky: 1, pop: 1, sage: 1, note: 1 };
    const VALID_THEME_NAMES = Object.keys(VALID_THEMES);
    let docTheme = '';
    for (let k = 0; k < lines.length; k++) {
        const line = lines[k].replace(/^\s+/, '');
        // 完整匹配
        const m = /^::theme\s+([a-z]+)\s*$/.exec(line);
        if (m && VALID_THEMES[m[1]]) { docTheme = m[1]; break; }
        // 半截匹配(流式过程中主题名可能还没吐完)
        const mPartial = /^::theme\s+([a-z]+)$/.exec(line);
        if (mPartial) {
            const prefix = mPartial[1];
            const hit = VALID_THEME_NAMES.find((n) => n.indexOf(prefix) === 0);
            if (hit) { docTheme = hit; break; }
        }
    }

    const out = [];
    let i = 0;

    function pushPlaceholder(src) {
        // 如果全文声明了主题且这个块本身没写 ::theme,把主题注入到块首行
        if (docTheme && src.indexOf('::theme') === -1) {
            src = '::theme ' + docTheme + '\n' + src;
        }
        if (out.length && out[out.length - 1].trim() !== '') out.push('');
        out.push('<div class="zone-dsl-placeholder" data-src="' + encodeURIComponent(src) + '"></div>');
        out.push('');
    }

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.replace(/^\s+/, '');

        // A. 围栏 ```zone
        const fenceMatch = /^(`{3,}|~{3,})zone\b/.exec(trimmed);
        if (fenceMatch) {
            const fence = fenceMatch[1];
            const fenceRe = new RegExp('^' + fence[0] + '{' + fence.length + ',}\\s*$');
            i++;
            const body = [];
            while (i < lines.length && !fenceRe.test(lines[i].replace(/^\s+/, ''))) {
                body.push(lines[i]);
                i++;
            }
            if (i < lines.length) i++; // 吃掉结束围栏
            pushPlaceholder(body.join('\n'));
            continue;
        }

        // B. 无围栏 ::xxx
        if (/^::[a-z]/.test(trimmed)) {
            const start = i;
            i++;
            while (i < lines.length && lines[i].trim() !== '') {
                i++;
            }
            pushPlaceholder(lines.slice(start, i).join('\n'));
            continue;
        }

        out.push(line);
        i++;
    }
    return out.join('\n');
}

/**
 * 遍历 towxml 输出的 AST,找到 h2w__zone-dsl 占位节点,原地替换成 zone 渲染树.
 * v2.12: 加 refMap 参数,把消息级引文注册表透传给 dslToNodes.
 */
function expandZoneNodes(node, streamingSafe, refMap) {
    if (!node || !node.children) return;
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child && child.tag === 'view' && child.attrs && typeof child.attrs.class === 'string' && child.attrs.class.indexOf('zone-dsl-placeholder') !== -1) {
            const src = child.attrs['data-src'] || '';
            let dsl = '';
            try { dsl = decodeURIComponent(src); } catch (e) { dsl = src; }
            const replacement = zonedsl.dslToNodes(dsl, { streamingSafe: !!streamingSafe, sources: refMap || undefined });
            node.children.splice(i, 1, ...replacement);
            i += replacement.length - 1;
            continue;
        }
        expandZoneNodes(child, streamingSafe, refMap);
    }
}

/**
 * v2.7: 从原文本预扫描 ::theme <name>,把 zone-theme-<name> class 追加到 AST 根节点上.
 * 这样 markdown 元素(h2w__*)也能被 .zone-theme-<name> .h2w__xxx 选择器命中.
 * 只对显式声明 ::theme 的消息生效,不影响其他 demo/普通消息.
 */
const VALID_THEMES_FOR_MD = { editorial: 1, literary: 1, serious: 1, data: 1, serene: 1, warm: 1, luxe: 1, purple: 1, sky: 1, pop: 1, sage: 1, note: 1 };
function extractDocTheme(text) {
    if (!text || text.indexOf('::theme') === -1) return '';
    const lines = String(text).split('\n');
    for (let i = 0; i < lines.length; i++) {
        const m = /^::theme\s+([a-z]+)\s*$/.exec(lines[i].replace(/^\s+/, ''));
        if (m && VALID_THEMES_FOR_MD[m[1]]) return m[1];
    }
    return '';
}
function applyThemeToRoot(node, theme) {
    if (!theme || !node) return;
    // towxml.wxml 会读 nodes.docTheme,拼成 zone-theme-<name> 挂到最外层 h2w 容器上
    node.docTheme = theme;
}

/* ============ v2.12: markdown 正文引文/链接支持 ============
 * 让 [^1](url) / [^@名](url) / [@名](url) / [文字](url) 在纯 markdown 正文也生效,
 * 与 zone 组件内同一套渲染(zone-node)和跳转(zoneaction).
 *
 * 只支持自包含写法(带 (url)):markdown 原生把 [x](url) 转成 navigator 节点,
 * expandLinkNodes 按文本前缀(^/@)拦截重分类成 zone-cite/zone-link.
 * 裸 [^n] 依赖 sources 注册表,正文不支持(sources 只在 zone 组件内)—— 正文裸 [^n] 按普通文本透出.
 */

// 遍历 navigator 节点(markdown 链接),按文本前缀重分类成 zone-cite/zone-link.
// markdown 把 [^1](url) 的文本解析成 '^1',[^@名](url) 解析成 '^@名',[@名](url) 解析成 '@名'.
// parseLinkTarget 不认的 href(相对锚点/mailto 等)保持 navigator 原样,向后兼容.
function expandLinkNodes(node) {
    if (!node || !node.children) return;
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child && child.tag === 'navigator' && child.attrs && child.attrs.href) {
            const link = zonedsl.parseLinkTarget(child.attrs.href);
            if (link) {
                const text = collectNodeText(child);
                node.children[i] = buildInlineNode(text, link);
                continue;
            }
        }
        if (child && child.children) expandLinkNodes(child);
    }
}

// 拍平 navigator 子节点文本(链接文字里嵌套格式时降级为纯文本).
function collectNodeText(node) {
    let t = '';
    (node.children || []).forEach(function (c) {
        if (c && typeof c.text === 'string') t += c.text;
        else if (c && c.children) t += collectNodeText(c);
    });
    return t;
}

// 按文本前缀把链接节点重分类:^@名→chip,^数字→徽章,@名→提及,其余→下划线链接.
// 产出带 isZone 的 zone-cite / zone-link 节点,复用 zone-node 渲染和 zoneaction 跳转.
function buildInlineNode(text, link) {
    // ^@名 → 昵称 chip
    if (/^\^@/.test(text)) {
        const name = text.slice(1); // 去掉 ^
        const attrs = { label: 1, display: name, text: name, intent: link.intent, value: link.value };
        return { isZone: true, tag: 'zone-cite', attrs: attrs, children: [] };
    }
    // ^数字 → 数字徽章
    if (/^\^\d+$/.test(text)) {
        const num = text.slice(1);
        const attrs = { label: 0, display: num, text: num, intent: link.intent, value: link.value };
        return { isZone: true, tag: 'zone-cite', attrs: attrs, children: [] };
    }
    // @名 → 橙色提及;name 存 @ 后的昵称,供跳转用户主页用
    if (text.charAt(0) === '@') {
        return { isZone: true, tag: 'zone-link', attrs: { text: text, name: text.slice(1), intent: link.intent, value: link.value, mention: 1 }, children: [] };
    }
    // 普通链接
    return { isZone: true, tag: 'zone-link', attrs: { text: text, intent: link.intent, value: link.value }, children: [] };
}

module.exports = (str, type, option) => {
    option = option || {};
    // v2.8: streamingSafe 透传到 dslToNodes,让每帧 zone 组件丢掉未闭合尾行.
    const streamingSafe = !!option.streamingSafe;
    let result;
    const docTheme = type === 'markdown' ? extractDocTheme(str) : '';
    switch (type) {
        case 'markdown': {
            // v2.12: 消息级引文注册表.
            //   option.quoteList: 宿主截下的后端 quote_list(最可靠)
            //   buildSourcesRefMap(str): DSL 原生 ::source 行预扫(AI 手写 sources 时)
            const refMap = type === 'markdown'
                ? (zonedsl.quoteListToRefMap(option.quoteList) || zonedsl.buildSourcesRefMap(str, { streamingSafe: streamingSafe }))
                : null;
            result = parse(md(extractZoneBlocks(str)), option);
            expandZoneNodes(result, streamingSafe, refMap);
            // v2.12: markdown 正文的行内链接/引文(navigator 节点)→ zone-link/zone-cite.
            // 只支持自包含写法 [^1](url)/[^@名](url)/[@名](url)/[文字](url);
            // 裸 [^n] 依赖 sources 注册表,正文不支持(sources 只在 zone 组件内).
            expandLinkNodes(result);
            break;
        }
        case 'html':
            result = parse(str, option);
            expandZoneNodes(result, streamingSafe);
            break;
        default:
            throw new Error('Invalid type, only markdown and html are supported');
    }
    applyThemeToRoot(result, docTheme);
    return result;
};
