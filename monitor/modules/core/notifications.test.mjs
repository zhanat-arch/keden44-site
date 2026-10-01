import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationForChange, notificationTimestamp } from './notifications.js';

test('sorts KEDEN notification dates written in Russian format', () => {
  const assigned = notificationTimestamp('30.09.2026, 14:33:52');
  const requested = notificationTimestamp('30.09.2026, 17:03:13');
  assert.ok(Number.isFinite(assigned));
  assert.ok(requested > assigned);
  assert.equal(new Date(requested).getHours(), 17);
});

test('can notify only about release', () => {
  const settings = { notifyReleased: true, notifyStatusChanges: false, notifyDataChanges: false };
  assert.equal(notificationForChange(
    { name: 'ДТ 1', status: 'Сформирована' },
    { name: 'ДТ 1', status: 'Выпущена' },
    ['статус изменился'],
    settings
  )?.title, 'ДТ выпущена');
  assert.equal(notificationForChange(
    { name: 'ДТ 1', status: 'Сформирована' },
    { name: 'ДТ 1', status: 'Проверяется' },
    ['статус изменился'],
    settings
  ), null);
});

test('supports other status and data notifications', () => {
  assert.equal(notificationForChange(
    { name: 'ДТ 1', status: 'Сформирована' },
    { name: 'ДТ 1', status: 'Проверяется' },
    ['статус изменился'],
    { notifyReleased: false, notifyStatusChanges: true, notifyDataChanges: false }
  )?.title, 'Статус ДТ изменился');
  assert.equal(notificationForChange(
    { name: 'ДТ 1', status: 'Проверяется' },
    { name: 'ДТ 1', status: 'Проверяется' },
    ['вес изменился'],
    { notifyReleased: false, notifyStatusChanges: false, notifyDataChanges: true }
  )?.title, 'Данные ДТ изменились');
});

test('notifies when a conditional release is cleared', () => {
  assert.equal(notificationForChange(
    { name: 'ДТ 1', status: 'Условно выпущена' },
    { name: 'ДТ 1', status: 'Очищена' },
    ['статус изменился'],
    { notifyReleased: false, notifyConditional: true, notifyStatusChanges: false, notifyDataChanges: false }
  )?.title, 'Условный выпуск очищен');
});
