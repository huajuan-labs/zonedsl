/**
 * towxml echarts 组件(新版 canvas 2d):
 * - 完全用官方 ec-canvas 的 initByNewWay(基础库 >= 2.9.0 用 <canvas type="2d">)
 * - 数据入口保留 towxml 的方式:通过 `data` property 传 markdown 生成的节点,
 *   attached 时从 data.data.attrs.value 解析 URI-encoded JSON 得到 option
 * - 基础库 < 2.9.0 走 initByOldWay 降级
 */
import WxCanvas from './wx-canvas';
import * as echarts from './wx-echarts';
const darkTheme = require('./dark');

let oldCtx;

function compareVersion(v1, v2) {
	v1 = v1.split('.');
	v2 = v2.split('.');
	const len = Math.max(v1.length, v2.length);
	while (v1.length < len) v1.push('0');
	while (v2.length < len) v2.push('0');
	for (let i = 0; i < len; i++) {
		const n1 = parseInt(v1[i], 10);
		const n2 = parseInt(v2[i], 10);
		if (n1 > n2) return 1;
		if (n1 < n2) return -1;
	}
	return 0;
}

Component({
	properties: {
		canvasId: {
			type: String,
			value: 'ec-canvas'
		},
		// towxml 传进来的完整节点,attrs.value 里是 URI-encoded 的 option JSON
		data: {
			type: Object,
			value: {}
		},
		forceUseOldCanvas: {
			type: Boolean,
			value: false
		}
	},

	data: {
		isUseNewCanvas: false,
		size: {
			height: 240
		}
	},

	lifetimes: {
		attached: function () {
			const self = this;
			// 调试:打印 property 收到什么
			console.log('[towxml echarts attached] this.data.data =', this.data.data);
			// 从 towxml 的 attrs.value 解析 option
			const dataAttr = this.data.data && this.data.data.attrs;
			if (!dataAttr || !dataAttr.value) {
				console.warn('[towxml echarts] no attrs.value, data.data=', this.data.data);
				return;
			}
			let obj;
			try {
				obj = JSON.parse(decodeURIComponent(dataAttr.value));
			} catch (e) {
				console.warn('[towxml echarts] JSON parse failed:', e && e.message);
				return;
			}
			// 兼容 {option:{...}, height?} / 直接 option 两种数据格式
			const option = obj && obj.option ? obj.option : obj;
			if (!option || typeof option !== 'object') {
				console.warn('[towxml echarts] invalid option');
				return;
			}
			if (!option.color) {
				option.color = ['#60acfc', '#32d3eb', '#5bc49f', '#feb64d', '#ff7c7c', '#9287e7'];
			}
			self._option = option;
			if (obj && obj.height) {
				self.setData({ size: { height: obj.height } });
			}
			// 需要一个持有 option 的 ec.onInit(供 ready 阶段调 init 时使用)
		}
	},

	ready: function () {
		if (!this._option) return;
		// 直接用新版 canvas 2d(要求基础库 >= 2.9.0,现网基本全覆盖)
		// 延迟一 tick 保证 canvas DOM 就绪
		const self = this;
		setTimeout(() => self.initByNewWay(), 50);
	},

	// decode.wxml 上给 <echarts> 元素绑了 catch:tap="_tap" 等,组件必须有对应方法,
	// 否则事件路径查找失败,小程序会抛 "this._getData is not a function" 这种连锁错误
	methods: {
		_tap: function () {},
		_change: function () {},

		initByNewWay() {
			const self = this;
			wx.createSelectorQuery()
				.in(this)
				.select('.ec-canvas')
				.fields({ node: true, size: true })
				.exec(res => {
					if (!res || !res[0] || !res[0].node) {
						console.warn('[towxml echarts] canvas node not found');
						return;
					}
					const canvasNode = res[0].node;
					const width = res[0].width;
					const height = res[0].height;
					const dpr = wx.getSystemInfoSync().pixelRatio || 1;
					const ctx2d = canvasNode.getContext('2d');
					// 关键:告诉 canvas 实际像素尺寸(乘以 dpr 才清晰)
					canvasNode.width = width * dpr;
					canvasNode.height = height * dpr;
					const canvas = new WxCanvas(ctx2d, self.data.canvasId, true, canvasNode);

					if (echarts.setPlatformAPI) {
						echarts.setPlatformAPI({
							createCanvas: () => canvas,
							loadImage: (src, onload, onerror) => {
								if (canvasNode.createImage) {
									const img = canvasNode.createImage();
									img.onload = onload;
									img.onerror = onerror;
									img.src = src;
									return img;
								}
							}
						});
					} else {
						echarts.setCanvasCreator(() => canvas);
					}
					echarts.registerTheme('dark', darkTheme);
					const chart = echarts.init(canvas, null, {
						width: width,
						height: height,
						devicePixelRatio: dpr
					});
					self.chart = chart;
					if (canvas && typeof canvas.setChart === 'function') canvas.setChart(chart);
					chart.setOption(self._option);
				});
		},

		initByOldWay() {
			const self = this;
			oldCtx = wx.createCanvasContext(this.data.canvasId, this);
			const canvas = new WxCanvas(oldCtx, this.data.canvasId, false);
			if (echarts.setPlatformAPI) {
				echarts.setPlatformAPI({ createCanvas: () => canvas });
			} else {
				echarts.setCanvasCreator(() => canvas);
			}
			echarts.registerTheme('dark', darkTheme);
			wx.createSelectorQuery()
				.in(this)
				.select('.ec-canvas')
				.boundingClientRect(res => {
					if (!res) return;
					const chart = echarts.init(canvas, null, {
						width: res.width,
						height: res.height
					});
					self.chart = chart;
					if (canvas && typeof canvas.setChart === 'function') canvas.setChart(chart);
					chart.setOption(self._option);
				})
				.exec();
		},

		touchStart(e) {
			if (this.chart && e.touches.length > 0) {
				const touch = e.touches[0];
				const handler = this.chart.getZr().handler;
				handler.dispatch('mousedown', { zrX: touch.x, zrY: touch.y });
				handler.dispatch('mousemove', { zrX: touch.x, zrY: touch.y });
				handler.processGesture(wrapTouch(e), 'start');
			}
		},

		touchMove(e) {
			if (this.chart && e.touches.length > 0) {
				const touch = e.touches[0];
				const handler = this.chart.getZr().handler;
				handler.dispatch('mousemove', { zrX: touch.x, zrY: touch.y });
				handler.processGesture(wrapTouch(e), 'change');
			}
		},

		touchEnd(e) {
			if (this.chart) {
				const touch = (e.changedTouches && e.changedTouches[0]) || {};
				const handler = this.chart.getZr().handler;
				handler.dispatch('mouseup', { zrX: touch.x, zrY: touch.y });
				handler.dispatch('click', { zrX: touch.x, zrY: touch.y });
				handler.processGesture(wrapTouch(e), 'end');
			}
		}
	}
});

function wrapTouch(event) {
	for (let i = 0; i < event.touches.length; ++i) {
		const touch = event.touches[i];
		touch.offsetX = touch.x;
		touch.offsetY = touch.y;
	}
	return event;
}
