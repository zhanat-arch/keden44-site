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

let tooltipTimer;
let tooltipHideTimer;
let longPressedControl;
const floatingTooltip = document.createElement('div');
floatingTooltip.className = 'floatingTooltip';
floatingTooltip.setAttribute('role', 'tooltip');
document.body.appendChild(floatingTooltip);

function hideTooltip() {
  clearTimeout(tooltipHideTimer);
  floatingTooltip.classList.remove('isVisible');
}

function showTooltip(control, duration = 0) {
  const text = control?.dataset.tooltip;
  if (!text) return;
  clearTimeout(tooltipHideTimer);
  floatingTooltip.textContent = text;
  floatingTooltip.classList.add('isVisible');
  const controlRect = control.getBoundingClientRect();
  const tooltipRect = floatingTooltip.getBoundingClientRect();
  const gap = 8;
  const left = Math.min(
    window.innerWidth - tooltipRect.width - gap,
    Math.max(gap, controlRect.left + controlRect.width / 2 - tooltipRect.width / 2)
  );
  const above = controlRect.top - tooltipRect.height - gap;
  const top = above >= gap ? above : Math.min(window.innerHeight - tooltipRect.height - gap, controlRect.bottom + gap);
  floatingTooltip.style.left = `${left}px`;
  floatingTooltip.style.top = `${Math.max(gap, top)}px`;
  if (duration) tooltipHideTimer = setTimeout(hideTooltip, duration);
}

document.addEventListener('pointerover', event => {
  if (event.pointerType === 'touch') return;
  const control = event.target.closest('[data-tooltip]');
  if (control) showTooltip(control);
});
document.addEventListener('pointerout', event => {
  const control = event.target.closest('[data-tooltip]');
  if (control && !control.contains(event.relatedTarget)) hideTooltip();
});
document.addEventListener('focusin', event => showTooltip(event.target.closest('[data-tooltip]')));
document.addEventListener('focusout', hideTooltip);
document.addEventListener('pointerdown', event => {
  const control = event.target.closest('[data-tooltip]');
  if (!control) return;
  clearTimeout(tooltipTimer);
  tooltipTimer = setTimeout(() => {
    longPressedControl = control;
    showTooltip(control, 1800);
  }, 550);
});
for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) {
  document.addEventListener(eventName, () => clearTimeout(tooltipTimer), true);
}
document.addEventListener('click', event => {
  const control = event.target.closest('[data-tooltip]');
  if (control && control === longPressedControl) {
    event.preventDefault();
    event.stopImmediatePropagation();
    longPressedControl = undefined;
    return;
  }
  event.target.closest('.cardMenuPopover')?.closest('.cardMenu')?.removeAttribute('open');
}, true);
window.addEventListener('scroll', hideTooltip, true);
window.addEventListener('resize', hideTooltip);

document.addEventListener('click', event => {
  const dialog = event.target.closest('dialog[open]');
  if (!dialog || event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  const outsideContent = event.clientX < rect.left || event.clientX > rect.right
    || event.clientY < rect.top || event.clientY > rect.bottom;
  if (outsideContent) dialog.close();
});

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
