/**
 * markdown-it-sup 插件(手写版)
 * 语法:E=mc^2^ → E=mc<sup>2</sup>
 */
var UNESCAPE_RE = /\\([ \\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g

module.exports = function sup_plugin(md) {
  function superscript(state, silent) {
    var start = state.pos
    var max = state.posMax
    if (state.src.charCodeAt(start) !== 0x5E /* ^ */) return false
    if (silent) return false
    if (start + 2 >= max) return false

    state.pos = start + 1
    var found = false
    while (state.pos < max) {
      if (state.src.charCodeAt(state.pos) === 0x5E) {
        found = true
        break
      }
      state.md.inline.skipToken(state)
    }
    if (!found || start + 1 === state.pos) {
      state.pos = start
      return false
    }
    var content = state.src.slice(start + 1, state.pos)
    if (content.match(/(^|[^\\])(\\\\)*\s/)) {
      state.pos = start
      return false
    }
    state.posMax = state.pos
    state.pos = start + 1

    var token = state.push('sup_open', 'sup', 1)
    token.markup = '^'
    token = state.push('text', '', 0)
    token.content = content.replace(UNESCAPE_RE, '$1')
    token = state.push('sup_close', 'sup', -1)
    token.markup = '^'

    state.pos = state.posMax + 1
    state.posMax = max
    return true
  }

  md.inline.ruler.after('emphasis', 'sup', superscript)
}
