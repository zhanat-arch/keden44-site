export function isGoodsHeader(value) {
  return /^маркировка и количество номера контейнеров количество и отличительные особенности$/u.test(String(value || '').toLowerCase().replace(/[\s–—-]+/gu, ' ').trim());
}

export function normalizeExtensionGoods(record, previous) {
  if (!isGoodsHeader(record.goods)) return record;
  const history = record.history || [];
  const transferIndex = history.findLastIndex(line => /передана из расширения|передана из открытой ДТ в расширении/iu.test(line));
  if (transferIndex < 0) return record;
  if (history.slice(transferIndex + 1).some(line => /товар:|создана запись|импорт PDF/iu.test(line))) return record;
  return { ...record, goods: previous?.goods && !isGoodsHeader(previous.goods) ? previous.goods : '' };
}
