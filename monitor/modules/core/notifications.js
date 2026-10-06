function released(status = '') {
  const value = String(status).toLowerCase();
  return value.includes('выпущ') || value.includes('очищ');
}

export function notificationTimestamp(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (value instanceof Date) return value.getTime();
  const text = String(value || '').trim();
  const ru = text.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s*,?\s*(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (ru) {
    const [, day, month, year, hours = '0', minutes = '0', seconds = '0'] = ru;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds)).getTime();
  }
  return Date.parse(text);
}

export function inspectionStateFromNotification(current, value = '') {
  const text = String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/досмотр/i.test(text)) return Boolean(current);
  if (/заверш[её]н|окончан|провед[её]н|снят|отмен[её]н/i.test(text)) return false;
  if (/назначен|начат|проводится|направлен/i.test(text)) return true;
  return Boolean(current);
}

export function controlAssignmentFromNotification(value = '') {
  const text = String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const control = text.match(/назначен(?:\s+следующий)?\s+вид контроля\s+(.+?)(?=\s*[.;]?\s*Исполнитель(?:\s|:)|$)/i)?.[1]
    ?.replace(/[.;,\s]+$/, '').trim();
  if (!control) return null;
  const goods = text.match(/в отношении товаров?\s+(.+?)\s+по\s+ДТ(?:\s|№)/i)?.[1]?.trim() || '';
  const inspector = text.match(/Исполнитель\s*:\s*(.+)$/i)?.[1]
    ?.replace(/\s+(?:0[1I]M[A-Z0-9]+|NOTIF_[A-Z0-9_]+|<!doctype|<html)[\s\S]*$/i, '')
    .replace(/^ФИО\s+/i, '').trim() || '';
  return { goods: goods.slice(0, 120), control: control.slice(0, 300), inspector: inspector.slice(0, 180) };
}

export function summarizeControlAssignments(items = []) {
  const groups = new Map();
  for (const item of items) {
    const control = String(item.control || '').trim();
    if (!control) continue;
    const inspector = String(item.inspector || '').trim();
    const goods = String(item.goods || '').trim();
    const key = `${goods}\u0000${control}\u0000${inspector}`;
    const group = groups.get(key) || { control, inspector, goods, dates: new Set() };
    if (item.date) group.dates.add(String(item.date).trim());
    groups.set(key, group);
  }
  return {
    date: '',
    lines: [...groups.values()].map(group => {
      const date = group.dates.size === 1 ? `${[...group.dates][0]} — ` : '';
      return `${date}товары ${group.goods || 'не указаны'}: ${group.control}${group.inspector ? ` · инспектор: ${group.inspector}` : ''}`;
    })
  };
}

