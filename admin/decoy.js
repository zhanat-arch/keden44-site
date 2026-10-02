(() => {
  const visitKey = 'k44-admin-decoy-visits';
  const groupKey = 'k44-admin-decoy-group';
  const visits = Math.min(20, Number(localStorage.getItem(visitKey) || 0) + 1);
  localStorage.setItem(visitKey, String(visits));
  let group = Number(localStorage.getItem(groupKey));
  if (!Number.isInteger(group) || group < 0 || group > 2) {
    group = crypto.getRandomValues(new Uint8Array(1))[0] % 3;
    localStorage.setItem(groupKey, String(group));
  }
  if (visits < 3 || group !== 0) return;

  document.querySelector('#plainMessage').hidden = true;
  document.querySelector('#decoy').hidden = false;
  document.querySelector('#decoyButton').addEventListener('click', event => {
    event.currentTarget.disabled = true;
    document.querySelector('#decoyStatus').textContent = 'Проверяем права и журналы безопасности...';
    const progress = document.querySelector('#decoyProgress');
    progress.hidden = false;
    requestAnimationFrame(() => { progress.firstElementChild.style.width = '100%'; });
    setTimeout(() => {
      document.querySelector('#decoyStatus').textContent = 'Доступ ограничен. Попытка зарегистрирована.';
      event.currentTarget.textContent = 'Недоступно';
    }, 2500);
  });
})();
