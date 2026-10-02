import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearchText, recordMatchesQuery } from './search.js';

const record = {
  dtNumber: '55301/290926/0085684',
  releaseDate: '29.09.2026 11:07',
  receiver: 'ТОО «Производственная компания Teaspoon»',
  receiverBin: '140940025643',
  goods: 'Машина для приготовления норимаки',
  transport: '8217 CN',
  containers: ['NEPU4595931'],
  invoice: '04022/26-09',
  sourceFolder: 'Документы/Проект Teaspoon'
};

test('normalizes punctuation, spacing, case and Russian yo', () => {
  assert.equal(normalizeSearchText('  Ёлка/ТЕСТ_01  '), 'елка тест 01');
});

test('finds a declaration by a compact or partial DT number', () => {
  assert.equal(recordMatchesQuery(record, '290926 85684'), true);
  assert.equal(recordMatchesQuery(record, '553012909260085684'), true);
});

test('finds a declaration by several human fields', () => {
  assert.equal(recordMatchesQuery(record, 'teaspoon норимаки'), true);
  assert.equal(recordMatchesQuery(record, 'NEPU4595931'), true);
  assert.equal(recordMatchesQuery(record, '29.09.2026'), true);
  assert.equal(recordMatchesQuery(record, 'другой клиент'), false);
});

test('finds a declaration by a specialist note', () => {
  assert.equal(recordMatchesQuery({ specialistNote: 'Ждём акт досмотра' }, 'акт досмотра'), true);
});
