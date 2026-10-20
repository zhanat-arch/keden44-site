export function createCardSharing({client, sync, signedIn, status}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'cardSharingDialog';
  dialog.innerHTML = '<div class="dh"><h2>Доступ к карточке</h2><button type="button" data-close aria-label="Закрыть">×</button></div>'
    + '<p data-number></p><p>Любой получивший ссылку сможет видеть номер ДТ, первый товар, статус и даты обновлений. Без заметок, документов и доступа к вашему монитору. Уже увиденные данные отозвать невозможно.</p>'
    + '<label data-link-label hidden>Ссылка только для чтения<input data-link readonly aria-label="Ссылка на карточку"></label>'
    + '<p data-status role="status"></p><div class="da"><button type="button" data-copy hidden>Копировать ссылку</button><button type="button" data-revoke hidden>Прекратить доступ</button><button type="button" data-create class="primary">Включить доступ по ссылке</button></div>';
  document.body.append(dialog);
  const find = selector => dialog.querySelector(selector);
  let recordId, busy = false;
  function show(value) {
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
    find('[data-status]').textContent = 'Проверяю доступ…';
    try {await task();} catch (error) {find('[data-status]').textContent = error.message;}
    finally {busy = false; dialog.querySelectorAll('.da button').forEach(node => {node.disabled = false;});}
  }
  find('[data-close]').onclick = () => {if (!busy) dialog.close();};
  dialog.addEventListener('cancel', event => {if (busy) event.preventDefault();});
  find('[data-create]').onclick = () => run(async () => {
    await sync();
    show(await client.createCardShare(recordId));
    find('[data-status]').textContent = 'Доступ включён. Ссылка обновляется по данным вашей синхронизации.';
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
