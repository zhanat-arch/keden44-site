import test from 'node:test';
import assert from 'node:assert/strict';
import { latestRequestFromHistory } from './notifications.js';

test('keeps request visible after ordinary events and detects an explicit answer', () => {
  const history = [
    '06.10.2026 09:00: уведомление KEDEN: Поступил дополнительный запрос документов',
    '06.10.2026 09:10: уведомление KEDEN: Контроль завершён',
    '06.10.2026 09:15: уведомление KEDEN: Направлен ответ на дополнительный запрос'
  ];
  assert.equal(latestRequestFromHistory(history).date, '06.10.2026 09:00');
  assert.equal(latestRequestFromHistory(history).answeredAt, '06.10.2026 09:15');
});

test('new request resets answered state and agreement is not an answer', () => {
  const history = [
    '06.10.2026 09:00: уведомление KEDEN: Поступил дополнительный запрос',
    '06.10.2026 09:15: уведомление KEDEN: Отправлен ответ на запрос',
    '06.10.2026 10:00: уведомление KEDEN: Поступил дополнительный запрос. Выбрано решение «согласен»'
  ];
  assert.equal(latestRequestFromHistory(history).date, '06.10.2026 10:00');
  assert.equal(latestRequestFromHistory(history).answeredAt, '');
});
