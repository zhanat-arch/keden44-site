import {clearPermit,storePermit,PERMIT_GENERATION_KEY} from '../core/access-permit.mjs';
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
      body: JSON.stringify(payload),
      ...(['/access/status','/access/usage'].includes(path)?{signal:AbortSignal.timeout(10000)}:{})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const error = new Error(result.error || `HTTP ${response.status}`);
      error.code = result.error || '';
      error.access = result.access || null;
      error.status = response.status;
      throw error;
    }
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
    credentials=loadCredentials(storage);
    const device = await ensureDevice();
    try {
      return await request(path, { ...device, ...payload });
    } catch (error) {
      if (error.message !== 'unauthorized') throw error;
      credentials = null;
      clearPermit(storage);
      storage?.removeItem(STORAGE_KEY);
      const renewed = await ensureDevice();
      return request(path, { ...renewed, ...payload });
    }
  }

  return {
    connection: () => credentials ? authenticated('/connection') : Promise.resolve({ ok: true, linked: false }),
    createLink: () => authenticated('/link'),
    sync: watches => credentials ? authenticated('/sync', { watches }) : Promise.resolve({ ok: true, skipped: true, watchCount: 0 }),
    googleAuth: credential => {clearPermit(storage);return authenticated('/auth/google', { credential });},
    googleChallenge: () => authenticated('/auth/google/challenge'),
    telegramLoginStart: () => authenticated('/auth/telegram/start'),
    telegramLoginStatus: async token => {const result=await authenticated('/auth/telegram/status',{token});if(result.status==='complete')clearPermit(storage);return result;},
    telegramLoginCancel: token => authenticated('/auth/telegram/cancel', { token }),
    cloudPull: () => authenticated('/cloud/pull'),
    cloudPush: (records, settings) => authenticated('/cloud/push', { records, settings }),
    cardShareStatus: recordId => authenticated('/cards/status', { recordId }),
    createCardShare: (recordId, options) => authenticated('/cards/create', { recordId, options }),
    updateCardShareOptions: (recordId, options) => authenticated('/cards/options', { recordId, options }),
    receivedCards: () => authenticated('/cards/received', {action: 'list'}),
    addReceivedCard: token => authenticated('/cards/received', {action: 'add', token}),
    removeReceivedCard: token => authenticated('/cards/received', {action: 'remove', token}),
    revokeCardShare: recordId => authenticated('/cards/revoke', { recordId }),
    accessStatus: async (scope) => {
      try{
        const generation=storage?.getItem(PERMIT_GENERATION_KEY);
        const response=await authenticated('/access/status',{clientType:'monitor',...(scope?{scope}:{})});
        if(generation===storage?.getItem(PERMIT_GENERATION_KEY)&&loadCredentials(storage)?.accountId===credentials?.accountId)storePermit(storage,response.offlinePermit);
        return response;
      }catch(error){if([401,402,403].includes(error.status))clearPermit(storage);throw error;}
    },
    logout: async () => {
      clearPermit(storage);
      try{return await authenticated('/auth/logout');}
      finally{credentials=null;storage?.removeItem(STORAGE_KEY);}
    },
    reportUsage: payload => authenticated('/access/usage',payload),
    invitePreview: code => request('/access/invite/preview',{code}),
    inviteActivate: code => authenticated('/access/invite/activate',{code}),
    clientRecipients: () => authenticated('/clients/list'),
    saveClientRecipient: recipient => authenticated('/clients/save', { recipient }),
    removeClientRecipient: recipientId => authenticated('/clients/remove', { recipientId }),
    createClientInvite: recipientId => authenticated('/clients/invite', { recipientId }),
    shareOrganizationNotifications: items => authenticated('/organization/notifications/share', { items }),
    pullOrganizationNotifications: dtNumbers => authenticated('/organization/notifications/pull', { dtNumbers }),
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