export function controlsFromHistory(history = [], status = '') {
  const controls = new Map();
  const events = history.map((line, index) => {
    const parts = String(line).split(': уведомление KEDEN:');
    return { text: parts.slice(1).join(': уведомление KEDEN:'), time: notificationTimestamp(parts[0]), index };
  }).filter(event => event.text).sort((a, b) => {
    if (Number.isFinite(a.time) && Number.isFinite(b.time)) return a.time - b.time || a.index - b.index;
    return a.index - b.index;
  });
  for (const event of events) {
    const text = event.text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const completed = /заверш[её]н\s+(?:следующий\s+)?вид контроля/i.test(text);
    const assignment = controlAssignmentFromNotification(text);
    const name = completed
      ? text.match(/заверш[её]н\s+(?:следующий\s+)?вид контроля\s+(.+?)(?=\s+(?:в отношении товаров?|по\s+ДТ)|$)/i)?.[1]
      : assignment?.control || text.match(/контроль\s+["«](.+?)["»].*?(?:переназначен|назначен)/i)?.[1];
    if (!name) continue;
    const fullName = name.replace(/\s+(?:в отношении товаров?|по\s+ДТ)[\s\S]*$/i, '').replace(/[.;,\s]+$/, '').trim();
    const normalized = fullName.toLowerCase().replace(/[«»"']/g, '').replace(/ё/g, 'е');
    let label = fullName;
    if (/досмотр/i.test(fullName)) label = 'Досмотр';
    else if (/ИДК|инспекционно/i.test(fullName)) label = 'ИДК';
    else if (/экспертиз/i.test(fullName)) label = 'Экспертиза';
    else if (/интеллектуаль|ОИС/i.test(fullName)) label = 'ОИС';
    else if (/запрет|ограничен/i.test(fullName)) label = 'Запреты';
    else if (/платеж/i.test(fullName)) label = 'Платежи';
    else if (/ЦЭД/i.test(fullName)) label = 'ЦЭД';
    else if (/ГДУ|таможенн\w*\s+стоимост/i.test(fullName)) label = 'ГДУ';
    else if (/ДГД/i.test(fullName)) label = 'ДГД';
    else if (/ПОСТ/i.test(fullName)) label = 'ПОСТ';
    if (!['Досмотр', 'ИДК', 'Экспертиза', 'ОИС', 'ГДУ'].includes(label)) continue;
    controls.set(normalized, { name: fullName, label, completed });
  }
  const groups = new Map();
  for (const control of controls.values()) {
    const existing = groups.get(control.label);
    groups.set(control.label, { ...control, completed: control.completed && (existing?.completed ?? true) });
  }
  const cleared = /очищен/i.test(status);
  const finalRelease = /выпущен|выпуск/i.test(status) && !/условн|обеспеч|отмен|отказ|не выпущ/i.test(status);
  return [...groups.values()].map(control => ({
    ...control,
    completed: control.completed || cleared || (finalRelease && control.label !== 'Экспертиза')
  }));
}

export function notificationForChange(previous, next, changes, settings) {
  if (!changes.length) return null;
  const name = next.name || next.dtNumber || 'ДТ';
  const statusChanged = String(previous.status || '') !== String(next.status || '');

  if (statusChanged && String(previous.status || '').toLowerCase().includes('условн') && String(next.status || '').toLowerCase().includes('очищ') && settings.notifyConditional) {
    return { title: 'Условный выпуск очищен', body: `${name}: ${next.status}` };
  }

  if (!released(previous.status) && released(next.status) && settings.notifyReleased) {
    return { title: 'ДТ выпущена', body: `${name}: ${next.status}` };
  }
  if (statusChanged && settings.notifyStatusChanges) {
    return { title: 'Статус ДТ изменился', body: `${name}: ${previous.status || '-'} -> ${next.status || '-'}` };
  }
  if (settings.notifyDataChanges) {
    return { title: 'Данные ДТ изменились', body: `${name}: ${changes[0]}` };
  }
  return null;
}

export function latestRequestFromHistory(history = []) {
  const events = history.map((line, index) => {
    const parts = String(line).split(': уведомление KEDEN:');
    return { text: parts.slice(1).join(': уведомление KEDEN:'), date: parts[0], time: notificationTimestamp(parts[0]), index };
  }).filter(event => event.text).sort((a, b) => Number.isFinite(a.time) && Number.isFinite(b.time) ? a.time - b.time || a.index - b.index : a.index - b.index);
  let request = null;
  for (const event of events) {
    const response = /ответ[а-яё]*[^.\n]*(?:на|по)\s+(?:дополнительн[а-яё]*\s+)?запрос/i.test(event.text)
      && /(?:отправлен|направлен|поступил|получен|предоставлен)[аоы]?/i.test(event.text);
    if (response) {
      if (request) request = { ...request, answeredAt: event.date, answeredTime: event.time };
    } else if (/дополнительн(?:ый|ого).*запрос|запрос.*(?:документ|сведени)/i.test(event.text)) {
      request = { date: event.date, time: event.time, text: event.text, answeredAt: '', answeredTime: NaN };
    }
  }
  return request;
}

export function visibleRequestForRecord(record = {}) {
  const request = latestRequestFromHistory(record.history);
  if (!request) return null;
  const status = String(record.status || '');
  if (!/выпущ|очищ|выпуск/i.test(status)) return request;
  let releaseTime = notificationTimestamp(record.releaseDate);
  let preciseRelease = /\d{1,2}:\d{2}/.test(String(record.releaseDate || ''));
  for (const line of record.history || []) {
    const parts = String(line).split(': уведомление KEDEN:');
    if (!/(?:^|\s)ДТ\s+\d{5}\/\d{6}\/\d{7}\s+(?:условно\s+)?(?:выпущен[ао]?|очищен[ао]?)/i.test(parts.slice(1).join(' '))) continue;
    const time = notificationTimestamp(parts[0]);
    if (Number.isFinite(time) && (!Number.isFinite(releaseTime) || time >= releaseTime)) {
      releaseTime = time;
      preciseRelease = /\d{1,2}:\d{2}/.test(parts[0]);
    }
  }
  if (!Number.isFinite(releaseTime) || !Number.isFinite(request.time)) return null;
  // Date-only releases cannot establish order within the same day.
  const boundary = preciseRelease ? releaseTime : releaseTime + 24 * 60 * 60_000 - 1;
  return request.time > boundary ? request : null;
}
