Component({
  options: {
    // virtualHost: 让 <zone-node> 不产生 DOM 节点,内部 view 直接成为父的 flex/grid 子
    virtualHost: true,
    // apply-shared: 父样式(如 --hj-* 变量)可透传进来
    styleIsolation: 'apply-shared',
    // v2.5: addGlobalClass 允许外部全局 class(如 .zone-theme-serene)命中组件内元素,
    // 让主题级后代选择器 .zone-theme-serene .zn-xxx 在 zone-node 递归组件里生效.
    // 只单向:允许全局 class 进入组件,组件自己的 wxss 不外泄 → 无污染风险.
    addGlobalClass: true,
  },
  properties: {
    item: {
      type: Object,
      value: {},
    },
  },
  data: {
    // tabs: 当前激活的 tab 下标
    activeTab: 0,
    // accordion: {index: bool} 展开状态映射
    accOpen: {},
    // checkbox: {key: bool} 勾选状态映射
    cbState: {},
    // radio: 当前选中的 main 值,null 表示用 attrs.selected 初始态
    radioSel: null,
    // select: {key: optionIndex} 选中项下标映射
    selectVal: {},
    // textarea: {key: string} 输入值映射
    textVal: {},
    // quiz: 当前选中选项下标,null 表示未选
    quizSel: null,
    // quiz: 是否已提交
    quizSubmitted: false,
  },
  methods: {
    // echarts 组件挂在 zone-node 内,事件冒泡到 zone-node 时需要这些 no-op 方法,
    // 否则小程序事件路径查找失败会抛 "this._getData is not a function"
    _tap: function () {},
    _change: function () {},
    _getData: function () {},

    // ===== tabs =====
    onTabTap: function (e) {
      var idx = e.currentTarget.dataset.idx
      this.setData({ activeTab: idx })
    },

    // ===== accordion =====
    onAccTap: function (e) {
      var idx = e.currentTarget.dataset.idx
      var map = Object.assign({}, this.data.accOpen)
      map[idx] = !map[idx]
      this.setData({ accOpen: map })
    },

    // ===== checkbox =====
    onCheckboxTap: function (e) {
      var key = e.currentTarget.dataset.key
      var map = Object.assign({}, this.data.cbState)
      map[key] = !map[key]
      this.setData({ cbState: map })
    },

    // ===== radio =====
    onRadioTap: function (e) {
      this.setData({ radioSel: e.currentTarget.dataset.key })
    },

    // ===== select =====
    onSelectChange: function (e) {
      var key = e.currentTarget.dataset.key
      var map = Object.assign({}, this.data.selectVal)
      map[key] = parseInt(e.detail.value, 10)
      this.setData({ selectVal: map })
    },

    // ===== textarea =====
    onTextInput: function (e) {
      var key = e.currentTarget.dataset.key
      var map = Object.assign({}, this.data.textVal)
      map[key] = e.detail.value
      this.setData({ textVal: map })
    },

    // ===== quiz =====
    onQuizSelect: function (e) {
      this.setData({ quizSel: e.currentTarget.dataset.idx, quizSubmitted: false })
    },
    onQuizSubmit: function () {
      this.setData({ quizSubmitted: true })
      wx.showToast({ title: '已提交', icon: 'success' })
    },

    // 九宫格图片点击 → 原生灯箱预览(当前图 + 同组集合)
    onGalleryTap: function (e) {
      var ds = e && e.currentTarget && e.currentTarget.dataset
      if (!ds || !ds.src) return
      wx.previewImage({
        urls: Array.isArray(ds.urls) && ds.urls.length ? ds.urls : [ds.src],
        current: ds.src,
        fail: function () {},
      })
    },

    // ===== button intent 交互 (v2.0) =====
    // parser 已经做过白名单校验,这里直接把 { intent, value } 上抛给业务页面.
    // 业务页面(agentChat/index.js)监听 zoneaction 事件做真正的分发.
    onButtonAction: function (e) {
      var ds = (e && e.currentTarget && e.currentTarget.dataset) || {}
      if (!ds.intent) return
      this.triggerEvent('zoneaction', {
        intent: ds.intent,
        value: ds.value || '',
      }, { bubbles: true, composed: true })
    },
  },
})
