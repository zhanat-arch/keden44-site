import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationForChange } from './notifications.js';

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
