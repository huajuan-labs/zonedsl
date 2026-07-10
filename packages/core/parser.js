var TOKEN = {
  BLANK: 'blank',
  COMMENT: 'comment',
  COMPONENT: 'component',
  CHILD_KEYWORD: 'child_kw',
  OPTION_HEADER: 'option_header',
  TEXT: 'text',
}

var CHILD_KEYWORDS = { series: 1, row: 1, field: 1, item: 1, option: 1, step: 1, radio: 1, checkbox: 1 }

function indentOf(line) {
  var n = 0
  for (var idx = 0; idx < line.length; idx++) {
    var ch = line[idx]
    if (ch === ' ') n++
    else if (ch === '\t') n += 2
    else break
  }
  return n
}

function tokenizeLine(rawLine) {
  if (!rawLine.trim()) return { kind: TOKEN.BLANK, indent: 0, raw: rawLine }
  var indent = indentOf(rawLine)
  var body = rawLine.slice(indent)

  if (/^::\s/.test(body)) return { kind: TOKEN.COMMENT, indent: indent, raw: rawLine }

  var compMatch = /^::([a-z][a-z0-9-]*)\b\s*(.*)$/.exec(body)
  if (compMatch) {
    return { kind: TOKEN.COMPONENT, indent: indent, name: compMatch[1], rest: compMatch[2], raw: rawLine }
  }

  if (/^option:\s*$/.test(body)) return { kind: TOKEN.OPTION_HEADER, indent: indent, raw: rawLine }

  var kwMatch = /^([a-z]+)(?:\s+(.*))?$/.exec(body)
  if (kwMatch && CHILD_KEYWORDS[kwMatch[1]]) {
    return { kind: TOKEN.CHILD_KEYWORD, indent: indent, name: kwMatch[1], rest: kwMatch[2] || '', raw: rawLine }
  }

  return { kind: TOKEN.TEXT, indent: indent, body: body, raw: rawLine }
}

