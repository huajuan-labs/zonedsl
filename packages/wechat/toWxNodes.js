/**
 * ZoneDSL AST → towxml 兼容节点树
 *
 * 新架构:每个 zone 组件输出 { tag: 'zone-xxx', attrs: {...}, children: [...] }
 * 叶子组件(metric/text/tag/divider/progress/alert/quote):attrs 放所有数据,children=[]
 * 容器组件(card/row/col/grid/section/list/table/timeline):children 递归或 attrs.items/rows
 * 图表(line/bar/pie/sparkline):仍输出 tag:'echarts',attrs.value=URI-encoded JSON
 *
 * decode.wxml 里新增 zone-* 派发分支 → <zone-node item="{{item}}" />
 */

var parser = require('./parser.js')

// ========== 未知组件降级模式 ==========
// silent: 完全丢弃,不渲染任何内容(生产默认,用户视角干净)
// placeholder: 渲染极小占位,保留位置(排查空白用)
// debug: 显示"未支持"卡片 + 源码(开发排查用)
var UNKNOWN_MODE = 'silent'

// ========== button intent 白名单 (v2.0) ==========
// 详见 INTENTS.md.未在白名单里的 intent 静默忽略,button 回退到纯样式.
// value 通过 validateIntentValue 做差异化校验,不合法的整对 intent+value 丢弃.
// v2.4 收敛白名单:
//   移除 login/open-my/track-topic —— 这些由宿主按能力自行实现,不进通用白名单.
//   保留 open-topic —— 语义有价值,宿主可接入话题详情或走搜索曲线.
//   保留 share —— 各端通过原生分享能力实现(WeChat 用 <button open-type="share"> 特判).
var BUTTON_INTENT_WHITELIST = {
  // 会话相关
  'followup':      1,
  'send-message':  1,
  // 内容跳转
  'search':        1,
  'open-topic':    1,
  'open-tab':      1,
  // 通用操作
  'open-url':      1,
  'open-scheme':   1,
  'open-web':      1,
  'copy':          1,
  'share':         1,
}

// 宿主自定义:各平台的 tab 标识不同,这里给空对象作默认,宿主在分发器里按需填.
// 例如 WeChat 小程序可能 { home: 1, search: 1, profile: 1 }.
var TAB_WHITELIST = {}

// 按 intent 差异化校验 value.返回校验通过后的 value 或 null(表示丢弃 intent).
// 注意:这是 WeChat 运行时的默认校验,宿主可覆盖.通用语义见 @zonedsl/core/INTENTS.md.
function validateIntentValue(intent, rawValue) {
  var v = (rawValue == null ? '' : String(rawValue))
  switch (intent) {
    case 'followup':
    case 'send-message':
    case 'share':
      return v ? v.slice(0, 200) : null
    case 'search':
    case 'open-topic':
      return v ? v.slice(0, 50) : null
    case 'open-tab':
      return TAB_WHITELIST[v] ? v : null
    case 'open-url':
      // 宿主应自校验协议白名单(站内路径或 https 外链,拒绝 javascript: 等).
      // 默认放行非空 URL,长度截断.
      return v ? v.slice(0, 300) : null
    case 'open-scheme':
      // 宿主自定义 scheme(如 xxx://detail?id=...) → 宿主分发器解析成站内跳转
      return /^[a-z][a-z0-9+.-]*:\/\//.test(v) ? v.slice(0, 300) : null
    case 'open-web':
      // 外部 https 链接,宿主走 webview 页
      return /^https?:\/\//.test(v) ? v.slice(0, 300) : null
    case 'copy':
      return v ? v.slice(0, 500) : null
  }
  return null
}

