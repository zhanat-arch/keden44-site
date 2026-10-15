const entries=[
 {title:'Между грузом и кнопкой',text:'От АСТАНА-1 к KEDEN: 15 историй, рабочий юмор и маленькие победы.',url:'/blog/astana-keden/'},
 {title:'Коллега, который не сказал «у меня работает»',text:'Первый совет не помог. Но разговор на этом не закончился.',url:'/blog/astana-keden/#story=java'},
 {title:'Кнопку нашли. Профессия осталась.',text:'Нужные графы стали доступны. Теперь начинается настоящая работа.',url:'/blog/astana-keden/#story=fields'}
];
const header=document.querySelector('.topbar')||document.querySelector('body > header')||document.querySelector('header');
if(header){
 const root=document.createElement('aside');root.className='blogStrip';root.setAttribute('aria-label','Интересное: блог KEDEN44');
 root.innerHTML='<a class="blogStripLabel" href="/blog/">Интересное <span>Жизнь декларанта</span></a><a class="blogStripStory" href="/blog/astana-keden/"><strong></strong><span></span></a><div class="blogStripActions"><button type="button" data-prev title="Предыдущая история" aria-label="Предыдущая история">‹</button><button type="button" data-pause title="Приостановить смену историй" aria-pressed="false">Пауза</button><button type="button" data-next title="Следующая история" aria-label="Следующая история">›</button></div>';
 header.insertAdjacentElement('afterend',root);let index=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,hovered=false;
 const story=root.querySelector('.blogStripStory'),pause=root.querySelector('[data-pause]');
 const render=()=>{const item=entries[index];story.href=item.url;story.querySelector('strong').textContent=item.title;story.querySelector('span').textContent=item.text;pause.textContent=paused?'Продолжить':'Пауза';pause.setAttribute('aria-pressed',String(paused));};
 root.querySelector('[data-prev]').onclick=()=>{index=(index+entries.length-1)%entries.length;render()};root.querySelector('[data-next]').onclick=()=>{index=(index+1)%entries.length;render()};pause.onclick=()=>{paused=!paused;render()};
 root.addEventListener('mouseenter',()=>hovered=true);root.addEventListener('mouseleave',()=>hovered=false);
 setInterval(()=>{if(paused||hovered||document.hidden||root.contains(document.activeElement))return;index=(index+1)%entries.length;render()},9000);render();
}
