import {dec,money,sum} from './pdf-core.js';

const payable=new Set(['ИУ','ВУ','ОП','ОЧ','РП','УМ']);
const excluded=new Set(['УН','УР','ЗН']);
export function costOf(item,catalog){
 const base=dec(item.customsValue);
 if(!base||base.lt(0)||!item.payments?.length)return null;
 const rows=[];
 for(const p of item.payments){
  if(excluded.has(p.sp))continue;
  if(!payable.has(p.sp)||!catalog.codes[p.code]||catalog.codes[p.code].review)return null;
  // Under instalments, UM is the paid part of the full RP obligation.
  if(p.sp==='УМ'&&item.payments.some(other=>other.code===p.code&&other.sp==='РП'))continue;
  const amount=dec(p.amount);if(!amount||amount.lt(0))return null;
  rows.push(p);
 }
 const payments=money(sum(rows.filter(p=>catalog.codes[p.code].family!=='vat').map(p=>p.amount)));
 const vat=money(sum(rows.filter(p=>catalog.codes[p.code].family==='vat').map(p=>p.amount)));
 const noVat=money(sum([base,payments])),total=money(sum([noVat,vat]));
 const quantity=dec(item.quantity);
 return {base:money(base),payments,vat,noVat,total,unit:quantity?.gt(0)?money(dec(total).div(quantity)):null};
}
