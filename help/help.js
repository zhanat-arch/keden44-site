const search = document.getElementById('faqSearch');
const items = [...document.querySelectorAll('#faqList details')];
const empty = document.getElementById('faqEmpty');
const count = document.getElementById('faqCount');
const categoryButtons = [...document.querySelectorAll('#faqCategories button')];
let activeCategory = 'all';

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim();
}

function filterFaq() {
  const terms = normalize(search.value).split(/\s+/).filter(Boolean);
  let visible = 0;
  for (const item of items) {
    const haystack = normalize(`${item.dataset.search || ''} ${item.textContent}`);
    const matchesSearch = terms.every(term => haystack.includes(term));
    const matchesCategory = activeCategory === 'all' || item.dataset.category === activeCategory;
    item.hidden = !matchesSearch || !matchesCategory;
    if (!item.hidden) visible += 1;
  }
  empty.hidden = visible > 0;
  count.textContent = `Найдено: ${visible}`;
}

search.addEventListener('input', filterFaq);
for (const button of categoryButtons) {
  button.addEventListener('click', () => {
    activeCategory = button.dataset.category;
    for (const candidate of categoryButtons) candidate.classList.toggle('active', candidate === button);
    filterFaq();
  });
}

filterFaq();
