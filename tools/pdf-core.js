export const SP={'ИУ':['Уплата до выпуска','paid'],'ВУ':['Уплата после выпуска','paid'],'ЗН':['НДС методом зачёта','offset'],'УН':['Условное начисление','conditional'],'УР':['Условное начисление по процедуре','conditional'],'ОП':['Отсрочка','deferred'],'ОЧ':['Отсрочка части суммы','deferred'],'РП':['Рассрочка','deferred'],'УМ':['Неуплата или уменьшенная уплата','review'],'ВВ':['Частичное условное освобождение','review'],'ТР':['Особый способ платежа','review'],'ПУ':['Подлежало бы уплате по расчёту обеспечения','security']};
export const dec=v=>v==null?null:/^-?\d+(?:\.\d+)?$/.test(String(v).replace(/\s/g,'').replace(',','.'))?new globalThis.Big(String(v).replace(/\s/g,'').replace(',','.')):null;
export const money=v=>v==null?null:new globalThis.Big(v).toFixed(2,1);
export const sum=values=>values.reduce((a,v)=>a.plus(v??'0'),new globalThis.Big('0'));
export const diff=(a,b)=>money(dec(a).minus(dec(b)));
export function lines(words){const out=[];for(const w of [...words].sort((a,b)=>a.top-b.top||a.x0-b.x0)){let g=out.slice(-3).reverse().find(g=>Math.abs(g[0].top-w.top)<2.3);if(!g)out.push(g=[]);g.push(w);}return out.map(g=>g.sort((a,b)=>a.x0-b.x0));}
export const lineText=words=>words.map(w=>w.text).join(' ');
export const pageText=words=>lines(words).map(lineText).join('\n');
export const between=(words,left,right)=>lineText(words.filter(w=>w.x0>=left&&w.x0<right));
export function crop(words,left,top,right,bottom){return pageText(words.filter(w=>w.x0>=left&&w.x0<right&&w.top>=top&&w.top<bottom));}
export const firstNumber=text=>{const m=String(text).match(/-?\d+(?:[,.]\d+)?/);return m?dec(m[0])?.toString()??null:null;};
export function label(words,n,top=0,bottom=900,minX=0){return words.find(w=>w.text===String(n)&&w.top>=top&&w.top<bottom&&w.x0>=minX);}
export async function openPdf(file){
 if(file.size>40*1024*1024)throw Error('Максимальный размер PDF — 40 МБ');
 globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc='/monitor/pdf.worker.min.js';
 return globalThis.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true}).promise;
}
export async function wordsOf(page){
 const content=await page.getTextContent();const height=page.getViewport({scale:1}).height;
 const out=[];
 for(const item of content.items){if(!item.str?.trim())continue;const h=Math.hypot(item.transform[2],item.transform[3])||item.height||8;
  const top=height-item.transform[5]-h*.8;const pieces=[...item.str.matchAll(/\S+/g)];
  for(const part of pieces)out.push({text:part[0],x0:item.transform[4]+item.width*part.index/item.str.length,top});
 }
 return out;
}
export async function detect(file){const pdf=await openPdf(file);try{const text=pageText(await wordsOf(await pdf.getPage(1))).replace(/\s+/g,' ').toLowerCase();if(text.includes('требование')&&text.includes('внесении изменений'))return 'requirement';if(text.includes('размера обеспечения')&&text.includes('исчисление платежей'))return 'frro';if(text.includes('декларация на товары'))return 'declaration';throw Error('Не распознан тип PDF. Нужен текстовый документ KEDEN, не скан.');}finally{await pdf.destroy();}}
export function paymentGroups(words,pageNumber){
 const anchor=words.find(w=>w.text==='47'&&w.x0<60);if(!anchor)return [];
 const groups=[];
 for(const [left,right] of pageNumber===1?[[65,337]]:[[65,305],[305,582]]){
  const codes=words.filter(w=>/^\d{4}$/.test(w.text)&&w.x0>=left&&w.x0<left+40&&w.top>anchor.top+5).sort((a,b)=>a.top-b.top);
  let current=[];for(const code of codes){if(current.length&&code.top-current.at(-1).top>32){groups.push({top:current[0].top,left,right,codes:current});current=[];}current.push(code);}if(current.length)groups.push({top:current[0].top,left,right,codes:current});
 }
 groups.sort((a,b)=>Math.round(a.top/35)-Math.round(b.top/35)||a.left-b.left);
 return groups.map(g=>g.codes.map(code=>{
  const t=words.filter(w=>w.x0>=g.left&&w.x0<g.right&&Math.abs(w.top-code.top)<3).sort((a,b)=>a.x0-b.x0).map(w=>w.text);
  const sp=t.at(-1),amount=dec(t.at(-2));if(!/^[А-ЯЁA-Z]{2}$/.test(sp)||!amount)return null;
  return {code:code.text,base:dec(t[1])?.toString()??null,rate:t.slice(2,-2).join(' '),amount:money(amount),sp,group:SP[sp]?.[1]||'unknown',page:pageNumber};
 }).filter(Boolean)).filter(g=>g.length);
}
