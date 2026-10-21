const API = 'https://api.keden44.com/v1/telegram';
const DEVICE_KEY = 'keden44-telegram-device-v1';
const CLAIM_KEY = 'keden44-payment-claim-v1';
const paidButton = document.querySelector('#paidBtn');
const statusBox = document.querySelector('#paymentStatus');
const detailsButton = document.querySelector('#showPaymentDetails');
const detailsForm = document.querySelector('#paymentDetails');
let pollTimer;
let pollCount = 0;
const purchaseLink = document.querySelector('#purchaseLink');
const accountStatus = document.querySelector('#subscriptionAccount');
const loginLink = document.querySelector('#subscriptionLogin');
const paymentCheck = document.querySelector('.payment-check');
purchaseLink.after(paymentCheck);
paymentCheck.style.cssText = 'grid-template-columns:1fr;gap:16px;padding:24px 0';
paymentCheck.hidden = true;
let signedIn = false;
let accountCheck = 0;
let paymentRevealTimer;
let accountKey = '';
function revealPaymentCheck() {
  clearTimeout(paymentRevealTimer);
  paymentCheck.hidden = true;
  if (!signedIn || !accountKey) return;
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
  const generation = ++accountCheck;
  clearTimeout(pollTimer);
  signedIn = false;
  accountKey = '';
  paymentCheck.hidden = true;
  clearTimeout(paymentRevealTimer);
  purchaseLink.hidden = true;
  paidButton.disabled = true;
  try {
    const device = credentials();
    if (!device?.accountId || !device?.deviceSecret) {
      accountStatus.textContent = 'Для подписки войдите через Google или Telegram в Мониторе.';
      loginLink.hidden = false;
      return;
    }
    const result = await request('/connection');
    if (generation !== accountCheck) return;
    const profile = result.identity || result.google;
    signedIn = Boolean(profile?.email || profile?.telegramId);
    accountStatus.textContent = signedIn
      ? `Вход выполнен: ${profile.email || 'Telegram ID ' + profile.telegramId}`
      : 'Для подписки войдите через Google или Telegram в Мониторе.';
    loginLink.hidden = signedIn;
    accountKey = signedIn ? String(profile.email || 'tg:' + profile.telegramId) : '';
    revealPaymentCheck();
    purchaseLink.hidden = !signedIn;
    paidButton.disabled = !signedIn;
    if (signedIn && localStorage.getItem(CLAIM_KEY)) await pollClaim();
  } catch {
    if (generation !== accountCheck) return;
    loginLink.hidden = false;
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
  const response = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...device, ...body }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || `Ошибка ${response.status}`);
  return result;
}

function schedulePoll(delay) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(pollClaim, delay);
}

function showClaim(claim) {
  paidButton.disabled = ['searching', 'provisional', 'confirmed'].includes(claim.status);
  if (claim.status === 'confirmed') {
    const validUntil = claim.validUntil
      ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(claim.validUntil))
      : '';
    statusBox.textContent = validUntil
      ? `Оплата подтверждена. Доступ активен до ${validUntil}.`
      : 'Оплата подтверждена. Доступ активен.';
    statusBox.dataset.state = 'success';
    detailsButton.hidden = true;
    detailsForm.hidden = true;
    clearTimeout(pollTimer);
    return;
  }
  if (claim.status === 'provisional') {
    statusBox.textContent = 'Данные сохранены. Доступ будет продлён после подтверждения платежа.';
    statusBox.dataset.state = 'pending';
    detailsButton.hidden = true;
    detailsForm.hidden = true;
  } else {
    statusBox.textContent = 'Ищем платёж. Повторно нажимать не нужно — проверяем автоматически.';
    statusBox.dataset.state = 'searching';
    detailsButton.hidden = !(claim.needsDetails || pollCount >= 3);
  }
  schedulePoll(claim.checkAgainMs || (pollCount < 12 ? 10_000 : 30_000));
}

async function pollClaim() {
  const claimId = localStorage.getItem(CLAIM_KEY);
  if (!claimId) return;
  try {
    pollCount += 1;
    const result = await request('/payment/status', { claimId });
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

detailsForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = detailsForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  const data = new FormData(detailsForm);
  try {
    const result = await request('/payment/identify', {
      claimId: localStorage.getItem(CLAIM_KEY),
      paidAt: new Date(String(data.get('paidAt'))).toISOString(),
      cardLast4: String(data.get('cardLast4') || '')
    });
    showClaim(result.claim);
  } catch (error) {
    statusBox.textContent = 'Не удалось сохранить данные: ' + error.message;
  } finally {
    submit.disabled = false;
  }
});

window.addEventListener('focus', checkAccount);
window.addEventListener('storage', event => {
  if (event.key === DEVICE_KEY || event.key === null) checkAccount();
});
checkAccount();
