const $=id=>document.getElementById(id);
let result=null;
let generation=0,detecting=false;
const documents={requirement:null,frro:null};
const ready=fetch('../payment-types.json').then(r=>r.json());
const fmt=value=>value==null?'—':Number(value).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
lucide.createIcons();
function row(target,values){const tr=document.createElement('tr');for(const v of values){const td=document.createElement('td');td.textContent=v??'—';tr.append(td);}$(target).append(tr);}
function show(data){
 result=data;$('result').hidden=false;$('dt').textContent='ДТ '+(data.dt||'номер не определён');
 for(const key of ['delta','increase','decrease','security'])$(key).textContent=fmt(data.totals[key]);
 $('difference').textContent=fmt(data.comparison.difference);
 const comparisonLabels={not_attached:'ФРРО не приложен — сравнение недоступно.',incomplete:'Сравнение предварительное: полнота или соответствие состава товаров не подтверждены.',matched:'Итоги совпали',mismatched:'Итоги не совпали'};
 $('comparisonStatus').textContent=comparisonLabels[data.comparison.status];$('comparisonStatus').className=data.comparison.status;
 $('basis').textContent=`Итоги графы 47 по товарам требования: до ${fmt(data.totals.old)} ₸, после ${fmt(data.totals.new)} ₸. С ФРРО сравнивается изменение, а не вся новая сумма начислений. Общая разница не является поручением на оплату или автоматический взаимозачёт.`;
 $('findings').replaceChildren();$('itemRows').replaceChildren();$('sourceRows').replaceChildren();$('limits').replaceChildren();$('paymentRows').replaceChildren();
 for(const p of data.paymentSummary)row('paymentRows',[p.code+' · '+p.name,fmt(p.delta),fmt(p.security),fmt(p.difference)]);
 const controlled=data.paymentSummary.filter(p=>p.totalControl==='included').map(p=>p.name);
 if(controlled.length)$('basis').textContent='По контрольному итогу графы 47 изменение относится к платежу: '+controlled.join(', ')+'.';
 const conditional=data.paymentSummary.filter(p=>p.sp.some(sp=>['УН','УР'].includes(sp)));
 $('benefits').hidden=!conditional.length;
 $('benefits').textContent='Льготы / условное начисление по ФРРО: '+conditional.map(p=>p.name+' ('+p.sp.filter(sp=>['УН','УР'].includes(sp)).join(', ')+')').join('; ')+'.';
 const labels={requirement:'Требование',frro:'ФРРО',difference:'Разница',old:'До',new:'После',page:'Страница',requirementRow:'№ строки требования',requirementPage:'Страница требования',frroPage:'Страница ФРРО',frroSequence:'№ п/п записи ФРРО',requirementDelta:'Изменение по требованию',securityDelta:'Обеспечение',reported:'Указано',computed:'Посчитано',dt:'ДТ',otherItems:'Номера товаров',stated:'Итог документа'};
 const moneyKeys=new Set(['requirement','frro','difference','old','new','requirementDelta','securityDelta','reported','computed','dt','stated']);
 for(const f of data.findings){const li=document.createElement('li');li.className=f.level;const heading=document.createElement('strong');heading.textContent=(f.item?'Товар '+f.item+' · ':'')+f.message;li.append(heading);const p=document.createElement('p');p.textContent=Object.entries(f.evidence).map(([key,value])=>(labels[key]||key)+': '+(value!=null&&moneyKeys.has(key)?fmt(value)+' ₸':typeof value==='object'?JSON.stringify(value):value??'не найдено')).join(' · ');li.append(p);$('findings').append(li);}
 if(!data.findings.length){const li=document.createElement('li');li.textContent='В выполненных проверках расхождений не найдено.';$('findings').append(li);}
 $('issuesCount').textContent=data.findings.filter(f=>f.level!=='info').length;
 for(const i of data.items){const sp=[...new Set(i.sp.map(p=>p.code+' '+p.sp+(data.paymentMethods[p.sp]?' — '+data.paymentMethods[p.sp]:'')))].join('; ');row('itemRows',[i.number,fmt(i.customs?.old),fmt(i.customs?.new),fmt(i.frroCustoms),fmt(i.delta),sp||'ФРРО не приложен']);}
 for(const r of data.requirement.rows.filter(r=>r.old!==r.new))row('sourceRows',[r.page,r.row,r.item,r.graph+(r.sub?' / '+r.sub:''),r.old,r.new]);
 for(const text of data.limits){const li=document.createElement('li');li.textContent=text;$('limits').append(li);}
 $('status').textContent=`Проверено строк: ${data.requirement.rows.length}. Товаров в требовании: ${data.items.length}. ${data.requirement.complete?'':'Полнота не подтверждена.'}`;
}
function encoded(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('Не удалось прочитать файл'));reader.readAsDataURL(file);});}
function reflectFiles(){for(const key of ['requirement','frro']){const dt=new DataTransfer();if(documents[key])dt.items.add(documents[key]);$(key).files=dt.files;$(key+'Name').textContent=documents[key]?.name||(key==='requirement'?'Не добавлено':'Не добавлен');}}
async function addFiles(files){
 if(detecting||$('run').disabled)return;
 const current=generation;detecting=true;$('run').disabled=true;$('status').textContent='Определяем тип документов…';
 const messages=[];
 try{
  await requireAccess();await ready;
  for(const file of files){
   if(current!==generation)return;
   if(file.size>28*1024*1024){messages.push(file.name+': файл больше 28 МБ');continue;}
   let info;try{info={kind:await detect(file)};}catch(error){messages.push(file.name+': '+error.message);continue;}
   if(current!==generation)return;
   if(info.kind==='declaration'){messages.push(file.name+': здесь нужны требование и ФРРО, не ДТ');continue;}
   documents[info.kind]=file;messages.push((info.kind==='requirement'?'Требование':'ФРРО')+': '+file.name);
  }
  if(current===generation){result=null;$('result').hidden=true;reflectFiles();$('status').textContent=messages.join(' · ');}
 }catch(error){if(current===generation){reflectFiles();$('status').textContent=error.message;}}
 finally{detecting=false;$('run').disabled=false;$('addFiles').value='';}
}
for(const key of ['requirement','frro','addFiles'])$(key).addEventListener('change',event=>{const files=[...event.target.files];reflectFiles();void addFiles(files);});
let dragDepth=0;
document.addEventListener('dragenter',event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();dragDepth++;$('dropHint').hidden=false;}});
document.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('Files'))event.preventDefault();});
document.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('dropHint').hidden=true;});
document.addEventListener('drop',event=>{if(!event.dataTransfer.files.length)return;event.preventDefault();dragDepth=0;$('dropHint').hidden=true;void addFiles([...event.dataTransfer.files]);});
$('clear').addEventListener('click',()=>{generation++;result=null;documents.requirement=null;documents.frro=null;$('auditForm').reset();reflectFiles();$('result').hidden=true;$('progress').hidden=true;$('status').textContent='Ожидание документов';for(const id of ['findings','itemRows','sourceRows','limits','paymentRows'])$(id).replaceChildren();});
$('auditForm').addEventListener('submit',async event=>{
 const current=generation;
 event.preventDefault();$('run').disabled=true;$('progress').hidden=false;$('result').hidden=true;$('status').textContent='Читаем документы…';
 try{
  await requireAccess();const catalog=await ready;
  if(!documents.requirement)throw Error('Добавьте требование');
  const progress=(n,total)=>{if(current===generation)$('status').textContent=`Читаем PDF: ${n} / ${total}`;};
  const req=await readRequirement(documents.requirement,progress);
  if(current!==generation)return;
  const frro=documents.frro?await readFrro(documents.frro,progress):null;
  if(current===generation)show(checkAudit(req,frro,catalog));
 }catch(error){if(current===generation)$('status').textContent=error.message;}finally{$('run').disabled=false;$('progress').hidden=true;}
});
for(const tab of document.querySelectorAll('[data-view]'))tab.addEventListener('click',()=>{for(const t of document.querySelectorAll('[data-view]')){t.classList.toggle('selected',t===tab);t.setAttribute('aria-selected',String(t===tab));$(t.dataset.view).hidden=t!==tab;}});
import {detect} from '../pdf-core.js';
import {readRequirement,readFrro,checkAudit} from '../audit-engine.js';
import {requireAccess} from '../access.js';
