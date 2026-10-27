import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeMonitorTransfer } from './transfer.mjs';

test('legacy transfer extracts container without changing goods or transport', () => {
  const goods = '1. НАВЕС А-ВНЕШНИЙ... 3. 1: INBU4936358-45G1';
  const result = normalizeMonitorTransfer({ goods, transport: '1:64184484' });
  assert.deepEqual(result.containers, ['INBU4936358']);
  assert.equal(result.goods, goods);
  assert.equal(result.transport, '1:64184484');
});

test('v2 parses page in monitor and preserves explicit fields and original text', () => {
  const text = '14 Декларант\n170340020968\nТОО ТЕСТ\n15 Страна отправления\nКИТАЙ\n18 Идентификация транспорта\n1:64184484\n19 Контейнер\n1\n31 Грузовые места и описание товаров\nНАВЕС...\nINBU 4936358-45G1\n32 Товар\n1';
  const input = {transferVersion: 2, extensionVersion: '1.74.17', firstPage: {text}, goods: 'НАВЕС...'};
  const result = normalizeMonitorTransfer(input);
  assert.equal(result.declarantBin, '170340020968');
  assert.equal(result.declarant, 'ТОО ТЕСТ');
  assert.equal(result.transport, '1:64184484');
  assert.equal(result.goods, 'НАВЕС...');
  assert.deepEqual(result.containers, ['INBU4936358']);
  assert.equal(result.firstPage.text, text);
  assert.equal(input.containers, undefined);
});

test('raw legacy fields and multiple containers deduplicate; longer IDs are excluded', () => {
  const result = normalizeMonitorTransfer({containers: ['INBU4936358'], rawFields: {goods: 'INBU4936358-45G1 NEPU4595931 ABCD12345678 170340020968'}});
  assert.deepEqual(result.containers, ['INBU4936358', 'NEPU4595931']);
});

test('old client updates preserve v2 source and containers; oversized text is rejected', () => {
  const previous = {transferVersion: 2, extensionVersion: '1.74.17', firstPage: {text: 'INBU4936358-45G1'}, containers: ['INBU4936358']};
  const result = normalizeMonitorTransfer({goods: 'сокращено...', transferVersion: 1}, previous);
  assert.equal(result.firstPage.text, previous.firstPage.text);
  assert.equal(result.extensionVersion, '1.74.17');
  assert.equal(result.goods, 'сокращено...');
  assert.deepEqual(result.containers, ['INBU4936358']);
  assert.throws(() => normalizeMonitorTransfer({transferVersion: 2, firstPage: {text: 'a'.repeat(120001)}}));
});

test('reads regime from graph 1 without a PDF, preserves known regime and never guesses from goods', () => {
  const source = {transferVersion:2,firstPage:{text:'1 Декларация\nИМ\n40\nЭД\n3 Формы\n1\n31 Грузовые места\nЭК 10'}};
  assert.equal(normalizeMonitorTransfer(source).regime,'ИМ 40');
  assert.equal(normalizeMonitorTransfer({rawFields:{regime:'ИМ 40 ЭД'}}).regime,'ИМ 40');
  assert.equal(normalizeMonitorTransfer({goods:'ЭК 10'}).regime,undefined);
  assert.equal(normalizeMonitorTransfer({goods:'товар'}, {regime:'ИМ 40'}).regime,'ИМ 40');
});

test('graph 1 can be mid-row in captured HTML table text', () => {
  const firstPage = {text:'2 Отправитель\t1 Декларация\nИМ\t40\tЭД\t3 Формы\n1\n31 Грузовые места\nЭК 10'};
  assert.equal(normalizeMonitorTransfer({transferVersion:2,firstPage}).regime,'ИМ 40');
  assert.equal(normalizeMonitorTransfer({transferVersion:2,firstPage:{text:'31 Грузовые места\nИМ 40'}}).regime,undefined);
});