// ========== 行内链接/引文 target 解析 (v2.12) ==========
// 把 [文字](target) 的 target 映射成 { intent, value }.规则:
//   open-xxx:值        —— 显式 intent(走白名单 + validateIntentValue)
//   xxx://...          —— 宿主自定义 scheme → open-scheme(宿主分发器解析)
//   /pages/...         —— 站内页面 → open-url
//   https?://...       —— 外部链接 → open-web(webview)
// 不合法返回 null(调用方降级为纯文本).
function parseLinkTarget(rawTarget) {
  var t = String(rawTarget == null ? '' : rawTarget).replace(/^\s+|\s+$/g, '')
  if (!t) return null
  // 显式 intent:value(intent 字母/连字符开头,避免把 xxx:// 的 scheme 名误当 intent)
  var m = /^([a-z][a-z-]*):(\S+)$/.exec(t)
  if (m && BUTTON_INTENT_WHITELIST[m[1]]) {
    var v = validateIntentValue(m[1], m[2])
    return v != null ? { intent: m[1], value: v } : null
  }
  var auto = ''
  if (/^https?:\/\//.test(t)) auto = 'open-web'
  else if (/^\/pages\//.test(t)) auto = 'open-url'
  // 宿主自定义 scheme(如 xxx://detail?id=...) —— 排除 http(s),否则 https 被误判成 open-scheme
  else if (/^[a-z][a-z0-9+.-]*:\/\//.test(t)) auto = 'open-scheme'
  if (!auto) return null
  var av = validateIntentValue(auto, t)
  return av != null ? { intent: auto, value: av } : null
}

// 从一组 attrs 里提取合法 intent/value(白名单校验).不合法返回 {}.
// 供组件级(video)和 item 级(timeline/list item)复用,保持校验逻辑只有一处.
function pickIntent(attrs) {
  var out = {}
  if (!attrs) return out
  var raw = (attrs.intent || '').toString()
  if (BUTTON_INTENT_WHITELIST[raw]) {
    var v = validateIntentValue(raw, attrs.value)
    if (v != null) { out.intent = raw; out.value = v }
  }
  return out
}

// ========== sources 引文注册表 (v2.12) ==========
// ::source 子节点 → 统一 item { n,name,url,intent,value }.
// 最小集:name + url 必需,n= 可选显式编号.账号富字段不进 DSL ——
// 引文形态由语法决定:[\^1](url)=数字徽章,[^@名](url)=昵称 chip,与 source 无关.
function parseSourceNode(c) {
  var a = (c && c.attrs) || {}
  var item = {
    n: parseInt(a.n, 10) || 0,
    name: (c && c.main) || a.name || '',
    url: a.url || a.scheme || '',
  }
  var link = parseLinkTarget(item.url)
  if (link) { item.intent = link.intent; item.value = link.value }
  return item
}

// 编号:显式 n 优先;未写的按顺序补号(跳过已被显式占用的号).
function assignSourceNumbers(items) {
  var used = {}
  items.forEach(function (it) { if (it.n > 0) used[it.n] = 1 })
  var auto = 0
  items.forEach(function (it) {
    if (it.n > 0) return
    auto++
    while (used[auto]) auto++
    it.n = auto
    used[auto] = 1
  })
  return items
}

// 从 AST 收集所有 ::source(无论在 ::sources 内还是独立) → refMap { n: item }.无来源返回 null.
function buildRefMapFromAst(ast) {
  var items = []
  walk(ast)
  function walk(list) {
    if (!list) return
    list.forEach(function (nd) {
      if (!nd || nd.type !== 'component') return
      if (nd.name === 'source') items.push(parseSourceNode(nd))
      if (nd.children) walk(nd.children)
    })
  }
  if (!items.length) return null
  assignSourceNumbers(items)
  var map = {}
  items.forEach(function (it) { if (!map[it.n]) map[it.n] = it })
  return map
}

// 消息级预扫(由 towxml 入口在抽 zone 块之前调用):从原始消息文本收集 ::source 行建 refMap.
// 一条消息 = 一个引文命名空间,sources 写在哪个块都能查到.
// 跳过非 zone 代码围栏里的 ::source 行(那是代码示例,不是真来源).
function buildSourcesRefMap(text, opts) {
  if (!text || text.indexOf('::source') === -1) return null
  var lines = String(text).split('\n')
  var items = []
  var inFence = false
  var fenceCh = ''
  var fenceLen = 0
  var fenceIsZone = false
  for (var i = 0; i < lines.length; i++) {
    var trimmed = lines[i].replace(/^\s+|\s+$/g, '')
    var fm = /^(`{3,}|~{3,})/.exec(trimmed)
    if (fm) {
      if (!inFence) {
        inFence = true
        fenceCh = fm[1][0]
        fenceLen = fm[1].length
        fenceIsZone = /^(`{3,}|~{3,})zone\b/.test(trimmed)
        continue
      }
      var closeRe = new RegExp('^\\' + fenceCh + '{' + fenceLen + ',}$')
      if (closeRe.test(trimmed)) { inFence = false }
      continue
    }
    if (inFence && !fenceIsZone) continue
    if (!/^::source(\s|$)/.test(trimmed)) continue
    var ast = parser.buildAst(trimmed, { streamingSafe: !!(opts && opts.streamingSafe) })
    var node = ast && ast[0]
    if (node && node.type === 'component' && node.name === 'source') items.push(parseSourceNode(node))
  }
  if (!items.length) return null
  assignSourceNumbers(items)
  var map = {}
  items.forEach(function (it) { if (!map[it.n]) map[it.n] = it })
  return map
}

// 宿主引文数据桥接(v2.12):宿主把后端 quote_list 截下经 towxml option.quoteList 传进来.
// 字段映射:index→n, scheme→url, name→name, label→昵称chip开关.
function quoteListToRefMap(quoteList) {
  if (!Array.isArray(quoteList) || !quoteList.length) return null
  var items = []
  quoteList.forEach(function (q) {
    if (!q) return
    var item = {
      n: parseInt(q.index, 10) || 0,
      name: q.name || '',
      url: q.scheme || '',
      label: (q.label === true || q.label === 1) ? 1 : 0,
    }
    var link = parseLinkTarget(item.url)
    if (link) { item.intent = link.intent; item.value = link.value }
    items.push(item)
  })
  if (!items.length) return null
  assignSourceNumbers(items)
  var map = {}
  items.forEach(function (it) { if (!map[it.n]) map[it.n] = it })
  return map
}

// ========== image/video fit 宽高适配白名单 (v2.11) ==========
// fit 值对 AI 友好(16:9 口语化),渲染层转 padding-bottom hack(项目不用 aspect-ratio,兼容老基础库).
// width(默认)= widthFix 向后兼容 + 流式骨架兜底;16:9/9:16/4:3/square = 固定比例容器;
// cover = 填满裁切(默认 16:9);contain = 完整留白;fixed = height attr 固定高.
var FIT_WHITELIST = { width: 1, '16:9': 1, '9:16': 1, '4:3': 1, '3:4': 1, square: 1, cover: 1, contain: 1, fixed: 1 }
function normalizeFit(raw) {
  var f = String(raw || '').replace(/^\s+|\s+$/g, '').toLowerCase()
  if (!f) return 'width'
  if (f === '1:1') return 'square'
  return FIT_WHITELIST[f] ? f : 'width'
}

// ========== 组件分层与版本注册表 ==========
// 记录每个 case 的层归属和引入版本,配合 LAYERS.md / VERSIONS.md 使用.
// 修改组件时同步更新此表. deprecated 组件在 case 里直接 return null.
var COMPONENT_REGISTRY = {
  // ---- primitive: 原语层 ----
  text:              { layer: 'primitive', since: 'v1.0' },
  tag:               { layer: 'primitive', since: 'v1.0' },
  divider:           { layer: 'primitive', since: 'v1.0' },
  badge:             { layer: 'primitive', since: 'v1.0' },
  pill:              { layer: 'primitive', since: 'v1.0' },
  icon:              { layer: 'primitive', since: 'v1.0' },
  avatar:            { layer: 'primitive', since: 'v1.0' },
  quote:             { layer: 'primitive', since: 'v1.0' },
  kicker:            { layer: 'primitive', since: 'v1.0' },
  trend:             { layer: 'primitive', since: 'v1.0' },
  tip:               { layer: 'primitive', since: 'v1.0' },
  callout:           { layer: 'primitive', since: 'v1.0' },
  display:           { layer: 'primitive', since: 'v1.0' },
  progress:          { layer: 'primitive', since: 'v1.0' },
  alert:             { layer: 'primitive', since: 'v1.0' },
  metric:            { layer: 'primitive', since: 'v1.0' },
  image:             { layer: 'primitive', since: 'v1.0' },
  video:             { layer: 'primitive', since: 'v2.11' },
  spacer:            { layer: 'primitive', since: 'v2.3' },

  // ---- structure: 结构层 ----
  card:              { layer: 'structure', since: 'v1.0' },
  section:           { layer: 'structure', since: 'v1.0' },
  row:               { layer: 'structure', since: 'v1.0' },
  col:               { layer: 'structure', since: 'v1.0' },
  grid:              { layer: 'structure', since: 'v1.0' },
  center:            { layer: 'structure', since: 'v2.9' },
  list:              { layer: 'structure', since: 'v1.0' },
  'numbered-list':   { layer: 'structure', since: 'v1.5' },
  'labeled-list':    { layer: 'structure', since: 'v1.5' },
  table:             { layer: 'structure', since: 'v1.0' },
  timeline:          { layer: 'structure', since: 'v1.0' },
  gallery:           { layer: 'structure', since: 'v1.0' },
  sources:           { layer: 'structure', since: 'v2.12', note: '引文来源列表,配合 [^n] 使用' },
  hscroll:           { layer: 'structure', since: 'v1.0' },
  swiper:            { layer: 'structure', since: 'v1.0' },
  chapter:           { layer: 'structure', since: 'v1.0' },
  'divider-fancy':   { layer: 'structure', since: 'v1.5' },
  form:              { layer: 'structure', since: 'v1.0' },

  // ---- interactive: 交互层 ----
  tabs:              { layer: 'interactive', since: 'v1.0' },
  accordion:         { layer: 'interactive', since: 'v1.0' },
  checkbox:          { layer: 'interactive', since: 'v1.0' },
  'checkbox-group':  { layer: 'interactive', since: 'v2.8' },
  radio:             { layer: 'interactive', since: 'v1.0' },
  'radio-group':     { layer: 'interactive', since: 'v1.0' },
  select:            { layer: 'interactive', since: 'v1.0' },
  textarea:          { layer: 'interactive', since: 'v1.0' },
  quiz:              { layer: 'interactive', since: 'v1.0' },
  button:            { layer: 'interactive', since: 'v1.0', note: 'v2.0+ 支持 intent 白名单交互,详见 INTENTS.md' },
  steps:             { layer: 'interactive', since: 'v1.0' },
  stairs:            { layer: 'interactive', since: 'v1.0' },
  mechanism:         { layer: 'interactive', since: 'v1.0' },

  // ---- chart: 图表层 ----
  line:              { layer: 'chart', since: 'v1.0' },
  bar:               { layer: 'chart', since: 'v1.0' },
  pie:               { layer: 'chart', since: 'v1.0' },
  sparkline:         { layer: 'chart', since: 'v1.0' },
  radar:             { layer: 'chart', since: 'v1.0' },
  ring:              { layer: 'chart', since: 'v1.0' },
  rank:              { layer: 'chart', since: 'v1.0' },
  compare:           { layer: 'chart', since: 'v1.0' },

  // ---- preset: 业务预设层 ----
  'magazine-cover':  { layer: 'preset', since: 'v1.5' },
  'city-card':       { layer: 'preset', since: 'v1.5' },
  'person-grid':     { layer: 'preset', since: 'v1.5' },
  'person-card':     { layer: 'preset', since: 'v1.5' },
  'scene-card':      { layer: 'preset', since: 'v1.5' },
  'glyph-compare':   { layer: 'preset', since: 'v1.5' },
  statement:         { layer: 'preset', since: 'v1.5' },
  'editorial-hero':  { layer: 'preset', since: 'v1.5' },
  'editorial-pullquote': { layer: 'preset', since: 'v1.5' },
  'editorial-summary':   { layer: 'preset', since: 'v1.5' },
  'editorial-stat':      { layer: 'preset', since: 'v1.5' },
  'editorial-image':     { layer: 'preset', since: 'v1.5' },
  'fact-bar':        { layer: 'preset', since: 'v1.5' },
  'data-board':      { layer: 'preset', since: 'v1.5' },
  'step-block':      { layer: 'preset', since: 'v1.5' },
  'icon-grid':       { layer: 'preset', since: 'v1.5' },
  'era-timeline':    { layer: 'preset', since: 'v2.1' },
  'media-card':      { layer: 'preset', since: 'v2.1' },

  // ---- 已移除 (v1.6) ----
  // 'echarts-raw':  removed v1.6, 使用 line/bar/pie/radar 替代
  // 'tree':         removed v1.6, 使用 step-block/timeline/mechanism 替代
}

// ========== 工具:option merge / 深路径 ==========
function setDeep(target, path, value) {
  var parts = path.split('.')
  var obj = target
  for (var i = 0; i < parts.length - 1; i++) {
    var k = parts[i]
    if (obj[k] == null || typeof obj[k] !== 'object') obj[k] = {}
    obj = obj[k]
  }
  obj[parts[parts.length - 1]] = value
}

// 极简 YAML 解析(只支持 key: value / 缩进嵌套 / 数组 [-] 起头 / 数字/布尔字面量)
function parseSimpleYaml(text) {
  if (!text) return {}
  var lines = String(text).split('\n')
  var root = {}
  var stack = [{ indent: -1, obj: root }]

  function coerce(v) {
    v = String(v).replace(/^\s+|\s+$/g, '')
    if (v === '') return ''
    if (v === 'true') return true
    if (v === 'false') return false
    if (v === 'null') return null
    if (/^-?\d+$/.test(v)) return parseInt(v, 10)
    if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v)
    if ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'")) {
      return v.slice(1, -1)
    }
    if (v[0] === '[' && v[v.length - 1] === ']') {
      return v.slice(1, -1).split(',').map(function (s) { return coerce(s) })
    }
    return v
  }

  for (var idx = 0; idx < lines.length; idx++) {
    var raw = lines[idx]
    if (!raw.trim()) continue
    var indent = 0
    for (var c = 0; c < raw.length; c++) { if (raw[c] === ' ') indent++; else break }
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop()
    var parent = stack[stack.length - 1].obj

    var body = raw.slice(indent)
    if (body[0] === '-' && (body[1] === ' ' || body.length === 1)) {
      var val = body.slice(1).replace(/^\s+/, '')
      if (!Array.isArray(parent)) continue
      if (val === '') {
        var itemObj = {}
        parent.push(itemObj)
        stack.push({ indent: indent, obj: itemObj })
      } else {
        parent.push(coerce(val))
      }
      continue
    }
    var m = /^([^:\s]+):\s*(.*)$/.exec(body)
    if (m) {
      var key = m[1]
      var valStr = m[2]
      if (valStr === '') {
        var child = {}
        parent[key] = child
        stack.push({ indent: indent, obj: child })
      } else {
        parent[key] = coerce(valStr)
      }
    }
  }
  return root
}

