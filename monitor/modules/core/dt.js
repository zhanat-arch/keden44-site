export function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

export function isReleased(status = '') {
  return (status.toLowerCase().includes('выпущ') && !isConditionalRelease(status) && !isSecuredRelease(status)) || isCleared(status);
}

export function isCleared(status = '') {
  return String(status).toLowerCase().includes('очищ');
}

export function isConditionalRelease(status = '') {
  const value = String(status).toLowerCase();
  return value.includes('условн') && (value.includes('выпуск') || value.includes('выпущ'));
}

export function isSecuredRelease(status = '') {
  const value = String(status).toLowerCase();
  return value.includes('обеспеч') && (value.includes('выпуск') || value.includes('выпущ'));
}

export function statusKind(status = '') {
  const value = status.toLowerCase();
  if (isConditionalRelease(value) || isSecuredRelease(value)) return 'conditional';
  if (value.includes('выпущ') || isCleared(value)) return 'released';
  if (value.includes('нужна проверка') || value.includes('нужна основная') || value.includes('отказ') || value.includes('ошиб') || value.includes('аннулир') || value.includes('отклон')) return 'problem';
  return 'work';
}

export function needsAttention(record = {}) {
  if (record.archived) return false;
  if (record.changed || record.requiresMainDt || !record.kedenUrl) return true;
  const status = String(record.status || '').toLowerCase();
  return statusKind(status) === 'problem' || status.includes('нужна проверка');
}

export function dtFromFileName(name = '') {
  const m = name.match(/(\d{5})[_-](\d{6})[_-](\d{7})(?:[_-](\d+))?/);
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join('/') : '';
}

export function declarationNumberParts(value = '') {
  const normalized = String(value).trim().replace(/[_-]/g, '/');
  const match = normalized.match(/^(\d{5})\/(\d{6})\/(\d{7})(?:\/(\d+))?/);
  if (!match) return { fullNumber: normalized, baseNumber: normalized, correctionIndex: '', isCorrection: false };
  const baseNumber = [match[1], match[2], match[3]].join('/');
  const correctionIndex = match[4] || '';
  return {
    fullNumber: correctionIndex ? `${baseNumber}/${correctionIndex}` : baseNumber,
    baseNumber,
    correctionIndex,
    isCorrection: Boolean(correctionIndex)
  };
}

export function declarationSectionFromDtNumber(value = '') {
  const sequence = declarationNumberParts(value).baseNumber.split('/')[2] || '';
  if (sequence.startsWith('1')) return 'ВТО';
  if (sequence.startsWith('0')) return 'ЕТТ';
  return '';
}

export function parseReleaseDate(value = '') {
  const match = String(value).match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, day, month, year, hour = '00', minute = '00'] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isRecentRelease(releaseDate, recentDays = 3, now = new Date()) {
  const date = parseReleaseDate(releaseDate);
  if (!date) return true;
  return now.getTime() - date.getTime() <= Number(recentDays || 3) * 86400000;
}

export function submissionDateFromDtNumber(dtNumber = '') {
  const parts = declarationNumberParts(dtNumber).baseNumber.split('/');
  if (parts.length < 2 || !/^\d{6}$/.test(parts[1])) return null;
  const day = Number(parts[1].slice(0, 2));
  const month = Number(parts[1].slice(2, 4));
  const year = 2000 + Number(parts[1].slice(4, 6));
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function conditionalReleaseDeadline(dtNumber, days = 60) {
  const date = submissionDateFromDtNumber(dtNumber);
  if (!date) return null;
  date.setDate(date.getDate() + Number(days || 60));
  return date;
}

export function daysUntil(date, now = new Date()) {
  if (!date) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.ceil((end - start) / 86400000);
}
