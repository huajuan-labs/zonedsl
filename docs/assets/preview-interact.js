/**
 * 组件全览页 · 微缩 preview 交互增强
 * 用事件委托 + 兄弟节点操作,让 tabs/checkbox/radio/quiz/accordion/button 都能真点/切/选
 */
(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    document.body.addEventListener('click', function (e) {
      // ---------- tabs ----------
      const tab = e.target.closest('.i-tab');
      if (tab) {
        const tabs = tab.parentElement.querySelectorAll('.i-tab');
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        return;
      }

      // ---------- checkbox / checkbox-group ----------
      const cb = e.target.closest('.i-checkbox');
      if (cb) {
        // 判断当前 on/off
        const isOn = cb.classList.contains('on') || (!cb.classList.contains('off') && cb.querySelector('.i-checkbox-box')?.textContent === '✓');
        if (isOn) {
          cb.classList.remove('on');
          cb.classList.add('off');
        } else {
          cb.classList.remove('off');
          cb.classList.add('on');
          // 保证 box 里有 ✓
          const box = cb.querySelector('.i-checkbox-box');
          if (box && !box.textContent.trim()) box.textContent = '✓';
        }
        return;
      }

      // ---------- radio / radio-group(同组互斥) ----------
      const r = e.target.closest('.i-radio');
      if (r) {
        const group = r.closest('.i-group-row') || r.parentElement;
        group.querySelectorAll('.i-radio').forEach((x) => {
          x.classList.remove('on');
          x.classList.add('off');
        });
        r.classList.remove('off');
        r.classList.add('on');
        return;
      }

      // ---------- quiz option ----------
      const q = e.target.closest('.i-quiz-opt');
      if (q) {
        q.parentElement.querySelectorAll('.i-quiz-opt').forEach((x) => x.classList.remove('active'));
        q.classList.add('active');
        return;
      }

      // ---------- accordion 展开/收起 ----------
      const accHeader = e.target.closest('.i-acc-header');
      if (accHeader) {
        const item = accHeader.closest('.i-acc-item');
        // 收起同 accordion 里其他
        const acc = item.closest('.i-acc');
        if (acc) acc.querySelectorAll('.i-acc-item').forEach((x) => { if (x !== item) x.classList.remove('open'); });
        item.classList.toggle('open');
        // 惰性补充 body 内容(如果没有)
        if (item.classList.contains('open') && !item.querySelector('.i-acc-body')) {
          const body = document.createElement('div');
          body.className = 'i-acc-body';
          body.textContent = '这是折叠内容示意——真实内容按 item 的 desc 字段渲染。';
          item.appendChild(body);
        }
        return;
      }

      // ---------- button(preview 里的示意按钮) ----------
      const btn = e.target.closest('.i-button');
      if (btn) {
        // 视觉反馈,防真跳转
        e.preventDefault();
        btn.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(0.94)' }, { transform: 'scale(1)' }],
          { duration: 180, easing: 'ease-out' }
        );
        return;
      }

      // ---------- select(preview 版模拟点击弹出提示) ----------
      const sel = e.target.closest('.i-select');
      if (sel) {
        sel.style.borderColor = 'var(--accent)';
        setTimeout(() => { sel.style.borderColor = ''; }, 300);
        return;
      }
    });

    // 初始态:给 checkbox-group 里已 checked 的加 .on,未选的加 .off,便于点击切换
    document.querySelectorAll('.i-checkbox').forEach((cb) => {
      const box = cb.querySelector('.i-checkbox-box');
      if (box && box.textContent.trim() === '✓') cb.classList.add('on');
      else cb.classList.add('off');
    });
    document.querySelectorAll('.i-radio').forEach((r) => {
      const circle = r.querySelector('.i-radio-circle');
      // 简单启发:有 ::after 白点(inline style 有 background:#fff)的是未选
      const style = circle && circle.getAttribute('style') || '';
      if (style.indexOf('background:#fff') !== -1 || style.indexOf('background: #fff') !== -1) {
        r.classList.add('off');
      } else {
        r.classList.add('on');
      }
    });
  });
})();
