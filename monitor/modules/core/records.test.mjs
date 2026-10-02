import test from 'node:test';
import assert from 'node:assert/strict';
import { fillMissingRecordFields } from './records.js';

test('a repeated PDF fills missing card data without replacing known values', () => {
  const target = { status: 'Добавлена в монитор', declarant: '', transport: 'старый транспорт', goods: '', containers: [] };
  const filled = fillMissingRecordFields(target, {
    status: 'В работе', declarant: 'ТОО Тест', transport: 'новый транспорт', goods: 'Товар 1', containers: ['ABC'], kedenUrl: 'https://keden.kgd.gov.kz/qrpage?url=x'
  });
  assert.equal(target.status, 'В работе');
  assert.equal(target.declarant, 'ТОО Тест');
  assert.equal(target.transport, 'старый транспорт');
  assert.equal(target.goods, 'Товар 1');
  assert.deepEqual(target.containers, ['ABC']);
  assert.ok(filled.includes('QR'));
});
