import {createTelegramClient} from '../monitor/modules/telegram/client.js?v=tool-support-20261127';
import {readPermit,clearPermit,DEVICE_KEY} from '../monitor/modules/core/access-permit.mjs';
import {ACCESS_COPY,copyReady,setServerAccessCopy} from '../shared/access-copy.js?v=20261125';
const client=createTelegramClient();
export const reportToolProblem=payload=>client.reportToolProblem(payload);
const scope=location.pathname.startsWith('/tools/audit/')?'audit':'accounting';
let pending=null,lastAttempt=0,epoch=0;
const retryDelay=10*60*1000;
const usageKey='keden44-tools-usage-outbox-v1';
let flushing=false;
function outbox(){try{return JSON.parse(localStorage.getItem(usageKey)||'[]');}catch{return [];}}
async function flushUsage(){
 if(flushing)return;flushing=true;
 try{
  const device=JSON.parse(localStorage.getItem(DEVICE_KEY)||'null');
  for(const event of outbox().filter(e=>e.accountId===device?.accountId).slice(0,50)){
   if(JSON.parse(localStorage.getItem(DEVICE_KEY)||'null')?.accountId!==event.accountId)break;
   await client.reportUsage({eventId:event.eventId,scope:event.scope,profile:event.profile});
   localStorage.setItem(usageKey,JSON.stringify(outbox().filter(e=>e.eventId!==event.eventId)));
  }
 }catch{}finally{flushing=false;}
}
function refresh(){
 if(pending)return pending;
 lastAttempt=Date.now();
 const current=epoch;
 pending=client.accessStatus(scope).then(response=>{
  if(current!==epoch)throw Error('Аккаунт изменился. Повторите проверку доступа.');
  setServerAccessCopy(response.access?.uiCopy);
  if(response.access?.allowed!==true){clearPermit(localStorage);throw Error('Для инструмента нужен активный доступ KEDEN44.');}
  void flushUsage();return response.access;
 }).finally(()=>{pending=null;});
 return pending;
}
export function recordReport(profile){
 try{
  const device=JSON.parse(localStorage.getItem(DEVICE_KEY)||'null');
  if(!device?.accountId)return;
  const event={eventId:crypto.randomUUID(),accountId:device.accountId,scope,profile};
  localStorage.setItem(usageKey,JSON.stringify([...outbox(),event].slice(-5000)));
  void flushUsage();
 }catch{}
}
function showAllowed(access){
 const notice=document.getElementById('accessNotice');
 if(notice){notice.textContent=access.state==='promo'?'Доступ предоставлен по приглашению. PDF обрабатываются на вашем устройстве.':'Доступ по общей подписке KEDEN44. PDF обрабатываются на вашем устройстве.';notice.dataset.state='allowed';}
 return access;
}
export async function requireAccess(force=false){
 await copyReady;
 const local=await readPermit(localStorage,scope);
 if(local&&!force){
  if(Date.now()-Math.max(lastAttempt,local.issuedAt)>retryDelay)void refresh().then(showAllowed).catch(async()=>{
   if(!await readPermit(localStorage,scope)){
    const notice=document.getElementById('accessNotice');
    if(notice){showAccessRequired(notice,'Доступ изменился. Проверьте подписку.');}
   }
  });
  return showAllowed(local);
 }
 try{return showAllowed(await refresh());}
 catch(error){
  // A temporary outage must not invalidate a previously issued permission.
  const fallback=await readPermit(localStorage,scope);
  if(fallback)return showAllowed(fallback);
  const notice=document.getElementById('accessNotice');
  const message=[401,402,403].includes(error.status)
   ? ACCESS_COPY.signIn+' '+ACCESS_COPY.trial
   : ACCESS_COPY.unavailable;
  if(notice){
   showAccessRequired(notice,message);
  }
  throw new Error(message,{cause:error});
 }
}
function showAccessRequired(notice,message){
 notice.replaceChildren(document.createTextNode(message+' '));
 const link=document.createElement('a');link.href='/subscription/?return='+encodeURIComponent(location.pathname);link.textContent='Войти и проверить подписку';
 const retry=document.createElement('button');retry.type='button';retry.textContent='Проверить доступ';retry.className='button';
 retry.addEventListener('click',()=>void requireAccess(true).catch(()=>{}));
 notice.append(link,document.createTextNode(' '),retry);notice.dataset.state='blocked';
}
window.addEventListener('storage',event=>{
 if(event.key==='keden44-telegram-device-v1'||event.key===null){epoch++;void requireAccess().catch(()=>{});}
});
void requireAccess().catch(()=>{});
