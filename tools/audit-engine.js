import {openPdf,wordsOf,lines,lineText,pageText,between,dec,money,sum,diff,SP} from './pdf-core.js';
export async function readRequirement(file,progress=()=>{}){
 const pdf=await openPdf(file),rows=[],unparsed=[],texts=[];
 try{for(let pn=1;pn<=pdf.numPages;pn++){progress(pn,pdf.numPages);const page=await pdf.getPage(pn),words=await wordsOf(page),scale=page.getViewport({scale:1}).width/595.92;texts.push(pageText(words));
  for(const line of lines(words)){if(line[0].x0/scale>30||!/^\d+$/.test(line[0].text))continue;const cells=[[0,75],[75,185],[185,300],[300,435],[435,590]].map(([a,b])=>between(line,a*scale,b*scale));
   if(!/^\d{2}(?:\s*\/\s*\d+)?$/.test(cells[2]))continue;
   const old=dec(cells[3]),value=dec(cells[4]);if(!old||!value||(cells[1]&&!/^\d+$/.test(cells[1]))){unparsed.push({page:pn,text:lineText(line)});continue;}
   const [graph,sub='']=cells[2].split('/').map(s=>s.trim());rows.push({row:Number(cells[0]),item:cells[1]?Number(cells[1]):null,graph,sub,old:old.toString(),new:value.toString(),page:pn});
  }page.cleanup();}}
 finally{await pdf.destroy();}
 const text=texts.join('\n');if(!text.includes('ТРЕБОВАНИЕ')||!rows.length)throw Error('Не распознана числовая таблица требования. Нужен текстовый PDF KEDEN.');
 return {kind:'requirement',dt:text.match(/№\s*(\d{5}\/\d{6}\/\d{7})/)?.[1]||'',rows,unparsed,
  complete:!unparsed.length&&rows.every((r,i)=>r.row===i+1)&&text.includes('Требование получено')};
}
export async function readFrro(file,progress=()=>{}){
 const pdf=await openPdf(file),items=[];let dt='',total=null,expected=null;
 try{for(let pn=1;pn<=pdf.numPages;pn++){progress(pn,pdf.numPages);const page=await pdf.getPage(pn),words=await wordsOf(page),text=pageText(words),scale=page.getViewport({scale:1}).width/595.92;
  dt=text.match(/\d{5}\/\d{6}\/\d{7}/)?.[0]||dt;
  if(pn===1){const a=words.find(w=>w.text==='17.'&&w.x0<40*scale);if(a){const vals=words.filter(w=>w.x0<100*scale&&w.top>a.top+5&&w.top<a.top+25&&dec(w.text));if(vals.length)total=money(dec(vals[0].text));}
   const header=lines(words).find(g=>g.some(w=>/\d{5}\/\d{6}\/\d{7}/.test(w.text)));const n=header?.find(w=>w.x0>=310*scale&&w.x0<360*scale&&/^\d+$/.test(w.text));if(n)expected=Number(n.text);
  }
  const anchors=words.filter(w=>w.text==='4.'&&w.x0<40*scale).sort((a,b)=>a.top-b.top);
  for(let i=0;i<anchors.length;i++){
   const block=words.filter(w=>w.top>=anchors[i].top&&w.top<(anchors[i+1]?.top||900)),idLine=lines(block).find(g=>g.some(w=>/^\d{10}$/.test(w.text)));if(!idLine)continue;
   const nums=idLine.filter(w=>w.x0>=235*scale&&w.x0<310*scale&&/^\d+$/.test(w.text));if(nums.length!==2)continue;
   const a=block.find(w=>w.text==='11.');const value=a?block.find(w=>w.x0>=235*scale&&w.x0<365*scale&&w.top>a.top&&w.top<a.top+20&&dec(w.text)):null;
   const payments=[],security=[];
   for(const line of lines(block)){
    const left=line.find(w=>w.x0<40*scale&&/^\d{4}$/.test(w.text));if(left){const sp=between(line,211*scale,239*scale),v=dec(between(line,164*scale,211*scale));if(v&&/^[А-Я]{2}$/.test(sp))payments.push({code:left.text,base:between(line,45*scale,135*scale),rate:between(line,135*scale,164*scale),amount:v.toString(),sp});}
    const right=line.find(w=>w.x0>=239*scale&&w.x0<275*scale&&/^\d{4}$/.test(w.text));if(right){const v=[[278,440],[440,515],[515,590]].map(([a,b])=>dec(between(line,a*scale,b*scale)));if(v.every(Boolean))security.push({code:right.text,new:money(v[0]),old:money(v[1]),delta:money(v[2])});}
   }
   items.push({number:Number(nums[1].text),sequence:Number(nums[0].text),customs:value?dec(value.text).toString():null,payments,security,page:pn});
  }page.cleanup();}}
 finally{await pdf.destroy();}
 if(!items.length)throw Error('Не распознаны товары расчёта обеспечения ФРРО.');
 return {kind:'frro',dt,total,expected,items,complete:expected!=null&&items.length===expected&&new Set(items.map(i=>i.number)).size===expected};
}
export function checkAudit(requirement,frro,catalog){
 if(frro&&(!requirement.dt||requirement.dt!==frro.dt))throw Error('Номера ДТ в требовании и ФРРО не совпадают. Документы нельзя объединять.');
 const findings=[],items=[],byItem=new Map();const note=(level,code,message,item=null,evidence={})=>findings.push({level,code,message,item,evidence});
 if(!requirement.complete)note('error','incomplete','Таблица требования разобрана не полностью. Итоги предварительные.');
 if(frro&&!frro.complete)note('error','incomplete_frro','Не подтверждена полнота товаров ФРРО.');
 for(const r of requirement.rows){if(!byItem.has(r.item))byItem.set(r.item,[]);byItem.get(r.item).push(r);}
 for(const[number,rows]of byItem){if(number==null)continue;const customs=rows.find(r=>r.graph==='45'&&!r.sub),totalRows=rows.filter(r=>r.graph==='47'&&!r.sub),total=totalRows.length===1?totalRows[0]:null;
  const item={number,customs,total,payments:[],sp:[],spEvidence:'not_present',page:rows[0].page};
  for(const code of new Set(rows.filter(r=>r.graph==='47'&&r.sub).map(r=>r.sub))){const pair=rows.filter(r=>r.graph==='47'&&r.sub===code);if(pair.length!==2||['old','new'].some(s=>dec(pair[0][s]).abs().lt(dec(pair[1][s]).abs()))){note('warning','ambiguous_payment',`Платёж ${code}: нельзя однозначно разделить базу и сумму.`,number);continue;}item.payments.push({code,base:pair[0],amount:pair[1],delta:diff(pair[1].new,pair[1].old),totalControl:'unknown'});}
  if(!frro&&customs&&dec(customs.new).lt(customs.old))note('warning','customs_decrease','Таможенная стоимость уменьшена. Проверьте основание изменения.',number,{old:customs.old,new:customs.new});
  if(total){item.delta=diff(total.new,total.old);const matching=item.payments.filter(p=>{const a=dec(total.old).minus(p.amount.old),b=dec(total.new).minus(p.amount.new);return a.eq(b)&&a.gte('0')&&!dec(p.delta).eq('0');});if(matching.length===1){matching[0].totalControl='included';item.controlPayment=matching[0].code;}
   for(const p of item.payments){const others=item.payments.filter(q=>q!==p);const residual=['old','new'].map(s=>dec(total[s]).minus(sum(others.map(q=>q.amount[s]))));if(others.length&&residual[0].eq(residual[1])&&residual.every((v,i)=>v.gte('0')&&v.lt(p.amount[i?'new':'old'])))p.totalControl='excluded';}
  }
  const f=frro?.items.find(i=>i.number===number);
  if(frro&&!f)note('warning','missing_frro_item','Товар не найден в ФРРО.',number);
  if(f){item.sp=f.payments;item.spEvidence='frro';item.frroCustoms=f.customs;
   if(customs&&f.customs!=null&&!dec(customs.new).eq(f.customs))note('error','frro_customs_mismatch','Новая таможенная стоимость требования не совпала с ФРРО.',number,{requirement:customs.new,frro:f.customs,difference:diff(customs.new,f.customs),requirementRow:customs.row,requirementPage:customs.page,frroPage:f.page,frroSequence:f.sequence});
   for(const p of item.payments){const s=f.security.find(s=>s.code===p.code);if(s){p.security=s;p.differenceFromSecurity=diff(p.delta,s.delta);if(!dec(p.differenceFromSecurity).eq('0'))note('error','security_mismatch',`Изменение платежа ${p.code} не совпало с обеспечением ФРРО.`,number,{requirementDelta:p.delta,securityDelta:s.delta,difference:p.differenceFromSecurity});}}
  }items.push(item);
 }
 const common=(byItem.get(null)||[]).find(r=>r.graph==='12'),customs=items.filter(i=>i.customs);
 if(common&&requirement.complete){const a=diff(common.new,common.old),b=money(sum(customs.map(i=>dec(i.customs.new).minus(i.customs.old))));if(a!==b)note('error','customs_total','Изменение общей стоимости не равно сумме изменений товаров.',null,{reported:a,computed:b});}
 if(frro){const actual=money(sum(frro.items.flatMap(i=>i.security.map(s=>s.delta))));if(frro.total==null||actual!==frro.total)note('error','frro_total','Итог ФРРО не подтверждён суммой обеспечения товаров.',null,{computed:actual,stated:frro.total});
  for(const i of frro.items){for(const s of i.security)if(diff(s.new,s.old)!==s.delta)note('error','frro_arithmetic','Изменение обеспечения не равно новой сумме минус предыдущая.',i.number);
   for(const p of i.payments){const rate=p.rate.match(/^(-?\d+(?:[.,]\d+)?)\s*%$/),base=dec(p.base);if(rate&&base){const computed=money(base.times(dec(rate[1])).div('100'));if(computed!==money(dec(p.amount)))note('error','frro_payment_arithmetic',`Платёж ${p.code} ФРРО: сумма не равна базе × ставке.`,i.number,{computed,stated:money(dec(p.amount))});}}
  }
 }
 const summary=[];for(const code of [...new Set(items.flatMap(i=>i.payments.map(p=>p.code)))].sort()){
  const related=items.flatMap(i=>i.payments.filter(p=>p.code===code)),secured=frro?.items.flatMap(i=>i.security.filter(s=>s.code===code))||[],delta=money(sum(related.map(p=>p.delta))),security=secured.length?money(sum(secured.map(s=>s.delta))):null,controls=new Set(related.map(p=>p.totalControl));
  summary.push({code,name:catalog.codes[code]?.name||'Неизвестный вид платежа',old:money(sum(related.map(p=>p.amount.old))),new:money(sum(related.map(p=>p.amount.new))),delta,security,difference:security==null?null:diff(delta,security),sp:[...new Set(items.flatMap(i=>i.sp.filter(p=>p.code===code).map(p=>p.sp)))].sort(),totalControl:controls.size===1?[...controls][0]:'mixed'});
 }
 const totalsRows=items.filter(i=>i.total),totalDelta=totalsRows.length?money(sum(totalsRows.map(i=>i.delta))):null,security=frro?.total??null;
 const comparable=!!(frro&&requirement.complete&&frro.complete&&security!=null&&totalsRows.length===items.length&&items.length===frro.items.length&&items.every(i=>frro.items.some(f=>f.number===i.number))&&!findings.some(f=>['frro_total','frro_arithmetic'].includes(f.code)));
 const difference=security==null||totalDelta==null?null:diff(totalDelta,security);findings.sort((a,b)=>({error:0,warning:1,info:2}[a.level]-{error:0,warning:1,info:2}[b.level])||Number(dec(b.evidence.difference||'0').abs().minus(dec(a.evidence.difference||'0').abs()))||(a.item||0)-(b.item||0));
 return {dt:requirement.dt,requirement,frro,items,findings,paymentSummary:summary,paymentMethods:Object.fromEntries(Object.entries(SP).map(([k,v])=>[k,v[0]])),
  comparison:{requirement:totalDelta,frro:security,difference,comparable,status:!frro?'not_attached':!comparable?'incomplete':difference==='0.00'?'matched':'mismatched'},
  totals:{old:totalsRows.length?money(sum(totalsRows.map(i=>i.total.old))):null,new:totalsRows.length?money(sum(totalsRows.map(i=>i.total.new))):null,delta:totalDelta,security,increase:totalsRows.length?money(sum(totalsRows.map(i=>dec(i.delta).gt('0')?i.delta:'0'))):null,decrease:totalsRows.length?money(sum(totalsRows.map(i=>dec(i.delta).lt('0')?i.delta:'0'))):null},
  limits:['Сверка документов не подтверждает фактическую оплату или остаток на лицевом счёте.','Суммы изменений не являются автоматическим взаимозачётом.','Правильность ставок и оснований льгот требует отдельной проверки.','Поддерживается текстовая числовая форма требования KEDEN.']};
}
