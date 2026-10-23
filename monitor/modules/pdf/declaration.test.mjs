import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeclarationNumber, parseDeclarationReferences, parseDeclarationSummary, parseStandardDtPage } from './declaration.js';

test('finds a labelled number regardless of layout and PDF digit spacing', () => {
  assert.equal(parseDeclarationNumber('Вес 100\n№ ДТ: 55411/221026/0027705\nСтатус'), '55411/221026/0027705');
  assert.equal(parseDeclarationNumber('№ Д Т:\n5 5 4 11 /2 2 1 02 6/002 7 7 06'), '55411/221026/0027706');
  assert.equal(parseDeclarationNumber('Номер ДТ: 55411.221026.0027705'), '55411/221026/0027705');
  assert.equal(parseDeclarationNumber('№ ДТ: 55411/221026/0027705/2'), '55411/221026/0027705/2');
  assert.equal(parseDeclarationSummary('№ ДТ: 55411/221026/0027705').dtNumber, '55411/221026/0027705');
});

test('does not guess an unrelated, ambiguous or invalid number', () => {
  assert.equal(parseDeclarationNumber('44 Предыдущий документ 55411/221026/0027705'), '');
  assert.equal(parseDeclarationNumber('55411/321326/0027705', true), '');
  assert.equal(parseDeclarationNumber('55411/221026/0027705 55411/221026/0027706', true), '');
  assert.equal(parseDeclarationNumber('55411/221026/00277050', true), '');
});

test('reads a split number from the header and ignores references below it', () => {
  const item = (str, x, top) => ({ str, transform: [1, 0, 0, 1, x, 842 - top] });
  assert.equal(parseStandardDtPage([
    item('5 5 4 11 /221 026/0027 7 05', 400, 26),
    item('55411/211026/0027706', 100, 500)
  ]).dtNumber, '55411/221026/0027705');
});

test('reads sender, receiver and goods from the first DT page text', () => {
  const fields = parseDeclarationSummary(`
    2. Отправитель/экспортер ACME EXPORT LTD
    3. Формы 1
    8. Получатель 123456789012 ТОО ИМПОРТ
    9. Лицо, ответственное за финансовое урегулирование
    14. Декларант ТОО БРОКЕР
    15. Страна отправления ИТАЛИЯ
    18. Идентификация и страна регистрации транспортного средства 123ABC02 KZ
    19. Контейнер 0
    31. Грузовые места и описание товаров ОПТИЧЕСКИЕ ПРИБОРЫ
    32. Товар 1
  `);
  assert.deepEqual(fields, {
    sender: 'ACME EXPORT LTD',
    receiver: 'ТОО ИМПОРТ',
    receiverBin: '123456789012',
    declarant: 'ТОО БРОКЕР',
    transport: '123ABC02 KZ',
    goods: 'ОПТИЧЕСКИЕ ПРИБОРЫ'
  });
});

test('reads standard DT cells by their stable page regions', () => {
  const item = (str, x, top) => ({ str, transform: [1, 0, 0, 1, x, 842 - top] });
  const fields = parseStandardDtPage([
    item('123456789012', 72, 130),
    item('ТОО "ИМПОРТ"', 72, 140),
    item('020440004149', 260, 168),
    item('ТОО "БРОКЕР"', 72, 178),
    item('1: KС0222 KZ', 72, 226),
    item('1. ЛИНЗЫ ОЧКОВЫЕ', 72, 324)
  ], 596, 842);
  assert.equal(fields.declarant, 'ТОО "БРОКЕР"');
  assert.equal(fields.declarantBin, '020440004149');
  assert.equal(fields.receiver, 'ТОО "ИМПОРТ"');
  assert.equal(fields.receiverBin, '123456789012');
  assert.equal(fields.transport, 'KС0222 KZ');
  assert.equal(fields.goods, '1. ЛИНЗЫ ОЧКОВЫЕ');
});

test('normalizes quotes and a word wrapped at the goods cell edge', () => {
  const item = (str, x, top) => ({ str, transform: [1, 0, 0, 1, x, 842 - top] });
  const fields = parseStandardDtPage([
    item('ТОО " БРОКЕР ЛТД "', 72, 178),
    item('ПОЛИМЕРНОГО МАТЕР', 72, 324),
    item('ИАЛА ОБРАБОТАННЫЕ', 72, 333)
  ], 596, 842);
  assert.equal(fields.declarant, 'ТОО "БРОКЕР ЛТД"');
  assert.equal(fields.goods, 'ПОЛИМЕРНОГО МАТЕРИАЛА ОБРАБОТАННЫЕ');
});

test('reads invoice and unique container numbers from declaration text', () => {
  assert.deepEqual(parseDeclarationReferences(`
    04021 KZ04014-2 02.06.2026 СЧЕТ-ФАКТУРА
    3. КОНТЕЙНЕР 1: CN; 1: NEPU4595931ВЕСЬ
    NEPU 4595931
  `), { invoice: 'KZ04014-2', containers: ['NEPU4595931'] });
});
