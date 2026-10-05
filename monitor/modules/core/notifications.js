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

export function controlsFromHistory(history = []) {
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
    const goods = assignment?.goods || text.match(/в отношении товаров?\s+(.+?)\s+по\s+ДТ/i)?.[1]?.trim() || '';
    const normalized = fullName.toLowerCase().replace(/[«»"']/g, '').replace(/ё/g, 'е');
    let label = fullName;
    if (/досмотр/i.test(fullName)) label = 'Досмотр';
    else if (/ИДК|инспекционно/i.test(fullName)) label = 'ИДК';
    else if (/экспертиз/i.test(fullName)) label = 'Экспертиза';
    else if (/интеллектуаль|\bОИС\b/i.test(fullName)) label = 'ОИС';
    else if (/запрет|ограничен/i.test(fullName)) label = 'Запреты';
    else if (/платеж/i.test(fullName)) label = 'Платежи';
    else if (/ЦЭД/i.test(fullName)) label = 'ЦЭД';
    else if (/ГДУ|таможенн\w*\s+стоимост/i.test(fullName)) label = 'ГДУ';
    else if (/ДГД/i.test(fullName)) label = 'ДГД';
    else if (/ПОСТ/i.test(fullName)) label = 'ПОСТ';
    const key = `${normalized}\u0000${goods}`;
    // A completion without goods cannot safely close separate goods-specific controls.
    controls.set(key, { name: fullName, label, goods, completed });
  }
  return [...controls.values()];
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