// ========== 图表转 echarts option ==========
function toEchartsNode(node) {
  var name = node.name
  var attrs = node.attrs || {}
  var main = node.main || ''
  var titleObj
  if (main || attrs.subtitle) {
    titleObj = {
      text: main || '',
      subtext: attrs.subtitle || '',
      left: 'center',
      textStyle: { fontSize: 14, color: '#1a1a1a' },
      subtextStyle: { fontSize: 11, color: '#666' },
    }
  }
  var opt = {
    title: titleObj,
    tooltip: { trigger: name === 'pie' ? 'item' : 'axis' },
    grid: { left: 40, right: 20, top: titleObj ? (attrs.subtitle ? 56 : 40) : 20, bottom: 30, containLabel: true },
    color: ['#FF8200', '#FFA726', '#38bdf8', '#22a065', '#ef4444', '#3b82f6'],
  }

  var labels = attrs.labels || []
  if (typeof labels === 'string') labels = labels.split(',').map(function (s) { return s.trim() })
  var data = attrs.data || []
  if (typeof data === 'string') {
    data = data.split(',').map(function (s) { return parseFloat(s) || s })
  }

  if (name === 'line' || name === 'bar') {
    opt.xAxis = { type: 'category', data: labels }
    opt.yAxis = { type: 'value' }
    opt.series = [{
      type: name,
      data: data,
      smooth: name === 'line' && (attrs.smooth != null ? attrs.smooth : true),
      areaStyle: (name === 'line' && attrs.area) ? { opacity: 0.25 } : undefined,
      itemStyle: attrs.color ? { color: attrs.color } : undefined,
    }]
  } else if (name === 'sparkline') {
    opt.xAxis = { type: 'category', data: labels, show: false }
    opt.yAxis = { type: 'value', show: false }
    opt.grid = { left: 0, right: 0, top: 0, bottom: 0 }
    opt.tooltip = undefined
    opt.series = [{
      type: 'line', data: data, smooth: true, symbol: 'none',
      lineStyle: { width: 2 },
      areaStyle: { opacity: 0.2 },
    }]
    delete opt.title
  } else if (name === 'pie') {
    opt.xAxis = undefined
    opt.yAxis = undefined
    opt.grid = undefined
    var pieData = []
    if (Array.isArray(labels) && Array.isArray(data) && labels.length === data.length) {
      for (var pi = 0; pi < labels.length; pi++) {
        pieData.push({ name: labels[pi], value: data[pi] })
      }
    }
    var seriesChildren = (node.children || []).filter(function (c) { return c.type === 'child' && c.name === 'series' })
    if (seriesChildren.length) {
      pieData = seriesChildren.map(function (c) { return { name: c.main || '', value: (c.attrs && c.attrs.value) || 0 } })
    }
    var pieRadius = attrs.radius || '55%'
    if (attrs.donut) pieRadius = ['30%', '55%']
    opt.series = [{
      type: 'pie',
      radius: pieRadius,
      center: ['50%', main ? '55%' : '50%'],
      data: pieData,
      label: { formatter: attrs.unit ? '{b}: {c}' + String(attrs.unit) : '{b}: {c}' },
    }]
  }

  // option yaml 覆盖
  var optionChild = (node.children || []).find(function (c) { return c.type === 'option' })
  if (optionChild && optionChild.yaml) {
    var override = parseSimpleYaml(optionChild.yaml)
    for (var pk in override) {
      if (pk.indexOf('.') !== -1) {
        setDeep(opt, pk, override[pk])
      } else if (opt[pk] != null && typeof opt[pk] === 'object' && typeof override[pk] === 'object' && !Array.isArray(override[pk])) {
        for (var subK in override[pk]) opt[pk][subK] = override[pk][subK]
      } else {
        opt[pk] = override[pk]
      }
    }
  }

  var chartH = attrs.height || attrs.h
  var payload = chartH ? { option: opt, height: chartH } : opt
  return {
    tag: 'echarts',
    attrs: {
      'class': 'zone-chart',
      'value': encodeURIComponent(JSON.stringify(payload)),
    },
    children: [],
  }
}

// ========== 行内 markdown 拆分 ==========
// 把 "**紧急** 优先级 `code`" 拆成 [{type:'bold',text:'紧急'},{type:'text',text:' 优先级 '},{type:'code',text:'code'}]
// 支持:**bold** / *italic* / `code`
// opts.streamingSafe: 流式态下,未配对的标记符号(** / ` / 单 *)裁到最后一个未闭合标记之前,
//   避免半截标记当裸字符闪(**紧急 → 空,等 **紧急** 到了再整体显示).非流式/最终态不裁,正则照旧.
//   详见 spec §4.5.裁剪顺序 ** → ` → 单 *(单 * 计数前先剔除 **),对齐 web-renderer.js bufferMarkdown().
function splitInlineMd(text, opts) {
  if (!text || typeof text !== 'string') return [{ type: 'text', text: String(text || '') }]
  var streamingSafe = !!(opts && opts.streamingSafe)
  var refMap = (opts && opts.refMap) || null
  if (streamingSafe) {
    text = trimUnclosedInline(text)
  }
  var re = /(\[\^(@[^\]]+)\]\(([^)\s]*)\)|\[\^(\d+)\]\(([^)\s]*)\)|\[\^(\d+)\]|\[([^\]]+)\]\(([^)\s]*)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  var parts = []
  var last = 0
  var m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', text: text.slice(last, m.index) })
    if (m[2] !== undefined) {
      // [^@名](url) 行内昵称 chip
      parts.push(makeInlineCite(m[2], 1, m[3]))
    } else if (m[4] !== undefined) {
      // [^1](url) 行内数字徽章
      parts.push(makeInlineCite(m[4], 0, m[5]))
    } else if (m[6] !== undefined) {
      // [^n] 裸引文(注册表)
      parts.push(makeCitePart(parseInt(m[6], 10), refMap))
    } else if (m[7] !== undefined) {
      // [文字](target) 链接 / [@名](url) 提及
      var link = parseLinkTarget(m[8])
      if (link) {
        var linkPart = { type: 'link', text: m[7], intent: link.intent, value: link.value }
        // @ 开头 → 橙色提及(不看 url);name 存 @ 后的昵称,供跳转用户主页用
        if (m[7].charAt(0) === '@') { linkPart.mention = 1; linkPart.name = m[7].slice(1) }
        parts.push(linkPart)
      } else {
        // target 不合法 → 降级为纯文本(保文字,丢掉标记和 target)
        parts.push({ type: 'text', text: m[7] })
      }
    }
    else if (m[9]) parts.push({ type: 'bold', text: m[9] })
    else if (m[10]) parts.push({ type: 'italic', text: m[10] })
    else if (m[11]) parts.push({ type: 'code', text: m[11] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) })
  if (!parts.length) parts.push({ type: 'text', text: text })
  return parts
}

// 由 ref 序号 + refMap 构建 cite part.
// 命中:带 intent/value 可点;未命中(dangling)或 url 非法:dead 徽章,不崩.
// 形态:source 带 label=1(来自宿主 quote_list)→ @昵称 chip;否则数字徽章.
// display: 渲染文本 —— chip=@名;徽章=序号.
function makeCitePart(ref, refMap) {
  var src = refMap && refMap[ref]
  if (!src) return { type: 'cite', ref: ref, dead: 1, display: String(ref), text: String(ref) }
  var label = src.label ? 1 : 0
  var part = { type: 'cite', ref: ref, label: label }
  part.display = label ? ('@' + (src.name || ref)) : String(ref)
  // text 兜底:杂志封面/章节标题等只认 p.text 的渲染分支里,引文至少显示文本(不可点)
  part.text = part.display
  var link = parseLinkTarget(src.url || '')
  if (link) { part.intent = link.intent; part.value = link.value }
  else part.dead = 1
  return part
}

// 行内自包含引文(v2.12):[^1](url) 数字徽章 / [^@名](url) 昵称 chip.
// 和注册表 [^n] 的区别:自包含 —— url 直接写在 () 里,不查 refMap,一次性引用首选.
// label: 1=昵称 chip,0=数字徽章.url 非法 → dead 降级(不崩).
function makeInlineCite(display, label, url) {
  var part = { type: 'cite', label: label, display: display, text: display }
  var link = parseLinkTarget(url || '')
  if (link) { part.intent = link.intent; part.value = link.value }
  else part.dead = 1
  return part
}

