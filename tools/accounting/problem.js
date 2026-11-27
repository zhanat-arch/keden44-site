export function problemFor(result){
 if(!result.items?.length)return 'no_items';
 return result.complete?null:'incomplete';
}
export function createProblemPanel({report}){
 const panel=document.createElement('section');panel.hidden=true;panel.setAttribute('role','status');panel.className='note';
 panel.style.cssText='border-left:4px solid #a44916;padding:12px 16px;background:#fff5e8;margin:16px 0;line-height:1.6';
 const message=document.createElement('p');message.textContent='Не удалось полностью проверить PDF. Возможно, загружен другой документ, скан, старый или изменённый шаблон декларации. Попробуйте выгрузить актуальную ДТ из KEDEN с выделяемым текстом. Если проблема повторяется, сообщите нам и отправьте проблемный PDF в поддержку — мы перепроверим формат.';
 const privacy=document.createElement('p');privacy.textContent='Кнопка отправляет только технический сигнал. PDF и его содержимое автоматически не передаются.';
 const button=document.createElement('button');button.type='button';button.className='button';button.textContent='Сообщить о проблеме';
 const icon=document.createElement('i');icon.dataset.lucide='send';button.prepend(icon);
 const support=document.createElement('a');support.href='https://t.me/keden44_monitor_bot?start=support';support.target='_blank';support.rel='noopener noreferrer';support.textContent='Отправить PDF в поддержку';
 const actions=document.createElement('div');actions.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:12px';actions.append(button,support);
 const status=document.createElement('p');let issue=null,version=0;
 panel.append(message,privacy,actions,status);
 button.addEventListener('click',async()=>{
  if(!issue)return;button.disabled=true;status.textContent='Отправляем сообщение…';const current=version;
  try{const response=await report(issue);if(current!==version)return;if(!response.reported)throw Error('not_sent');status.textContent=`Сообщение передано разработчику. Номер обращения: ${response.reference}. Отправьте этот номер и проблемный PDF в поддержку для проверки. Сам PDF ещё не отправлен.`;}
  catch{if(current!==version)return;status.textContent='Не удалось подтвердить отправку сообщения. Попробуйте позже или обратитесь в поддержку напрямую.';button.disabled=false;}
 });
 return {element:panel,clear(){version++;issue=null;panel.hidden=true;status.textContent='';button.disabled=false;},show(reason,result){version++;issue={scope:'accounting',reason,extracted:result?.items?.length??null,expected:result?.metadata?.expectedItems?Number(result.metadata.expectedItems):null};panel.hidden=false;status.textContent='';button.disabled=false;}};
}
