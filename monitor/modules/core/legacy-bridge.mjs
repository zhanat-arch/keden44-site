// Bridge 1.74.35 clears changed after a newer QR check and reloads on that write.
// Preserve the UI flag separately so rereading the same notification is stable.
export function forLegacyBridge(record) {
  const value = { ...record };
  delete value.k44PendingChange;
  const checked = Date.parse(record.checkedAt || '');
  const delivered = Date.parse(record.lastKedenNotificationAt || '');
  if (record.changed && record.lastKedenNotification && Number.isFinite(checked)
    && Number.isFinite(delivered) && delivered <= checked) {
    value.changed = false;
    value.k44PendingChange = true;
  }
  return value;
}

export function fromLegacyBridge(record) {
  if (!record || record.k44PendingChange !== true) return record;
  const value = { ...record, changed: true };
  delete value.k44PendingChange;
  return value;
}
