const SEARCH_FIELDS = [
  'name', 'dtNumber', 'kdtNumber', 'status', 'releaseDate',
  'declarant', 'declarantBin', 'sender', 'receiver', 'receiverBin',
  'invoice', 'tnved', 'goods', 'description', 'transport', 'container',
  'containers', 'sourceFileName', 'sourceFolder', 'note'
];

export function normalizeSearchText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function searchableValues(record) {
  return SEARCH_FIELDS.flatMap(field => {
    const value = record?.[field];
    return Array.isArray(value) ? value : [value];
  });
}

export function recordMatchesQuery(record, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const text = normalizeSearchText(searchableValues(record).filter(Boolean).join(' '));
  const compactText = text.replaceAll(' ', '');
  return normalizedQuery.split(' ').every(token =>
    text.includes(token) || compactText.includes(token.replaceAll(' ', ''))
  );
}
