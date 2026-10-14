import qrcode from '../../vendor/qrcode.mjs';

export function installTelegramLogin(client, onComplete) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Войти через Telegram-бота';
  document.querySelector('#googleSignIn').after(button);
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'telegramLoginTitle');
  dialog.style.cssText = 'width:420px;max-width:calc(100vw - 32px);padding:24px;border:1px solid #ccd7e4;border-radius:8px';
  dialog.innerHTML = '<h2 id="telegramLoginTitle" style="font-size:20px;margin:0 0 16px">Вход через Telegram-бота</h2><canvas width="256" height="256" style="display:block;width:256px;max-width:100%;height:auto;margin:16px auto"></canvas><p>Для входа используем Telegram ID. Номер телефона не запрашиваем.</p><p role="status" aria-live="polite"></p><a target="_blank" rel="noopener noreferrer">Открыть бота</a><form method="dialog" style="margin-top:16px"><button>Отмена</button></form>';
  document.body.append(dialog);
  let token = '';
  let timeout;
  let generation = 0;
  dialog.addEventListener('close', () => {
    generation++;
    clearTimeout(timeout);
    if (token) client.telegramLoginCancel(token).catch(() => {});
    token = '';
  });
  button.addEventListener('click', async () => {
    if (dialog.open) return;
    dialog.showModal();
    const current = ++generation;
    const status = dialog.querySelector('[role="status"]');
    const link = dialog.querySelector('a');
    link.hidden = true;
    status.textContent = 'Создаём защищённую ссылку…';
    const canvas = dialog.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 256, 256);
    try {
      const result = await client.telegramLoginStart();
      if (current !== generation || !dialog.open) { client.telegramLoginCancel(result.token).catch(() => {}); return; }
      token = result.token;
      link.href = result.url;
      link.hidden = false;
      const qr = qrcode(0, 'M');
      qr.addData(result.url);
      qr.make();
      const count = qr.getModuleCount();
      const scale = Math.floor(256 / (count + 8));
      const offset = Math.floor((256 - count * scale) / 2);
      ctx.fillStyle = '#000';
      for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) ctx.fillRect(offset + col * scale, offset + row * scale, scale, scale);
      }
      status.textContent = 'Сканируйте QR или откройте бота и подтвердите вход. Ссылка действует 10 минут.';
      async function poll() {
        if (!dialog.open || generation !== current) return;
        try {
          const response = await client.telegramLoginStatus(token);
          if (generation !== current) return;
          if (response.status === 'complete') {
            token = '';
            dialog.close();
            button.hidden = true;
            await onComplete();
            return;
          }
          if (['expired', 'cancelled'].includes(response.status)) {
            status.textContent = 'Ссылка истекла. Закройте окно и начните вход заново.';
            link.hidden = true;
            return;
          }
          timeout = setTimeout(poll, 2000);
        } catch (error) {
          status.textContent = error.message;
        }
      }
      timeout = setTimeout(poll, 1500);
    } catch (error) { status.textContent = error.message; }
  });
  return { setAuthenticated: value => { button.hidden = Boolean(value); } };
}
