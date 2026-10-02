const search = document.getElementById('faqSearch');
const items = [...document.querySelectorAll('#faqList details')];
const empty = document.getElementById('faqEmpty');

search.addEventListener('input', () => {
  const query = search.value.trim().toLocaleLowerCase('ru-RU');
  let visible = 0;
  for (const item of items) {
    const haystack = `${item.dataset.search || ''} ${item.textContent}`.toLocaleLowerCase('ru-RU');
    item.hidden = Boolean(query && !haystack.includes(query));
    if (!item.hidden) visible += 1;
  }
  empty.hidden = visible > 0;
});
