/**
 * ::ZoneDSL 官网主题切换器(下拉版)
 * - 12 套主题 · 挂在 <html data-theme="xxx"> 上
 * - localStorage 跨页面记忆
 * - 挂载点:nav 右上角
 */
(function () {
  const THEMES = [
    { key: 'editorial', short: '暖橙',    label: '暖橙 · Editorial',  dot: '#FF8200' },
    { key: 'literary',  short: '人文',    label: '人文 · Literary',   dot: '#A17141' },
    { key: 'serious',   short: '严肃',    label: '严肃 · Serious',    dot: '#0F0F0F' },
    { key: 'data',      short: '数据',    label: '数据 · Data',       dot: '#2563EB' },
    { key: 'serene',    short: '人文青绿',    label: '人文青绿 · Serene',     dot: '#5E8265' },
    { key: 'warm',      short: '暖调',    label: '暖调 · Warm',       dot: '#C56F3E' },
    { key: 'luxe',      short: '金铜',    label: '金铜 · Luxe',       dot: '#A88232' },
    { key: 'purple',    short: '紫底',    label: '紫底 · Purple',     dot: '#7C6EE0' },
    { key: 'sky',       short: '蓝底',    label: '蓝底 · Sky',        dot: '#4A87E8' },
    { key: 'pop',       short: '红粉',    label: '红粉 · Pop',        dot: '#FF4D75' },
    { key: 'sage',      short: '深绿',    label: '深绿 · Sage',       dot: '#2F4F3F' },
    { key: 'note',      short: '极简',    label: '极简 · Note',       dot: '#FF4D75' },
  ];

  const STORAGE_KEY = 'zonedsl-docs-theme';

  function currentTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && THEMES.some((t) => t.key === stored)) return stored;
    } catch (_) {}
    return 'editorial';
  }

  function currentMeta() {
    return THEMES.find((t) => t.key === currentTheme()) || THEMES[0];
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
    updateToggle();
    renderButtons(theme);
  }

  function updateToggle() {
    const meta = currentMeta();
    const dotEl = document.querySelector('.theme-switcher-toggle .ts-dot');
    const nameEl = document.querySelector('.theme-switcher-toggle .ts-name');
    if (dotEl) dotEl.style.background = meta.dot;
    if (nameEl) nameEl.textContent = meta.short || meta.key;
  }

  function renderButtons(active) {
    const btns = document.querySelectorAll('.theme-btn');
    btns.forEach((b) => {
      if (b.dataset.theme === active) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  function mount() {
    // 立即挂 data-theme 避免闪烁
    setTheme(currentTheme());

    // 找 nav-links 容器并把 switcher 追加进去
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    const wrap = document.createElement('div');
    wrap.className = 'theme-switcher';
    wrap.innerHTML = `
      <button class="theme-switcher-toggle" type="button">
        <span class="ts-dot"></span>
        <span class="ts-name">editorial</span>
        <span class="ts-caret">▼</span>
      </button>
      <div class="theme-switcher-body">
        ${THEMES.map((t) => `
          <button class="theme-btn" type="button" data-theme="${t.key}">
            <span class="dot" style="background:${t.dot}"></span>
            <span class="theme-label">${t.label}</span>
            <span class="theme-check">✓</span>
          </button>
        `).join('')}
      </div>
    `;

    const toggle = wrap.querySelector('.theme-switcher-toggle');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      wrap.classList.toggle('open');
    });

    // 外部点击关闭
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) wrap.classList.remove('open');
    });

    // 按钮点击选主题
    wrap.querySelectorAll('.theme-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setTheme(btn.dataset.theme);
        wrap.classList.remove('open');
      });
    });

    navLinks.appendChild(wrap);
    updateToggle();
    renderButtons(currentTheme());

    // 移动端抽屉里克隆一份主题切换器,让菜单里也能切
    const drawerPanel = document.querySelector('.nav-drawer-panel');
    if (drawerPanel) {
      const drawerWrap = wrap.cloneNode(true);
      // 克隆节点没绑事件,重新绑
      const dToggle = drawerWrap.querySelector('.theme-switcher-toggle');
      dToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        drawerWrap.classList.toggle('open');
      });
      drawerWrap.querySelectorAll('.theme-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          setTheme(btn.dataset.theme);
          drawerWrap.classList.remove('open');
        });
      });
      drawerPanel.appendChild(drawerWrap);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
