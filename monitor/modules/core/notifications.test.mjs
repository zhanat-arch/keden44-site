import test from 'node:test';
import assert from 'node:assert/strict';
import { controlAssignmentFromNotification, inspectionStateFromNotification, notificationForChange, notificationTimestamp } from './notifications.js';

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

test('keeps an inspection active until KEDEN reports its completion', () => {
  assert.equal(inspectionStateFromNotification(false, 'Назначен таможенный досмотр по ДТ 1'), true);
  assert.equal(inspectionStateFromNotification(true, 'Поступил дополнительный запрос по ДТ 1'), true);
  assert.equal(inspectionStateFromNotification(true, 'Таможенный досмотр завершён по ДТ 1'), false);
});

test('reads assigned customs control and affected goods from a KEDEN notification', () => {
  assert.deepEqual(controlAssignmentFromNotification(
    'В отношении товаров 1, 3 по ДТ 55302/300926/0086612, назначен следующий вид контроля Контроль таможенной стоимости (ГДУ). Исполнитель: ФИО УАЛИ'
  ), { goods: '1, 3', control: 'Контроль таможенной стоимости (ГДУ)' });
  assert.equal(controlAssignmentFromNotification('Поступил дополнительный запрос по ДТ'), null);
});
