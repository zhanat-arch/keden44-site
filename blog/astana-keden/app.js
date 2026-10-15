const timeline=document.getElementById('timeline');
const reader=document.getElementById('reader');
const discussion=document.createElement('a');
discussion.className='discussionButton';discussion.textContent='Обсудить в Telegram';discussion.target='_blank';discussion.rel='noopener noreferrer';discussion.hidden=true;
reader.querySelector('.readerBottom').prepend(discussion);
const discussionPrompt=document.createElement('p');discussionPrompt.className='outcome';discussionPrompt.textContent='Вспомнили, как это было? Расскажите свою историю в комментариях. Пару ласковых системе тоже можно — без перехода на личности.';reader.querySelector('article').append(discussionPrompt);
timeline.addEventListener('click',event=>{const button=event.target.closest('[data-story]');if(!button)return;const url=STORY_DISCUSSIONS[button.dataset.story];discussion.hidden=!url;if(url)discussion.href=url;});
let selected=null;
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function drawThread(){
 const svg=document.getElementById('thread'),bounds=timeline.getBoundingClientRect();
 svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
 const points=[...timeline.querySelectorAll('.node')].map(n=>{const r=n.getBoundingClientRect();return {x:r.left+r.width/2-bounds.left,y:r.top+r.height/2-bounds.top}});
 let d='';points.forEach((p,i)=>{if(!i){d=`M ${p.x} ${p.y}`;return}const a=points[i-1],swing=innerWidth>760?(i%2?35:-35):0;d+=` C ${a.x+swing} ${(a.y+p.y)/2}, ${p.x-swing} ${(a.y+p.y)/2}, ${p.x} ${p.y}`});
 svg.querySelector('path').setAttribute('d',d);
}
function render(year='all'){
 timeline.querySelectorAll('.entry,.yearMark').forEach(n=>n.remove());
 const rows=STORIES.filter(s=>year==='all'||s.date.startsWith(year));let previous='';
 rows.forEach((s,i)=>{
  const y=s.date.slice(0,4);if(y!==previous){const mark=document.createElement('div');mark.className='yearMark';mark.innerHTML=`<span>${y} · ${y==='2024'?'Привычки встречают перемены':y==='2025'?'Помогаем. Учимся. Работаем.':'Новые ожидания'}</span>`;timeline.append(mark);previous=y;}
  const e=document.createElement('section');e.className=`entry ${s.kind}`;e.innerHTML=`<div class="node" aria-hidden="true"></div><article class="story"><div class="storyMeta"><time datetime="${s.date}">${escapeHtml(s.label)}</time><span>${escapeHtml(s.system)}</span></div><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.teaser)}</p>${s.quote?`<blockquote>«${escapeHtml(s.quote)}»</blockquote>`:''}<button class="read" type="button" data-story="${s.id}" aria-haspopup="dialog">Читать подробнее <span aria-hidden="true">↗</span></button></article>`;timeline.append(e);
 });
 document.getElementById('storyCount').textContent=rows.length+' историй';requestAnimationFrame(drawThread);
}
timeline.addEventListener('click',e=>{const b=e.target.closest('[data-story]');if(!b)return;selected=STORIES.find(s=>s.id===b.dataset.story);document.getElementById('readerTitle').textContent=selected.title;document.getElementById('readerDate').textContent=selected.label;document.getElementById('readerSystem').textContent=selected.system;document.getElementById('readerBody').innerHTML=selected.body.map(p=>`<p>${escapeHtml(p)}</p>`).join('')+(selected.quote?`<blockquote>«${escapeHtml(selected.quote)}»</blockquote>`:'');document.getElementById('readerOutcome').textContent=selected.outcome;document.getElementById('shareStatus').textContent='';reader.showModal();document.body.classList.add('modalOpen');});
document.getElementById('closeReader').onclick=()=>reader.close();reader.addEventListener('close',()=>document.body.classList.remove('modalOpen'));reader.addEventListener('click',e=>{if(e.target===reader){const b=reader.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)reader.close();}});
document.querySelectorAll('[data-year]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-year]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b))});render(b.dataset.year);});
document.getElementById('shareStory').onclick=async()=>{if(!selected)return;const url='https://keden44.com/blog/astana-keden/#story='+encodeURIComponent(selected.id);const text=selected.title+'\n\n'+selected.teaser+'\n\n'+url;try{await navigator.clipboard.writeText(text);document.getElementById('shareStatus').textContent='Текст и ссылка скопированы';}catch{document.getElementById('shareStatus').textContent='Копирование недоступно в этом браузере';}};
new ResizeObserver(drawThread).observe(timeline);render();
const requestedStory=new URLSearchParams(location.hash.slice(1)).get('story');
if(STORIES.some(s=>s.id===requestedStory))timeline.querySelector(`[data-story="${requestedStory}"]`)?.click();
