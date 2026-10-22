(() => {
 if(window.__k44FooterStarted)return;
 window.__k44FooterStarted=true;
 // Analytics is independent of the footer request, including offline failures.
 if(!document.querySelector('script[data-k44-analytics]')){
  const analytics=document.createElement('script');analytics.src='/shared/analytics.js';analytics.async=true;analytics.dataset.k44Analytics='';document.head.append(analytics);
 }
 const mount=async()=>{
  const footer=document.querySelector('footer[data-site-footer]');if(!footer)return;
  try{
   const response=await fetch('/shared/footer.html',{cache:'no-cache',credentials:'omit'});
   if(!response.ok)throw new Error('Footer unavailable');
   const template=document.createElement('template');template.innerHTML=await response.text();
   if(!template.content.querySelector('.k44-footer-inner'))throw new Error('Invalid footer');
   const actions=footer.querySelector('[data-footer-actions]');
   footer.replaceChildren(template.content.cloneNode(true));
   if(actions){const slot=footer.querySelector('[data-site-footer-actions]');slot.append(actions);slot.hidden=false;}
   footer.dataset.loaded='true';
  }catch{footer.dataset.loaded='fallback';}
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else void mount();
})();
