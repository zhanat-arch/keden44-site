import test from 'node:test';
import assert from 'node:assert/strict';
import { conditionalReleaseDeadline, daysUntil, declarationNumberParts, declarationSectionFromDtNumber, dtFromFileName, isCleared, isConditionalRelease, isRecentRelease, isReleased, isSecuredRelease, needsAttention, statusKind, submissionDateFromDtNumber } from './dt.js';

test('reads a DT number from PDF filename', () => {
  assert.equal(dtFromFileName('55302_230626_0035613.pdf'), '55302/230626/0035613');
  assert.equal(dtFromFileName('55302_250626_0036977_2.pdf'), '55302/250626/0036977/2');
});

test('separates a KDT suffix from the main declaration number', () => {
  assert.deepEqual(declarationNumberParts('55302/250626/0036977/1'), {
    fullNumber: '55302/250626/0036977/1',
    baseNumber: '55302/250626/0036977',
    correctionIndex: '1',
    isCorrection: true
  });
});

test('separates recent and old releases', () => {
  const now = new Date(2026, 5, 29, 18, 0);
  assert.equal(isRecentRelease('29.06.2026 09:09', 3, now), true);
  assert.equal(isRecentRelease('10.06.2026 12:05', 3, now), false);
});

test('declarations without QR require attention', () => {
  assert.equal(needsAttention({ status: 'Нужна проверка', kedenUrl: '' }), true);
  assert.equal(needsAttention({ status: 'Выпущена', kedenUrl: 'https://keden.kgd.gov.kz/qrpage' }), false);
});

test('calculates a conditional release deadline from the DT registration date', () => {
  assert.equal(isConditionalRelease('Условно выпущена'), true);
  const deadline = conditionalReleaseDeadline('55301/280926/0085408', 60);
  assert.equal(deadline.toLocaleDateString('ru-RU'), '27.11.2026');
  assert.equal(daysUntil(deadline, new Date(2026, 10, 20)), 7);
});

test('reads the registration date from main DT and KDT numbers', () => {
  assert.equal(submissionDateFromDtNumber('55301/280926/0085408').toLocaleDateString('ru-RU'), '28.09.2026');
  assert.equal(submissionDateFromDtNumber('55302/250626/0036977/2').toLocaleDateString('ru-RU'), '25.06.2026');
});

test('recognizes ETT and VTO from the declaration sequence', () => {
  assert.equal(declarationSectionFromDtNumber('55302/030826/0056074'), 'ЕТТ');
  assert.equal(declarationSectionFromDtNumber('55302/030826/1011567'), 'ВТО');
  assert.equal(declarationSectionFromDtNumber('55302/030826/2056074'), '');
});

test('treats a cleared conditional declaration as completed', () => {
  assert.equal(isCleared('Очищена'), true);
  assert.equal(isReleased('Очищена'), true);
  assert.equal(statusKind('Очищена'), 'released');
});

test('keeps release under security in the conditional lane', () => {
  assert.equal(isSecuredRelease('Выпущена под обеспечение'), true);
  assert.equal(isReleased('Выпущена под обеспечение'), false);
  assert.equal(statusKind('Выпущена под обеспечение'), 'conditional');
});
