import {createTelegramClient} from './monitor/modules/telegram/client.js?v=20261123-connection-state';
import {installTelegramLogin} from './monitor/modules/telegram/login.js';
import {ACCESS_COPY, renderAccessCopy, copyReady, setServerAccessCopy} from './shared/access-copy.js?v=20261125';
renderAccessCopy();
const client = createTelegramClient();
const API = 'https://api.keden44.com/v1/telegram';
const DEVICE_KEY = 'keden44-telegram-device-v1';
const CLAIM_KEY = 'keden44-payment-claim-v1';
const paidButton = document.querySelector('#paidBtn');
const statusBox = document.querySelector('#paymentStatus');
const detailsButton = document.querySelector('#showPaymentDetails');
const detailsForm = document.querySelector('#paymentDetails');
const cancelButton = document.querySelector('#cancelPaymentClaim');
let pollTimer;
let pollCount = 0;
const purchaseLink = document.querySelector('#purchaseLink');
const accountStatus = document.querySelector('#subscriptionAccount');
const subscriptionStatus = document.querySelector('#subscriptionStatus');
const checkSubscriptionStatus = document.querySelector('#checkSubscriptionStatus');
const loginLink = document.querySelector('#subscriptionLogin');
const returnLink = document.querySelector('#returnToTool');
const logoutButton = document.querySelector('#subscriptionLogout');
const loginStatus = document.querySelector('#loginStatus');
const retryLogin = document.querySelector('#retryLogin');
const destinations = new Map([['/tools/accounting/', 'Открыть отчёт бухгалтеру'], ['/tools/audit/', 'Открыть сверку требования'], ['/monitor/', 'Открыть Монитор'], ['/extension/', 'Открыть расширение']]);
const requestedReturn = new URL(location.href).searchParams.get('return');
const returnPath = destinations.has(requestedReturn) ? requestedReturn : '/monitor/';
const accessScope = returnPath === '/tools/accounting/' ? 'accounting' : returnPath === '/tools/audit/' ? 'audit' : returnPath === '/extension/' ? 'extension' : 'monitor';
returnLink.href = returnPath;
returnLink.textContent = destinations.get(returnPath);
const telegramLogin = installTelegramLogin(client, () => checkAccount());
document.querySelector('#googleSignIn').nextElementSibling.className = 'button secondary';
let googlePreparing = false;
async function prepareGoogle(attempt = 0) {
  if (signedIn || googlePreparing) return;
  if (!window.google?.accounts?.id) {
    if (attempt < 40) setTimeout(() => prepareGoogle(attempt + 1), 250);
    else { loginStatus.textContent = 'Вход Google недоступен. Используйте Telegram или повторите попытку.'; retryLogin.hidden = false; }
    return;
  }
  googlePreparing = true;
  retryLogin.hidden = true;
  try {
    const challenge = await client.googleChallenge();
    if (signedIn) return;
    // Use the same OAuth client and server nonce validation as the Monitor.
    window.google.accounts.id.initialize({client_id:'57476430330-a9mvuo5sh4gec820jtd1u5ldcgrm8tpn.apps.googleusercontent.com',nonce:challenge.nonce,callback:async response => {
      try { await client.googleAuth(response.credential); loginStatus.textContent = ''; await checkAccount(); }
      catch { loginStatus.textContent = 'Не удалось войти. Повторите вход.'; void prepareGoogle(); }
    }});
    document.querySelector('#googleSignIn').replaceChildren();
    window.google.accounts.id.renderButton(document.querySelector('#googleSignIn'), {theme:'outline',size:'large',text:'signin_with',shape:'rectangular'});
  } catch { loginStatus.textContent = 'Не удалось подготовить вход Google. Используйте Telegram или повторите попытку.'; retryLogin.hidden = false; }
  finally { googlePreparing = false; }
}
retryLogin.addEventListener('click', () => void prepareGoogle());
logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try { await client.logout(); await checkAccount(); }
  catch { accountStatus.textContent = 'Не удалось выйти. Повторите попытку.'; }
  finally { logoutButton.disabled = false; }
});
const paymentCheck = document.querySelector('.payment-check');
purchaseLink.parentElement.after(paymentCheck);
paymentCheck.style.cssText = 'grid-template-columns:1fr;gap:16px;padding:24px 0';
paymentCheck.hidden = true;
let signedIn = false;
let accountCheck = 0;
let paymentRevealTimer;
let accountKey = '';
let accessRequest;
let lastAccessCheck = 0;
let accessAccount = '';

