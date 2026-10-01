if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

const mobileLayout = matchMedia('(max-width: 720px)');
if (mobileLayout.matches) {
  document.querySelectorAll('.compactControls').forEach(panel => panel.removeAttribute('open'));
}

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
