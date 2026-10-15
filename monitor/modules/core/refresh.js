import { isGoodsHeader } from './goods.js';
import { normalizeRegime } from './regime.js';

export function refreshedFields(record, fields = {}) {
  const next = { ...record };
  for (const [key, value] of Object.entries(fields)) {
    if (value == null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length)) continue;
    if (['id', 'note', 'history', 'logs', 'dtNumber'].includes(key)) continue;
    if (key === 'goods' && (isGoodsHeader(value) || (record.goods && !isGoodsHeader(record.goods)))) continue;
    if (key === 'regime') {
      const regime = normalizeRegime(value);
      if (regime) next.regime = regime;
    } else next[key] = value;
  }
  return next;
}
