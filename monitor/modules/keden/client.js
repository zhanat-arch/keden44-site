export async function requestKedenCheck(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'keden.kgd.gov.kz') throw new Error('Разрешены только QR-ссылки KEDEN');
  const sourcePath = parsed.pathname === '/qrpage' ? parsed.searchParams.get('url') || '' : parsed.pathname;
  const match = sourcePath.match(/\/declaration\/declarations\/qr-data\/([A-Za-z0-9]+)\/DT$/);
  if (!match) throw new Error('QR-ссылка KEDEN не распознана');

  const response = await fetch(`https://api.keden44.com/v1/keden/qr/${encodeURIComponent(match[1])}/DT`);
  const raw = await response.json();
  if (!response.ok) throw new Error(raw.error || 'KEDEN не удалось проверить');
  const withSuffix = (value, suffix) => value ? `${value}${suffix}` : '';
  const fields = {
    dtNumber: raw['№ ДТ'] || '',
    description: raw['Наименование таможенного органа, зарегистрировавшего ДТ (ДГД)'] || '',
    netWeight: withSuffix(raw['Вес нетто (кг)'], ' кг'),
    customsValue: withSuffix(raw['Общая таможенная стоимость (тг)'], ' тг'),
    status: raw['Статус'] || '',
    releaseDate: raw['Дата выпуска'] || '',
    grossWeight: withSuffix(raw['Общий вес брутто (кг)'], ' кг')
  };
  return { ok: true, fields, source: 'keden-public-api', statusCode: response.status, diagnostics: ['Публичный QR API KEDEN'] };
}
