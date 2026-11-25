// Time windows require explicit offsets so every browser uses the same deadline.
export function isVisibleAt(element, now = Date.now()) {
  const start = element.getAttribute('data-visible-from');
  const end = element.getAttribute('data-visible-until');
  const parse = value => /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
  const from = start ? parse(start) : -Infinity;
  const until = end ? parse(end) : Infinity;
  return !Number.isNaN(from) && !Number.isNaN(until) && now >= from && now < until;
}
export function refreshTimedContent(root = document, now = Date.now()) {
  for (const element of root.querySelectorAll('[data-visible-from],[data-visible-until]')) {
    element.hidden = !isVisibleAt(element, now);
  }
}
refreshTimedContent();
setInterval(() => refreshTimedContent(), 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshTimedContent(); });
