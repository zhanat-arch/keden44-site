if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

let installPrompt;
const installButton = document.querySelector('#installBtn');
const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
if (standalone && installButton) {
  installButton.textContent = 'Установлено';
  installButton.disabled = true;
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  if (installButton) installButton.hidden = false;
});
installButton?.addEventListener('click', async () => {
  if (installPrompt) {
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      installButton.textContent = 'Установлено';
      installButton.disabled = true;
    }
    installPrompt = undefined;
    return;
  }
  alert('В Edge откройте меню «…» → «Приложения» → «Установить KEDEN44». Если пункта пока нет, обновите страницу и подождите несколько секунд.');
});
window.addEventListener('appinstalled', () => {
  if (!installButton) return;
  installButton.textContent = 'Установлено';
  installButton.disabled = true;
  installPrompt = undefined;
});

document.querySelectorAll('.compactControls').forEach(panel => panel.removeAttribute('open'));

const KEDEN_NOTIFICATIONS_KEY = 'keden44-keden-notifications';
const KEDEN_HEALTH_KEY = 'keden44-keden-notification-health';
function applyKedenNotifications(items, attempt = 0) {
  if (window.KEDEN44_MONITOR?.applyNotifications) {
    window.KEDEN44_MONITOR.applyNotifications(Array.isArray(items) ? items : []);
    return;
  }
  if (attempt < 20) setTimeout(() => applyKedenNotifications(items, attempt + 1), 250);
}
window.addEventListener('keden44-notifications', event => applyKedenNotifications(event.detail));
try {
  applyKedenNotifications(JSON.parse(localStorage.getItem(KEDEN_NOTIFICATIONS_KEY) || '[]'));
} catch {}

function applyKedenHealth(health) {
  const indicator = document.querySelector('#kedenRequestHealth');
  if (!indicator || !health || typeof health.ok !== 'boolean') return;
  const message = health.ok
    ? 'Запросы KEDEN обновляются. Серверная проверка статусов по QR также работает.'
    : health.reason === 'tab-closed'
      ? 'Запросы временно не обновляются: откройте вкладку KEDEN. Статусы выпуска продолжают проверяться сервером по QR.'
      : 'Запросы временно не обновляются: войдите в KEDEN снова или обновите его вкладку. Статусы выпуска продолжают проверяться сервером по QR.';
  indicator.dataset.state = health.ok ? 'ready' : 'warning';
  indicator.dataset.message = message;
  indicator.title = message;
  indicator.setAttribute('aria-label', message);
}
window.addEventListener('keden44-notification-health', event => applyKedenHealth(event.detail));
try {
  applyKedenHealth(JSON.parse(localStorage.getItem(KEDEN_HEALTH_KEY) || 'null'));
} catch {}
document.querySelector('#kedenRequestHealth')?.addEventListener('click', event => {
  const message = event.currentTarget.dataset.message || 'Состояние чтения запросов ещё не получено. Статусы выпуска проверяются сервером по QR.';
  const line = document.querySelector('#line');
  if (line) line.textContent = message;
});

document.querySelector('#shareMonitorBtn')?.addEventListener('click', async () => {
  const share = { title: 'KEDEN44 — монитор статусов ДТ', text: 'Монитор статусов деклараций KEDEN44', url: 'https://keden44.com/monitor/' };
  try {
    if (navigator.share) await navigator.share(share);
    else {
      await navigator.clipboard.writeText(share.url);
      document.querySelector('#shareMonitorBtn').textContent = 'Ссылка скопирована';
    }
  } catch {}
});
