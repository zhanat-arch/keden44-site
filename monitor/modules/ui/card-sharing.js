export function createCardSharing({client, sync, signedIn, status}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'cardSharingDialog';
  dialog.innerHTML = '<div class="dh"><h2>Доступ к карточке</h2><button type="button" data-close aria-label="Закрыть">×</button></div>'
    + '<p data-number></p><p>Любой получивший ссылку сможет видеть номер ДТ, первый товар, статус и даты обновлений. Без заметок, документов и доступа к вашему монитору. Уже увиденные данные отозвать невозможно.</p>'
    + '<div class="cardShareOptions"><label><input type="checkbox" data-declarant> Показывать декларанта</label><label><input type="checkbox" data-notifications> Показывать историю уведомлений</label><small>Уведомления могут содержать ФИО, суммы и служебные подробности.</small></div>'
    + '<label data-link-label hidden>Ссылка только для чтения<input data-link readonly aria-label="Ссылка на карточку"></label>'
    + '<p data-status role="status"></p><div class="da"><button type="button" data-copy hidden>Копировать ссылку</button><button type="button" data-revoke hidden>Прекратить доступ</button><button type="button" data-create class="primary">Включить доступ по ссылке</button></div>';
  document.body.append(dialog);
  const find = selector => dialog.querySelector(selector);
  let recordId, busy = false, active = false;
  const options = () => ({declarant: find('[data-declarant]').checked, notifications: find('[data-notifications]').checked});
  function show(value) {
    active = value.enabled === true;
    find('[data-declarant]').checked = !value.enabled || value.options?.declarant === true;
    find('[data-notifications]').checked = !value.enabled || value.options?.notifications === true;
    find('[data-link-label]').hidden = !value.enabled;
    find('[data-copy]').hidden = !value.enabled;
    find('[data-revoke]').hidden = !value.enabled;
    find('[data-create]').hidden = value.enabled;
    find('[data-link]').value = value.url || '';
  }
  async function run(task) {
    if (busy) return;
    busy = true;
    dialog.querySelectorAll('.da button').forEach(node => {node.disabled = true;});
    dialog.querySelectorAll('.cardShareOptions input').forEach(node => {node.disabled = true;});
    find('[data-status]').textContent = 'Проверяю доступ…';
    try {await task();} catch (error) {find('[data-status]').textContent = error.message;}
    finally {busy = false; dialog.querySelectorAll('.da button,.cardShareOptions input').forEach(node => {node.disabled = false;});}
  }
  find('[data-close]').onclick = () => {if (!busy) dialog.close();};
  dialog.addEventListener('cancel', event => {if (busy) event.preventDefault();});
  find('[data-create]').onclick = () => run(async () => {
    await sync();
    show(await client.createCardShare(recordId, options()));
    find('[data-status]').textContent = 'Доступ включён. Ссылка обновляется по данным вашей синхронизации.';
  });
  for (const checkbox of dialog.querySelectorAll('.cardShareOptions input')) checkbox.addEventListener('change', () => {
    if (!active) return;
    run(async () => {
      const selected = options();
      try {show(await client.updateCardShareOptions(recordId, selected)); find('[data-status]').textContent = 'Сохранено. У получателя изменится после обновления карточки.';}
      catch (error) {show(await client.cardShareStatus(recordId)); throw error;}
    });
  });
  find('[data-revoke]').onclick = () => run(async () => {
    show(await client.revokeCardShare(recordId));
    find('[data-status]').textContent = 'Старая ссылка отключена. При повторном включении будет создана новая.';
  });
  find('[data-copy]').onclick = async () => {
    try {await navigator.clipboard.writeText(find('[data-link]').value); find('[data-status]').textContent = 'Ссылка скопирована';}
    catch {find('[data-link]').focus(); find('[data-link]').select(); find('[data-status]').textContent = 'Скопируйте выделенную ссылку';}
  };
  return async record => {
    if (!signedIn()) {status('Для общего доступа войдите через Google и дождитесь синхронизации.'); return;}
    recordId = record.id;
    show({enabled: false});
    find('[data-number]').textContent = record.dtNumber;
    dialog.showModal();
    await run(async () => {show(await client.cardShareStatus(record.id)); find('[data-status]').textContent = '';});
  };
}
