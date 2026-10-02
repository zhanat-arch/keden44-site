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