function formatAccessDate(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Qyzylorda'
  }).format(new Date(value));
}

async function refreshSubscription(force = false) {
  if (!signedIn || !accountKey) return;
  const device = credentials();
  const key = device?.accountId + ':' + accountKey;
  if (accessRequest?.key === key) return accessRequest.pending;
  if (!force && key === accessAccount && Date.now() - lastAccessCheck < 10_000) return;
  accessAccount = key;
  lastAccessCheck = Date.now();
  subscriptionStatus.hidden = false;
  subscriptionStatus.dataset.state = 'searching';
  subscriptionStatus.textContent = 'Проверяем статус подписки…';
  checkSubscriptionStatus.disabled = true;
  const current = () => accessRequest?.key === key
    && credentials()?.accountId === device?.accountId
    && credentials()?.deviceSecret === device?.deviceSecret;
  const pending = (async () => {
    try {
      let access;
      try { ({access} = await client.accessStatus(accessScope)); }
      catch (error) { if (error.access) access = error.access; else throw error; }
      if (!current()) return;
      setServerAccessCopy(access?.uiCopy);
      returnLink.hidden = access?.allowed !== true;
      const expiry = Date.parse(access?.validUntil || '');
      if (['active', 'device_limit'].includes(access?.state) && expiry >= Date.now()) {
        subscriptionStatus.dataset.state = 'success';
        subscriptionStatus.textContent = 'Оплата подтверждена. Подписка действует до ' + formatAccessDate(expiry).replace(/\.$/, '') + '.';
      } else if (access?.state === 'trial') {
        subscriptionStatus.dataset.state = 'success';
        const until = access.trialUntil || access.validUntil;
        subscriptionStatus.textContent = until ? 'Пробный доступ действует до ' + formatAccessDate(until).replace(/\.$/, '') + '.' : 'Пробный доступ активен.';
      } else if (access?.state === 'promo') {
        subscriptionStatus.dataset.state = 'success';
        subscriptionStatus.textContent = 'Доступ по приглашению' + (access.validUntil ? ' до ' + formatAccessDate(access.validUntil).replace(/\.$/, '') : ' без ограничения срока') + '.';
      } else if (access?.state === 'grace') {
        subscriptionStatus.dataset.state = 'pending';
        subscriptionStatus.textContent = 'Ожидается оплата.' + (access.graceUntil ? ' Доступ сохраняется до ' + formatAccessDate(access.graceUntil).replace(/\.$/, '') + '.' : ' Проверьте срок доступа.');
      } else {
        subscriptionStatus.dataset.state = 'pending';
        subscriptionStatus.textContent = access?.state === 'promo' || access?.state === 'trial'
          ? 'Доступ есть, платная подписка не активна.'
          : 'Активная платная подписка не найдена.';
      }
    } catch {
      if (!current()) return;
      subscriptionStatus.dataset.state = 'pending';
      subscriptionStatus.textContent = ACCESS_COPY.unavailable;
    } finally {
      if (accessRequest?.pending === pending) {
        accessRequest = undefined;
        checkSubscriptionStatus.disabled = false;
      }
    }
  })();
  accessRequest = { key, pending };
  return pending;
}

function clearSubscriptionStatus() {
  accessRequest = undefined;
  accessAccount = '';
  subscriptionStatus.hidden = true;
  returnLink.hidden = true;
  checkSubscriptionStatus.hidden = true;
  checkSubscriptionStatus.disabled = false;
}
function revealPaymentCheck() {
  clearTimeout(paymentRevealTimer);
  paymentCheck.hidden = true;
  if (!signedIn || !accountKey) return;
  if (localStorage.getItem(CLAIM_KEY)) { paymentCheck.hidden=false; return; }
  const startedAt = Number(sessionStorage.getItem('keden44-purchase-start:' + accountKey));
  if (!startedAt) return;
  const remaining = startedAt + 30000 - Date.now();
  if (remaining > 0) {
    paymentRevealTimer = setTimeout(revealPaymentCheck, remaining);
    return;
  }
  paymentCheck.hidden = false;
}
purchaseLink.addEventListener('click', () => {
  if (!signedIn || !accountKey) return;
  sessionStorage.setItem('keden44-purchase-start:' + accountKey, String(Date.now()));
  revealPaymentCheck();
});

