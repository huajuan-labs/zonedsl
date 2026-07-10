/**
 * markdown-it-task-lists 手写版(towxml 定制):
 * 语法:- [ ] 未完成 / - [x] 已完成 → 微信原生 <checkbox> 组件
 *
 * 平移自 markdown-it-task-lists 官方逻辑 + towxml 定制的 <checkbox> 输出,
 * 避免使用 browserify 打包 shim 触发微信 code protect。
 */

var DISABLE_ATTR = ' disabled="true"'

function isTodoItem(tokens, index) {
  return (
    isInline(tokens[index]) &&
    isParagraph(tokens[index - 1]) &&
    isListItem(tokens[index - 2]) &&
    startsWithTodoMarkdown(tokens[index])
  )
}
function isInline(t) { return t && t.type === 'inline' }
function isParagraph(t) { return t && t.type === 'paragraph_open' }
function isListItem(t) { return t && t.type === 'list_item_open' }
function isBulletList(t) { return t && t.type === 'bullet_list_open' }

function startsWithTodoMarkdown(t) {
  return t && t.content && (
    t.content.indexOf('[ ] ') === 0 ||
    t.content.indexOf('[x] ') === 0 ||
    t.content.indexOf('[X] ') === 0
  )
}

function todoify(token, TokenConstructor, index, opts) {
  var checked = token.content.indexOf('[x]') === 0 || token.content.indexOf('[X]') === 0
  var disabledAttr = opts && opts.enabled ? '' : DISABLE_ATTR
  var value = ' value="' + index + '"'
  var html = checked
    ? '<checkbox class="h2w__todoCheckbox task-list-item-checkbox" checked="true"' + disabledAttr + value + '/>'
    : '<checkbox class="h2w__todoCheckbox task-list-item-checkbox"' + disabledAttr + value + '/>'

  // 生成一个 html_inline token 承载 checkbox 标签
  var checkboxToken = new TokenConstructor('html_inline', '', 0)
  checkboxToken.content = html
  token.children.unshift(checkboxToken)
  // 去掉 "[x] " / "[ ] " 前缀
  token.children[1].content = token.children[1].content.slice(4)
  token.content = token.content.slice(4)
}

function setAttr(token, name, value) {
  var index = token.attrIndex(name)
  var attr = [name, value]
  if (index < 0) token.attrPush(attr)
  else token.attrs[index] = attr
}

function attrSet(token, name, value) {
  var attrs = token.attrs || []
  var idx = attrs.findIndex(function (a) { return a[0] === name })
  if (idx >= 0) attrs[idx][1] = value
  else attrs.push([name, value])
  token.attrs = attrs
}

module.exports = function todo_plugin(md, opts) {
  opts = opts || {}
  md.core.ruler.after('inline', 'github-task-lists', function (state) {
    var tokens = state.tokens
    var index = 0
    for (var i = 2; i < tokens.length; i++) {
      if (isTodoItem(tokens, i)) {
        todoify(tokens[i], state.Token, index++, opts)
        // 给 list_item 加 class
        attrSet(tokens[i - 2], 'class', 'task-list-item' + (opts.enabled ? ' enabled' : ''))
        // 给包裹的 bullet_list 加 class
        var parentIdx = findParentBulletList(tokens, i - 2)
        if (parentIdx >= 0) {
          attrSet(tokens[parentIdx], 'class', 'contains-task-list')
        }
      }
    }
  })
}

function findParentBulletList(tokens, itemIdx) {
  // 向前找最近的 bullet_list_open,且 level 比 list_item 小 1
  var itemLevel = tokens[itemIdx].level
  for (var i = itemIdx - 1; i >= 0; i--) {
    if (isBulletList(tokens[i]) && tokens[i].level === itemLevel - 1) return i
  }
  return -1
}

// 消除未使用符号警告
void setAttr
