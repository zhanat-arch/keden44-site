const FIELDS = [
  ['name', 'имя файла'],
  ['releaseDate', 'дата выпуска'],
  ['declarant', 'декларант'],
  ['declarantBin', 'БИН декларанта'],
  ['transport', 'транспорт'],
  ['sender', 'отправитель'],
  ['receiver', 'получатель'],
  ['receiverBin', 'БИН получателя'],
  ['invoice', 'инвойс'],
  ['containers', 'контейнеры'],
  ['tnved', 'ТН ВЭД'],
  ['customsValue', 'стоимость'],
  ['netWeight', 'вес нетто'],
  ['grossWeight', 'вес брутто'],
  ['description', 'описание'],
  ['goods', 'товар'],
  ['kedenUrl', 'QR'],
  ['qrImageDataUrl', 'изображение QR'],
  ['sourceFileName', 'исходный PDF'],
  ['sourceFolder', 'папка'],
];

function missing(value) {
  return Array.isArray(value) ? value.length === 0 : !String(value || '').trim();
}

export function fillMissingRecordFields(target, source) {
  const filled = [];
  for (const [key, label] of FIELDS) {
    if (!missing(target[key]) || missing(source[key])) continue;
    target[key] = Array.isArray(source[key]) ? [...source[key]] : source[key];
    filled.push(label);
  }
  const placeholderStatus = /^(?:|Нужна проверка|Добавлена в монитор)$/i.test(String(target.status || '').trim());
  const usefulStatus = !/^(?:|Нужна проверка)$/i.test(String(source.status || '').trim());
  if (placeholderStatus && usefulStatus) {
    target.status = source.status;
    filled.push('статус');
  }
  return filled;
}