async function checkAccount() {
  await copyReady;
  const generation = ++accountCheck;
  clearTimeout(pollTimer);
  signedIn = false;
  returnLink.hidden = true;
  logoutButton.hidden = true;
  accountKey = '';
  paymentCheck.hidden = true;
  clearTimeout(paymentRevealTimer);
  purchaseLink.hidden = true;
  paidButton.disabled = true;
  try {
    const device = credentials();
    if (!device?.accountId || !device?.deviceSecret) {
      clearSubscriptionStatus();
      accountStatus.textContent = ACCESS_COPY.signIn;
      loginLink.hidden = false;
      telegramLogin.setAuthenticated(false);
      void prepareGoogle();
      return;
    }
    const result = await request('/connection');
    if (generation !== accountCheck) return;
    const profile = result.identity || result.google;
    signedIn = Boolean(profile?.email || profile?.telegramId);
    accountStatus.textContent = signedIn
      ? `Вход выполнен: ${profile.email || 'Telegram ID ' + profile.telegramId}`
      : ACCESS_COPY.signIn;
    loginLink.hidden = signedIn;
    logoutButton.hidden = !signedIn;
    telegramLogin.setAuthenticated(signedIn);
    if (!signedIn) void prepareGoogle();
    accountKey = signedIn ? String(profile.email || 'tg:' + profile.telegramId) : '';
    if (signedIn) {
      checkSubscriptionStatus.hidden = false;
      void refreshSubscription(true);
    } else clearSubscriptionStatus();
    revealPaymentCheck();
    purchaseLink.hidden = !signedIn;
    paidButton.disabled = !signedIn;
    const linkedClaim=new URL(location.href).searchParams.get('payment');
    if (signedIn && /^[0-9a-f-]{36}$/i.test(linkedClaim||'')) localStorage.setItem(CLAIM_KEY,linkedClaim);
    if (signedIn && localStorage.getItem(CLAIM_KEY)) { paymentCheck.hidden=false; await pollClaim(); }
  } catch {
    if (generation !== accountCheck) return;
    clearSubscriptionStatus();
    loginLink.hidden = false;
    telegramLogin.setAuthenticated(false);
    void prepareGoogle();
    accountStatus.textContent = 'Не удалось проверить аккаунт. Обновите страницу перед оплатой.';
  }
}

function credentials() {
  try { return JSON.parse(localStorage.getItem(DEVICE_KEY) || 'null'); }
  catch { return null; }
}

async function request(path, body = {}) {
  let device = credentials();
  if (!device?.accountId || !device?.deviceSecret) {
    const response = await fetch(`${API}/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Не удалось создать защищённую сессию');
    device = { accountId: result.accountId, deviceSecret: result.deviceSecret };
    localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
  }
  const response = await fetch(`${API}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...device, ...body }),
    signal: AbortSignal.timeout(15_000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || `Ошибка ${response.status}`);
  return result;
}

function schedulePoll(delay) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(pollClaim, delay);
}

