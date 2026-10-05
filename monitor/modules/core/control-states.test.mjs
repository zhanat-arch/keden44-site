import test from 'node:test';
import assert from 'node:assert/strict';
import { controlsFromHistory } from './notifications.js';

test('final release overrides missing completion notices except expertise', () => {
  const history = ['ГДУ', 'ИДК', 'Таможенный досмотр', 'Экспертиза', 'ОИС'].map(name =>
    `05.10.2026 15:00: уведомление KEDEN: Назначен следующий вид контроля ${name}. Исполнитель: Иванов`);
  const controls = controlsFromHistory(history, 'Выпущена');
  assert.equal(controls.length, 5);
  assert.ok(controls.filter(control => control.label !== 'Экспертиза').every(control => control.completed));
  assert.equal(controls.find(control => control.label === 'Экспертиза').completed, false);
  for (const status of ['Условно выпущена', 'Выпуск под обеспечение']) {
    assert.ok(controlsFromHistory(history, status).every(control => !control.completed));
  }
  assert.ok(controlsFromHistory(history, 'Очищена').every(control => control.completed));
});

test('hides DGD and restrictions on cards', () => {
  const controls = controlsFromHistory([
    '05.10.2026 15:00: уведомление KEDEN: Назначен следующий вид контроля Проверка документов и сведений (ДГД). Исполнитель: Иванов',
    '05.10.2026 15:01: уведомление KEDEN: По декларации контроль "Контроль запретов и ограничений" переназначен должностному лицу Иванов',
    '05.10.2026 15:02: уведомление KEDEN: Завершён следующий вид контроля Проверка документов и сведений (ДГД) по ДТ 55302/300926/0086612'
  ]);
  assert.equal(controls.length, 0);
});

test('shows one category and reopens a newly assigned control', () => {
  const controls = controlsFromHistory([
    '05.10.2026 15:00: уведомление KEDEN: Назначен следующий вид контроля ИДК в отношении товаров 1 по ДТ 55302/300926/0086612. Исполнитель: Иванов',
    '05.10.2026 15:01: уведомление KEDEN: Назначен следующий вид контроля ИДК в отношении товаров 2 по ДТ 55302/300926/0086612. Исполнитель: Иванов',
    '05.10.2026 15:02: уведомление KEDEN: Завершён следующий вид контроля ИДК в отношении товаров 1 по ДТ 55302/300926/0086612',
    '05.10.2026 15:03: уведомление KEDEN: Назначен следующий вид контроля ИДК в отношении товаров 1 по ДТ 55302/300926/0086612. Исполнитель: Иванов'
  ]);
  assert.equal(controls.length, 1);
  assert.ok(controls.every(control => !control.completed));
});

test('completion without goods closes the same previously assigned control', () => {
  const controls = controlsFromHistory([
    '05.10.2026 15:00: уведомление KEDEN: Назначен следующий вид контроля ИДК в отношении товаров 1, 2 по ДТ 55302/300926/0086612. Исполнитель: Иванов',
    '05.10.2026 15:01: уведомление KEDEN: Завершён следующий вид контроля ИДК по ДТ 55302/300926/0086612'
  ]);
  assert.equal(controls.length, 1);
  assert.equal(controls[0].completed, true);
  assert.equal(controls[0].goods, undefined);
});
