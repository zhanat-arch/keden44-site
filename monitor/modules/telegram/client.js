const STORAGE_KEY = 'keden44-telegram-device-v1';

export function createTelegramClient({
  apiBase = 'https://api.keden44.com/v1/telegram',
  storage = window.localStorage,
  fetchImpl = window.fetch.bind(window)
} = {}) {
  let credentials = loadCredentials(storage);

  async function request(path, payload = {}) {
    const response = await fetchImpl(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    return result;
  }

  async function ensureDevice() {
    if (credentials?.accountId && credentials?.deviceSecret) return credentials;
    const registered = await request('/register');
    credentials = { accountId: registered.accountId, deviceSecret: registered.deviceSecret };
    storage?.setItem(STORAGE_KEY, JSON.stringify(credentials));
    return credentials;
  }

  async function authenticated(path, payload = {}) {
    const device = await ensureDevice();
    try {
      return await request(path, { ...device, ...payload });
    } catch (error) {
      if (error.message !== 'unauthorized') throw error;
      credentials = null;
      storage?.removeItem(STORAGE_KEY);
      const renewed = await ensureDevice();
      return request(path, { ...renewed, ...payload });
    }
  }

  return {
    connection: () => credentials ? authenticated('/connection') : Promise.resolve({ ok: true, linked: false }),
    createLink: () => authenticated('/link'),
    sync: watches => credentials ? authenticated('/sync', { watches }) : Promise.resolve({ ok: true, skipped: true, watchCount: 0 }),
    googleAuth: credential => authenticated('/auth/google', { credential }),
    cloudPull: () => authenticated('/cloud/pull'),
    cloudPush: (records, settings) => authenticated('/cloud/push', { records, settings }),
    notify: (title, body, dedupeKey) => authenticated('/notify', {
      text: `${String(title).trim()}\n\n${String(body).trim()}`,
      dedupeKey
    })
  };
}

function loadCredentials(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    return parsed?.accountId && parsed?.deviceSecret ? parsed : null;
  } catch {
    return null;
  }
}