// 流式态:把行内文本里"未配对"的标记符号及之后内容裁掉.
// 裁剪顺序 ** → ` → 单 *(单 * 计数前剔除 **)→ [^n] → [text]( → 裸 [,每个符号奇数次才裁.
// 算法对齐 web-renderer.js bufferMarkdown(),保证跨端一致(spec §9).
// v2.12: 补 [ 系列裁剪 —— 引文 [^1 / 链接 [文字](url 半截时不闪裸符号.
function trimUnclosedInline(text) {
  if (!text) return text
  var s = String(text)
  // ** (加粗) —— 偶数才闭合
  var stars = (s.match(/\*\*/g) || []).length
  if (stars % 2 === 1) {
    var idx = s.lastIndexOf('**')
    s = s.slice(0, idx)
  }
  // ` (行内代码)
  var backticks = (s.match(/`/g) || []).length
  if (backticks % 2 === 1) {
    var bidx = s.lastIndexOf('`')
    s = s.slice(0, bidx)
  }
  // 单 * 斜体(不能和 ** 冲突,先剔除 ** 再数)
  var singleStars = (s.replace(/\*\*/g, '').match(/\*/g) || []).length
  if (singleStars % 2 === 1) {
    // 找最后一个孤立 *(前后都不是 *)
    var lastStar = -1
    for (var i = s.length - 1; i >= 0; i--) {
      if (s[i] === '*' && s[i - 1] !== '*' && s[i + 1] !== '*') { lastStar = i; break }
    }
    if (lastStar >= 0) s = s.slice(0, lastStar)
  }
  // [ 系列(引文 [^n] / 链接 [text](url)) —— 找最后一个未闭合的 [
  s = trimUnclosedBracket(s)
  return s
}

// 裁掉末尾未闭合的 [ 起始标记.三种半截形态:
//   [^1     → 引文半截(有 [^ 无 ])
//   [文字](  → 链接半截(有 [text]( 无 ))
//   [文字    → 裸 [ 未闭合(可能是引文或链接的前缀)
// 已闭合的 [^1] / [text](url) 不动;普通 Array[0] 这类非标记用法也不裁(无 ^ 且无后续().
function trimUnclosedBracket(s) {
  if (!s || s.indexOf('[') === -1) return s
  var i = s.length - 1
  while (i >= 0) {
    var idx = s.lastIndexOf('[', i)
    if (idx === -1) break
    var rest = s.slice(idx)
    if (rest.charAt(1) === '^') {
      // [^ 引文:找 ] 或 ( 。均无 → 半截,裁掉
      if (rest.indexOf(']') === -1) return s.slice(0, idx)
    } else {
      // 普通 [ :可能是链接 [text](url) 前缀。有 ]( 才算链接;否则是数组/文本用法,不动
      var close = rest.indexOf(']')
      if (close !== -1 && rest.charAt(close + 1) === '(' && rest.indexOf(')') === -1) {
        return s.slice(0, idx)
      }
    }
    i = idx - 1
  }
  return s
}

// ========== magazine-cover 标题/副标题行内高亮拆分 ==========
// **text** → 主色高亮底黑字   ~~text~~ → 浅色高亮底主色字   ==text== → 主色字
// `\n` 或字面量 `\n`(反斜杠+n) → 换行(part.type='break')
// opts.streamingSafe: 流式态下,每行未配对的 ** / ~~ / == 裁到最后一个未闭合标记前.详见 spec §4.5.
function splitCoverHighlights(text, opts) {
  if (!text || typeof text !== 'string') return [{ type: 'text', text: String(text || '') }]
  var streamingSafe = !!(opts && opts.streamingSafe)
  // parser 从 attrs 值里读出的 `\n` 是字面量两字符(反斜杠+n),先归一化成真实换行
  var normalized = String(text).replace(/\\n/g, '\n')
  var lines = normalized.split('\n')
  var out = []
  for (var li = 0; li < lines.length; li++) {
    var ln = lines[li]
    if (streamingSafe) {
      ln = trimUnclosedCover(ln)
    }
    var re = /(\*\*([^*]+)\*\*|~~([^~]+)~~|==([^=]+)==)/g
    var last = 0
    var m
    while ((m = re.exec(ln)) !== null) {
      if (m.index > last) out.push({ type: 'text', text: ln.slice(last, m.index) })
      if (m[2]) out.push({ type: 'highlight', style: 'primary', text: m[2] })
      else if (m[3]) out.push({ type: 'highlight', style: 'soft', text: m[3] })
      else if (m[4]) out.push({ type: 'colored', text: m[4] })
      last = m.index + m[0].length
    }
    if (last < ln.length) out.push({ type: 'text', text: ln.slice(last) })
    // 裁剪后整行空(半截标记被裁光)→ 占位一个空 text,避免落到下面兜底用原始 text 闪裸符号
    else if (streamingSafe && ln === '' && lines[li] !== '') out.push({ type: 'text', text: '' })
    if (li < lines.length - 1) out.push({ type: 'break' })
  }
  if (!out.length) out.push({ type: 'text', text: text })
  return out
}

// 流式态:magazine-cover/chapter/editorial-hero 的单行高亮标记裁剪.
// 裁剪顺序 ** → ~~ → ==,每个符号奇数次才裁.对齐 web-renderer.js inline() 行 191-198.
function trimUnclosedCover(line) {
  if (!line) return line
  var s = String(line)
  var stars = (s.match(/\*\*/g) || []).length
  if (stars % 2 === 1) s = s.slice(0, s.lastIndexOf('**'))
  var tildes = (s.match(/~~/g) || []).length
  if (tildes % 2 === 1) s = s.slice(0, s.lastIndexOf('~~'))
  var eqs = (s.match(/==/g) || []).length
  if (eqs % 2 === 1) s = s.slice(0, s.lastIndexOf('=='))
  return s
}

// ========== 结构化子节点过滤 ==========
function isStructuralChild(c) {
  return c && c.type === 'child'
}

// v2.12: table cell 引号感知分隔 —— 单元格内容带逗号时用 | 分隔,逗号保留向后兼容
function splitCells(str) {
  var s = String(str == null ? '' : str)
  var sep = s.indexOf('|') !== -1 ? '|' : ','
  return s.split(sep).map(function (x) { return x.replace(/^\s+|\s+$/g, '') })
}

// ========== 组件 → 新 tag-based 节点 ==========
function zoneToNode(node, ctx) {
  if (!node || node.type !== 'component') return null
  ctx = ctx || {}
  var name = node.name
  var main = node.main || ''
  var attrs = node.attrs || {}

  // 通用子节点:过滤掉 child 类型和 option 伪节点,其余递归(透传 ctx 保持 streamingSafe)
  var kids = (node.children || [])
    .filter(function (c) {
      if (isStructuralChild(c)) return false
      if (c && c.type === 'component' && c.name === 'option') return false
      if (name === 'table' && c && c.type === 'component' && (c.name === 'field' || c.name === 'row')) return false
      if (name === 'list' && c && c.type === 'component' && c.name === 'item') return false
      if (name === 'timeline' && c && c.type === 'component' && c.name === 'item') return false
      if (name === 'pie' && c && c.type === 'component' && c.name === 'series') return false
      if ((name === 'tabs' || name === 'accordion' || name === 'rank' || name === 'ranking' || name === 'quiz') && c && c.type === 'component' && c.name === 'item') return false
      if ((name === 'steps' || name === 'stairs' || name === 'mechanism') && c && c.type === 'component' && c.name === 'step') return false
      if ((name === 'step-block' || name === 'steps-block') && c && c.type === 'component' && (c.name === 'item' || c.name === 'step')) return false
      if ((name === 'icon-grid' || name === 'tip-grid') && c && c.type === 'component' && c.name === 'item') return false
      if (name === 'quiz' && c && c.type === 'component' && c.name === 'option') return false
      if (name === 'compare' && c && c.type === 'component' && c.name === 'item') return false
      if ((name === 'era-timeline' || name === 'history-strip') && c && c.type === 'component' && c.name === 'item') return false
      return true
    })
    .map(function (c) { return zoneToNode(c, ctx) }).filter(Boolean)

  switch (name) {

    // ---- 叶子:divider ----
    case 'divider':
      return { tag: 'zone-divider', attrs: {}, children: [] }

    // ---- 叶子:spacer(留白) ----
    // h=xs/sm/md/lg/xl 或精确 rpx 数值(如 h=24 或 h=24rpx).
    // 让 AI 显式表达"留白意图",避免用空 text/hr 硬撑.
    case 'spacer':
    case 'gap': {
      var spH = attrs.h || attrs.height || main || 'md'
      var spSize = 'md'
      var spCustom = ''
      if (/^\d+(rpx|px)?$/.test(String(spH))) {
        spCustom = /rpx|px$/.test(String(spH)) ? String(spH) : (String(spH) + 'rpx')
        spSize = ''
      } else {
        spSize = String(spH).toLowerCase()
        if (!/^(xs|sm|md|lg|xl)$/.test(spSize)) spSize = 'md'
      }
      return { tag: 'zone-spacer', attrs: { size: spSize, custom: spCustom }, children: [] }
    }

    // ---- 叶子:text ----
    case 'text':
      return {
        tag: 'zone-text',
        attrs: {
          main: main,
          size: attrs.size || '',
          align: attrs.align === 'center' ? 'center' : 'left',
          parts: splitInlineMd(main, ctx),
        },
        children: [],
      }

    // ---- 叶子:tag ----
    case 'tag':
      return { tag: 'zone-tag', attrs: { main: main, color: attrs.color || 'accent' }, children: [] }

    // ---- 叶子:alert ----
    case 'alert': {
      var alertType = attrs.type || attrs.color || 'info'
      var iconStr = alertType === 'danger' ? '⚠' : alertType === 'success' ? '✓' : (alertType === 'warn' || alertType === 'warning') ? '!' : 'ⓘ'
      return { tag: 'zone-alert', attrs: { main: main, type: alertType, icon: iconStr, parts: splitInlineMd(main, ctx) }, children: [] }
    }

    // ---- 叶子:metric ----
    case 'metric': {
      var trend = attrs.trend != null ? String(attrs.trend) : ''
      var trendDir = ''
      if (trend.indexOf('↑') === 0) trendDir = 'up'
      else if (trend.indexOf('↓') === 0) trendDir = 'down'
      else if (trend) trendDir = 'flat'
      return {
        tag: 'zone-metric',
        attrs: {
          main: main,
          trend: trend,
          trendDir: trendDir,
          desc: attrs.desc != null ? String(attrs.desc) : '',
          color: attrs.color || 'accent',
          align: attrs.align === 'center' ? 'center' : 'left',
        },
        children: [],
      }
    }

    // ---- 叶子:progress ----
    case 'progress': {
      var pct = Math.max(0, Math.min(100, parseFloat(attrs.value != null ? attrs.value : main) || 0))
      return {
        tag: 'zone-progress',
        attrs: { value: pct, label: attrs.label || '', color: attrs.color || 'accent' },
        children: [],
      }
    }

    // ---- 叶子:quote ----
    case 'quote':
      return {
        tag: 'zone-quote',
        attrs: {
          main: main,
          cite: attrs.cite || '',
          // v2.12: main 走行内解析,引文 [^n] 和链接 [文字](target) 在引用块里也能用
          parts: splitInlineMd(main, ctx),
        },
        children: [],
      }

    // ---- sources 引文来源注册表 (v2.12) ----
    // ::sources 是纯数据组件,自身不渲染 —— 唯一职责是把 ::source 子项喂给 refMap,
    // 供 [^n] 引文徽章/chip 解析.(buildRefMapFromAst 在 zoneToNode 之前就已扫 AST 收集)
    case 'sources':
    case 'source':
      return null

    // ---- 结构消费:list ----
    case 'list': {
      var listItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it) {
          // child 类型:文本在 _raw;component 类型(::item):文本在 main
          // child 类型:若 main 已被 parser 提取则用它,否则用 _raw(裸文本无引号情况)
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          var itDesc = (it.attrs && it.attrs.desc) || ''
          var liIntent = pickIntent(it.attrs)
          return {
            main: itMain,
            desc: itDesc,
            // v2.12: item 文本走行内解析,支持引文/链接
            mainParts: splitInlineMd(itMain, ctx),
            descParts: itDesc ? splitInlineMd(itDesc, ctx) : null,
            // v2.12: item 级可点击
            intent: liIntent.intent || '',
            value: liIntent.value || '',
          }
        })
      return { tag: 'zone-list', attrs: { main: main, items: listItems }, children: [] }
    }

    // ---- 结构消费:numbered-list / ol ----
    case 'numbered-list':
    case 'ol': {
      var olItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it, idx) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return { main: itMain, desc: (it.attrs && it.attrs.desc) || '', index: idx + 1 }
        })
      return { tag: 'zone-numbered-list', attrs: { main: main, items: olItems }, children: [] }
    }

    // ---- 结构消费:table ----
    case 'table': {
      var fields = (node.children || []).filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'field' })
      var rows = (node.children || []).filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'row' })

      var headerLabels = []
      if (fields.length) {
        // child 类型:文本在 _raw;component 类型(::field):文本在 main
        headerLabels = fields.map(function (f) {
          return f.main || (f._raw || '').replace(/^\s+|\s+$/g, '')
        })
      } else if (attrs.cols) {
        var colsAttr = attrs.cols
        if (typeof colsAttr === 'string') colsAttr = colsAttr.split(',').map(function (s) { return s.replace(/^\s+|\s+$/g, '') })
        if (Array.isArray(colsAttr)) headerLabels = colsAttr.map(String)
      }

      var colCount = headerLabels.length
      if (!colCount && rows.length) {
        var firstR = rows[0]
        var firstCells = (firstR.attrs && firstR.attrs.cells) || []
        if (typeof firstCells === 'string') firstCells = splitCells(firstCells)
        if ((!Array.isArray(firstCells) || !firstCells.length) && firstR._raw) {
          firstCells = splitCells(firstR._raw)
        }
        colCount = firstCells.length || 3
      }
      var cellsCount = Math.max(1, Math.min(6, colCount))

      // v2.12: cells 用引号感知分隔(内容带逗号用引号包裹),且每个 cell 走行内解析支持引文/链接
      var tableRows = rows.map(function (r) {
        var cells = (r.attrs && r.attrs.cells) || []
        if (typeof cells === 'string') cells = splitCells(cells)
        if ((!Array.isArray(cells) || !cells.length) && r._raw) {
          cells = splitCells(r._raw)
        }
        return cells.map(function (cellText) {
          var txt = String(cellText)
          return { text: txt, parts: splitInlineMd(txt, ctx) }
        })
      })
      var cellsCount = Math.max(1, Math.min(6, colCount))

      return {
        tag: 'zone-table',
        attrs: { main: main, headers: headerLabels, rows: tableRows, cellsCount: cellsCount },
        children: [],
      }
    }

    // ---- 结构消费:timeline ----
    case 'timeline': {
      var tlItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          var itDesc = (it.attrs && it.attrs.desc) || ''
          var tlIntent = pickIntent(it.attrs)
          return {
            when: (it.attrs && it.attrs.when) || '',
            main: itMain,
            desc: itDesc,
            tag: (it.attrs && it.attrs.tag) || '',
            location: (it.attrs && it.attrs.location) || '',
            highlight: !!(it.attrs && it.attrs.highlight),
            // v2.12: item 文本走行内解析,支持引文/链接
            mainParts: splitInlineMd(itMain, ctx),
            descParts: itDesc ? splitInlineMd(itDesc, ctx) : null,
            // v2.12: item 级可点击,每个事件独立跳转
            intent: tlIntent.intent || '',
            value: tlIntent.value || '',
          }
        })
      return { tag: 'zone-timeline', attrs: { main: main, items: tlItems }, children: [] }
    }

    // ---- 结构消费:fact-bar ----
    case 'fact-bar': {
      var factItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return {
            label: itMain,
            value: (it.attrs && it.attrs.value) || '',
          }
        })
      return { tag: 'zone-fact-bar', attrs: { main: main, items: factItems }, children: [] }
    }

    // ---- 结构消费:data-board ----
    case 'data-board': {
      var boardItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return {
            label: itMain,
            value: (it.attrs && it.attrs.value) || '',
            desc: (it.attrs && it.attrs.desc) || '',
            tag: (it.attrs && it.attrs.tag) || '',
          }
        })
      var boardCols = Math.max(1, Math.min(4, parseInt(attrs.cols, 10) || 2))
      var boardLayout = attrs.layout || 'grid'
      return {
        tag: 'zone-data-board',
        attrs: { main: main, items: boardItems, cols: boardCols, layout: boardLayout },
        children: [],
      }
    }

    // ---- 结构消费:step-block(米色块列表,Step 1-N) ----
    case 'step-block':
    case 'steps-block': {
      var sbItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && (c.name === 'item' || c.name === 'step') })
        .map(function (it, idx) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return {
            index: idx + 1,
            label: (it.attrs && it.attrs.label) || ('Step ' + (idx + 1)),
            main: itMain,
            desc: (it.attrs && it.attrs.desc) || '',
          }
        })
      return { tag: 'zone-step-block', attrs: { main: main, items: sbItems }, children: [] }
    }

    // ---- 结构消费:icon-grid(emoji 网格,4/2×2 布局) ----
    case 'icon-grid':
    case 'tip-grid': {
      var igItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return {
            icon: (it.attrs && it.attrs.icon) || '',
            main: itMain,
            desc: (it.attrs && it.attrs.desc) || '',
          }
        })
      var igCols = Math.max(1, Math.min(4, parseInt(attrs.cols, 10) || 2))
      return { tag: 'zone-icon-grid', attrs: { main: main, items: igItems, cols: igCols }, children: [] }
    }

    // ---- 叶子:divider-fancy(装饰分隔线,// 章节标记) ----
    case 'divider-fancy':
    case 'section-mark': {
      return {
        tag: 'zone-divider-fancy',
        attrs: {
          main: main,
          prefix: attrs.prefix || '//',
        },
        children: [],
      }
    }

    // ---- 结构消费:labeled-list ----
    case 'labeled-list': {
      var labeledItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return {
            label: itMain,
            desc: (it.attrs && it.attrs.desc) || '',
            tag: (it.attrs && it.attrs.tag) || '',
            color: (it.attrs && it.attrs.color) || 'accent',
          }
        })
      return { tag: 'zone-labeled-list', attrs: { main: main, items: labeledItems }, children: [] }
    }

    // ---- 结构消费:glyph-compare ----
    case 'glyph-compare':
    case 'character-compare': {
      var glyphItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return {
            glyph: itMain,
            label: (it.attrs && it.attrs.label) || '',
            desc: (it.attrs && it.attrs.desc) || '',
          }
        })
      return { tag: 'zone-glyph-compare', attrs: { main: main, items: glyphItems }, children: [] }
    }

    // ---- 容器:statement ----
    case 'statement': {
      return {
        tag: 'zone-statement',
        attrs: {
          title: main || attrs.title || '',
          author: attrs.author || '',
          time: attrs.time || '',
          source: attrs.source || '',
          avatar: attrs.avatar || '',
        },
        children: kids,
      }
    }

    // ---- 容器:section ----
    case 'section':
      return { tag: 'zone-section', attrs: { main: main }, children: kids }

    // ---- 容器:magazine-cover ----
    case 'magazine-cover':
    case 'cover': {
      var statsArr = []
      if (attrs.stats) {
        var rawStats = typeof attrs.stats === 'string' ? attrs.stats.split(',').map(function (s) { return s.trim() }) : attrs.stats
        statsArr = rawStats.map(function (s) {
          var text = String(s)
          // 匹配前缀数字部分(可含 . / h+ / % 等符号),用于染色
          var m = /^([0-9][0-9,.h+%]*)\s*(.*)$/.exec(text)
          if (m) {
            return { num: m[1], rest: m[2], text: text }
          }
          return { num: '', rest: text, text: text }
        })
      }
      var titleText = main || attrs.title || ''
      var subtitleText = attrs.subtitle || ''
      return {
        tag: 'zone-magazine-cover',
        attrs: {
          tag: attrs.tag || '',
          date: attrs.date || '',
          title: titleText,
          titleParts: splitCoverHighlights(titleText, ctx),
          highlight: attrs.highlight || '',
          subtitle: subtitleText,
          subtitleParts: splitCoverHighlights(subtitleText, ctx),
          stats: statsArr,
          footnote: attrs.footnote || '',
          badge: attrs.badge || '',
          bg: attrs.bg || 'light',
          bgUrl: attrs.bgUrl || attrs['bg-url'] || '',
          // v2.5: align=center 支持居中排版,默认 left 保持向后兼容
          align: attrs.align === 'center' ? 'center' : 'left',
          tagStyle: (function () {
            // 白名单: pill(默认白胶囊) / light(米色描边) / dark(深炭底) / accent(橙底)
            var raw = attrs.tagStyle || attrs['tag-style'] || 'pill'
            var TAG_STYLES = { pill: 1, light: 1, dark: 1, accent: 1 }
            return TAG_STYLES[raw] ? raw : 'pill'
          })(),
        },
        children: [],
      }
    }

    // ---- 容器:card ----
    case 'card': {
      var variant = attrs.v || attrs.variant || 'default'
      return { tag: 'zone-card', attrs: { main: main, variant: variant }, children: kids }
    }

    // ---- 容器:row(v2.9: 支持 align=center 让子组件居中) ----
    case 'row':
      return { tag: 'zone-row', attrs: { align: attrs.align === 'center' ? 'center' : '' }, children: kids }

    // ---- 容器:center(v2.9: 通用居中包装器,零参数,双向 flex 居中,宽度 100%) ----
    case 'center':
      return { tag: 'zone-center', attrs: {}, children: kids }

    // ---- 容器:person-grid ----
    case 'person-grid': {
      var personCols = Math.max(1, Math.min(4, parseInt(attrs.cols, 10) || 2))
      return { tag: 'zone-person-grid', attrs: { cols: personCols }, children: kids }
    }

    // ---- 叶子:person-card ----
    case 'person-card':
    case 'person': {
      return {
        tag: 'zone-person-card',
        attrs: {
          name: main || attrs.name || '',
          desc: attrs.desc || '',
          avatar: attrs.avatar || attrs.url || attrs.src || '',
        },
        children: [],
      }
    }

    // ---- 叶子:scene-card ----
    case 'scene-card':
    case 'moment-card': {
      var sceneTags = []
      if (attrs.tags) {
        sceneTags = typeof attrs.tags === 'string' ? attrs.tags.split(',').map(function (s) { return s.trim() }) : attrs.tags
      }
      return {
        tag: 'zone-scene-card',
        attrs: {
          icon: attrs.icon || '',
          title: main || attrs.title || '',
          desc: attrs.desc || '',
          tags: sceneTags,
          rank: attrs.rank || '',
          badge: attrs.badge || '',
        },
        children: kids,
      }
    }

    // ---- 叶子:era-timeline 横向历史时间条 ----
    // 参考图 1 (梅雨季) 里 1954 / 1998 那种米色横向卡片列表
    // v2.5: 自动 layout —— ≤3 张走 2 列网格,4+ 张走横滑(最后一张露半张暗示可滑)
    // 也可 layout=grid/scroll 手动指定
    case 'era-timeline':
    case 'history-strip': {
      var eraItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return {
            year: (it.attrs && it.attrs.year) || itMain,
            label: (it.attrs && it.attrs.label) || '',
            desc: (it.attrs && it.attrs.desc) || '',
          }
        })
      // 自动 layout: 只有能被 2 整除(2/4)才走 grid,其他(1/3/5+)走 scroll
      // 避免"3 张里最后一张孤儿"的尴尬布局
      var eraLayout = attrs.layout
      if (eraLayout !== 'grid' && eraLayout !== 'scroll') {
        var n = eraItems.length
        eraLayout = (n === 2 || n === 4) ? 'grid' : 'scroll'
      }
      return {
        tag: 'zone-era-timeline',
        attrs: { main: main, items: eraItems, layout: eraLayout },
        children: [],
      }
    }

    // ---- 叶子:media-card 图片+叠加标题的杂志卡片 ----
    case 'media-card': {
      var mediaTags = []
      if (attrs.tags) {
        mediaTags = typeof attrs.tags === 'string' ? attrs.tags.split(',').map(function (s) { return s.trim() }) : attrs.tags
      }
      return {
        tag: 'zone-media-card',
        attrs: {
          url: attrs.url || attrs.src || '',
          title: main || attrs.title || '',
          subtitle: attrs.subtitle || '',
          tag: attrs.tag || '',
          tags: mediaTags,
          height: attrs.height || attrs.h || 360,
          align: attrs.align || 'bottom',  // top / center / bottom
          overlay: attrs.overlay || 'gradient',  // gradient / solid / none
        },
        children: [],
      }
    }

    // ---- 叶子:city-card / itinerary-card ----
    case 'city-card':
    case 'itinerary-card': {
      var cityItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return { main: itMain, desc: (it.attrs && it.attrs.desc) || '' }
        })
      var cityTags = []
      if (attrs.tags) {
        cityTags = typeof attrs.tags === 'string' ? attrs.tags.split(',').map(function (s) { return s.trim() }) : attrs.tags
      }
      return {
        tag: 'zone-city-card',
        attrs: {
          num: main || attrs.num || '',
          country: attrs.country || '',
          city: attrs.city || '',
          en: attrs.en || '',
          date: attrs.date || '',
          color: attrs.color || 'accent',
          items: cityItems,
          tags: cityTags,
        },
        children: [],
      }
    }

    // ---- 容器:col(v2.9: 支持 align=center 让子组件水平居中) ----
    case 'col': {
      var rawSpan = attrs.span || 12
      var span
      if (rawSpan < 6) span = 12
      else if (rawSpan < 12) span = 6
      else span = 12
      return { tag: 'zone-col', attrs: { span: span, align: attrs.align === 'center' ? 'center' : '' }, children: kids }
    }

    // ---- 容器:grid ----
    case 'grid': {
      var rawCols = attrs.cols || 2
      var cols = Math.max(1, Math.min(4, parseInt(rawCols, 10) || 2))
      var gap = attrs.gap || 'md'
      return { tag: 'zone-grid', attrs: { cols: cols, gap: gap }, children: kids }
    }

    // ---- 图表(保留 echarts 分支) ----
    case 'line':
    case 'bar':
    case 'pie':
    case 'sparkline':
      return toEchartsNode(node)

    case 'image': {
      var imgUrl = attrs.url || attrs.src || main
      var imgCap = attrs.caption || attrs.alt || ''
      var imgFit = normalizeFit(attrs.fit)
      return {
        tag: 'zone-image',
        attrs: {
          src: imgUrl,
          caption: imgCap,
          fit: imgFit,
          // fitClass: fit 值的冒号→连字符,用作 wxml class(WXSS 不支持 \: 转义)
          fitClass: imgFit.replace(/:/g, '-'),
          height: attrs.height || attrs.h || '',
          mode: imgFit === 'width' ? (attrs.mode || 'widthFix') : (imgFit === 'contain' ? 'aspectFit' : 'aspectFill'),
        },
        children: [],
      }
    }

    // ---- 叶子:video(封面 + 点击跳转, v2.11) ----
    // 不内嵌原生 video,只渲染 poster 封面 + ▶ 角标 + title;点击复用 button intent 链路(open-url).
    // 流式态 poster 未闭合 → streamingSafe 丢弃 → 渲染层显示骨架(同 image).
    case 'video': {
      var vPoster = attrs.poster || attrs.url || attrs.src || ''
      var vTitle = attrs.title || main || ''
      var vFit = attrs.fit ? normalizeFit(attrs.fit) : '16:9'
      var vIntent = ''
      var vValue = ''
      var rawVIntent = (attrs.intent || '').toString()
      if (BUTTON_INTENT_WHITELIST[rawVIntent]) {
        var vValidated = validateIntentValue(rawVIntent, attrs.value)
        if (vValidated != null) { vIntent = rawVIntent; vValue = vValidated }
      }
      return {
        tag: 'zone-video',
        attrs: {
          poster: vPoster,
          title: vTitle,
          subtitle: attrs.subtitle || '',
          fit: vFit,
          fitClass: vFit.replace(/:/g, '-'),
          height: attrs.height || attrs.h || '',
          intent: vIntent,
          value: vValue,
        },
        children: [],
      }
    }

    case 'gallery': {
      // v2.12: 支持 image + video 混排。image 点击灯箱预览,video 点击走 intent 跳转。
      var rawItems = (node.children || []).filter(function (c) {
        return c.type === 'component' && (c.name === 'image' || c.name === 'video')
      })
      var items = rawItems.map(function (c) {
        var ca = c.attrs || {}
        if (c.name === 'image') {
          var src = (ca.url || ca.src) || c.main || ''
          return src ? { type: 'image', src: src } : null  // v2.11: 过滤空 url,流式时未闭合的子图不混入
        }
        // video: 复用 video case 的 intent 校验逻辑(BUTTON_INTENT_WHITELIST + validateIntentValue)
        var poster = ca.poster || ca.url || ca.src || ''
        var intent = ''
        var value = ''
        var rawVIntent = (ca.intent || '').toString()
        if (BUTTON_INTENT_WHITELIST[rawVIntent]) {
          var vValidated = validateIntentValue(rawVIntent, ca.value)
          if (vValidated != null) { intent = rawVIntent; value = vValidated }
        }
        return poster ? { type: 'video', poster: poster, intent: intent, value: value } : null
      }).filter(Boolean)
      // 灯箱集合:只含 image 的 src(点视频是跳转,不该进灯箱)
      var imageUrls = items.filter(function (it) { return it.type === 'image' }).map(function (it) { return it.src })
      var count = items.length
      var galleryCols = count === 1 ? 1 : (count === 2 || count === 4) ? 2 : 3
      return {
        tag: 'zone-gallery',
        attrs: { main: main, cols: galleryCols, items: items, imageUrls: imageUrls },
        children: [],
      }
    }

    case 'hscroll':
    case 'scroller': {
      var hSlides = (node.children || [])
        .filter(function (c) { return c.type === 'component' })
        .map(function (c) { return zoneToNode(c, ctx) }).filter(Boolean)
      return {
        tag: 'zone-hscroll',
        attrs: { main: main },
        children: hSlides,
      }
    }

    case 'swiper':
    case 'carousel': {
      var swSlides = (node.children || [])
        .filter(function (c) { return c.type === 'component' })
        .map(function (c) { return zoneToNode(c, ctx) }).filter(Boolean)
      return {
        tag: 'zone-swiper',
        attrs: {
          main: main,
          height: attrs.height || attrs.h || 400,
          autoplay: !!attrs.autoplay,
          circular: !!attrs.circular || !!attrs.loop,
          interval: attrs.interval || 3000,
          dots: attrs.dots !== false,
        },
        children: swSlides,
      }
    }

    // ---- P1 叶子:badge ----
    case 'badge':
      return { tag: 'zone-badge', attrs: { main: main, color: attrs.color || 'accent' }, children: [] }

    // ---- P1 叶子:pill ----
    case 'pill':
      return { tag: 'zone-pill', attrs: { main: main, color: attrs.color || 'accent' }, children: [] }

    // ---- P1 叶子:button ----
    // v2.0: 支持 intent 白名单交互 (详见 INTENTS.md).
    // 未知 intent 或 value 校验失败时,intent/value 清空 → button 回退到纯样式.
    case 'button': {
      var btnVariant = attrs.variant || attrs.v || 'primary'
      var btnSize = attrs.size || 'md'
      var btnIntent = ''
      var btnValue = ''
      var rawIntent = (attrs.intent || '').toString()
      if (BUTTON_INTENT_WHITELIST[rawIntent]) {
        var validated = validateIntentValue(rawIntent, attrs.value)
        if (validated != null) {
          btnIntent = rawIntent
          btnValue = validated
        }
      }
      return {
        tag: 'zone-button',
        attrs: {
          main: main,
          variant: btnVariant,
          size: btnSize,
          intent: btnIntent,
          value: btnValue,
        },
        children: [],
      }
    }

    // ---- P1 叶子:icon ----
    case 'icon':
      return { tag: 'zone-icon', attrs: { main: main, size: attrs.size || 'md' }, children: [] }

    // ---- P1 叶子:avatar ----
    case 'avatar': {
      var avatarUrl = attrs.url || attrs.src || main
      var avatarSize = attrs.size || 'md'
      var avatarName = attrs.name || ''
      return { tag: 'zone-avatar', attrs: { url: avatarUrl, size: avatarSize, name: avatarName }, children: [] }
    }

    // ---- P1 叶子:kicker ----
    case 'kicker':
      return {
        tag: 'zone-kicker',
        attrs: { main: main, align: attrs.align === 'center' ? 'center' : 'left' },
        children: [],
      }

    // ---- P1 叶子:trend ----
    case 'trend': {
      var trendDir2 = attrs.dir || (main.indexOf('↑') === 0 ? 'up' : main.indexOf('↓') === 0 ? 'down' : 'flat')
      return { tag: 'zone-trend', attrs: { main: main, dir: trendDir2 }, children: [] }
    }

    // ---- P1 叶子:tip ----
    case 'tip': {
      var tipType = attrs.type || 'info'
      return { tag: 'zone-tip', attrs: { main: main, type: tipType }, children: [] }
    }

    // ---- P1 叶子:callout ----
    case 'callout': {
      var calloutType = attrs.type || 'info'
      var calloutTitle = attrs.title || ''
      return { tag: 'zone-callout', attrs: { main: main, type: calloutType, title: calloutTitle }, children: [] }
    }

    // ---- P1 叶子:display ----
    case 'display': {
      var dispDesc = attrs.desc != null ? String(attrs.desc) : ''
      var dispColor = attrs.color || 'accent'
      return {
        tag: 'zone-display',
        attrs: {
          main: main,
          desc: dispDesc,
          color: dispColor,
          align: attrs.align === 'center' ? 'center' : 'left',
        },
        children: [],
      }
    }

    // ---- P1 结构消费:tabs ----
    case 'tabs': {
      var tabItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it, idx) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return { main: itMain, active: idx === 0 }
        })
      return { tag: 'zone-tabs', attrs: { main: main, items: tabItems }, children: [] }
    }

    // ---- P1 结构消费:accordion ----
    case 'accordion': {
      var accordionItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          var itDesc = (it.attrs && it.attrs.desc) || ''
          // item 的子组件(::text/::list 等)作为展开内容
          var itChildren = (it.children || [])
            .filter(function (c) { return c.type === 'component' })
            .map(function (c) { return zoneToNode(c, ctx) }).filter(Boolean)
          return { main: itMain, desc: itDesc, children: itChildren }
        })
      return { tag: 'zone-accordion', attrs: { main: main, items: accordionItems }, children: [] }
    }

    // ---- P1 结构消费:steps / step ----
    case 'steps':
    case 'step': {
      var stepsDir = attrs.direction || attrs.dir || 'vertical'
      var stepItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'step' })
        .map(function (it, idx) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return { main: itMain, desc: (it.attrs && it.attrs.desc) || '', index: idx + 1 }
        })
      // 单独 ::step 叶子直接作为文本
      if (name === 'step') {
        return { tag: 'zone-step-leaf', attrs: { main: main }, children: [] }
      }
      return { tag: 'zone-steps', attrs: { main: main, direction: stepsDir, items: stepItems }, children: [] }
    }

    // ---- P2 叶子:ring ----
    case 'ring': {
      var ringVal = Math.max(0, Math.min(100, parseFloat(attrs.value != null ? attrs.value : main) || 0))
      var ringDesc = attrs.desc != null ? String(attrs.desc) : ''
      var ringColor = attrs.color || 'accent'
      return { tag: 'zone-ring', attrs: { value: ringVal, desc: ringDesc, color: ringColor }, children: [] }
    }

    // ---- P2 结构消费:rank / ranking ----
    case 'rank':
    case 'ranking': {
      var rankItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it, idx) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          var itVal = (it.attrs && it.attrs.value) || 0
          return { main: itMain, value: itVal, rank: idx + 1 }
        })
      // 计算最大值用于进度条
      var rankMax = rankItems.reduce(function (m, r) { return Math.max(m, parseFloat(r.value) || 0) }, 1)
      return { tag: 'zone-rank', attrs: { main: main, items: rankItems, max: rankMax }, children: [] }
    }

    // ---- P2 图表:radar ----
    case 'radar': {
      var radarIndicatorRaw = attrs.indicator || attrs.indicators || ''
      var radarValueRaw = attrs.value || attrs.values || ''
      var radarNames = typeof radarIndicatorRaw === 'string'
        ? radarIndicatorRaw.split(',').map(function (s) { return s.trim() })
        : (Array.isArray(radarIndicatorRaw) ? radarIndicatorRaw : [])
      var radarValues = typeof radarValueRaw === 'string'
        ? radarValueRaw.split(',').map(function (s) { return parseFloat(s) || 0 })
        : (Array.isArray(radarValueRaw) ? radarValueRaw.map(function (v) { return parseFloat(v) || 0 }) : [])
      var radarMax = attrs.max || 100
      var radarIndicator = radarNames.map(function (n) { return { name: n, max: radarMax } })
      var radarOpt = {
        tooltip: {},
        radar: { indicator: radarIndicator },
        color: ['#FF8200'],
        series: [{
          type: 'radar',
          data: [{ value: radarValues, name: main || '数据' }],
          areaStyle: { opacity: 0.25 },
          lineStyle: { color: '#FF8200', width: 2 },
        }],
      }
      if (main) {
        radarOpt.title = { text: main, left: 'center', textStyle: { fontSize: 14, color: '#1a1a1a' } }
      }
      var radarH = attrs.height || attrs.h
      var radarPayload = radarH ? { option: radarOpt, height: radarH } : radarOpt
      return {
        tag: 'echarts',
        attrs: { 'class': 'zone-chart', 'value': encodeURIComponent(JSON.stringify(radarPayload)) },
        children: [],
      }
    }

    // ---- P2 叶子:compare ----
    case 'compare': {
      var cmpItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          var itVal = (it.attrs && it.attrs.value) || 0
          return { main: itMain, value: itVal }
        })
      return { tag: 'zone-compare', attrs: { main: main, items: cmpItems }, children: [] }
    }

    // ---- P2 结构消费:tree ----
    // ---- P2 结构消费:stairs ----
    case 'stairs': {
      var stairsItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'step' })
        .map(function (it, idx) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return { main: itMain, index: idx }
        })
      return { tag: 'zone-stairs', attrs: { main: main, items: stairsItems }, children: [] }
    }

    // ---- P2 结构消费:mechanism ----
    case 'mechanism': {
      var mechItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'step' })
        .map(function (it, idx) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return { main: itMain, index: idx }
        })
      return { tag: 'zone-mechanism', attrs: { main: main, items: mechItems }, children: [] }
    }

    // ---- P2 叶子:chapter ----
    case 'chapter': {
      var chapTitle = attrs.title || ''
      var chapSubtitle = attrs.subtitle || ''
      var chapCategory = attrs.category || ''
      var chapVariant = attrs.variant || (chapCategory ? 'magazine' : 'default')
      return {
        tag: 'zone-chapter',
        attrs: {
          main: main,
          title: chapTitle,
          titleParts: splitCoverHighlights(chapTitle, ctx),
          subtitle: chapSubtitle,
          category: chapCategory,
          variant: chapVariant,
          align: attrs.align === 'center' ? 'center' : 'left',
        },
        children: [],
      }
    }

    // ---- P3 容器:form ----
    case 'form':
      return { tag: 'zone-form', attrs: { main: main }, children: kids }

    // ---- P3 容器:checkbox-group(同组 checkbox 共享多选 state, v2.8)----
    case 'checkbox-group': {
      var cgItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'checkbox' })
        .map(function (c) {
          var cMain = c.main || (c._raw || '').replace(/^\s+|\s+$/g, '')
          var cChk = (c.attrs && c.attrs.checked != null) ? !!c.attrs.checked : false
          return { main: cMain, checked: cChk }
        })
      return { tag: 'zone-checkbox-group', attrs: { main: main, items: cgItems }, children: [] }
    }

    // ---- P3 叶子:checkbox ----
    case 'checkbox': {
      var cbChecked = attrs.checked != null ? !!attrs.checked : (main.indexOf('checked') !== -1)
      return { tag: 'zone-checkbox', attrs: { main: main, checked: cbChecked }, children: [] }
    }

    // ---- P3 叶子:radio ----
    case 'radio': {
      var rdSelected = attrs.selected != null ? !!attrs.selected : (main.indexOf('selected') !== -1)
      return { tag: 'zone-radio', attrs: { main: main, selected: rdSelected }, children: [] }
    }

    // ---- P3 容器:radio-group(同组 radio 共享单选 state)----
    case 'radio-group': {
      var rgItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'radio' })
        .map(function (c) {
          var cMain = c.main || (c._raw || '').replace(/^\s+|\s+$/g, '')
          var cSel = (c.attrs && c.attrs.selected != null) ? !!c.attrs.selected : false
          return { main: cMain, selected: cSel }
        })
      return { tag: 'zone-radio-group', attrs: { main: main, items: rgItems }, children: [] }
    }

    // ---- P3 叶子:select ----
    case 'select': {
      var selOptions = attrs.options || ''
      if (typeof selOptions === 'string') selOptions = selOptions.split(',').map(function (s) { return s.trim() })
      return { tag: 'zone-select', attrs: { main: main, options: selOptions }, children: [] }
    }

    // ---- P3 叶子:textarea ----
    case 'textarea':
      return { tag: 'zone-textarea', attrs: { main: main, placeholder: attrs.placeholder || main }, children: [] }

    // ---- P3 结构消费:quiz ----
    case 'quiz': {
      var quizOptions = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'option' })
        .map(function (it, idx) {
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return { main: itMain, label: String.fromCharCode(65 + idx) }
        })
      return { tag: 'zone-quiz', attrs: { main: main, options: quizOptions }, children: [] }
    }

    // ---- P3 叶子:editorial-hero ----
    case 'editorial-hero': {
      var ehTitle = attrs.title || main
      var ehSubtitle = attrs.subtitle || ''
      var ehBg = attrs.bg || 'accent'
      var ehKicker = attrs.kicker || ''
      var ehStatsArr = []
      if (attrs.stats) {
        ehStatsArr = typeof attrs.stats === 'string' ? attrs.stats.split(',').map(function (s) { return s.trim() }) : attrs.stats
      }
      return {
        tag: 'zone-editorial-hero',
        attrs: {
          title: ehTitle,
          titleParts: splitCoverHighlights(ehTitle, ctx),
          subtitle: ehSubtitle,
          bg: ehBg,
          kicker: ehKicker,
          stats: ehStatsArr,
          align: attrs.align === 'center' ? 'center' : 'left',
        },
        children: [],
      }
    }

    // ---- P3 叶子:editorial-image ----
    case 'editorial-image': {
      var eiUrl = attrs.url || attrs.src || ''
      var eiSearch = attrs.search || main || ''
      var eiCaption = attrs.caption || ''
      return { tag: 'zone-editorial-image', attrs: { url: eiUrl, search: eiSearch, caption: eiCaption }, children: [] }
    }

    // ---- P3 叶子:editorial-pullquote ----
    case 'editorial-pullquote': {
      var epqCite = attrs.cite || ''
      return { tag: 'zone-editorial-pullquote', attrs: { main: main, cite: epqCite }, children: [] }
    }

    // ---- P3 叶子:editorial-stat ----
    case 'editorial-stat': {
      var estDesc = attrs.desc != null ? String(attrs.desc) : ''
      var estTrend = attrs.trend != null ? String(attrs.trend) : ''
      return { tag: 'zone-editorial-stat', attrs: { main: main, desc: estDesc, trend: estTrend }, children: [] }
    }

    // ---- P3 叶子:editorial-summary ----
    case 'editorial-summary': {
      var esTitle = attrs.title || 'TL;DR'
      return { tag: 'zone-editorial-summary', attrs: { main: main, title: esTitle }, children: [] }
    }

    default: {
      // 未知组件降级 —— 由 UNKNOWN_MODE 控制
      if (UNKNOWN_MODE === 'silent') return null
      if (UNKNOWN_MODE === 'placeholder') {
        return { tag: 'zone-unknown-placeholder', attrs: {}, children: [] }
      }
      // debug: 保留源码卡片
      return {
        tag: 'zone-unknown',
        attrs: { main: '::' + name + ' ' + (main ? '"' + main + '" ' : '') + JSON.stringify(attrs) },
        children: [],
      }
    }
  }
}

