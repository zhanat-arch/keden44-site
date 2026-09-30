const shareButton = document.getElementById('shareKeden44');
const shareResult = document.getElementById('shareResult');

shareButton?.addEventListener('click', async () => {
  const data = {
    title: 'KEDEN44',
    text: 'Инструменты для работы с документами графы 44 и мониторинга статусов ДТ.',
    url: 'https://keden44.com/'
  };
  try {
    if (navigator.share) await navigator.share(data);
    else {
      await navigator.clipboard.writeText(data.url);
      if (shareResult) shareResult.textContent = 'Ссылка скопирована';
    }
  } catch (error) {
    if (error.name !== 'AbortError' && shareResult) shareResult.textContent = 'Не удалось поделиться. Ссылка: keden44.com';
  }
});
