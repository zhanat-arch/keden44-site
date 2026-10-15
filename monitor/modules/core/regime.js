export function normalizeRegime(value) {
  const matches = [...String(value || '').toUpperCase().matchAll(/(?:^|[^А-ЯЁA-Z0-9])([А-ЯЁ]{2})\s*(\d{2})(?!\d)/gu)];
  const values = [...new Set(matches.map(match => match[1] + ' ' + match[2]))];
  return values.length === 1 ? values[0] : '';
}

export function pdfRegime(items, pageWidth = 596, pageHeight = 842) {
  const headers = items.filter(item => /^\s*1\s*[.]?\s*Декларация\s*$/iu.test(item.str || ''));
  if (headers.length > 1) return '';
  if (!headers.length) {
    // Standard DT graph 1; some PDFs split its label into separate text items.
    const cells = items.filter(item => item.transform?.[4] >= pageWidth * .535 && item.transform[4] < pageWidth * .68 && item.transform[5] >= pageHeight * .90 && item.transform[5] <= pageHeight * .945);
    const regime = normalizeRegime(cells.sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]).map(item => item.str).join(' '));
    return /^(?:ИМ|ЭК|ТР) \d{2}$/u.test(regime) ? regime : '';
  }
  const header = headers[0], x = header.transform[4], y = header.transform[5];
  const cells = items.filter(item => item.transform?.[4] >= x - 2 && item.transform[4] < x + 100 && item.transform[5] < y && item.transform[5] >= y - 35);
  return normalizeRegime(cells.sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]).map(item => item.str).join(' '));
}
