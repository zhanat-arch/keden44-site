const $=id=>document.getElementById(id);
let data=null,generation=0;
const ready=Promise.all([fetch('../payment-types.json').then(r=>r.json()),fetch('../templates.json').then(r=>r.json())]);
lucide.createIcons();
const fmt=(value,digits=2)=>value==null?'—':Number(value).toLocaleString('ru-RU',{maximumFractionDigits:digits,minimumFractionDigits:digits});
function cell(row,value,cls=''){const td=document.createElement('td');td.textContent=value??'—';td.className=cls;row.append(td);}
function rows(){
 if(!data)return;
 const query=$('search').value.toLocaleLowerCase();
 const items=data.items.filter(item=>[item.number,item.tnved,item.name,item.article].join(' ').toLocaleLowerCase().includes(query));
 $('goodsBody').replaceChildren();
 for(const item of items){const tr=document.createElement('tr');
  [item.number,item.tnved,item.name,item.article,fmt(item.quantity,3),fmt(item.net,3),fmt(item.invoiceValue),fmt(item.customsValue),item.page].forEach((v,i)=>cell(tr,v,i===2?'description':i>=4?'numeric':''));
  $('goodsBody').append(tr);
 }
 $('visibleCount').textContent=`${items.length} из ${data.items.length}`;
}
function show(result){
 data=result;$('empty').hidden=true;$('workspace').hidden=false;$('filename').textContent=data.filename||'PDF ДТ';
 $('dt').textContent=data.metadata.dtNumber||'Не определена';$('count').textContent=`${data.items.length} / ${data.metadata.expectedItems||'?'}`;
 $('customs').textContent=fmt(data.metadata.totalCustoms)+' ₸';$('health').textContent=data.complete?'Пройдена':'Нужна проверка';$('health').style.color=data.complete?'#167359':'#a44916';
 $('warningCount').textContent=data.warnings.length;$('paymentsBody').replaceChildren();
 const groups={paid:'ИУ / ВУ',offset:'Зачёт НДС',conditional:'Условное начисление',deferred:'Отсрочка / рассрочка',review:'Требует проверки',unknown:'Неизвестный код'};
 for(const p of data.paymentTotals){const tr=document.createElement('tr');[p.code,p.sp,groups[p.group]||p.group,fmt(p.amount)].forEach((v,i)=>cell(tr,v,i===3?'numeric':''));$('paymentsBody').append(tr);}
 $('warnings').replaceChildren();for(const text of data.warnings.length?data.warnings:['Полнота товаров и контрольные суммы проверены.']){const li=document.createElement('li');li.textContent=text;$('warnings').append(li);}
 $('status').textContent=data.complete?'Декларация разобрана':'Декларация разобрана. Проверьте замечания перед использованием отчёта.';
 rows();
}
async function load(file){
 if(!file)return;const current=++generation;
 $('status').className='';$('workspace').hidden=true;$('empty').hidden=true;$('progress').hidden=false;$('progress').value=0;
 $('status').textContent='Открываем PDF…';$('file').disabled=true;
 try{await requireAccess();const[catalog]=await ready;const result=await parseDeclaration(file,catalog,(page,total)=>{if(current!==generation)return;$('status').textContent=`Разбор PDF · страница ${page} из ${total}`;$('progress').value=page/total*100;});if(current===generation)show(result);}
 catch(error){if(current===generation){$('status').textContent=error.message;$('status').className='error';}}
 finally{$('file').disabled=false;$('file').value='';$('progress').hidden=true;}
}
$('file').addEventListener('change',()=>void load($('file').files[0]));
$('clear').addEventListener('click',()=>{generation++;data=null;$('workspace').hidden=true;$('empty').hidden=false;$('filename').textContent='Декларация не загружена';$('status').textContent='Выберите декларацию на товары';$('progress').hidden=true;$('search').value='';});
document.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('Files'))event.preventDefault();});
document.addEventListener('drop',event=>{if(!event.dataTransfer.files.length)return;event.preventDefault();if(!$('file').disabled)void load(event.dataTransfer.files[0]);});
$('search').addEventListener('input',rows);
for(const tab of document.querySelectorAll('[data-tab]'))tab.addEventListener('click',()=>{
 for(const t of document.querySelectorAll('[data-tab]')){t.classList.toggle('selected',t===tab);t.setAttribute('aria-selected',String(t===tab));$(t.dataset.tab).hidden=t!==tab;}
 document.querySelector('.filter').hidden=tab.dataset.tab!=='goods';
});
$('download').addEventListener('click',async()=>{
 if(!data)return;
 $('download').disabled=true;$('status').textContent='Формируем Excel…';
 try{await requireAccess();const[catalog,profiles]=await ready;const buffer=await makeReport(data,profiles.find(p=>p.id===$('profile').value),catalog);
  const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download=`Отчет_${(data.metadata.dtNumber||'ДТ').replaceAll('/','_')}_${$('profile').value}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);$('status').textContent='Excel сформирован';
 }catch(error){$('status').textContent=error.message;}finally{$('download').disabled=false;}
});
import {parseDeclaration} from '../accounting-engine.js';
import {makeReport} from '../excel-report.js';
import {requireAccess} from '../access.js';
