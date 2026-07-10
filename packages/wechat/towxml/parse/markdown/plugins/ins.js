/**
 * markdown-it-ins 插件(手写版,等价 markdown-it-ins@3.0.1)
 * 语法:++inserted text++ → <ins>inserted text</ins>
 */
module.exports = function ins_plugin(md) {
  function tokenize(state, silent) {
    var start = state.pos
    var marker = state.src.charCodeAt(start)
    if (silent) return false
    if (marker !== 0x2B /* + */) return false

    var scanned = state.scanDelims(state.pos, true)
    var len = scanned.length
    var ch = String.fromCharCode(marker)
    if (len < 2) return false

    var token
    if (len % 2) {
      token = state.push('text', '', 0)
      token.content = ch
      len--
    }
    for (var i = 0; i < len; i += 2) {
      token = state.push('text', '', 0)
      token.content = ch + ch
      state.delimiters.push({
        marker: marker,
        length: 0,
        jump: i,
        token: state.tokens.length - 1,
        end: -1,
        open: scanned.can_open,
        close: scanned.can_close,
      })
    }
    state.pos += scanned.length
    return true
  }

  function postProcess(state, delimiters) {
    var loneMarkers = []
    var max = delimiters.length
    for (var i = 0; i < max; i++) {
      var startDelim = delimiters[i]
      if (startDelim.marker !== 0x2B) continue
      if (startDelim.end === -1) continue
      var endDelim = delimiters[startDelim.end]

      var t = state.tokens[startDelim.token]
      t.type = 'ins_open'
      t.tag = 'ins'
      t.nesting = 1
      t.markup = '++'
      t.content = ''

      t = state.tokens[endDelim.token]
      t.type = 'ins_close'
      t.tag = 'ins'
      t.nesting = -1
      t.markup = '++'
      t.content = ''

      if (
        state.tokens[endDelim.token - 1].type === 'text' &&
        state.tokens[endDelim.token - 1].content === '+'
      ) {
        loneMarkers.push(endDelim.token - 1)
      }
    }
    while (loneMarkers.length) {
      var j = loneMarkers.pop()
      var k = j + 1
      while (k < state.tokens.length && state.tokens[k].type === 'ins_close') k++
      k--
      if (j !== k) {
        var swap = state.tokens[k]
        state.tokens[k] = state.tokens[j]
        state.tokens[j] = swap
      }
    }
  }

  md.inline.ruler.before('emphasis', 'ins', tokenize)
  md.inline.ruler2.before('emphasis', 'ins', function (state) {
    var tokensMeta = state.tokens_meta
    var max = (state.tokens_meta || []).length
    postProcess(state, state.delimiters)
    for (var curr = 0; curr < max; curr++) {
      if (tokensMeta[curr] && tokensMeta[curr].delimiters) {
        postProcess(state, tokensMeta[curr].delimiters)
      }
    }
  })
}
