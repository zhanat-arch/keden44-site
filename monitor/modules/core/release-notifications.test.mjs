import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseStatusFromNotification} from './notifications.js';

test('recognizes Cyrillic release notices without ASCII word boundaries', () => {
  for (const text of ['ДТ 57507/191126/0003764 выпущена.', 'ДТ 57507/191126/0003764 ВЫПУЩЕНО',
    'Декларация № 57507/191126/0003764 выпущена', 'ДТ 57507/191126/0003764 выпуск разрешён', 'ДТ выпущена']) {
    assert.equal(releaseStatusFromNotification(text),'Выпущена',text);
  }
});
test('keeps conditional and secured release distinct', () => {
  assert.equal(releaseStatusFromNotification('ДТ 57507/191126/0003764 условно выпущена.'),'Условно выпущена');
  assert.equal(releaseStatusFromNotification('ДТ 57507/191126/0003764 выпущена под обеспечение.'),'Выпущена под обеспечение');
});
test('does not turn controls, negation or release refusal into release', () => {
  for (const text of ['ДТ 57507/191126/0003764 не выпущена','ДТ 57507/191126/0003764 отказ в выпуске',
    'Отменён выпуск ДТ 57507/191126/0003764','Завершен следующий вид контроля по ДТ 57507/191126/0003764',
    'ДТ 57507/191126/0003764 выпущенатор']) assert.equal(releaseStatusFromNotification(text),'');
});
