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
