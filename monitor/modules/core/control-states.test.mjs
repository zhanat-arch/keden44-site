import test from 'node:test';
import assert from 'node:assert/strict';
import { controlsFromHistory } from './notifications.js';

test('closes controls independently and handles reassignment', () => {
  const controls = controlsFromHistory([
    '05.10.2026 15:00: уведомление KEDEN: Назначен следующий вид контроля Проверка документов и сведений (ДГД). Исполнитель: Иванов',
    '05.10.2026 15:01: уведомление KEDEN: По декларации контроль "Контроль запретов и ограничений" переназначен должностному лицу Иванов',
    '05.10.2026 15:02: уведомление KEDEN: Завершён следующий вид контроля Проверка документов и сведений (ДГД) по ДТ 55302/300926/0086612'
  ]);
  assert.equal(controls.length, 2);
  assert.equal(controls.find(control => control.label === 'ДГД').completed, true);
  assert.equal(controls.find(control => control.label === 'Запреты').completed, false);
});

test('keeps different goods separate and reopens a newly assigned control', () => {
  const controls = controlsFromHistory([
    '05.10.2026 15:00: уведомление KEDEN: Назначен следующий вид контроля ИДК в отношении товаров 1 по ДТ 55302/300926/0086612. Исполнитель: Иванов',
    '05.10.2026 15:01: уведомление KEDEN: Назначен следующий вид контроля ИДК в отношении товаров 2 по ДТ 55302/300926/0086612. Исполнитель: Иванов',
    '05.10.2026 15:02: уведомление KEDEN: Завершён следующий вид контроля ИДК в отношении товаров 1 по ДТ 55302/300926/0086612',
    '05.10.2026 15:03: уведомление KEDEN: Назначен следующий вид контроля ИДК в отношении товаров 1 по ДТ 55302/300926/0086612. Исполнитель: Иванов'
  ]);
  assert.equal(controls.length, 2);
  assert.ok(controls.every(control => !control.completed));
});
