const token = location.hash.slice(1);
const card = document.querySelector('#card');
const message = document.querySelector('#message');
const refresh = document.querySelector('#refresh');
let stopped = false, loading = false, lastSynced = '';
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('ru-RU') : value;
function clearCard() {
  document.querySelector('#addToMonitor').hidden = true;
  card.hidden = true;
  document.querySelector('#number').textContent = '';
  document.querySelector('#status').textContent = '';
  document.querySelector('#details').replaceChildren();
  document.querySelector('#events').replaceChildren();
  document.querySelector('#notifications').hidden = true;
  document.querySelector('#sync').textContent = '';
}
async function load() {
  if (loading || stopped) return;
  if (!/^[a-f0-9]{64}$/.test(token)) {stopped = true; clearCard(); message.textContent = 'Неверная ссылка на карточку'; return;}
  loading = true;
  refresh.disabled = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.keden44.com/v1/telegram/cards/read', {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({token}), cache: 'no-store', signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer'
    });
    const data = await response.json();
    if (response.status === 404) {stopped = true; clearCard(); message.textContent = 'Владелец отключил доступ или удалил карточку'; return;}
    if (!response.ok || !data.ok) throw new Error('Недоступно');
    const record = data.record;
    document.querySelector('#number').textContent = [record.regime, record.dtNumber].filter(Boolean).join(' · ');
    document.querySelector('#status').textContent = record.status || 'Статус пока не указан';
    document.querySelector('#inspection').hidden = !record.onInspection;
    const details = document.querySelector('#details');
    details.replaceChildren();
    for (const [label, value] of [['Декларант', record.declarant], ['Первый товар', record.goods], ['Дата выпуска', record.releaseDate], ['Продлено до', record.conditionalExtendedUntil], ['Последняя проверка', date(record.checkedAt)], ['Последнее уведомление', date(record.lastKedenNotificationAt)]]) {
      if (!value) continue;
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = value; details.append(dt, dd);
    }
    const events = document.querySelector('#events');
    events.replaceChildren();
    document.querySelector('#notifications').hidden = !Array.isArray(record.notifications);
    if (Array.isArray(record.notifications)) {
      for (const item of record.notifications) {
        const entry = document.createElement('div'), time = document.createElement('small'), text = document.createElement('p');
        entry.className = 'sharedNotification'; time.textContent = item.date; text.textContent = item.text;
        entry.append(time, text); events.append(entry);
      }
      if (!record.notifications.length) events.textContent = 'Сохранённых уведомлений пока нет';
    }
    card.hidden = false;
    const add = document.querySelector('#addToMonitor');
    add.href = '/monitor/#card=' + token;
    add.hidden = false;
    lastSynced = data.syncedAt;
    message.textContent = 'Данные монитора владельца · обновление каждые 30 секунд';
    document.querySelector('#sync').textContent = 'Последняя синхронизация владельца: ' + (date(lastSynced) || 'не указана');
  } catch {
    message.textContent = 'Свежие данные получить не удалось. Повторим автоматически.';
    if (lastSynced) document.querySelector('#sync').textContent = 'Показаны ранее полученные данные от ' + date(lastSynced);
  } finally {clearTimeout(timeout); loading = false; refresh.disabled = stopped;}
}
refresh.onclick = load;
document.addEventListener('visibilitychange', () => {if (!document.hidden) load();});
setInterval(() => {if (!document.hidden) load();}, 30000);
load();
