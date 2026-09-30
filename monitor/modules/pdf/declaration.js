function clean(value = '') {
  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/([№(])\s+/g, '$1')
    .replace(/\s+([)])/g, '$1')
    .replace(/"\s+([^"]*?)\s+"/g, '"$1"')
    .replace(/\b([A-ZÇĞİÖŞÜ]{2,})\s+([A-ZÇĞİÖŞÜ])\s+([A-ZÇĞİÖŞÜ])\b/g, '$1$2$3')
    .replace(/\b([A-ZÇĞİÖŞÜ])\s+([A-ZÇĞİÖŞÜ])\s+([A-ZÇĞİÖŞÜ])(?=\.|\s)/g, '$1$2$3')
    .replace(/^[:;\s-]+|[:;\s-]+$/g, '')
    .trim();
}

function joinWrappedLines(lines) {
  return lines.reduce((value, line) => {
    if (!value) return line;
    const brokenAtCellEdge = /(?:^|\s)[А-ЯA-Z]{3,5}$/u.test(value) && /^[А-ЯA-Z]{2,5}(?:\s|$)/u.test(line);
    return value + (brokenAtCellEdge ? '' : ' ') + line;
  }, '');
}

function between(text, start, end) {
  const match = text.match(new RegExp(start.source + '\\s*[:.-]?\\s*([\\s\\S]*?)\\s*(?=' + end.source + ')', 'i'));
  const value = clean(match?.[1]);
  return value && value.length <= 500 ? value : '';
}

export function parseDeclarationSummary(text = '') {
  const normalized = String(text).replace(/\u00a0/g, ' ').replace(/\r/g, '\n');
  const receiver = between(normalized, /8\.?\s*Получатель/i, /9\.?\s*Лицо/i);
  return {
    sender: between(normalized, /2\.?\s*Отправитель(?:\s*\/\s*экспортер)?/i, /3\.?\s*Формы?/i),
    receiver: receiver.replace(/^№?\s*\d{12}\s*/i, ''),
    receiverBin: receiver.match(/\b\d{12}\b/)?.[0] || '',
    declarant: between(normalized, /14\.?\s*Декларант/i, /15\.?\s*Страна отправления/i),
    transport: between(normalized, /18\.?\s*Идентификация и страна регистрации транспортного средства/i, /19\.?\s*Контейнер/i),
    goods: between(normalized, /31\.?\s*Грузовые места[\s\S]*?описание товаров/i, /32\.?\s*Товар/i)
  };
}

export function parseDeclarationReferences(text = '') {
  const normalized = String(text).toUpperCase().replace(/\u00a0/g, ' ');
  const containers = [...normalized.matchAll(/\b([A-Z]{4})\s*(\d{7})\b/g)]
    .map(match => match[1] + match[2]);
  const invoice = normalized.match(/\b(?:04021|04022)\s+([A-ZА-ЯЁ0-9][A-ZА-ЯЁ0-9./_-]{1,})/u)?.[1] || '';
  return { invoice, containers: [...new Set(containers)] };
}

function regionText(items, pageWidth, pageHeight, { left, right, top, bottom }) {
  const selected = items
    .map(item => ({
      x: Number(item.transform?.[4] || 0),
      top: pageHeight - Number(item.transform?.[5] || 0),
      text: item.str || ''
    }))
    .filter(item => item.x >= pageWidth * left && item.x < pageWidth * right && item.top >= pageHeight * top && item.top < pageHeight * bottom);
  const lines = new Map();
  for (const item of selected) {
    const key = Math.round(item.top / 3) * 3;
    const line = lines.get(key) || [];
    line.push(item);
    lines.set(key, line);
  }
  return [...lines.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, line]) => clean(line.sort((a, b) => a.x - b.x).map(item => item.text).join(' ')))
    .filter(Boolean);
}

export function parseStandardDtPage(items = [], pageWidth = 596, pageHeight = 842) {
  const declarantLines = regionText(items, pageWidth, pageHeight, { left: 0.115, right: 0.535, top: 0.205, bottom: 0.245 });
  const transportLines = regionText(items, pageWidth, pageHeight, { left: 0.115, right: 0.49, top: 0.26, bottom: 0.285 });
  const goodsLines = regionText(items, pageWidth, pageHeight, { left: 0.115, right: 0.575, top: 0.375, bottom: 0.41 });
  const declarantHeader = regionText(items, pageWidth, pageHeight, { left: 0.4, right: 0.535, top: 0.19, bottom: 0.215 }).join(' ');
  const withoutLabel = (lines, pattern) => lines.filter(line => !pattern.test(line));
  const senderLines = withoutLabel(regionText(items, pageWidth, pageHeight, { left: 0.115, right: 0.535, top: 0.055, bottom: 0.13 }), /Отправитель|Экспортер/i);
  const receiverLines = regionText(items, pageWidth, pageHeight, { left: 0.115, right: 0.535, top: 0.14, bottom: 0.185 });
  const receiverText = receiverLines.join(' ');
  const cleanDeclarant = withoutLabel(declarantLines, /Декларант/i);
  const cleanTransport = withoutLabel(transportLines, /^прибытии$/i);
  return {
    sender: senderLines.join(' ').replace(/^№\s*/i, ''),
    receiver: receiverText.replace(/^№?\s*\d{12}\s*/i, ''),
    receiverBin: receiverText.match(/\b\d{12}\b/)?.[0] || '',
    declarant: (cleanDeclarant.find(line => !/^\d{12}$/.test(line)) || '').replace(/^№?\s*\d{12}\s*/i, ''),
    declarantBin: declarantHeader.match(/\b\d{12}\b/)?.[0] || '',
    transport: cleanTransport.join(' ').replace(/^1:\s*/i, ''),
    goods: joinWrappedLines(goodsLines).replace(/^1\s+(?=1[.])/i, '')
  };
}
