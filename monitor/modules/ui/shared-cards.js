const KEY = 'keden44-shared-card-links-v1';
const valid = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
export function installSharedCards() {
  const board = document.querySelector('.board');
  if (!board) return;
  let tokens = [];
  try {tokens = JSON.parse(localStorage.getItem(KEY) || '[]');} catch {}
  tokens = Array.isArray(tokens) ? [...new Set(tokens.filter(valid))].slice(0, 20) : [];
  const incoming = new URLSearchParams(location.hash.slice(1)).get('card');
  if (valid(incoming) && !tokens.includes(incoming) && tokens.length < 20) tokens.push(incoming);
  const save = () => {try {localStorage.setItem(KEY, JSON.stringify(tokens));} catch {}};
  save();
  if (valid(incoming)) history.replaceState(null, '', location.pathname + location.search);
  const lane = document.createElement('section');
  lane.className = 'lane sharedCardsLane';
  lane.setAttribute('aria-label', 'Доступные по ссылке ДТ');
  lane.innerHTML = '<div class="head"><h2>Доступ по ссылке</h2><span data-count></span></div><div class="list" data-list></div>';
  board.prepend(lane);
  const list = lane.querySelector('[data-list]');
  const nodes = new Map();
  const addText = (root, tag, value, className = '') => {
    const node = document.createElement(tag); node.textContent = value; node.className = className; root.append(node); return node;
  };
  for (const token of tokens) {
    const node = document.createElement('article');
    node.className = 'card sharedReadOnlyCard';
    const body = document.createElement('div'), state = document.createElement('p'), remove = document.createElement('button');
    state.textContent = 'Загружаю карточку…'; state.className = 'tiny'; state.setAttribute('role','status');
    remove.type = 'button'; remove.textContent = 'Убрать из моего монитора';
    remove.onclick = () => {tokens = tokens.filter(value => value !== token); save(); nodes.delete(token); node.remove(); updateCount();};
    node.append(body, state, remove); list.append(node);
    nodes.set(token, {body, state});
  }
  function updateCount() {lane.hidden = tokens.length === 0; lane.querySelector('[data-count]').textContent = String(tokens.length);}
  updateCount();
  let busy = false;
  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      await Promise.all(tokens.map(async token => {
        const target = nodes.get(token);
        if (!target) return;
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch('https://api.keden44.com/v1/telegram/cards/read', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
          if (response.status === 404) {target.body.replaceChildren(); target.state.textContent = 'Владелец прекратил доступ или удалил карточку'; return;}
          const data = await response.json();
          if (!response.ok || !data.ok) throw new Error('Недоступно');
          const record = data.record;
          target.body.replaceChildren();
          addText(target.body,'h3',[record.regime,record.dtNumber].filter(Boolean).join(' · '));
          addText(target.body,'p',record.status || 'Без статуса','sharedCardStatus');
          addText(target.body,'p','Только чтение · монитор владельца','tiny');
          if (record.declarant) addText(target.body,'p',record.declarant,'privateData');
          if (record.goods) addText(target.body,'p',record.goods,'privateData sharedCardGoods');
          if (record.releaseDate) addText(target.body,'p','Дата выпуска: '+record.releaseDate,'tiny');
          if (record.onInspection) addText(target.body,'p','На досмотре');
          if (Array.isArray(record.notifications)) {
            const details = document.createElement('details');
            addText(details,'summary','Уведомления · '+record.notifications.length);
            for (const event of record.notifications) {
              const entry = document.createElement('div'); entry.className = 'sharedNotification privateData';
              addText(entry,'small',event.date); addText(entry,'p',event.text); details.append(entry);
            }
            if (!record.notifications.length) addText(details,'p','Сохранённых уведомлений пока нет');
            target.body.append(details);
          }
          const time = data.syncedAt && Number.isFinite(Date.parse(data.syncedAt)) ? new Date(data.syncedAt).toLocaleString('ru-RU') : 'не указана';
          target.state.textContent = 'Синхронизация владельца: '+time;
        } catch {target.state.textContent = 'Обновление недоступно. Ниже могут оставаться ранее полученные данные.';}
        finally {clearTimeout(timeout);}
      }));
    } finally {busy = false;}
  }
  setInterval(refresh,30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  refresh();
}
