// Shared public wording, available even when the account API is unavailable.
// Access decisions and personal expiry dates remain server-authoritative.
const DEFAULT_COPY = Object.freeze({
  signIn: 'Для доступа нужно авторизоваться через Google или Telegram.',
  trial: 'Новым аккаунтам доступен бесплатный пробный период. Точный срок появится после входа. Повторный вход и смена браузера не запускают пробный период заново.',
  trialActive: 'Пробный доступ активен. Дата окончания определяется сервером и не меняется при повторном входе.',
  grace: 'После окончания оплаченного доступа может предоставляться срок на оплату. Точная дата и текущий статус показаны после входа. Повторный вход не продлевает доступ.',
  unavailable: 'Не удалось проверить доступ. Повторите проверку позже. Это не означает, что подписка закончилась.'
});
export let ACCESS_COPY = DEFAULT_COPY;
let siteCopy = {}, serverCopy = {};
function validCopy(value) {
  const clean = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return clean;
  for (const key of Object.keys(DEFAULT_COPY)) {
    if (typeof value[key] === 'string' && value[key].trim() && value[key].length <= 1200) clean[key] = value[key].trim();
  }
  return clean;
}
function updateCopy() {
  ACCESS_COPY = Object.freeze({...DEFAULT_COPY, ...siteCopy, ...serverCopy});
  renderAccessCopy();
}
export function setServerAccessCopy(value) {
  serverCopy = validCopy(value);
  updateCopy();
}
export const copyReady = (async () => {
  try {
    const response = await fetch('/shared/access-copy.json', {cache:'no-cache', signal:AbortSignal.timeout(3000)});
    if (!response.ok) return;
    siteCopy = validCopy(await response.json());
    updateCopy();
  } catch { /* Built-in copy remains available without either remote source. */ }
})();
export function renderAccessCopy(root = document) {
  for (const element of root.querySelectorAll('[data-access-copy]')) {
    const value = ACCESS_COPY[element.dataset.accessCopy];
    if (typeof value === 'string') element.textContent = value;
  }
}
