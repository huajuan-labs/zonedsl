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
    case 'copy':
      return v ? v.slice(0, 500) : null
  }
  return null
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
function splitInlineMd(text) {
  if (!text || typeof text !== 'string') return [{ type: 'text', text: String(text || '') }]
  var re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  var parts = []
  var last = 0
  var m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', text: text.slice(last, m.index) })
    if (m[2]) parts.push({ type: 'bold', text: m[2] })
    else if (m[3]) parts.push({ type: 'italic', text: m[3] })
    else if (m[4]) parts.push({ type: 'code', text: m[4] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) })
  if (!parts.length) parts.push({ type: 'text', text: text })
  return parts
}

// ========== magazine-cover 标题/副标题行内高亮拆分 ==========
// **text** → 主色高亮底黑字   ~~text~~ → 浅色高亮底主色字   ==text== → 主色字
// `\n` 或字面量 `\n`(反斜杠+n) → 换行(part.type='break')
function splitCoverHighlights(text) {
  if (!text || typeof text !== 'string') return [{ type: 'text', text: String(text || '') }]
  // parser 从 attrs 值里读出的 `\n` 是字面量两字符(反斜杠+n),先归一化成真实换行
  var normalized = String(text).replace(/\\n/g, '\n')
  var lines = normalized.split('\n')
  var out = []
  for (var li = 0; li < lines.length; li++) {
    var ln = lines[li]
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
    if (li < lines.length - 1) out.push({ type: 'break' })
  }
  if (!out.length) out.push({ type: 'text', text: text })
  return out
}

// ========== 结构化子节点过滤 ==========
function isStructuralChild(c) {
  return c && c.type === 'child'
}

// ========== 组件 → 新 tag-based 节点 ==========
function zoneToNode(node) {
  if (!node || node.type !== 'component') return null
  var name = node.name
  var main = node.main || ''
  var attrs = node.attrs || {}

  // 通用子节点:过滤掉 child 类型和 option 伪节点,其余递归
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
    .map(zoneToNode).filter(Boolean)

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
          parts: splitInlineMd(main),
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
      return { tag: 'zone-alert', attrs: { main: main, type: alertType, icon: iconStr }, children: [] }
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
      return { tag: 'zone-quote', attrs: { main: main, cite: attrs.cite || '' }, children: [] }

    // ---- 结构消费:list ----
    case 'list': {
      var listItems = (node.children || [])
        .filter(function (c) { return (c.type === 'child' || c.type === 'component') && c.name === 'item' })
        .map(function (it) {
          // child 类型:文本在 _raw;component 类型(::item):文本在 main
          // child 类型:若 main 已被 parser 提取则用它,否则用 _raw(裸文本无引号情况)
          var itMain = it.main || (it._raw || '').replace(/^\s+|\s+$/g, '')
          return { main: itMain, desc: (it.attrs && it.attrs.desc) || '' }
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
        if (typeof firstCells === 'string') firstCells = firstCells.split(',')
        if ((!Array.isArray(firstCells) || !firstCells.length) && firstR._raw) {
          firstCells = String(firstR._raw).split(',')
        }
        colCount = firstCells.length || 3
      }
      var cellsCount = Math.max(1, Math.min(6, colCount))

      var tableRows = rows.map(function (r) {
        var cells = (r.attrs && r.attrs.cells) || []
        if (typeof cells === 'string') cells = cells.split(',').map(function (s) { return s.replace(/^\s+|\s+$/g, '') })
        if ((!Array.isArray(cells) || !cells.length) && r._raw) {
          cells = String(r._raw).split(',').map(function (s) { return s.replace(/^\s+|\s+$/g, '') })
        }
        return cells.map(String)
      })

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
          return {
            when: (it.attrs && it.attrs.when) || '',
            main: itMain,
            desc: (it.attrs && it.attrs.desc) || '',
            tag: (it.attrs && it.attrs.tag) || '',
            location: (it.attrs && it.attrs.location) || '',
            highlight: !!(it.attrs && it.attrs.highlight),
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
          titleParts: splitCoverHighlights(titleText),
          highlight: attrs.highlight || '',
          subtitle: subtitleText,
          subtitleParts: splitCoverHighlights(subtitleText),
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
      return {
        tag: 'zone-image',
        attrs: { src: imgUrl, caption: imgCap, mode: attrs.mode || 'widthFix' },
        children: [],
      }
    }

    case 'gallery': {
      var imgs = (node.children || []).filter(function (c) { return c.type === 'component' && c.name === 'image' })
      var count = imgs.length
      var galleryCols = count === 1 ? 1 : (count === 2 || count === 4) ? 2 : 3
      var urls = imgs.map(function (im) {
        return (im.attrs && (im.attrs.url || im.attrs.src)) || im.main || ''
      })
      return {
        tag: 'zone-gallery',
        attrs: { main: main, cols: galleryCols, urls: urls },
        children: [],
      }
    }

    case 'hscroll':
    case 'scroller': {
      var hSlides = (node.children || [])
        .filter(function (c) { return c.type === 'component' })
        .map(zoneToNode).filter(Boolean)
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
        .map(zoneToNode).filter(Boolean)
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
            .map(zoneToNode).filter(Boolean)
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
          titleParts: splitCoverHighlights(chapTitle),
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
          titleParts: splitCoverHighlights(ehTitle),
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
  var meta = extractTheme(ast)
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
      return zoneToNode(node)
    })
    .filter(Boolean)
  // v2.5 主题穿透:把主题写到每个子节点的 attrs.theme 上,
  // 让 zone-node 组件的最外层 view 都能挂上 zone-theme-<name> class,
  // 从而 shared.wxss 里 `.zone-theme-serene .zn-xxx` 选择器能在每个组件内部命中.
  function injectTheme(n) {
    if (!n || typeof n !== 'object') return
    if (n.attrs) n.attrs['_theme'] = meta.theme
    if (Array.isArray(n.children)) n.children.forEach(injectTheme)
  }
  nodes.forEach(injectTheme)
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
  COMPONENT_REGISTRY: COMPONENT_REGISTRY,
  UNKNOWN_MODE: UNKNOWN_MODE,
}
