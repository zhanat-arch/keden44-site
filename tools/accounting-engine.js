import {openPdf,wordsOf,pageText,crop,label,firstNumber,paymentGroups,dec,money,sum,SP} from './pdf-core.js';
export async function parseDeclaration(file,catalog,progress=()=>{}){
 const pdf=await openPdf(file),byId=new Map(),appendix=new Map(),metadata={},warnings=[],declaredTotals={};
 try{
  for(let index=1;index<=pdf.numPages;index++){
   progress(index,pdf.numPages);const page=await pdf.getPage(index),words=await wordsOf(page),text=pageText(words);
   if(index===1){
    metadata.dtNumber=text.match(/\d{5}\/\d{6}\/\d{7}/)?.[0]||'';metadata.regime=text.match(/(?:^|\s)((?:ИМ|ЭК)\s+\d{2})(?=\s|$)/m)?.[1]||'';
    for(const [field,n,left,right] of [['currency',22,321,442],['exchangeRate',23,445,493],['totalCustoms',12,408,580],['packages',6,364,405],['expectedItems',5,321,364],['borderTransport',21,70,318],['transportMode',25,70,150],['delivery',20,321,580],['departure',15,321,441],['departureCode',15,441,505],['destination',17,442,580],['tradeCountry',11,408,475]]){
     if(field==='tradeCountry')continue;
     const a=field==='destination'?words.find(w=>w.text==='17'&&words.some(v=>v.text==='назначения'&&Math.abs(v.top-w.top)<2&&v.x0>w.x0&&v.x0<w.x0+110)):label(words,n,0,300);
     if(!a)continue;const raw=crop(words,left-1.5,a.top+10,right,a.top+(field==='totalCustoms'?26:23));
     metadata[field]=field==='currency'?raw.match(/\b[A-Z]{3}\b/)?.[0]||'':field==='departureCode'?raw.match(/\b[A-Z]{2}\b/)?.[0]||'':['borderTransport','delivery','departure','destination','tradeCountry'].includes(field)?raw.split('\n')[0].trim():firstNumber(raw);
    }
    const trade=label(words,11,0,250);if(trade)metadata.tradeCountry=crop(words,363,trade.top+10,408,trade.top+23).match(/\b[A-Z]{2}\b/)?.[0]||'';
    metadata.destinationCode=metadata.destination==='КАЗАХСТАН'?'KZ':null;
    for(const [,code,value] of text.matchAll(/\b(\d{4})\s+([\d,.]+)\s+KZT\b/g))declaredTotals[code]=money(dec(value));
   }
   const main=text.includes('32 Товар')&&(text.includes('ДЕКЛАРАЦИЯ НА ТОВАРЫ')||text.includes('ДОБАВОЧНЫЙ ЛИСТ'));
   if(main){
    const starts=words.filter(w=>w.text==='32'&&w.x0>300&&w.x0<340&&words.some(v=>v.text==='Товар'&&Math.abs(v.top-w.top)<3&&v.x0-w.x0>0&&v.x0-w.x0<28)).sort((a,b)=>a.top-b.top),items=[];
    for(let pos=0;pos<starts.length;pos++){
     const top=starts[pos].top,end=starts[pos+1]?.top||900,num=firstNumber(crop(words,310,top+10,341,top+28));if(!num||num.includes('.'))continue;
     const item={number:Number(num),page:index,payments:[]};item.tnved=crop(words,343,top+10,480,top+39).match(/\b\d{10}\b/)?.[0]||'';
     const a34=label(words,34,top,end,340);item.name=crop(words,67,top+20,310,a34?.top||top+50).replace(/\s+/g,' ').replace(/^1\.\s*/,'');
     for(const [field,n,left,right] of [['gross',35,418,495],['net',38,418,495],['invoiceValue',42,418,495],['customsValue',45,450,580],['statValue',46,450,580],['extraQuantity',41,343,418],['mos',43,495,580]]){
      const a=label(words,n,top,end,340);if(!a)continue;const raw=crop(words,left,a.top+10,right,a.top+(n===45?31:24));
      if(n===41){const parts=raw.split(/\s+/);item.extraUnit=/^\d+$/.test(parts[0])?parts[0]:'';item[field]=parts.length>1?dec(parts.at(-1))?.toString()??null:null;}else item[field]=firstNumber(raw);
     }
     if(a34)item.origin=crop(words,343,a34.top+10,418,a34.top+24).match(/\b[A-Z]{2}\b/)?.[0]||'';
     if(byId.has(item.number))warnings.push(`Повтор товара №${item.number}, стр. ${index}`);else{byId.set(item.number,item);items.push(item);}
    }
    const groups=paymentGroups(words,index);if(groups.length!==items.length)warnings.push(`Стр. ${index}: товаров ${items.length}, блоков 47 ${groups.length}; платежи требуют проверки`);else items.forEach((item,i)=>item.payments=groups[i]);
   }else{
    if(text.includes('Транспортная информация'))for(const [field,n]of[['sender',2],['receiver',8],['financial',9],['declarant',14]]){const match=text.match(new RegExp('№ '+n+' [^\\n]*\\n([\\s\\S]*?)(?=\\n№|\\nТранспортная информация)'));if(match)metadata[field]=match[1].replace(/\s+/g,' ');}
    if(text.includes('Графа 31')&&text.includes('ГРУППА ТОВАРОВ')){const parts=text.split(/^(\d{1,4})\s+(?=ГРУППА ТОВАРОВ)/m);for(let i=1;i+1<parts.length;i+=2){const n=Number(parts[i]);appendix.set(n,(appendix.get(n)||'')+' '+parts[i+1]);}}
   }
   page.cleanup();if(index%8===0)await new Promise(r=>setTimeout(r,0));
  }
 }finally{await pdf.destroy();}
 const items=[...byId.values()].sort((a,b)=>a.number-b.number);
 for(const item of items)if(!item.name){const extra=appendix.get(item.number)||'';item.name=extra.match(/ГРУППА ТОВАРОВ\s+1\s*:\s*([\s\S]*?)(?=ТОВАРНЫЙ ЗНАК|МАРКА|МОДЕЛЬ|АРТИКУЛ|КОЛИЧЕСТВО|ПРОИЗВОДИТЕЛЬ|$)/)?.[1]?.replace(/^1\.\s*/,'').replace(/\s+/g,' ').trim()||'';}
 for(const item of items){const extra=appendix.get(item.number)?.trim();if(extra){item.description=extra;for(const [field,tag]of[['article','АРТИКУЛ'],['manufacturer','ПРОИЗВОДИТЕЛЬ'],['brand','МАРКА'],['trademark','ТОВАРНЫЙ ЗНАК'],['model','МОДЕЛЬ'],['serial','СЕРИЙНЫЕ НОМЕРА']])item[field]=extra.match(new RegExp(tag+'\\s+([^;]+)'))?.[1]?.trim();const q=[...extra.matchAll(/КОЛИЧЕСТВО\s+([\d,.]+)\s*([^;]+)/g)];if(q.length===1){item.quantity=dec(q[0][1])?.toString()??null;item.unitName=q[0][2].trim();}else if(q.length>1)warnings.push(`Товар №${item.number}: несколько групп, количество требует проверки`);}
  for(const key of ['name','tnved','customsValue','invoiceValue','statValue','quantity'])if(item[key]==null||item[key]==='')warnings.push(`Товар №${item.number}: не извлечено поле ${key}`);
  for(const p of item.payments){Object.assign(p,catalog.codes[p.code]||{name:'Неизвестный вид платежа',family:'unknown',review:true});if(p.group==='unknown'||p.group==='review')warnings.push(`Товар №${item.number}: СП ${p.sp} требует проверки`);if(p.family==='unknown')warnings.push(`Товар №${item.number}: неизвестный вид платежа ${p.code}`);}
 }
 const grouped=new Map();for(const item of items)for(const p of item.payments){const key=p.code+'|'+p.sp;const row=grouped.get(key)||{code:p.code,sp:p.sp,group:p.group,name:p.name,amount:'0.00'};row.amount=money(sum([row.amount,p.amount]));grouped.set(key,row);}
 const paymentTotals=[...grouped.values()].sort((a,b)=>a.code.localeCompare(b.code)||a.sp.localeCompare(b.sp));
 const expected=Number(metadata.expectedItems||0);if(!expected||items.length!==expected||items.some((i,n)=>i.number!==n+1))warnings.push(`Полнота: ожидалось ${expected||'?'}, извлечено ${items.length}`);
 if(metadata.totalCustoms!=null&&items.every(i=>i.customsValue!=null)&&!sum(items.map(i=>i.customsValue)).eq(metadata.totalCustoms))warnings.push(`Таможенная стоимость: сумма товаров ${money(sum(items.map(i=>i.customsValue)))}, графа 12 ${metadata.totalCustoms}`);
 for(const[code,expected]of Object.entries(declaredTotals)){const actual=sum(paymentTotals.filter(p=>p.code===code&&['ИУ','ВУ'].includes(p.sp)).map(p=>p.amount));if(!actual.eq(expected))warnings.push(`Графа Б / 47, код ${code}: Б ${expected}, 47 ${money(actual)}`);}
 metadata.currencyCode=catalog.currencies[metadata.currency]||null;
 return {metadata,items,warnings,paymentTotals,declaredTotals,complete:items.length>0&&!warnings.length,filename:file.name,source:{sp:'https://kzl.kgd.gov.kz/ru/nsi/outp/10/1'},pages:0};
}
