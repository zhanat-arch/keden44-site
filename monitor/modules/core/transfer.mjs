const MAX_TEXT = 120000;
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

function section(text, start, end) {
  const match = text.match(new RegExp(start + '\\s*[:№.-]?\\s*([\\s\\S]*?)(?=' + end + ')', 'iu'));
  return clean(match?.[1]);
}

// This module also runs in the API. Old field-by-field transfers remain valid.
export function normalizeMonitorTransfer(record, previous) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  const next = { ...record };
  if (!record.firstPage?.text && previous?.firstPage?.text && Number(previous.transferVersion) === 2) {
    for (const key of ['firstPage', 'transferVersion', 'extensionVersion']) next[key] = previous[key];
  }
  const text = Number(next.transferVersion) === 2 && typeof next.firstPage?.text === 'string' ? next.firstPage.text : '';
  if (text.length > MAX_TEXT) throw new Error('Первый лист превышает лимит передачи; исходный текст не обрезан.');
  const raw = record.rawFields || {};
  const graph1 = section(text, '(?:^|\\s)1\\s*Декларация', '(?:^|\\s)(?:3\\s*Форм|5\\s*Всего)');
  const regimeText = [record.regime, raw.regime, graph1, previous?.regime].filter(Boolean);
  for (const value of regimeText) {
    const matches = [...String(value).toUpperCase().matchAll(/(?:^|[^А-ЯЁA-Z0-9])(ИМ|ЭК|ТР)\s*(\d{2})(?!\d)/gu)];
    const regimes = [...new Set(matches.map(match => match[1] + ' ' + match[2]))];
    if (regimes.length === 1) { next.regime = regimes[0]; break; }
  }
  const references = [text, record.goods, raw.goods, record.transport, raw.transport].map(value => String(value || '').slice(0, MAX_TEXT)).join('\n');
  const found = [...references.toUpperCase().matchAll(/(?<![A-Z0-9])([A-Z]{4})\s*(\d{7})(?!\d)/g)].map(match => match[1] + match[2]);
  const known = [...(Array.isArray(record.containers) ? record.containers : []), record.container,
    ...(Array.isArray(previous?.containers) ? previous.containers : [])].filter(value => typeof value === 'string' && value.trim());
  const containers = [...new Set([...known, ...found])];
  if (containers.length) next.containers = containers;
  if (text) {
    const fields = {
      declarant: section(text, '14\\s*Декларант', '15\\s*(?:Страна|Код)'),
      transport: section(text, '18\\s*Идентификация[^\\n]*', '19\\s*Конт'),
      goods: section(text, '31\\s*Грузовые\\s+места\\s+и\\s+описание\\s+товаров', '32\\s*Товар|33\\s*Код'),
    };
    const bin = fields.declarant.match(/\b\d{12}\b/)?.[0] || '';
    if (!next.declarantBin && bin) next.declarantBin = bin;
    fields.declarant = fields.declarant.replace(bin, '').replace(/^№\s*/, '').trim();
    // Never replace an existing (possibly shortened) goods description.
    for (const [key, value] of Object.entries(fields)) if (!clean(next[key]) && value) next[key] = value;
  }
  return next;
}
