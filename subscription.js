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
let signedIn = false;

async function checkAccount() {
  signedIn = false;
  purchaseLink.hidden = true;
  paidButton.disabled = true;
  try {
    const device = credentials();
    if (!device?.accountId || !device?.deviceSecret) {
      accountStatus.textContent = 'Для подписки войдите через Google в Мониторе и вернитесь сюда.';
      return;
    }
    const result = await request('/connection');
    signedIn = Boolean(result.google?.email);
    accountStatus.textContent = signedIn
      ? `Аккаунт подписки: ${result.google.email}`
      : 'Для подписки войдите через Google в Мониторе и вернитесь сюда.';
    purchaseLink.hidden = !signedIn;
    paidButton.disabled = !signedIn;
    if (signedIn && localStorage.getItem(CLAIM_KEY)) await pollClaim();
  } catch {
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
checkAccount();