// opts.streamingSafe: 流式模式.此行末尾如果没有明确终止符(空格),
// 则最后一个 bare 值 attr 视为"正在吐字",不写入 attrs.
// 保证 zone 组件的 attrs 只包含"完整闭合"的键值对.
function parseAttrs(rest, opts) {
  var attrs = {}
  var main
  var src = rest || ''
  var i = 0
  var streamingSafe = !!(opts && opts.streamingSafe)

  function skipWs() { while (i < src.length && /\s/.test(src[i])) i++ }
  // 返回 { value, closed } —— closed 为 false 表示引号没闭合(流式吐到一半),
  // 上层 streamingSafe 时可据此丢弃整个 attr,避免半截 URL / 文本闪一下.
  function readQuoted() {
    i++ // skip opening quote
    var out = ''
    var closed = false
    while (i < src.length) {
      var ch = src[i]
      // 反斜杠转义:\" 表示字面双引号,\\ 表示反斜杠,其他保持原样
      if (ch === '\\' && i + 1 < src.length) {
        var next = src[i + 1]
        if (next === '"' || next === '\\') {
          out += next
          i += 2
          continue
        }
        // 保留 \n \t 等常见转义为字面 \n(供 splitCoverHighlights 后续归一化)
        out += ch
        i++
        continue
      }
      // 流式模式:如果尾部是孤立的 \ (下一字符还没到),丢弃它,避免闪出裸 \
      if (ch === '\\' && i + 1 >= src.length && streamingSafe) {
        i++
        break
      }
      if (ch === '"') { closed = true; break }
      out += ch
      i++
    }
    if (src[i] === '"') i++
    return { value: out, closed: closed }
  }
  // 返回 { value, closed, isBare }.isBare=true 时 closed 恒为 true(不需要闭合概念).
  function readBareValue() {
    if (src[i] === '"') {
      var q = readQuoted()
      return { value: q.value, closed: q.closed, isBare: false }
    }
    var start = i
    while (i < src.length && !/\s/.test(src[i])) i++
    return { value: src.slice(start, i), closed: true, isBare: true }
  }
  function coerce(v) {
    if (v === 'true') return true
    if (v === 'false') return false
    if (/^-?\d+$/.test(v)) return parseInt(v, 10)
    if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v)
    if (v.indexOf(',') !== -1) {
      // 只在"全数字"时转成数字数组,否则保持原字符串.
      // toWxNodes 里所有需要数组的地方(attrs.labels/data/indicator/value/stats 等)
      // 都有 typeof === 'string' 的 split 兜底,所以不需要 coerce 提前拆.
      // 之前"非全数字也拆成字符串数组"的行为会破坏 subtitle 等含逗号的文本 attr.
      var parts = v.split(',').map(function (s) { return s.trim() })
      var allNum = true
      for (var k = 0; k < parts.length; k++) {
        if (!/^-?\d+(\.\d+)?$/.test(parts[k])) { allNum = false; break }
      }
      if (allNum) return parts.map(Number)
      return v
    }
    return v
  }

  while (i < src.length) {
    skipWs()
    if (i >= src.length) break

    if (src[i] === '"' && main === undefined) {
      var mainQ = readQuoted()
      // 流式:main 引号未闭合 → 丢弃(下一 tick 完整了再显示,避免半截标题闪)
      if (streamingSafe && !mainQ.closed) continue
      main = mainQ.value
      continue
    }

    var tokStart = i
    while (i < src.length && !/[\s=:]/.test(src[i])) i++
    var key = src.slice(tokStart, i)
    if (!key) { i++; continue }

    if (src[i] === '=' || src[i] === ':') {
      i++
      var valStartIdx = i
      var read = readBareValue()
      // v2.8: 流式模式下,如果这个 bare 值(非引号)读到了 src 末尾,
      // 说明尾部没有空格/换行终止,可能是流式吐字中的半截值 —— 丢弃这个 attr.
      if (streamingSafe && read.isBare && i >= src.length && valStartIdx < src.length) {
        continue
      }
      // v2.9: 引号值 —— 未闭合就丢弃整个 attr(避免半截 URL / avatar / caption 闪).
      if (streamingSafe && !read.isBare && !read.closed) continue
      attrs[key] = coerce(read.value)
    } else {
      // 裸键(不带 = 的 flag,如 "selected" "checked").
      // 流式模式下如果它在 src 尾部无空格,可能是半截的 key 名(如 "selecte"),丢弃.
      if (streamingSafe && i >= src.length) {
        continue
      }
      attrs[key] = true
    }
  }

  return { main: main, attrs: attrs }
}

