import test from 'node:test';
import assert from 'node:assert/strict';
import { createImportQueue } from './queue.js';

test('imports files sequentially and reports the batch result', async () => {
  const order = [];
  const queue = createImportQueue({ process: async file => { order.push(file.name); return file.ok; } });
  const result = await queue.add([{ name: 'one.pdf', ok: true }, { name: 'two.pdf', ok: false }, { name: 'three.pdf', ok: true }]);
  assert.deepEqual(order, ['one.pdf', 'two.pdf', 'three.pdf']);
  assert.deepEqual({ total: result.total, completed: result.completed, failed: result.failed }, { total: 3, completed: 3, failed: 1 });
  assert.deepEqual(result.errors, ['two.pdf']);
});

test('accepts another file while the queue is running', async () => {
  const order = [];
  let releaseFirst;
  const firstFinished = new Promise(resolve => { releaseFirst = resolve; });
  const queue = createImportQueue({
    process: async file => {
      order.push(file.name);
      if (file.name === 'one.pdf') await firstFinished;
      return true;
    }
  });
  const batch = queue.add([{ name: 'one.pdf' }]);
  queue.add([{ name: 'two.pdf' }]);
  releaseFirst();
  const result = await batch;
  assert.deepEqual(order, ['one.pdf', 'two.pdf']);
  assert.equal(result.total, 2);
});
