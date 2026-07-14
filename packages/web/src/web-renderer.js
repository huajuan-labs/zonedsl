/**
 * Playground · web 端 ZoneDSL 渲染器
 * - 用真 parser(zone-dsl/parser.js,纯 JS 浏览器可跑)buildAst
 * - markdown 段走 marked.js,zone 段走本渲染器,复用 components-preview.css 的 .p-/.mock-/.s- 类
 * - 未知组件降级为灰色 fallback 框
 */
(function () {
  var buildAst = null;
  var parserPromise = null;

  // 加载 parser · 优先 UMD 全局(兼容 file:// 双击),回退动态 ESM import
  // - file:// 场景:动态 import ESM 会失败(浏览器 opaque origin 限制)
  //   → 让 index.html 用 <script src="parser.umd.js"> 挂 window.ZoneDSLParser 就万事大吉
  // - HTTP 场景:UMD 全局也照样能用,同时保留 ESM import 作为规范路径
  function loadParser() {
    if (buildAst) return Promise.resolve(buildAst);
    if (parserPromise) return parserPromise;
    // 全局 UMD 已就绪 → 直接用
    if (window.ZoneDSLParser && window.ZoneDSLParser.buildAst) {
      buildAst = window.ZoneDSLParser.buildAst;
      return Promise.resolve(buildAst);
    }
    // 否则尝试动态 ESM import(HTTP 环境)
    var parserUrl = new URL('assets/parser.mjs', document.baseURI).href;
    parserPromise = import(parserUrl).then(function (mod) {
      buildAst = mod.buildAst;
      return buildAst;
    }).catch(function () {
      // 再兜底:轮询等 UMD 脚本加载完(如果 script 加载慢)
      return new Promise(function (resolve, reject) {
        var n = 0;
        var t = setInterval(function () {
          if (window.ZoneDSLParser && window.ZoneDSLParser.buildAst) {
            clearInterval(t);
            buildAst = window.ZoneDSLParser.buildAst;
            resolve(buildAst);
          } else if (++n > 50) {
            clearInterval(t);
            reject(new Error('无法加载 parser:请用 HTTP 服务打开,或引入 parser.umd.js'));
          }
        }, 100);
      });
    });
    return parserPromise;
  }

  // ---- 切分 markdown 段 / zone 段(逻辑同 towxml extractZoneBlocks) ----
  function splitSegments(text) {
    var lines = String(text || '').split('\n');
    var segs = [];
    var i = 0;
    var mdBuf = [];
    function flushMd() {
      if (mdBuf.length) {
        segs.push({ type: 'md', content: mdBuf.join('\n') });
        mdBuf = [];
      }
    }
    while (i < lines.length) {
      var line = lines[i];
      var trimmed = line.replace(/^\s+/, '');
      // A. 围栏 ```zone
      var fence = /^(`{3,}|~{3,})zone\b/.exec(trimmed);
      if (fence) {
        flushMd();
        var fenceCh = fence[1][0];
        var fenceRe = new RegExp('^' + fenceCh + '{' + fence[1].length + ',}\\s*$');
        i++;
        var body = [];
        while (i < lines.length && !fenceRe.test(lines[i].replace(/^\s+/, ''))) {
          body.push(lines[i]); i++;
        }
        i++; // 跳过闭合围栏
        segs.push({ type: 'zone', content: body.join('\n') });
        continue;
      }
      // B. 顶格 :: 组件(非 :: 注释)
      if (/^::[a-zA-Z]/.test(trimmed) && indentOf(line) === 0) {
        flushMd();
        var zbody = [line];
        i++;
        // 收集后续:缩进行 或 顶格 :: 行,遇空行止
        while (i < lines.length) {
          var l = lines[i];
          if (l.replace(/^\s+/, '') === '') break;
          var lt = l.replace(/^\s+/, '');
          if (indentOf(l) === 0 && /^::[a-zA-Z]/.test(lt)) { zbody.push(l); i++; continue; }
          if (indentOf(l) > 0) { zbody.push(l); i++; continue; }
          break;
        }
        segs.push({ type: 'zone', content: zbody.join('\n') });
        continue;
      }
      mdBuf.push(line);
      i++;
    }
    flushMd();
    return segs;
  }
  function indentOf(line) {
    var m = /^(\s*)/.exec(line);
    return m ? m[1].length : 0;
  }

  // ---- markdown 流式尾部裁剪 ----
  // 流式吐字时,marked 遇到"半符号"(未闭合的 ** * ` ~~,行首孤立 # > -,或裸 [) 会直接原样吐出,
  // 用户看见闪烁的 * ** [ # 等符号.这里在 marked 之前把这些尾巴裁掉,等下一 tick 补齐再显示.
  function bufferMarkdown(src) {
    if (!src) return src;
    var lines = src.split('\n');
    var last = lines[lines.length - 1];

    // 0) 尾行是"半截 zone 组件头"::: 或 ::x(还没到 splitSegments 认识的顶格 ::a 阈值),丢弃等下一 tick
    if (/^\s*::[a-zA-Z]*$/.test(last)) {
      lines.pop();
      return lines.join('\n');
    }
    // 1) 尾行是"半截行首标记":# ## - * > 后面还没跟内容 → 整行丢弃
    if (/^\s*(#{1,6}|-|\*|>|\d+\.)\s*$/.test(last)) {
      lines.pop();
    } else {
      // 2) 未闭合的 inline 标记:统计尾行成对符号,奇数就裁到上一个成对位置
      var trimmed = last;
      // ** (加粗) —— 偶数才闭合
      var stars = (trimmed.match(/\*\*/g) || []).length;
      if (stars % 2 === 1) {
        var idx = trimmed.lastIndexOf('**');
        trimmed = trimmed.slice(0, idx);
      }
      // ` (行内代码)
      var backticks = (trimmed.match(/`/g) || []).length;
      if (backticks % 2 === 1) {
        var bidx = trimmed.lastIndexOf('`');
        trimmed = trimmed.slice(0, bidx);
      }
      // ~~ 删除线
      var tildes = (trimmed.match(/~~/g) || []).length;
      if (tildes % 2 === 1) {
        var tidx = trimmed.lastIndexOf('~~');
        trimmed = trimmed.slice(0, tidx);
      }
      // 单 * 斜体(不能和 ** 冲突,先减掉 ** 数量再算)
      var singleStars = (trimmed.replace(/\*\*/g, '').match(/\*/g) || []).length;
      if (singleStars % 2 === 1) {
        // 找最后一个非 ** 的 *
        var lastStar = -1;
        for (var i = trimmed.length - 1; i >= 0; i--) {
          if (trimmed[i] === '*' && trimmed[i - 1] !== '*' && trimmed[i + 1] !== '*') { lastStar = i; break; }
        }
        if (lastStar >= 0) trimmed = trimmed.slice(0, lastStar);
      }
      // 未闭合的 [ 链接
      var openBracket = trimmed.lastIndexOf('[');
      if (openBracket !== -1 && trimmed.indexOf(']', openBracket) === -1) {
        trimmed = trimmed.slice(0, openBracket);
      }
      // 孤立 \ 尾部
      if (/\\$/.test(trimmed)) trimmed = trimmed.slice(0, -1);
      lines[lines.length - 1] = trimmed;
    }
    return lines.join('\n');
  }

  // ---- 转义归一化 ----
  // parser 里 "\n" 里的 \ 是字面保留的(等 splitCoverHighlights 归一).web 端这里做兜底:
  //   - \n \r → <br>(inline) / 换行(esc)
  //   - \t → 4 空格
  //   - 尾部裸 \ (流式吐字瞬间) → 丢
  function normEscapes(s, forInline) {
    if (!s) return '';
    s = String(s);
    // 尾部孤立 \ (下一字符还没到) 直接丢
    if (/[^\\]\\$|^\\$/.test(s)) s = s.replace(/\\$/, '');
    // \\\\ → 字面 \ (先占位再还原)
    s = s.replace(/\\\\/g, '\x00');
    s = s.replace(/\\n/g, forInline ? '<br>' : '\n');
    s = s.replace(/\\r/g, '');
    s = s.replace(/\\t/g, '    ');
    s = s.replace(/\x00/g, '\\');
    return s;
  }

  // ---- 行内高亮 ----
  function inline(s) {
    if (!s) return '';
    s = normEscapes(s, false);
    s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    s = s.replace(/\n/g, '<br>');
    // 流式期间:未成对的 **/~~/== 视为"还没吐完",裁到最后一个未闭合符号前,避免出现裸的 ** 字面.
    // 非流式或已完整 → 正则匹配得到 <strong> 等标签,该显示的显示,不影响非成对场景.
    if (STREAMING) {
      var stars = (s.match(/\*\*/g) || []).length;
      if (stars % 2 === 1) s = s.slice(0, s.lastIndexOf('**'));
      var tildes = (s.match(/~~/g) || []).length;
      if (tildes % 2 === 1) s = s.slice(0, s.lastIndexOf('~~'));
      var eqs = (s.match(/==/g) || []).length;
      if (eqs % 2 === 1) s = s.slice(0, s.lastIndexOf('=='));
    }
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/~~(.+?)~~/g, '<em class="hl-soft">$1</em>');
    s = s.replace(/==(.+?)==/g, '<em class="hl-mk">$1</em>');
    return s;
  }
  function esc(s) {
    s = normEscapes(s, false);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function main(node) { return node.main || node.attrs && node.attrs.main || ''; }
  // attr:返回值时 true(裸 flag,可能是流式吐到 key 还没 =) 视为 dflt || '',
  // 避免 "true" 字面渲染到 UI.真的 boolean flag(如 checkbox checked)用 attrRaw().
  function attr(node, k, dflt) {
    var v = node.attrs && node.attrs[k];
    if (v === true) return dflt || '';
    if (v == null || v === '') return dflt || '';
    return v;
  }
  // attrRaw:不做 true→空 兜底,给 checkbox/checked 这类真裸 flag 判断用
  function attrRaw(node, k) { return node.attrs && node.attrs[k]; }
  // isFlag: 判断 boolean flag 型 attr(裸 flag 或 =true / ="true")
  function isFlag(node, k) {
    var v = attrRaw(node, k);
    return v === true || v === 'true';
  }
  function kids(node) { return node.children || []; }


  // ---- 组件渲染器 ----
  var R = {};
  R.text = function (n) {
    var size = attr(n, 'size', 'base');
    var cls = { hero: 'p-text-hero', title: 'p-text-title', xl: 'p-text-hero', lg: 'p-text-title', sm: 'p-text-sm' }[size] || 'p-text';
    var align = attr(n, 'align') === 'center' ? ' style="text-align:center"' : '';
    return '<div class="' + cls + '"' + align + '>' + inline(main(n)) + '</div>';
  };
  R.tag = function (n) { return '<span class="p-tag">' + inline(main(n)) + '</span>'; };
  R.badge = function (n) { return '<span class="p-badge">' + inline(main(n)) + '</span>'; };
  R.pill = function (n) { return '<span class="p-pill">' + inline(main(n)) + '</span>'; };
  R.icon = function (n) { return '<span class="p-icon">' + inline(main(n)) + '</span>'; };
  R.kicker = function (n) { return '<div class="p-kicker">' + inline(main(n)) + '</div>'; };
  R.divider = function (n) { return isFlag(n, 'thick') ? '<div class="p-divider p-divider-thick"></div>' : '<div class="p-divider"></div>'; };
  // 内联 SVG 图标(无依赖,stroke 跟随 currentColor)
  function iconSvg(type) {
    var s = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    if (type === 'danger') return s + '<circle cx="8" cy="8" r="6.5"/><line x1="5.5" y1="5.5" x2="10.5" y2="10.5"/><line x1="10.5" y1="5.5" x2="5.5" y2="10.5"/></svg>';
    if (type === 'success') return s + '<circle cx="8" cy="8" r="6.5"/><polyline points="5,8.2 7,10.2 11,6"/></svg>';
    if (type === 'warn' || type === 'warning') return s + '<path d="M8 2.5 L14 13 L2 13 Z"/><line x1="8" y1="6.5" x2="8" y2="9.2"/><circle cx="8" cy="11" r="0.4" fill="currentColor" stroke="none"/></svg>';
    return s + '<circle cx="8" cy="8" r="6.5"/><line x1="8" y1="7.2" x2="8" y2="11"/><circle cx="8" cy="4.8" r="0.5" fill="currentColor" stroke="none"/></svg>'; // info
  }
  R.callout = function (n) {
    var title = attr(n, 'title');
    // tone 是 type 的别名(AI 常用 tone=warning)
    var type = attr(n, 'type') || attr(n, 'tone') || 'info';
    // 正文:优先 main,没有就拼 ::text 子节点(AI 习惯把长正文放子节点)
    var body = main(n);
    if (!body) {
      var textKids = kids(n).filter(function (c) { return c.name === 'text'; });
      body = textKids.map(function (t) { return main(t); }).join('');
    }
    return '<div class="p-callout p-callout-' + esc(type) + '">' +
      '<span class="p-callout-icon">' + iconSvg(type) + '</span>' +
      '<div class="p-callout-content">' +
      (title ? '<div class="p-callout-title">' + inline(title) + '</div>' : '') +
      (body ? '<div class="p-callout-body">' + inline(body) + '</div>' : '') +
      '</div></div>';
  };
  R.tip = function (n) {
    var title = attr(n, 'title');
    var type = attr(n, 'type') || attr(n, 'tone') || 'info';
    var body = main(n);
    return '<div class="p-tip p-tip-' + esc(type) + '">' +
      (title ? '<div class="p-tip-title">' + inline(title) + '</div>' : '') +
      (body ? '<div class="p-tip-body">' + inline(body) + '</div>' : '') + '</div>';
  };
  R.quote = function (n) {
    var cite = attr(n, 'cite');
    return '<div class="p-quote">' + inline(main(n)) + (cite ? '<span class="p-quote-cite">' + inline(cite) + '</span>' : '') + '</div>';
  };
  R.display = function (n) {
    var d = attr(n, 'desc');
    return '<div class="p-display">' + inline(main(n)) + '</div>' + (d ? '<div class="p-display-desc">' + inline(d) + '</div>' : '');
  };
  R.progress = function (n) {
    var v = parseInt(attr(n, 'value', '60'), 10);
    return '<div class="p-progress"><div class="p-progress-label"><span>' + inline(main(n)) + '</span><span>' + v + '%</span></div><div class="p-progress-bar"><div class="p-progress-fill" style="width:' + v + '%"></div></div></div>';
  };
  R.alert = function (n) {
    var type = attr(n, 'type') || attr(n, 'color') || 'info';
    return '<div class="p-alert p-alert-' + esc(type) + '"><span class="p-alert-icon">' + iconSvg(type) + '</span>' +
      '<span class="p-alert-body">' + inline(main(n)) + '</span></div>';
  };
  R.chapter = function (n) {
    var idx = main(n), cat = attr(n, 'category'), title = attr(n, 'title'), subtitle = attr(n, 'subtitle');
    var head = '<div class="mock-chapter-head">' +
      (idx ? '<span class="mock-chapter-idx">' + esc(idx) + '</span>' : (STREAMING ? '<span class="mock-chapter-idx pending">&nbsp;</span>' : '')) +
      (cat ? '<span class="mock-chapter-cat">' + esc(cat) + '</span>' : (STREAMING ? '<span class="mock-chapter-cat pending">&nbsp;</span>' : '')) +
      (title ? '<span class="mock-chapter-title">' + inline(title) + '</span>' : (STREAMING ? '<span class="mock-chapter-title pending">&nbsp;</span>' : '')) +
    '</div>';
    var sub = subtitle
      ? '<div class="mock-chapter-sub">' + inline(subtitle) + '</div>'
      : (STREAMING ? '<div class="mock-chapter-sub pending">&nbsp;</div>' : '');
    return '<div class="mock-chapter">' + head + sub + '</div>';
  };
  R['magazine-cover'] = function (n) {
    var tag = attr(n, 'tag'), sub = attr(n, 'subtitle'), stats = attr(n, 'stats');
    var badge = attr(n, 'badge'), footnote = attr(n, 'footnote');
    var title = main(n) || attr(n, 'title');
    var statsArr = (stats && stats !== true) ? (Array.isArray(stats) ? stats : String(stats).split(',')) : null;
    var statsHtml = statsArr
      ? '<div class="mock-mag-stats">' + statsArr.map(function (s) {
          s = String(s);
          var m = s.trim().match(/^(\S+)\s+(.+)$/);
          return '<span class="mock-mag-stat"><b>' + esc(m ? m[1] : s.trim()) + '</b>' + esc(m ? m[2] : '') + '</span>';
        }).join('') + '</div>'
      : (STREAMING ? '<div class="mock-mag-stats"><span class="mock-mag-stat pending">&nbsp;</span><span class="mock-mag-stat pending">&nbsp;</span><span class="mock-mag-stat pending">&nbsp;</span></div>' : '');
    var meta = (badge || footnote) ? '<div class="mock-mag-meta">' +
      (badge ? '<span class="mock-mag-badge">' + esc(badge) + '</span>' : '') +
      (footnote ? '<span class="mock-mag-footnote">' + esc(footnote) + '</span>' : '') +
      '</div>' : '';
    return '<div class="mock-mag-cover">' +
      (tag ? '<div class="mock-mag-tag">' + esc(tag) + '</div>' : (STREAMING ? '<div class="mock-mag-tag pending">&nbsp;</div>' : '')) +
      (title ? '<div class="mock-mag-title">' + inline(title) + '</div>' : (STREAMING ? '<div class="mock-mag-title pending">&nbsp;</div>' : '')) +
      (sub ? '<div class="mock-mag-sub">' + inline(sub) + '</div>' : (STREAMING ? '<div class="mock-mag-sub pending">&nbsp;</div>' : '')) +
      statsHtml + meta + '</div>';
  };
  R['data-board'] = function (n) {
    var cols = attr(n, 'cols', '2');
    var items = kids(n).filter(function (c) { return c.name === 'item'; });
    var colsN = parseInt(cols, 10) || 2;
    // 流式且当前是"最后正在吐"组件:预留 cols 槽;非流式或已完成:严格按 items 长度渲染,没写就不出
    var slots = STREAMING ? Math.max(items.length, colsN) : items.length;
    if (!slots) return '';
    var cells = '';
    for (var i = 0; i < slots; i++) {
      var it = items[i];
      if (it) {
        var lbl = main(it), val = attr(it, 'value'), desc = attr(it, 'desc');
        cells += '<div class="mock-db-cell">' +
          (lbl ? '<div class="mock-db-lbl">' + inline(lbl) + '</div>' : (STREAMING ? '<div class="mock-db-lbl pending">&nbsp;</div>' : '')) +
          (val ? '<div class="mock-db-val">' + inline(val) + '</div>' : (STREAMING ? '<div class="mock-db-val pending">&nbsp;</div>' : '')) +
          (desc ? '<div class="mock-db-desc">' + inline(desc) + '</div>' : '') + '</div>';
      } else {
        cells += '<div class="mock-db-cell"><div class="mock-db-lbl pending">&nbsp;</div><div class="mock-db-val pending">&nbsp;</div></div>';
      }
    }
    return '<div class="mock-data-board" style="grid-template-columns:repeat(' + cols + ',1fr)">' + cells + '</div>';
  };
  R['era-timeline'] = function (n) {
    var title = main(n);
    var items = kids(n).filter(function (c) { return c.name === 'item'; });
    var DEFAULT = 3;
    var slots = STREAMING ? Math.max(items.length, DEFAULT) : items.length;
    if (!slots) return '';
    var body = '';
    for (var i = 0; i < slots; i++) {
      var it = items[i];
      if (it) {
        var hl = isFlag(it, 'highlight') ? ' highlight' : '';
        var date = main(it), lbl = attr(it, 'label'), desc = attr(it, 'desc');
        body += '<div class="mock-era-item"><div class="mock-era-node' + hl + '"></div><div class="mock-era-body">' +
          '<div class="mock-era-row">' +
          (date ? '<span class="mock-era-date">' + esc(date) + '</span>' : (STREAMING ? '<span class="mock-era-date pending">&nbsp;</span>' : '')) +
          (lbl ? '<span class="mock-era-lbl">' + esc(lbl) + '</span>' : (STREAMING ? '<span class="mock-era-lbl pending">&nbsp;</span>' : '')) +
          '</div>' +
          (desc ? '<div class="mock-era-desc">' + inline(desc) + '</div>' : (STREAMING ? '<div class="mock-era-desc pending">&nbsp;</div>' : '')) +
          '</div></div>';
      } else {
        body += '<div class="mock-era-item"><div class="mock-era-node"></div><div class="mock-era-body">' +
          '<div class="mock-era-row"><span class="mock-era-date pending">&nbsp;</span><span class="mock-era-lbl pending">&nbsp;</span></div>' +
          '<div class="mock-era-desc pending">&nbsp;</div></div></div>';
      }
    }
    var titleHtml = title ? '<div class="mock-era-title">' + esc(title) + '</div>' : (STREAMING ? '<div class="mock-era-title pending">&nbsp;</div>' : '');
    return titleHtml + '<div class="mock-era">' + body + '</div>';
  };
  R['numbered-list'] = function (n) {
    var title = main(n);
    var kidsArr = kids(n).filter(function (c) { return c.name === 'item'; });
    var items = kidsArr.length
      ? kidsArr.map(function (it, i) {
          var t = main(it) || attr(it, 'title');
          var desc = attr(it, 'desc');
          return '<div class="mock-nlist-item"><span class="mock-nlist-num">' + (i + 1) + '</span>' +
            '<div class="mock-nlist-body">' +
            (t ? '<div class="mock-nlist-main">' + inline(t) + '</div>' : '<span class="pending">&nbsp;</span>') +
            (desc ? '<div class="mock-nlist-desc">' + inline(desc) + '</div>' : '') +
            '</div></div>';
        }).join('')
      : '<div class="mock-nlist-item"><span class="mock-nlist-num">1</span><span class="pending">&nbsp;</span></div>' +
        '<div class="mock-nlist-item"><span class="mock-nlist-num">2</span><span class="pending">&nbsp;</span></div>';
    return '<div class="mock-nlist-title' + (title ? '' : ' pending') + '">' + (title ? esc(title) : '&nbsp;') + '</div><div class="mock-nlist">' + items + '</div>';
  };
  R.list = function (n) {
    var title = main(n);
    var kidsArr = kids(n).filter(function (c) { return c.name === 'item'; });
    var items = kidsArr.length
      ? kidsArr.map(function (it) {
          var t = main(it) || attr(it, 'title');
          var desc = attr(it, 'desc');
          return '<div class="pg-list-item">' +
            (t ? '<div class="pg-list-main">' + inline(t) + '</div>' : '<span class="pending">&nbsp;</span>') +
            (desc ? '<div class="pg-list-desc">' + inline(desc) + '</div>' : '') +
            '</div>';
        }).join('')
      : '<div class="pg-list-item"><span class="pending">&nbsp;</span></div>' +
        '<div class="pg-list-item"><span class="pending">&nbsp;</span></div>';
    return '<div class="pg-list"><div class="pg-list-title' + (title ? '' : ' pending') + '">' + (title ? esc(title) : '&nbsp;') + '</div>' + items + '</div>';
  };
  R['labeled-list'] = function (n) {
    var title = main(n);
    var kidsArr = kids(n).filter(function (c) { return c.name === 'item'; });
    var items = kidsArr.length
      ? kidsArr.map(function (it) {
          var lbl = attr(it, 'label'), t = main(it);
          return '<div class="s-llist-item">' +
            '<span class="s-llist-label' + (lbl ? '' : ' pending') + '">' + (lbl ? esc(lbl) : '&nbsp;') + '</span>' +
            (t ? inline(t) : '<span class="pending">&nbsp;</span>') + '</div>';
        }).join('')
      : '<div class="s-llist-item"><span class="s-llist-label pending">&nbsp;</span><span class="pending">&nbsp;</span></div>' +
        '<div class="s-llist-item"><span class="s-llist-label pending">&nbsp;</span><span class="pending">&nbsp;</span></div>';
    return '<div class="s-llist"><div class="s-llist-title' + (title ? '' : ' pending') + '">' + (title ? esc(title) : '&nbsp;') + '</div>' + items + '</div>';
  };
  R['person-grid'] = function (n) {
    var cols = attr(n, 'cols', '2');
    var colsN = parseInt(cols, 10) || 2;
    var cardNodes = kids(n).filter(function (c) { return c.name === 'person-card'; });
    var slots = STREAMING ? Math.max(cardNodes.length, colsN * 2) : cardNodes.length;
    if (!slots) return '';
    var body = '';
    for (var i = 0; i < slots; i++) {
      var c = cardNodes[i];
      if (c) {
        var name = main(c) || attr(c, 'name'), desc = attr(c, 'desc'), av = attr(c, 'avatar');
        var avHtml = av ? '<img class="mock-person-avatar-img" src="' + esc(av) + '" alt="">' :
          (name ? '<div class="mock-person-avatar">' + esc(String(name).slice(-1)) + '</div>' : (STREAMING ? '<div class="mock-person-avatar pending">&nbsp;</div>' : ''));
        body += '<div class="mock-person">' + avHtml +
          (name ? '<div class="mock-person-name">' + inline(name) + '</div>' : (STREAMING ? '<div class="mock-person-name pending">&nbsp;</div>' : '')) +
          (desc ? '<div class="mock-person-desc">' + inline(desc) + '</div>' : (STREAMING ? '<div class="mock-person-desc pending">&nbsp;</div>' : '')) +
        '</div>';
      } else {
        body += '<div class="mock-person"><div class="mock-person-avatar pending">&nbsp;</div>' +
          '<div class="mock-person-name pending">&nbsp;</div><div class="mock-person-desc pending">&nbsp;</div></div>';
      }
    }
    return '<div class="mock-person-grid" style="grid-template-columns:repeat(' + cols + ',1fr)">' + body + '</div>';
  };
  R['scene-card'] = function (n) {
    var tags = attr(n, 'tags');
    var tagsArr = tags ? (Array.isArray(tags) ? tags : String(tags).split(',')) : null;
    var tagsHtml = tagsArr ? '<div class="mock-scene-tags">' + tagsArr.map(function (t) { return '<span>' + esc(String(t).trim()) + '</span>'; }).join('') + '</div>' : '';
    return '<div class="mock-scene-card"><div class="mock-scene-icon">' + esc(attr(n, 'icon')) + '</div>' +
      '<div class="mock-scene-body"><div class="mock-scene-title">' + inline(attr(n, 'title')) + '</div>' +
      (attr(n, 'desc') ? '<div class="mock-scene-desc">' + inline(attr(n, 'desc')) + '</div>' : '') + tagsHtml + '</div></div>';
  };
  // ---- primitive 补齐 ----
  R.avatar = function (n) {
    var src = attr(n, 'src') || attr(n, 'url') || main(n);
    var size = attr(n, 'size', 'md');
    return src
      ? '<img class="p-avatar p-avatar-' + esc(size) + '" src="' + esc(src) + '" alt="">'
      : '<div class="p-avatar p-avatar-' + esc(size) + ' p-avatar-fallback">' + esc((main(n) || '?').slice(-1)) + '</div>';
  };
  R.trend = function (n) {
    var t = String(main(n) || '');
    var dir = t.indexOf('↑') === 0 ? 'up' : t.indexOf('↓') === 0 ? 'down' : 'flat';
    return '<span class="p-trend p-trend-' + dir + '">' + esc(t) + '</span>';
  };
  R.metric = function (n) {
    var v = main(n);
    var trend = attr(n, 'trend'), desc = attr(n, 'desc');
    var trendDir = trend.indexOf('↑') === 0 ? 'up' : trend.indexOf('↓') === 0 ? 'down' : trend ? 'flat' : '';
    return '<div class="p-metric">' +
      '<div class="p-metric-val">' + esc(v) + (trend ? '<span class="p-metric-trend p-trend-' + trendDir + '">' + esc(trend) + '</span>' : '') + '</div>' +
      (desc ? '<div class="p-metric-desc">' + inline(desc) + '</div>' : '') +
      '</div>';
  };
  // v2.11: fit 宽高适配(16:9 口语化 → CSS aspect-ratio;width 默认向后兼容)
  var FIT_RATIO = { '16:9': '16 / 9', '9:16': '9 / 16', '4:3': '4 / 3', '3:4': '3 / 4', square: '1 / 1', cover: '16 / 9' };
  function fitStyle(fit, height) {
    var f = String(fit || 'width').toLowerCase();
    if (f === '1:1') f = 'square';
    if (f === 'fixed' && height) return 'height:' + esc(String(height)) + 'px;';
    if (FIT_RATIO[f]) return 'aspect-ratio:' + FIT_RATIO[f] + ';';
    return ''; // width 模式不约束
  }
  R.image = function (n) {
    var url = attr(n, 'url') || attr(n, 'src') || main(n);
    var cap = attr(n, 'caption') || attr(n, 'alt');
    var fit = (attr(n, 'fit') || 'width').toLowerCase();
    var st = fitStyle(fit, attr(n, 'height'));
    // 流式态 url 未到 → 骨架(对齐 .pending 语义)
    if (!url) return STREAMING ? '<div class="p-image p-image-skeleton" style="' + st + '"></div>' : '<div class="p-image p-image-empty">(image)</div>';
    var cls = 'p-image' + (st ? ' p-image-fixed' : '') + (fit === '9:16' ? ' p-image-portrait' : '');
    return '<figure class="' + cls + '"' + (st ? ' style="' + st + '"' : '') + '><img src="' + esc(url) + '" alt="' + esc(cap) + '">' +
      (cap ? '<figcaption>' + esc(cap) + '</figcaption>' : '') + '</figure>';
  };
  // v2.11: video 封面组件(web 端纯展示,点击跳转在小程序端发生)
  R.video = function (n) {
    var poster = attr(n, 'poster') || attr(n, 'url') || attr(n, 'src');
    var title = main(n) || attr(n, 'title');
    var sub = attr(n, 'subtitle');
    var fit = (attr(n, 'fit') || '16:9').toLowerCase();
    var st = fitStyle(fit, attr(n, 'height'));
    if (!poster && !STREAMING) return '<div class="p-video p-image-empty">(video)</div>';
    var inner = poster ? '<img class="p-video-poster" src="' + esc(poster) + '">' : '<div class="p-image-skeleton"></div>';
    return '<div class="p-video' + (fit === '9:16' ? ' p-image-portrait' : '') + '"' + (st ? ' style="' + st + '"' : '') + '>' +
      inner + '<div class="p-video-play">▶</div>' +
      (title || sub ? '<div class="p-video-content">' + (title ? '<div class="p-video-title">' + esc(title) + '</div>' : '') + (sub ? '<div class="p-video-sub">' + esc(sub) + '</div>' : '') + '</div>' : '') +
      '</div>';
  };
  R.spacer = function (n) {
    var h = attr(n, 'h') || attr(n, 'height') || main(n) || 'md';
    var sizeMap = { xs: 8, sm: 12, md: 20, lg: 32, xl: 48 };
    var px = sizeMap[h] || (parseInt(h, 10) || 20);
    return '<div class="p-spacer" style="height:' + px + 'px"></div>';
  };
  R.gap = R.spacer;

  // ---- preset 补齐 ----
  R['city-card'] = function (n) {
    var num = main(n) || attr(n, 'num');
    var country = attr(n, 'country'), city = attr(n, 'city'), en = attr(n, 'en'), date = attr(n, 'date');
    var items = kids(n).filter(function (c) { return c.name === 'item'; }).map(function (it) {
      return '<div class="mock-city-item"><span class="mock-city-i-main">' + inline(main(it)) + '</span>' +
        (attr(it, 'desc') ? '<span class="mock-city-i-desc">' + inline(attr(it, 'desc')) + '</span>' : '') + '</div>';
    }).join('');
    var tags = attr(n, 'tags');
    var tagsArr = tags ? (Array.isArray(tags) ? tags : String(tags).split(',')) : null;
    var tagsHtml = tagsArr ? '<div class="mock-city-tags">' + tagsArr.map(function (t) { return '<span>' + esc(String(t).trim()) + '</span>'; }).join('') + '</div>' : '';
    return '<div class="mock-city-card">' +
      '<div class="mock-city-head"><span class="mock-city-num">' + esc(num) + '</span>' +
      '<div class="mock-city-loc"><div class="mock-city-country">' + esc(country) + '</div>' +
      '<div class="mock-city-city">' + esc(city) + '</div>' +
      (en ? '<div class="mock-city-en">' + esc(en) + '</div>' : '') + '</div>' +
      (date ? '<span class="mock-city-date">' + esc(date) + '</span>' : '') + '</div>' +
      (items ? '<div class="mock-city-items">' + items + '</div>' : '') +
      tagsHtml + '</div>';
  };
  R.statement = function (n) {
    var title = main(n) || attr(n, 'title');
    var author = attr(n, 'author'), time = attr(n, 'time'), source = attr(n, 'source');
    return '<div class="mock-statement"><div class="mock-statement-title">' + inline(title) + '</div>' +
      '<div class="mock-statement-meta">' +
      (author ? '<span>' + esc(author) + '</span>' : '') +
      (time ? '<span>' + esc(time) + '</span>' : '') +
      (source ? '<span>' + esc(source) + '</span>' : '') +
      '</div>' + kids(n).map(renderNode).join('') + '</div>';
  };
  R['editorial-hero'] = function (n) {
    var kicker = attr(n, 'kicker'), title = main(n) || attr(n, 'title'), sub = attr(n, 'subtitle');
    var stats = attr(n, 'stats');
    var statsArr = (stats && stats !== true) ? (Array.isArray(stats) ? stats : String(stats).split(',')) : null;
    var statsHtml = statsArr ? '<div class="mock-ed-hero-stats">' + statsArr.map(function (s) {
      return '<span class="mock-ed-hero-stat">' + esc(String(s).trim()) + '</span>';
    }).join('') + '</div>' : '';
    return '<div class="mock-ed-hero">' +
      (kicker ? '<div class="mock-ed-kicker">' + esc(kicker) + '</div>' : (STREAMING ? '<div class="mock-ed-kicker pending">&nbsp;</div>' : '')) +
      (title ? '<div class="mock-ed-title">' + inline(title) + '</div>' : (STREAMING ? '<div class="mock-ed-title pending">&nbsp;</div>' : '')) +
      (sub ? '<div class="mock-ed-sub">' + inline(sub) + '</div>' : (STREAMING ? '<div class="mock-ed-sub pending">&nbsp;</div>' : '')) +
      statsHtml + '</div>';
  };
  R['editorial-pullquote'] = function (n) {
    var cite = attr(n, 'cite') || attr(n, 'author');
    return '<div class="mock-ed-pq">"' + inline(main(n)) + '"' +
      (cite ? '<div class="mock-ed-pq-cite">— ' + esc(cite) + '</div>' : '') + '</div>';
  };
  R['editorial-summary'] = function (n) {
    var label = attr(n, 'title') || attr(n, 'label') || 'TL;DR';
    var body = main(n);
    return '<div class="mock-ed-sum"><div class="mock-ed-sum-lbl">' + esc(label) + '</div>' +
      '<div class="mock-ed-sum-body">' + (body ? inline(body) : (STREAMING ? '<span class="pending">&nbsp;</span>' : '')) + '</div></div>';
  };
  R['editorial-stat'] = function (n) {
    var val = main(n) || attr(n, 'value');
    var lbl = attr(n, 'label'), desc = attr(n, 'desc');
    return '<div class="mock-ed-stat"><div class="mock-ed-stat-val">' + esc(val) + '</div>' +
      (lbl ? '<div class="mock-ed-stat-lbl">' + inline(lbl) + '</div>' : '') +
      (desc ? '<div class="mock-ed-stat-desc">' + inline(desc) + '</div>' : '') + '</div>';
  };
  R['editorial-image'] = function (n) {
    var url = attr(n, 'url') || attr(n, 'src') || main(n);
    var cap = attr(n, 'caption');
    return '<figure class="mock-ed-image">' + (url ? '<img src="' + esc(url) + '" alt="">' : '<div class="mock-ed-image-empty">image</div>') +
      (cap ? '<figcaption>' + inline(cap) + '</figcaption>' : '') + '</figure>';
  };
  R['fact-bar'] = function (n) {
    var items = kids(n).filter(function (c) { return c.name === 'item'; }).map(function (it) {
      return '<div class="mock-fact-item"><span class="mock-fact-lbl">' + inline(main(it)) + '</span>' +
        '<span class="mock-fact-val">' + inline(attr(it, 'value')) + '</span></div>';
    }).join('');
    return '<div class="mock-fact-bar">' + (main(n) ? '<div class="mock-fact-title">' + inline(main(n)) + '</div>' : '') + items + '</div>';
  };
  R['step-block'] = function (n) {
    var items = kids(n).filter(function (c) { return c.name === 'item' || c.name === 'step'; }).map(function (it, i) {
      return '<div class="mock-sb-item"><div class="mock-sb-lbl">' + esc(attr(it, 'label') || ('Step ' + (i + 1))) + '</div>' +
        '<div class="mock-sb-main">' + inline(main(it)) + '</div>' +
        (attr(it, 'desc') ? '<div class="mock-sb-desc">' + inline(attr(it, 'desc')) + '</div>' : '') + '</div>';
    }).join('');
    return '<div class="mock-step-block">' + (main(n) ? '<div class="mock-sb-title">' + inline(main(n)) + '</div>' : '') + items + '</div>';
  };
  R['glyph-compare'] = function (n) {
    var items = kids(n).filter(function (c) { return c.name === 'item'; }).map(function (it) {
      return '<div class="mock-glyph-item"><div class="mock-glyph-char">' + esc(main(it)) + '</div>' +
        (attr(it, 'label') ? '<div class="mock-glyph-lbl">' + inline(attr(it, 'label')) + '</div>' : '') +
        (attr(it, 'desc') ? '<div class="mock-glyph-desc">' + inline(attr(it, 'desc')) + '</div>' : '') + '</div>';
    }).join('');
    return '<div class="mock-glyph-compare">' + (main(n) ? '<div class="mock-glyph-title">' + inline(main(n)) + '</div>' : '') + items + '</div>';
  };
  R['media-card'] = function (n) {
    var url = attr(n, 'url') || attr(n, 'src');
    var title = main(n) || attr(n, 'title'), sub = attr(n, 'subtitle');
    return '<div class="mock-media-card">' +
      (url ? '<img class="mock-media-img" src="' + esc(url) + '" alt="">' : '<div class="mock-media-empty"></div>') +
      '<div class="mock-media-body"><div class="mock-media-title">' + inline(title) + '</div>' +
      (sub ? '<div class="mock-media-sub">' + inline(sub) + '</div>' : '') + '</div></div>';
  };

  // ---- structure 补齐 ----
  R.grid = function (n) {
    var cols = attr(n, 'cols', '2');
    return '<div class="s-grid" style="grid-template-columns:repeat(' + cols + ',1fr)">' + kids(n).map(renderNode).join('') + '</div>';
  };
  R.table = function (n) {
    var fields = kids(n).filter(function (c) { return c.name === 'field'; });
    var rows = kids(n).filter(function (c) { return c.name === 'row'; });
    var head = fields.length ? '<thead><tr>' + fields.map(function (f) { return '<th>' + esc(main(f) || f._raw || '') + '</th>'; }).join('') + '</tr></thead>' : '';
    var body = '<tbody>' + rows.map(function (r) {
      var cells = attr(r, 'cells');
      if (typeof cells === 'string') cells = cells.split(',').map(function (s) { return s.trim(); });
      if (!cells && r._raw) cells = String(r._raw).split(',').map(function (s) { return s.trim(); });
      cells = cells || [];
      return '<tr>' + cells.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody>';
    return '<table class="s-table">' + head + body + '</table>';
  };
  R.timeline = function (n) {
    var items = kids(n).filter(function (c) { return c.name === 'item'; }).map(function (it) {
      var hl = isFlag(it, 'highlight') ? ' highlight' : '';
      return '<div class="pg-tl-item' + hl + '">' +
        (attr(it, 'when') ? '<div class="pg-tl-when">' + esc(attr(it, 'when')) + '</div>' : '') +
        '<div class="pg-tl-main">' + inline(main(it)) + '</div>' +
        (attr(it, 'desc') ? '<div class="pg-tl-desc">' + inline(attr(it, 'desc')) + '</div>' : '') + '</div>';
    }).join('');
    return '<div class="pg-timeline">' + (main(n) ? '<div class="pg-tl-title">' + esc(main(n)) + '</div>' : '') + items + '</div>';
  };
  R.gallery = function (n) {
    var imgs = kids(n).filter(function (c) { return c.name === 'image'; });
    var cols = imgs.length === 1 ? 1 : (imgs.length === 2 || imgs.length === 4) ? 2 : 3;
    var cells = imgs.map(function (im) {
      var url = attr(im, 'url') || attr(im, 'src') || main(im);
      return '<div class="s-gallery-cell">' + (url ? '<img src="' + esc(url) + '" alt="">' : '') + '</div>';
    }).join('');
    return '<div class="s-gallery" style="grid-template-columns:repeat(' + cols + ',1fr)">' + cells + '</div>';
  };
  R.hscroll = function (n) {
    return '<div class="s-hscroll">' + kids(n).map(renderNode).join('') + '</div>';
  };
  R.scroller = R.hscroll;
  R.swiper = function (n) {
    // Web 端降级:swiper 只显示第一张 slide,轮播交给小程序端
    var slides = kids(n).filter(function (c) { return c.type === 'component'; });
    var first = slides[0];
    var count = slides.length;
    return '<div class="s-swiper">' + (first ? renderNode(first) : '<div class="s-swiper-empty">no slides</div>') +
      (count > 1 ? '<div class="s-swiper-hint">1 / ' + count + '(Web 静态展示,小程序端为轮播)</div>' : '') + '</div>';
  };
  R.carousel = R.swiper;
  R['divider-fancy'] = function (n) {
    var prefix = attr(n, 'prefix', '//');
    return '<div class="p-divider-fancy"><span class="p-divider-fancy-mark">' + esc(prefix) + '</span>' +
      (main(n) ? '<span class="p-divider-fancy-txt">' + esc(main(n)) + '</span>' : '') + '</div>';
  };
  R['section-mark'] = R['divider-fancy'];
  R.form = function (n) {
    // 简化:直接把子节点渲染成竖排
    return '<div class="s-form">' + (main(n) ? '<div class="s-form-title">' + inline(main(n)) + '</div>' : '') +
      kids(n).map(renderNode).join('') + '</div>';
  };
  R['icon-grid'] = function (n) {
    var cols = attr(n, 'cols', '2');
    var items = kids(n).filter(function (c) { return c.name === 'item'; }).map(function (it) {
      return '<div class="mock-ig-item"><div class="mock-ig-icon">' + esc(attr(it, 'icon')) + '</div>' +
        '<div class="mock-ig-main">' + inline(main(it)) + '</div>' +
        (attr(it, 'desc') ? '<div class="mock-ig-desc">' + inline(attr(it, 'desc')) + '</div>' : '') + '</div>';
    }).join('');
    return '<div class="mock-icon-grid" style="grid-template-columns:repeat(' + cols + ',1fr)">' + items + '</div>';
  };
  R['tip-grid'] = R['icon-grid'];

  // ---- interactive 层:静态降级 ----
  R.button = function (n) {
    var variant = attr(n, 'variant') || attr(n, 'v') || 'primary';
    var size = attr(n, 'size', 'md');
    return '<button class="p-btn p-btn-' + esc(variant) + ' p-btn-' + esc(size) + '" disabled>' + inline(main(n)) + '</button>';
  };
  R.tabs = function (n) {
    var items = kids(n).filter(function (c) { return c.name === 'item' || c.name === 'tab'; });
    var head = '<div class="s-tabs-head">' + items.map(function (it, i) {
      return '<span class="s-tab' + (i === 0 ? ' active' : '') + '">' + esc(main(it) || attr(it, 'label')) + '</span>';
    }).join('') + '</div>';
    var body = items[0] ? '<div class="s-tabs-body">' + kids(items[0]).map(renderNode).join('') + '</div>' : '';
    return '<div class="s-tabs">' + head + body + '</div>';
  };
  R.accordion = function (n) {
    var items = kids(n).filter(function (c) { return c.name === 'item'; }).map(function (it, i) {
      var open = i === 0 || attr(it, 'open') === 'true';
      return '<details class="s-acc-item"' + (open ? ' open' : '') + '>' +
        '<summary>' + inline(main(it) || attr(it, 'title')) + '</summary>' +
        '<div class="s-acc-body">' + kids(it).map(renderNode).join('') + (attr(it, 'desc') ? inline(attr(it, 'desc')) : '') + '</div>' +
        '</details>';
    }).join('');
    return '<div class="s-accordion">' + items + '</div>';
  };
  R.checkbox = function (n) {
    var checked = isFlag(n, 'checked') || isFlag(n, 'selected');
    return '<label class="s-check"><span class="s-check-box' + (checked ? ' checked' : '') + '">' + (checked ? '✓' : '') + '</span>' + inline(main(n)) + '</label>';
  };
  R.radio = function (n) {
    var checked = isFlag(n, 'checked') || isFlag(n, 'selected');
    return '<label class="s-radio"><span class="s-radio-dot' + (checked ? ' checked' : '') + '"></span>' + inline(main(n)) + '</label>';
  };
  R['checkbox-group'] = function (n) {
    return '<div class="s-check-group">' + (main(n) ? '<div class="s-check-title">' + inline(main(n)) + '</div>' : '') +
      kids(n).filter(function (c) { return c.name === 'checkbox' || c.name === 'item'; }).map(function (it) {
        return R.checkbox(it);
      }).join('') + '</div>';
  };
  R['radio-group'] = function (n) {
    return '<div class="s-radio-group">' + (main(n) ? '<div class="s-radio-title">' + inline(main(n)) + '</div>' : '') +
      kids(n).filter(function (c) { return c.name === 'radio' || c.name === 'item'; }).map(function (it) {
        return R.radio(it);
      }).join('') + '</div>';
  };
  R.select = function (n) {
    var opts = kids(n).filter(function (c) { return c.name === 'option' || c.name === 'item'; });
    return '<div class="s-select"><span class="s-select-lbl">' + inline(main(n)) + '</span>' +
      '<select disabled>' + opts.map(function (o) { return '<option>' + esc(main(o) || o._raw || '') + '</option>'; }).join('') + '</select></div>';
  };
  R.textarea = function (n) {
    var placeholder = attr(n, 'placeholder') || attr(n, 'hint') || '';
    return '<div class="s-textarea">' + (main(n) ? '<label>' + inline(main(n)) + '</label>' : '') +
      '<textarea disabled placeholder="' + esc(placeholder) + '"></textarea></div>';
  };
  R.quiz = function (n) {
    var q = main(n) || attr(n, 'question');
    var opts = kids(n).filter(function (c) { return c.name === 'option' || c.name === 'item'; }).map(function (o) {
      var correct = attr(o, 'correct') === 'true';
      return '<div class="s-quiz-opt' + (correct ? ' correct' : '') + '">' + inline(main(o)) + '</div>';
    }).join('');
    return '<div class="s-quiz"><div class="s-quiz-q">' + inline(q) + '</div>' + opts + '</div>';
  };
  R.steps = function (n) {
    var items = kids(n).filter(function (c) { return c.name === 'step' || c.name === 'item'; }).map(function (it, i) {
      return '<div class="s-steps-item"><span class="s-steps-num">' + (i + 1) + '</span>' +
        '<div class="s-steps-body"><div class="s-steps-main">' + inline(main(it)) + '</div>' +
        (attr(it, 'desc') ? '<div class="s-steps-desc">' + inline(attr(it, 'desc')) + '</div>' : '') + '</div></div>';
    }).join('');
    return '<div class="s-steps">' + (main(n) ? '<div class="s-steps-title">' + inline(main(n)) + '</div>' : '') + items + '</div>';
  };
  R.stairs = R.steps;
  R.mechanism = function (n) {
    return '<div class="mock-mech"><div class="mock-mech-title">' + inline(main(n)) + '</div>' +
      kids(n).map(renderNode).join('') + '</div>';
  };

  R.compare = function (n) {
    var rows = kids(n).filter(function (c) { return c.name === 'row'; });
    var aName = '', bName = '';
    kids(n).forEach(function (c) {
      if (c.name === 'a') aName = main(c) || attr(c, 'name');
      if (c.name === 'b') bName = main(c) || attr(c, 'name');
    });
    var head = '<div class="mock-compare-head"><div class="mock-compare-col"><div class="mock-compare-name">' + esc(aName) + '</div></div>' +
      '<div class="mock-compare-vs">VS</div><div class="mock-compare-col"><div class="mock-compare-name">' + esc(bName) + '</div></div></div>';
    var body = rows.map(function (r) {
      return '<div class="mock-compare-row"><span class="mock-compare-a">' + esc(attr(r, 'a')) + '</span>' +
        '<span class="mock-compare-lbl">' + esc(attr(r, 'label')) + '</span>' +
        '<span class="mock-compare-b">' + esc(attr(r, 'b')) + '</span></div>';
    }).join('');
    return '<div class="mock-compare">' + head + body + '</div>';
  };
  R.center = function (n) {
    return '<div class="zn-center">' + kids(n).map(renderNode).join('') + '</div>';
  };
  R.row = function (n) {
    var c = attr(n, 'align') === 'center' ? ' zn-row-center' : '';
    return '<div class="zn-row' + c + '">' + kids(n).map(renderNode).join('') + '</div>';
  };
  R.col = function (n) {
    var c = attr(n, 'align') === 'center' ? ' zn-col-center' : '';
    return '<div class="zn-col' + c + '">' + kids(n).map(renderNode).join('') + '</div>';
  };
  R.card = function (n) {
    var t = main(n), sub = attr(n, 'subtitle');
    return '<div class="s-card">' +
      (t ? '<div class="s-card-title">' + inline(t) + '</div>' : (STREAMING ? '<div class="s-card-title pending">&nbsp;</div>' : '')) +
      (sub ? '<div class="s-card-sub">' + inline(sub) + '</div>' : (STREAMING && !t ? '' : '')) +
      kids(n).map(renderNode).join('') + '</div>';
  };
  R.section = function (n) { return '<div class="s-section">' + (main(n) ? '<div class="s-section-title">' + inline(main(n)) + '</div>' : '') + kids(n).map(renderNode).join('') + '</div>'; };
  R.theme = function (n) {
    // ::theme xxx —— playground 里实时切 html data-theme,不输出可见 UI
    var t = main(n) || attr(n, 'name');
    if (t) document.documentElement.setAttribute('data-theme', t);
    return '';
  };
  R.md = function (n) {
    return window.marked ? (marked.parse ? marked.parse(n.mdText || '') : marked(n.mdText || '')) : '<pre>' + esc(n.mdText || '') + '</pre>';
  };
  // 图表:用 echarts-preview.js 的 RECIPES,attrs 里给的 title/data/labels 直接注入 option.
  // AI-friendly:即使只写 ::line 也能出图(用默认示例数据).
  function chartOption(n) {
    var k = n.name;
    var title = main(n) || attr(n, 'title');
    // 从 attrs 里取 data / labels / value 覆盖默认
    function arr(v) {
      if (v == null || v === '') return null;
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') return v.split(',').map(function (s) { return s.trim(); });
      // 单个数字(coerce 已转 int)也当成一元数组,让 ring/gauge 类 data=78 生效
      if (typeof v === 'number') return [v];
      return null;
    }
    var labels = arr(attr(n, 'labels')) || arr(attr(n, 'x'));
    var data = arr(attr(n, 'data')) || arr(attr(n, 'value')) || arr(attr(n, 'values'));
    var series = kids(n).filter(function (c) { return c.name === 'series'; });
    var opt = { type: k, title: title, labels: labels, data: data, series: series };
    return opt;
  }
  // 把 JSON 字符串安全放到 HTML attribute 里:转掉 & 和 " 就够(单引号包裹时转 ' 也行)
  function attrEsc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }
  // CHART_UID:按"每次 renderZone 内的组件序号"编号(不是全局递增),
  // 让同一逻辑位置的 chart 在 tick 间保持相同 id → morphdom 认作同一元素,不重建.
  var CHART_UID = 0;
  ['line', 'bar', 'pie', 'sparkline', 'radar', 'ring', 'rank'].forEach(function (k) {
    R[k] = function (n) {
      var t = main(n) || attr(n, 'title');
      var opt = chartOption(n);
      var h = k === 'sparkline' ? 60 : 220;
      // 流式且数据未到(data 引号还没闭合,被 streamingSafe 丢弃)→ shimmer 骨架,
      // 不挂 echarts.避免用默认示例数据先画一遍,等真数据到又换一遍("两个不一样的图"闪).
      if (STREAMING && !opt.data) {
        return '<div class="pg-chart">' +
          (t ? '<div class="pg-chart-title">' + inline(t) + '</div>' : '') +
          '<div class="pg-chart-skel" style="height:' + h + 'px"></div></div>';
      }
      var uid = 'pg-c-' + (++CHART_UID);
      var optJson = attrEsc(JSON.stringify(opt));
      // sig = 数据签名(type+labels+data),标题增长不进 sig → 标题 tick 不触发 reinit.
      var sig = attrEsc(opt.type + '|' + JSON.stringify(opt.labels) + '|' + JSON.stringify(opt.data));
      return '<div class="pg-chart">' +
        (t ? '<div class="pg-chart-title">' + inline(t) + '</div>' : '') +
        '<div id="' + uid + '" data-pg-chart="' + esc(k) + '" data-pg-opt="' + optJson + '" data-pg-sig="' + sig + '" style="width:100%;height:' + h + 'px"></div>' +
        '</div>';
    };
  });
  // 渲染后钩子:找出 [data-pg-chart] 未初始化的容器,用 echarts init
  function mountCharts(rootEl) {
    if (!rootEl || !window.echarts) return;
    var nodes = rootEl.querySelectorAll('[data-pg-chart]:not([data-inited])');
    nodes.forEach(function (el) {
      var type = el.getAttribute('data-pg-chart');
      var opt = null;
      try { opt = JSON.parse(el.getAttribute('data-pg-opt') || '{}'); } catch (_) {}
      var recipe = window.PgChartRecipes && window.PgChartRecipes[type];
      if (!recipe) return;
      // dispose 掉可能残留的 echarts 实例(getInstanceByDom 只认还挂在同 DOM 上的实例)
      var existing = window.echarts.getInstanceByDom(el);
      if (existing) { try { existing.dispose(); } catch (_) {} }
      // 彻底清空,消除可能残留的 canvas
      el.innerHTML = '';
      var inst = window.echarts.init(el);
      inst.setOption(Object.assign({ animation: false }, recipe(opt || {})));
      el.setAttribute('data-inited', '1');
      el._pgChart = inst;
      el._pgChartRecipe = recipe;
      el._pgChartOpt = opt;
    });
  }
  window.__mountPgCharts = mountCharts;
  // 监听 data-theme 变化,让 playground 里已初始化的图表跟随主题重画
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(function () {
      if (!window.PgChartRefreshColors) return;
      window.PgChartRefreshColors();
      var all = document.querySelectorAll('[data-pg-chart][data-inited]');
      all.forEach(function (el) {
        if (el._pgChart && el._pgChartRecipe) {
          el._pgChart.setOption(el._pgChartRecipe(el._pgChartOpt || {}));
          el._pgChart.resize();
        }
      });
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // 已知组件名集合(流式时前缀匹配,识别半截组件名)
  var KNOWN = (function () {
    var s = {};
    Object.keys(R).forEach(function (k) { s[k] = 1; });
    return s;
  })();
  var STREAMING = false;
  var SKELETON_ON = true;  // 骨架开关(半截组件名 → 骨架 / pending 灰条)
  function isPartialName(name) {
    if (KNOWN[name]) return false;
    for (var k in KNOWN) { if (k.indexOf(name) === 0) return true; }
    return false;
  }
  function guessComponent(prefix) {
    if (KNOWN[prefix]) return prefix;
    for (var k in KNOWN) { if (k.indexOf(prefix) === 0) return k; }
    return prefix;
  }

  function renderNode(node) {
    if (node.type === 'component' || node.type === 'child') {
      var name = node.name;
      // 流式 + 半截组件名:骨架开则猜完整名当"空组件"渲(pending 灰条 = 骨架),骨架关则跳过等下一 tick
      if (STREAMING && !R[name] && isPartialName(name)) {
        if (!SKELETON_ON) return '';
        name = guessComponent(name);
      }
      var fn = R[name];
      if (fn) {
        // 组件用 pg-slot 稳定外壳,让 morphdom 靠 data-slot-for 匹配同一份 DOM,
        // pending → 有值只是文本 patch,DOM 结构不变,视觉稳定不抖.
        var nodeForRender = name === node.name ? node : { name: name, attrs: {}, children: [], main: undefined };
        var html = fn(nodeForRender);
        if (!html) return '';  // 组件输出空(如 theme 只是切属性)不包 slot,避免空外壳
        return '<div class="pg-slot" data-slot-for="' + esc(name) + '">' + html + '</div>';
      }
      // 未知组件:静默丢弃(白名单外的组件名等同不存在,和 zone-node 小程序端行为一致).
      return '';
    }
    if (node.type === 'option') return '';
    return '';
  }

  function renderZone(src, streaming) {
    CHART_UID = 0;
    var opts = streaming ? { streamingSafe: true } : {};
    var ast = buildAst(src, opts);
    // 关键:只有最后一个顶层节点开 STREAMING=true(它是正在吐字的组件),
    // 其它已完成的组件视为非流式,attrs 缺失就是"用户就没写",不显示预留骨架.
    var out = ast.map(function (node, i) {
      STREAMING = streaming && i === ast.length - 1;
      return renderNode(node);
    }).join('');
    STREAMING = false;
    return out;
  }

  // ---- 主渲染入口 ----
  window.ZonePlayground = {
    load: loadParser,
    render: function (text, opts) {
      opts = opts || {};
      var streaming = !!opts.streaming;
      // skeleton 默认开;传 false 关掉,pending 灰条元素在 CSS 层面被隐藏,未完成组件不渲染
      SKELETON_ON = opts.skeleton !== false;
      return loadParser().then(function () {
        var segs = splitSegments(text);
        return segs.map(function (s, i) {
          // 每段挂 pg-slot key,让 morphdom 能按 "seg:zone:0" / "seg:md:0" 稳定匹配 —— 段落级 diff 不撞类型.
          if (s.type === 'zone') {
            return '<div class="pg-slot pg-zone-block" data-slot-for="seg-zone">' + renderZone(s.content, streaming) + '</div>';
          }
          var isLast = i === segs.length - 1;
          var mdSrc = (streaming && isLast) ? bufferMarkdown(s.content) : s.content;
          var html = window.marked ? (marked.parse ? marked.parse(mdSrc) : marked(mdSrc)) : '<pre>' + esc(mdSrc) + '</pre>';
          return '<div class="pg-slot md-render" data-slot-for="seg-md">' + html + '</div>';
        }).join('');
      });
    },
    // 注册自定义组件(扩展点,见 protocol/spec.md §10.1).同名覆盖即替换内置.
    register: function (name, fn) {
      if (typeof name !== 'string' || typeof fn !== 'function') return;
      R[name] = fn;
      KNOWN[name] = 1;
    },
    // 便捷挂载:render 出 HTML 后写进 el 并 init 图表.等价于 playground 的 render+setRenderEl+mountCharts.
    mount: function (el, text, opts) {
      if (!el) return Promise.reject(new Error('mount: el is required'));
      return window.ZonePlayground.render(text, opts).then(function (html) {
        if (window.morphdom) {
          var tpl = document.createElement('div'); tpl.innerHTML = html || '';
          window.morphdom(el, tpl, { childrenOnly: true });
        } else {
          el.innerHTML = html || '';
        }
        if (window.__mountPgCharts) window.__mountPgCharts(el);
        return html;
      });
    },
  };
  // CJS shim(供 Node 端 require 拿到引用;浏览器 <script src> 走 window.ZonePlayground)
  if (typeof module !== 'undefined' && module.exports) module.exports = window.ZonePlayground;
})();
