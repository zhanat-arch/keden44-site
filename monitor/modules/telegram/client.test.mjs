import assert from 'node:assert/strict';
import test from 'node:test';
import { createTelegramClient } from './client.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

test('registers once and reuses device credentials', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, body });
    const payload = url.endsWith('/register')
      ? { ok: true, accountId: 'account-1', deviceSecret: 'secret-1' }
      : url.endsWith('/connection') ? { ok: true, linked: true }
        : { ok: true, sent: true };
    return { ok: true, json: async () => payload };
  };
  const client = createTelegramClient({ storage: memoryStorage(), fetchImpl, apiBase: 'https://api.test' });

  await client.createLink();
  await client.connection();
  await client.notify('Статус', 'ДТ выпущена', 'dt:released');

  assert.equal(calls.filter(call => call.url.endsWith('/register')).length, 1);
  assert.equal(calls.at(-1).body.accountId, 'account-1');
  assert.equal(calls.at(-1).body.deviceSecret, 'secret-1');
  assert.equal(calls.at(-1).body.dedupeKey, 'dt:released');
});
