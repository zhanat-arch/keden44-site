const IDS = ['changed', 'work', 'released', 'conditional', 'archive'];
export function createBoardView(render) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('keden44-board-view-v1') || '{}') || {}; } catch {}
  const order = [...new Set([...(Array.isArray(saved.order) ? saved.order : []), ...IDS])].filter(id => IDS.includes(id));
  const counts = {}, visible = {}, controls = {};
  const save = () => { try { localStorage.setItem('keden44-board-view-v1', JSON.stringify({ order, counts })); } catch {} };
  const limit = id => visible[id] ?? (counts[id] || Infinity);
  const refresh = () => order.forEach((id, index) => {
    document.querySelector('.board').append(controls[id].lane);
    controls[id].menu.querySelector('[data-step="-1"]').disabled = index === 0;
    controls[id].menu.querySelector('[data-step="1"]').disabled = index === order.length - 1;
  });
  for (const id of IDS) {
    const value = Number(saved.counts?.[id]);
    counts[id] = Number.isSafeInteger(value) && value > 0 ? value : matchMedia('(max-width:720px)').matches ? 5 : 20;
    const lane = document.getElementById(id).closest('.lane');
    const head = lane.querySelector('.head');
    const menu = document.createElement('details');
    menu.className = 'sectionMenu';
    menu.innerHTML = '<summary title="Настройки раздела" aria-label="Настройки раздела">⋯</summary><div class="sectionMenuBody"><strong>Переместить раздел</strong><div class="sectionMove"><button type="button" data-step="-1" title="Раньше" aria-label="Переместить раньше">←</button><button type="button" data-step="1" title="Позже" aria-label="Переместить позже">→</button></div><label>Карточек в разделе<input type="number" min="1" step="1" inputmode="numeric" required></label></div>';
    head.prepend(menu);
    menu.querySelector('summary').setAttribute('aria-label', 'Настройки раздела: ' + head.querySelector('h2').textContent);
    const input = menu.querySelector('input');
    input.value = String(counts[id]);
    const applyCount = () => {
      const value = Number(input.value);
      if (!input.checkValidity() || !Number.isSafeInteger(value) || value < 1) { input.reportValidity(); return; }
      counts[id] = value; delete visible[id]; save(); render();
    };
    input.addEventListener('change', applyCount);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); applyCount(); } });
    for (const button of menu.querySelectorAll('[data-step]')) button.addEventListener('click', () => {
      const index = order.indexOf(id), next = index + Number(button.dataset.step);
      if (next < 0 || next >= order.length) return;
      [order[index], order[next]] = [order[next], order[index]];
      save(); menu.open = false; refresh();
    });
    menu.addEventListener('toggle', () => { if (menu.open) for (const item of Object.values(controls)) if (item.menu !== menu) item.menu.open = false; });
    const footer = document.createElement('div');
    footer.className = 'sectionPagination';
    footer.innerHTML = '<button type="button" class="sectionMore"></button><button type="button" class="sectionAll"></button>';
    footer.querySelector('.sectionMore').addEventListener('click', () => { visible[id] = limit(id) + (counts[id] || 20); render(); });
    footer.querySelector('.sectionAll').addEventListener('click', () => { visible[id] = Infinity; render(); });
    lane.append(footer);
    controls[id] = { lane, menu, footer };
  }
  document.addEventListener('click', event => { for (const { menu } of Object.values(controls)) if (!menu.contains(event.target)) menu.open = false; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') for (const { menu } of Object.values(controls)) menu.open = false; });
  refresh();
  return { limit, update(id, total) {
    const footer = controls[id].footer, remaining = Math.max(0, total - limit(id));
    footer.hidden = !remaining;
    footer.querySelector('.sectionMore').textContent = 'Показать ещё (' + Math.min(remaining, counts[id] || 20) + ')';
    footer.querySelector('.sectionAll').textContent = 'Все (' + total + ')';
  } };
}
