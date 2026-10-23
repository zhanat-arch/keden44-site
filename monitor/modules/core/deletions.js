function baseNumber(value) {
  return String(value || '').replace(/[._-]/g, '/').match(/^\d{5}\/\d{6}\/\d{7}(?!\d)/)?.[0] || '';
}

export function mergeRecordDeletions(...sources) {
  const merged = new Map();
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const entry of source) {
      if (!entry || typeof entry.id !== 'string' || !entry.id || entry.id.length > 200 || !Number.isFinite(Date.parse(entry.deletedAt))) continue;
      const previous = merged.get(entry.id);
      if (!previous || Date.parse(entry.deletedAt) > Date.parse(previous.deletedAt)) {
        merged.set(entry.id, { id: entry.id, dtNumber: baseNumber(entry.dtNumber), deletedAt: new Date(entry.deletedAt).toISOString() });
      }
    }
  }
  return [...merged.values()];
}

export function isRecordDeleted(record, deletions) {
  if (!record || typeof record !== 'object') return true;
  return (Array.isArray(deletions) ? deletions : []).some(entry => entry.id === record.id);
}
