import test from 'node:test';
import assert from 'node:assert/strict';
import { splitDeclarationNumber, splitOrganizationName } from './privacy.js';

test('keeps the organization form separate from its private name', () => {
  assert.deepEqual(splitOrganizationName('ТОО "Тестовая компания"'), {
    legalForm: 'ТОО',
    name: '"Тестовая компания"'
  });
  assert.deepEqual(splitOrganizationName('ИП Иванов'), {
    legalForm: 'ИП',
    name: 'Иванов'
  });
});

test('treats the whole value as private when no legal form is present', () => {
  assert.deepEqual(splitOrganizationName('TEASPOON'), {
    legalForm: '',
    name: 'TEASPOON'
  });
});

test('separates only the last four declaration digits for demo mode', () => {
  assert.deepEqual(splitDeclarationNumber('55301/280926/0085346'), {
    prefix: '55301/280926/008',
    privateTail: '5346',
    suffix: ''
  });
  assert.deepEqual(splitDeclarationNumber('55302/250626/0036977/1'), {
    prefix: '55302/250626/003',
    privateTail: '6977',
    suffix: '/1'
  });
});
