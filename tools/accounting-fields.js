import {crop} from './pdf-core.js';

export function fullGoodsName(description){
 const text=String(description||'').replace(/\s+/g,' ').trim();
 const names=[...text.matchAll(/ГРУППА ТОВАРОВ\s+\d+\s*:\s*(.*?)(?=ТОВАРНЫЙ ЗНАК|МАРКА|МОДЕЛЬ|АРТИКУЛ|СЕРИЙНЫЕ НОМЕРА|КОЛИЧЕСТВО|ПРОИЗВОДИТЕЛЬ|ГРУППА ТОВАРОВ|$)/g)]
  .map(m=>m[1].replace(/^1\.\s*/,'').trim()).filter(Boolean);
 return [...new Set(names)].join('; ');
}

export function invoiceDate(value){
 const s=String(value||'').trim(),m=s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/),iso=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(!m&&!iso)return null;
 const [year,month,day]=m?[m[3],m[2],m[1]]:iso.slice(1),date=new Date(`${year}-${month}-${day}T00:00:00Z`);
 return Number.isFinite(date.getTime())&&date.getUTCFullYear()===Number(year)&&date.getUTCMonth()+1===Number(month)&&date.getUTCDate()===Number(day)?`${year}-${month}-${day}`:null;
}
export const displayInvoiceDate=value=>invoiceDate(value)?.split('-').reverse().join('.')||'';
export const invoiceReferences=invoices=>invoices.map(i=>`${i.code} ${i.number}${i.date?' ОТ '+displayInvoiceDate(i.date):''}`).join('\n');

export function readInvoiceRows(words){
 const heading=words.find(w=>w.text==='Дата'&&w.top<110),codeHeading=words.find(w=>w.text==='Код'&&heading&&Math.abs(w.top-heading.top)<4&&w.x0<heading.x0);
 const nameHeading=words.find(w=>w.text==='Название'&&heading&&Math.abs(w.top-heading.top)<4&&w.x0>heading.x0);
 if(!heading||!codeHeading||!nameHeading)return [];
 const numberHeading=words.filter(w=>w.text==='№'&&Math.abs(w.top-heading.top)<4&&w.x0>codeHeading.x0&&w.x0<heading.x0).sort((a,b)=>a.x0-b.x0)[0];
 const left=numberHeading?.x0??codeHeading.x0+24;
 const anchors=words.filter(w=>/^\d{5}$/.test(w.text)&&Math.abs(w.x0-codeHeading.x0)<5&&w.top>heading.top+5).sort((a,b)=>a.top-b.top);
 const result=[];
 for(let i=0;i<anchors.length;i++){
  const a=anchors[i];if(!['04021','04022'].includes(a.text))continue;
  const prefix=words.filter(w=>w.x0<codeHeading.x0-3&&Math.abs(w.top-a.top)<3).sort((a,b)=>a.x0-b.x0);
  const item=Number(prefix[0]?.text);if(!Number.isInteger(item)||item<1)continue;
  const bottom=anchors[i+1]?anchors[i+1].top-2:Math.min(a.top+32,820);
  const number=crop(words,left-1,a.top-2,heading.x0-2,bottom).replace(/\s+/g,'').trim();
  const date=invoiceDate(crop(words,heading.x0-1,a.top-2,nameHeading.x0-2,bottom).replace(/\s+/g,''));
  if(number)result.push({item,code:a.text,number,date});
 }
 return result;
}

export function itemProcedure(words,top,end){
 const a=words.find(w=>w.text==='37'&&w.x0>330&&w.top>=top&&w.top<end);
 const value=a&&crop(words,342,a.top+9,418,a.top+26).match(/\b(\d{4})\s+(\d{3})\b/);
 return value?`${value[1].slice(0,2)} ${value[1].slice(2)} ${value[2]}`:null;
}
