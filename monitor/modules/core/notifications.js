function released(status = '') {
  const value = String(status).toLowerCase();
  return value.includes('выпущ') || value.includes('очищ');
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