// 支持的主题白名单;非法值 fallback 到 editorial
var VALID_THEMES = { editorial: 1, literary: 1, serious: 1, data: 1, serene: 1, warm: 1, luxe: 1, purple: 1, sky: 1, pop: 1, sage: 1, note: 1 }

// 从 AST 里提取主题声明,支持三种入口(A+C 组合方案):
// 1) 顶层节点 ::theme literary  (伪组件,提取后从 AST 中移除)
// 2) 顶层 ::magazine-cover theme=xxx  (提取属性,组件保留渲染)
// 3) 围栏 meta ```zone theme=xxx  (由调用方传入;此处扫描 AST 兜底)
function extractTheme(ast) {
  var theme = ''
  var kept = []
  for (var i = 0; i < ast.length; i++) {
    var n = ast[i]
    if (n && n.type === 'component' && n.name === 'theme') {
      // 从 ::theme literary 提取,不保留渲染
      // parser 会把 "literary" 当成裸键 attrs.literary=true,所以三种取值方式都支持
      var val = ''
      if (n.main) val = String(n.main)
      else if (n.attrs && (n.attrs.name || n.attrs.value)) val = String(n.attrs.name || n.attrs.value)
      else if (n.attrs) {
        for (var tk in n.attrs) {
          if (VALID_THEMES[tk]) { val = tk; break }
        }
      }
      val = val.replace(/^\s+|\s+$/g, '')
      if (val && VALID_THEMES[val]) theme = theme || val
      continue
    }
    if (n && n.type === 'component' && (n.name === 'magazine-cover' || n.name === 'cover')) {
      var cv = n.attrs && n.attrs.theme
      if (cv && VALID_THEMES[cv]) theme = theme || cv
    }
    kept.push(n)
  }
  return { theme: theme || 'editorial', ast: kept }
}