function showClaim(claim) {
  paidButton.disabled = ['searching', 'provisional'].includes(claim.status);
  cancelButton.hidden = !['searching','provisional'].includes(claim.status);
  if (claim.status === 'cancelled') {
    clearTimeout(pollTimer);
    localStorage.removeItem(CLAIM_KEY);
    detailsButton.hidden=true;detailsForm.hidden=true;
    statusBox.textContent='Заявка закрыта. После оплаты нажмите «Я оплатил» заново.';
    statusBox.dataset.state='cancelled';
    return;
  }
  if (claim.status === 'confirmed') {
    const validUntil = claim.validUntil
      ? formatAccessDate(claim.validUntil)
      : '';
    statusBox.textContent = validUntil
      ? `Оплата подтверждена. Доступ активен до ${validUntil}.`
      : 'Оплата подтверждена. Доступ активен.';
    statusBox.dataset.state = 'success';
    detailsButton.hidden = true;
    detailsForm.hidden = true;
    clearTimeout(pollTimer);
    void refreshSubscription();
    return;
  }
  if (claim.status === 'provisional') {
    statusBox.textContent = 'Данные сохранены. Ожидаем письмо Boosty до 24 часов: при однозначном совпадении доступ продлится автоматически. Повторно платить не нужно.';
    statusBox.dataset.state = 'pending';
    detailsButton.hidden = !detailsForm.hidden;
    detailsButton.textContent='Уточнить данные платежа';
  } else {
    statusBox.textContent = 'Ищем платёж. Повторно нажимать не нужно — проверяем автоматически.';
    statusBox.dataset.state = 'searching';
    detailsButton.hidden = !claim.needsDetails || !detailsForm.hidden;
    if (claim.needsDetails) statusBox.textContent='Пока не удалось найти оплату. Если оплатили, укажите данные покупки. Если только проверяли кнопку, закройте заявку.';
  }
  if(claim.queueStatus==='ambiguous')statusBox.textContent='Найдено несколько возможных совпадений. Автоматическое начисление приостановлено: уточните данные покупки или напишите в поддержку.';
  if(claim.queueStatus==='needs_review'){
    clearTimeout(pollTimer);
    statusBox.textContent='За 24 часа не удалось однозначно подтвердить оплату. Заявка сохранена. Не платите повторно: напишите в поддержку для ручной проверки.';
    return;
  }
  schedulePoll(claim.checkAgainMs || (pollCount < 12 ? 10_000 : 30_000));
}

async function pollClaim() {
  const claimId = localStorage.getItem(CLAIM_KEY);
  const account=credentials()?.accountId;
  if (!claimId) return;
  try {
    pollCount += 1;
    const result = await request('/payment/status', { claimId });
    if (localStorage.getItem(CLAIM_KEY)!==claimId || credentials()?.accountId!==account) return;
    showClaim(result.claim);
  } catch (error) {
    statusBox.textContent = 'Проверка временно недоступна. Повторим автоматически: ' + error.message;
    schedulePoll(30_000);
  }
}

paidButton.addEventListener('click', async () => {
  if (!signedIn) return;
  paidButton.disabled = true;
  statusBox.textContent = 'Запускаем проверку платежа...';
  try {
    const result = await request('/payment/start');
    localStorage.setItem(CLAIM_KEY, result.claim.id);
    pollCount = 0;
    showClaim(result.claim);
  } catch (error) {
    paidButton.disabled = false;
    statusBox.textContent = 'Не удалось начать проверку: ' + error.message;
  }
});

detailsButton.addEventListener('click', () => {
  detailsForm.hidden = false;
  detailsButton.hidden = true;
});

cancelButton.addEventListener('click',async()=>{
  cancelButton.disabled=true;
  clearTimeout(pollTimer);
  try { const result=await request('/payment/cancel',{claimId:localStorage.getItem(CLAIM_KEY)});showClaim(result.claim); }
  catch(error){statusBox.textContent='Не удалось закрыть заявку: '+error.message;}
  finally{cancelButton.disabled=false;}
});

detailsForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = detailsForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  const data = new FormData(detailsForm);
  try {
    const result = await request('/payment/identify', {
      claimId: localStorage.getItem(CLAIM_KEY),
      paidTime: String(data.get('paidTime') || ''),
      paidDate: String(data.get('paidDate') || ''),
      payerName: String(data.get('payerName') || ''),
      payerEmail: String(data.get('payerEmail') || '')
    });
    showClaim(result.claim);
  } catch (error) {
    statusBox.textContent = 'Не удалось сохранить данные: ' + error.message;
  } finally {
    submit.disabled = false;
  }
});

window.addEventListener('focus', checkAccount);
checkSubscriptionStatus.addEventListener('click', () => {
  if (signedIn) void refreshSubscription(true);
  else void checkAccount();
});
window.addEventListener('storage', event => {
  if (event.key === DEVICE_KEY || event.key === null) {
    clearSubscriptionStatus();
    checkAccount();
  }
});
checkAccount();
