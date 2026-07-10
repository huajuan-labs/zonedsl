const config = require('./config');

Component({
	options: {
		styleIsolation: 'apply-shared'
	},
	properties: {
		nodes: {
			type: Object,
			value: {}
		}
	},
	// echarts 组件挂在 decode 内,事件冒泡到 decode 时需要 no-op 方法作为兜底
	// 否则小程序事件路径查找失败会抛 "this._getData is not a function"
	methods: {
		_tap: function () {},
		_change: function () {},
		_getData: function () {},
	},
	lifetimes: {
		attached: function () {
			const _ts = this;

			config.events.forEach(item => {
				_ts['_' + item] = function (...arg) {
					if (global._events && typeof global._events[item] === 'function') {
						global._events[item](...arg);
					}
				};
			});
		}
	}
})