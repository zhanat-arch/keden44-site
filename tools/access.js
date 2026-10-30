import {createTelegramClient} from '../monitor/modules/telegram/client.js?v=access-20261030';
const client=createTelegramClient();let cached=null,checked=0;
const scope=location.pathname.startsWith('/tools/audit/')?'audit':'accounting';
export function recordReport(profile){
 const eventId=crypto.randomUUID();
 void client.reportUsage({eventId,scope,profile}).catch(()=>{});
}
export async function requireAccess(force=false){
 const notice=document.getElementById('accessNotice');
 try{
  if(force||!cached||Date.now()-checked>10*60*1000){const response=await client.accessStatus(scope);cached=response.access;checked=Date.now();}
  if(!cached||cached.allowed!==true)throw Error('Для этого инструмента нужен активный доступ KEDEN44. Войдите в Монитор и проверьте общую подписку.');
  if(notice){notice.textContent=cached.state==='promo'?'Доступ предоставлен по приглашению. PDF обрабатываются на вашем устройстве.':'Доступ по общей подписке KEDEN44. PDF обрабатываются на вашем устройстве.';notice.dataset.state='allowed';}
  return cached;
 }catch(error){const message=cached?.allowed===false?'Для инструмента нужен активный доступ KEDEN44. Войдите в Монитор и проверьте общую подписку.':'Не удалось проверить подписку. Проверьте интернет и повторите.';if(notice){notice.replaceChildren(document.createTextNode(message+' '));const link=document.createElement('a');link.href='/subscription/';link.textContent='Подписка';const retry=document.createElement('button');retry.type='button';retry.textContent='Проверить доступ';retry.className='button';retry.addEventListener('click',()=>void requireAccess(true).catch(()=>{}));notice.append(link,document.createTextNode(' '),retry);notice.dataset.state='blocked';}throw new Error(message);}
}
void requireAccess().catch(()=>{});