// 输入:zone DSL 原文;输出:一个 zone-block 根节点(带 isZone 标识供 decode 派发)
// options.allowLayers: 可选,数组,只保留指定层的组件(其他层组件走 silent 降级为 null)
//   例:dslToNodes(dsl, { allowLayers: ['preset', 'primitive'] })
function dslToNodes(dsl, options) {
  var opts = options || {}
  // v2.8: 流式模式下丢弃"未闭合尾行"(=结尾/引号未配对/逗号结尾等半截值),
  // 避免每帧 zone 组件 attrs 出现"a"/"acc"/"accen"这种半截值导致视觉闪烁.
  // v2.8 streamingSafe:流式安全模式,只对"未换行的尾行"的最后一个 bare attr 丢弃,
  // 组件始终显示,attrs 只在闭合时更新.比 dropPartialLastLine 更精细.
  var ast = parser.buildAst(dsl, { streamingSafe: !!opts.streamingSafe })
  // v2.10: 把 streamingSafe 透传给 zoneToNode → splitInlineMd/splitCoverHighlights,
  // 让流式态下组件 main 文本里的半截行内标记(** / ` / * / ~~ / ==)裁到未闭合标记前,
  // 避免裸符号闪烁.详见 spec §4.5.
  var ctx = { streamingSafe: !!opts.streamingSafe }
  var meta = extractTheme(ast)
  // v2.12: 引文注册表.两路来源合并 ——
  //   opts.sources: towxml 入口消息级预扫(buildSourcesRefMap),跨块/跨围栏都能查到
  //   块内 ::sources: dslToNodes 直接从 AST 收(直接用引擎、不走 towxml 时的兜底)
  // 块内优先(同号覆盖消息级),因为块内 source 离引用最近、最可能是新写的.
  var refMap = {}
  var msgMap = opts.sources || null
  if (msgMap) { for (var mk in msgMap) refMap[mk] = msgMap[mk] }
  var blockMap = buildRefMapFromAst(meta.ast)
  if (blockMap) { for (var bk in blockMap) refMap[bk] = blockMap[bk] }
  if (msgMap || blockMap) ctx.refMap = refMap
  var layerFilter = null
  if (Array.isArray(opts.allowLayers) && opts.allowLayers.length) {
    layerFilter = {}
    opts.allowLayers.forEach(function (l) { layerFilter[l] = 1 })
  }
  var nodes = meta.ast
    .map(function (node) {
      if (layerFilter && node && node.type === 'component') {
        var reg = COMPONENT_REGISTRY[node.name]
        if (reg && !layerFilter[reg.layer]) return null
      }
      return zoneToNode(node, ctx)
    })
    .filter(Boolean)
  // v2.5 主题穿透:把主题写到每个子节点的 attrs.theme 上,
  // 让 zone-node 组件的最外层 view 都能挂上 zone-theme-<name> class,
  // 从而 shared.wxss 里 `.zone-theme-serene .zn-xxx` 选择器能在每个组件内部命中.
  // v2.11: 同时注入 _streaming(流式态),让 image/video/gallery 在 src 未闭合时显示骨架而非撑大.
  var isStreaming = !!opts.streamingSafe
  function injectMeta(n) {
    if (!n || typeof n !== 'object') return
    if (n.attrs) {
      n.attrs['_theme'] = meta.theme
      if (isStreaming && n.tag !== 'zone-block') n.attrs['_streaming'] = true
    }
    if (Array.isArray(n.children)) n.children.forEach(injectMeta)
  }
  nodes.forEach(injectMeta)
  return [{
    tag: 'zone-block',
    attrs: {
      'class': 'zone-block zone-theme-' + meta.theme,
      'theme': meta.theme,
      '_theme': meta.theme,
    },
    children: nodes,
    isZone: true,
  }]
}

module.exports = {
  dslToNodes: dslToNodes,
  zoneToNode: zoneToNode,
  buildSourcesRefMap: buildSourcesRefMap,
  quoteListToRefMap: quoteListToRefMap,
  parseLinkTarget: parseLinkTarget,
  splitInlineMd: splitInlineMd,
  splitCoverHighlights: splitCoverHighlights,
  COMPONENT_REGISTRY: COMPONENT_REGISTRY,
  UNKNOWN_MODE: UNKNOWN_MODE,
}