function looksPartial(line) {
  if (!line) return false
  var trimmed = line.replace(/\s+$/, '')
  if (!trimmed) return false
  if (/^\s*::?\s*$/.test(trimmed)) return true
  if (/=\s*$/.test(trimmed)) return true
  var quoteCount = (trimmed.match(/"/g) || []).length
  if (quoteCount % 2 === 1) return true
  if (/=\S+(?:,\S+)*,\s*$/.test(trimmed)) return true
  return false
}

function buildAst(text, opts) {
  opts = opts || {}
  var dropPartialLastLine = !!opts.dropPartialLastLine
  var dropPartialTail = !!opts.dropPartialTail
  // v2.8: streamingSafe —— 流式安全模式.尾行如果没换行结尾,parseAttrs 传 streamingSafe,
  // 让最后一个 bare 值 attr 视为"正在吐字"不写入.保证组件始终显示,attrs 只含闭合值.
  var streamingSafe = !!opts.streamingSafe
  var src = String(text || '')
  // 记录尾行是否没换行(用于给 parseAttrs 传 streamingSafe)
  var tailNoNewline = streamingSafe && src.length > 0 && src[src.length - 1] !== '\n'
  if (dropPartialLastLine && src.length && src[src.length - 1] !== '\n') {
    var lastNl = src.lastIndexOf('\n')
    src = lastNl >= 0 ? src.slice(0, lastNl + 1) : ''
  }
  if (dropPartialTail && src.length) {
    var linesTmp = src.split('\n')
    while (linesTmp.length) {
      var last = linesTmp[linesTmp.length - 1]
      if (last === '' && linesTmp.length === 1) break
      if (last === '') { linesTmp.pop(); continue }
      if (looksPartial(last)) { linesTmp.pop(); continue }
      break
    }
    src = linesTmp.join('\n')
  }

  var lines = src.split('\n')
  var root = []
  var rootContainer = { type: 'root', children: root }
  var stack = [{ depth: -2, node: rootContainer }]

  var mode = 'normal'
  var collector = null
  var collectorBase = 0

  function topDepth() { return stack[stack.length - 1].depth }
  function topNode() { return stack[stack.length - 1].node }

  function attachChild(node, depth) {
    while (stack.length > 1 && topDepth() >= depth) stack.pop()
    var parent = topNode()
    parent.children = parent.children || []
    parent.children.push(node)
    stack.push({ depth: depth, node: node })
  }

  function finalize() {
    if (!collector) return
    var txt = (collector.rawLines || []).join('\n')
    if (mode === 'md') collector.mdText = txt
    else if (mode === 'option' || mode === 'echarts_raw') collector.yaml = txt
    delete collector.rawLines
    collector = null
    mode = 'normal'
  }

  for (var lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    var raw = lines[lineIdx]
    var tok = tokenizeLine(raw)

    if (mode !== 'normal' && collector) {
      if (tok.kind === TOKEN.BLANK) {
        collector.rawLines.push('')
        continue
      }
      if (tok.indent > collectorBase) {
        var strip = collectorBase + 2
        collector.rawLines.push(raw.length >= strip ? raw.slice(strip) : raw)
        continue
      }
      finalize()
    }

    if (tok.kind === TOKEN.BLANK || tok.kind === TOKEN.COMMENT) continue

    // v2.8: 判断当前行是否是流式尾行(最后一行 + 无换行结尾) —— 用于告诉 parseAttrs 丢弃半截 attr
    var isStreamingTail = tailNoNewline && lineIdx === lines.length - 1
    var parseOpts = isStreamingTail ? { streamingSafe: true } : null

    if (tok.kind === TOKEN.COMPONENT) {
      var parsedC = parseAttrs(tok.rest, parseOpts)
      var nodeC = { type: 'component', name: tok.name, main: parsedC.main, attrs: parsedC.attrs, children: [] }
      attachChild(nodeC, tok.indent)
      if (tok.name === 'md') {
        mode = 'md'; collector = nodeC; nodeC.rawLines = []; collectorBase = tok.indent
      } else if (tok.name === 'echarts-raw') {
        mode = 'echarts_raw'; collector = nodeC; nodeC.rawLines = []; collectorBase = tok.indent
      }
      continue
    }

    if (tok.kind === TOKEN.CHILD_KEYWORD) {
      var parsedK = parseAttrs(tok.rest, parseOpts)
      var nodeK = { type: 'child', name: tok.name, main: parsedK.main, attrs: parsedK.attrs, _raw: tok.rest, children: [] }
      attachChild(nodeK, tok.indent)
      continue
    }

    if (tok.kind === TOKEN.OPTION_HEADER) {
      while (stack.length > 1 && topDepth() >= tok.indent) stack.pop()
      var parentO = topNode()
      var nodeO = { type: 'option', rawLines: [] }
      parentO.children = parentO.children || []
      parentO.children.push(nodeO)
      mode = 'option'
      collector = nodeO
      collectorBase = tok.indent
      continue
    }

    if (tok.kind === TOKEN.TEXT) {
      continue
    }
  }

  finalize()
  return root
}

module.exports = {
  TOKEN: TOKEN,
  tokenizeLine: tokenizeLine,
  parseAttrs: parseAttrs,
  buildAst: buildAst,
  looksPartial: looksPartial,
}
