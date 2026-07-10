/**
 * 组件全览页 · chart 组件真 echarts 渲染
 * 从 CDN 加载 echarts,在页面所有 [data-chart] 容器里初始化对应类型的示意图
 */
(function () {
  // 优先国内 CDN,失败自动回落.只保留最快的两个,不再多层 fallback 拖慢首次加载.
  const SCRIPT_URLS = [
    'https://cdn.bootcdn.net/ajax/libs/echarts/5.4.3/echarts.min.js',      // BootCDN(国内,主)
    'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js',       // jsDelivr(境外,备)
  ];
  // 颜色从 CSS 变量实时读取,主题切换时 refreshColors() 重新取值,图表跟随主题
  let ACCENT = '#FF8200', ACCENT_WARM = '#FFB347', HL = '#FFB700',
      LINE = '#EFE0CC', INK = '#1A1A1A', INK_MUTE = '#8B8B8B';
  function refreshColors() {
    const cs = getComputedStyle(document.documentElement);
    ACCENT      = cs.getPropertyValue('--accent').trim()      || '#FF8200';
    ACCENT_WARM = cs.getPropertyValue('--accent-warm').trim() || '#FFB347';
    HL          = cs.getPropertyValue('--hl').trim()          || '#FFB700';
    LINE        = cs.getPropertyValue('--line').trim()        || '#EFE0CC';
    INK         = cs.getPropertyValue('--ink').trim()         || '#1A1A1A';
    INK_MUTE    = cs.getPropertyValue('--ink-mute').trim()    || '#8B8B8B';
  }
  refreshColors();
  // 把 ACCENT hex 转 rgba,用于 area fill 渐变 —— 主题切换时跟随
  function accentRgba(alpha) {
    const h = ACCENT.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      // crossorigin: 匿名 CORS 请求,让 Service Worker 能把跨域资源存进 cache
      // (不加就是 no-cors 模式,响应是 opaque,cache 存了取不出来)
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function baseGrid() {
    return { left: 30, right: 12, top: 20, bottom: 20, containLabel: true };
  }
  function baseAxis() {
    return {
      axisLine: { lineStyle: { color: LINE } },
      axisTick: { show: false },
      axisLabel: { color: INK_MUTE, fontSize: 10 },
      splitLine: { lineStyle: { color: LINE, type: 'dashed' } },
    };
  }

  // RECIPES:接受 opt = { labels?, data?, title? } 让 playground 里通过 attrs 传入真实数据.
  // 全部字段可选,缺失时用示例数据(组件全览页用).
  const RECIPES = {
    line: (opt) => {
      opt = opt || {};
      const labels = opt.labels && opt.labels.length ? opt.labels : ['Q1', 'Q2', 'Q3', 'Q4'];
      const data = opt.data && opt.data.length ? opt.data.map(Number) : [820, 1050, 1180, 1240];
      return {
        grid: baseGrid(),
        xAxis: { type: 'category', data: labels, ...baseAxis() },
        yAxis: { type: 'value', ...baseAxis() },
        series: [{
          type: 'line', smooth: true, data,
          lineStyle: { color: ACCENT, width: 3 },
          itemStyle: { color: ACCENT }, symbolSize: 8,
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: accentRgba(0.32) }, { offset: 1, color: accentRgba(0.03) },
          ]}},
        }],
      };
    },
    bar: (opt) => {
      opt = opt || {};
      const labels = opt.labels && opt.labels.length ? opt.labels : ['iPhone', 'Mac', 'iPad', 'Watch'];
      const data = opt.data && opt.data.length ? opt.data.map(Number) : [12000, 8500, 6200, 4300];
      return {
        grid: baseGrid(),
        xAxis: { type: 'category', data: labels, ...baseAxis() },
        yAxis: { type: 'value', ...baseAxis() },
        series: [{
          type: 'bar', data,
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: ACCENT }, { offset: 1, color: ACCENT_WARM }],
            },
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: '55%',
        }],
      };
    },
    pie: (opt) => {
      opt = opt || {};
      const labels = opt.labels && opt.labels.length ? opt.labels : ['电商', '私域', '线下'];
      const data = opt.data && opt.data.length ? opt.data.map(Number) : [45, 30, 25];
      const colors = [ACCENT, ACCENT_WARM, accentRgba(0.35), LINE, INK_MUTE];
      return {
        series: [{
          type: 'pie', radius: ['48%', '72%'], center: ['50%', '50%'],
          data: labels.map((name, i) => ({ value: data[i] || 0, name, itemStyle: { color: colors[i % colors.length] } })),
          label: { fontSize: 10, color: INK_MUTE, formatter: '{b}\n{d}%' },
          labelLine: { length: 6, length2: 6 },
        }],
      };
    },
    sparkline: (opt) => {
      opt = opt || {};
      const data = opt.data && opt.data.length ? opt.data.map(Number) : [10, 15, 8, 20, 25, 18, 30];
      return {
        grid: { left: 0, right: 0, top: 8, bottom: 8 },
        xAxis: { type: 'category', show: false, boundaryGap: false, data: data.map((_, i) => i) },
        yAxis: { type: 'value', show: false },
        series: [{
          type: 'line', smooth: true, data,
          lineStyle: { color: ACCENT, width: 2 },
          symbol: 'none',
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: accentRgba(0.4) }, { offset: 1, color: accentRgba(0) },
          ]}},
        }],
      };
    },
    radar: (opt) => {
      opt = opt || {};
      const labels = opt.labels && opt.labels.length ? opt.labels : ['销售', '营销', '产品', '技术'];
      const data = opt.data && opt.data.length ? opt.data.map(Number) : [80, 70, 90, 85];
      return {
        radar: {
          indicator: labels.map((name) => ({ name, max: 100 })),
          radius: '62%',
          splitLine: { lineStyle: { color: LINE } },
          splitArea: { areaStyle: { color: [accentRgba(0.02), 'transparent'] } },
          axisLine: { lineStyle: { color: LINE } },
          axisName: { color: INK_MUTE, fontSize: 10 },
        },
        series: [{
          type: 'radar',
          data: [{ value: data,
            areaStyle: { color: accentRgba(0.24) },
            lineStyle: { color: ACCENT, width: 2 },
            itemStyle: { color: ACCENT },
          }],
        }],
      };
    },
    ring: (opt) => {
      opt = opt || {};
      const v = opt.data && opt.data.length ? Number(opt.data[0]) : 72;
      const centerLabel = opt.title || '完成度';
      return {
        series: [{
          type: 'pie', radius: ['62%', '80%'], center: ['50%', '50%'],
          data: [
            { value: v, itemStyle: { color: ACCENT } },
            { value: Math.max(0, 100 - v), itemStyle: { color: LINE } },
          ],
          label: { show: false }, labelLine: { show: false },
          startAngle: 90,
        }],
        graphic: [
          { type: 'text', left: 'center', top: '38%',
            style: { text: v + '%', fontFamily: 'Songti SC, serif', fontSize: 24, fontWeight: 800, fill: ACCENT } },
          { type: 'text', left: 'center', top: '58%',
            style: { text: centerLabel, fontSize: 10, fill: INK_MUTE } },
        ],
      };
    },
    rank: (opt) => {
      // 横向条形图排行
      opt = opt || {};
      const labels = opt.labels && opt.labels.length ? opt.labels : ['A', 'B', 'C', 'D', 'E'];
      const data = opt.data && opt.data.length ? opt.data.map(Number) : [90, 75, 60, 40, 25];
      return {
        grid: { left: 60, right: 20, top: 8, bottom: 8, containLabel: true },
        xAxis: { type: 'value', show: false },
        yAxis: { type: 'category', data: labels.slice().reverse(), ...baseAxis(), axisTick: { show: false }, axisLine: { show: false } },
        series: [{
          type: 'bar', data: data.slice().reverse(),
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [{ offset: 0, color: ACCENT_WARM }, { offset: 1, color: ACCENT }] },
            borderRadius: [0, 4, 4, 0],
          },
          barWidth: '55%',
          label: { show: true, position: 'right', color: INK_MUTE, fontSize: 10 },
        }],
      };
    },
  };
  // 暴露给 web-renderer(playground) 用
  window.PgChartRecipes = RECIPES;
  // 让 playground 切主题时能重读 CSS 变量再重画
  window.PgChartRefreshColors = refreshColors;

  function initOne(el) {
    if (el.dataset.chartInited) return;   // 幂等,避免懒加载 + tab 切换重复 init
    const type = el.getAttribute('data-chart');
    const build = RECIPES[type];
    if (!build || typeof window.echarts === 'undefined') return;
    // 保证有尺寸
    if (el.clientWidth === 0) el.style.width = '240px';
    if (el.clientHeight === 0) el.style.height = '140px';
    const inst = window.echarts.init(el);
    // 关掉初始动画,雷达/大图初始化的 500-1000ms 动画在批量场景下会明显卡
    refreshColors();
    inst.setOption(Object.assign({ animation: false }, build()));
    el.dataset.chartInited = '1';
    // 主题切换时重画(此时可以让动画开着,单个 chart 重画不卡)
    const obs = new MutationObserver(function () { refreshColors(); inst.setOption(build()); });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // 懒加载:视口内的 chart 才 init;不在视口的先按占位,滚动到附近再唤醒
  function initAll() {
    const all = document.querySelectorAll('[data-chart]');
    if (!('IntersectionObserver' in window)) {
      all.forEach(initOne);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          initOne(e.target);
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '200px' });   // 提前 200px 唤醒,滚到跟前时已渲好
    all.forEach((el) => io.observe(el));
  }

  function loadEchartsWithFallback(urls, idx) {
    idx = idx || 0;
    if (idx >= urls.length) {
      console.warn('[echarts] all CDN sources failed');
      return Promise.reject(new Error('all sources failed'));
    }
    return loadScript(urls[idx]).catch(() => loadEchartsWithFallback(urls, idx + 1));
  }

  function boot() {
    if (window.echarts) { initAll(); fireReady(); return; }
    loadEchartsWithFallback(SCRIPT_URLS).then(() => { initAll(); fireReady(); }).catch(() => {
      // 全部失败,悄悄降级
    });
  }
  // 通知 playground:echarts 到位了,可以补渲染已在页面上的 chart 容器
  function fireReady() {
    window.__pgEchartsReady = true;
    try { window.dispatchEvent(new Event('pg-echarts-ready')); } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
