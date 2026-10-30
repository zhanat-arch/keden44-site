export function declarationReference(text) {
 const match=String(text||'').match(/\b(\d{5}\s*\/\s*\d{6}\s*\/\s*\d{7})(?:\s*\/\s*([1-9]\d*)(?!\d))?/);
 return {dtNumber:match?match[1].replace(/\s/g,''):'',correctionNumber:match?.[2]?Number(match[2]):null};
}
export function correctionNotice(number) {
 return number?`По данным КДТ №${number}. В PDF ДТ после корректировки итоги в разделе «Подробности подсчёта» могут отсутствовать или быть нулевыми. Итоги отчёта рассчитаны по графе 47 товаров; расхождения с этим разделом требуют проверки по КДТ.`:'';
}
export function declarationHeading(number,correctionNumber=null) {
 const heading=baseHeading(number);
 return correctionNumber?`${heading} · По данным КДТ №${correctionNumber}`:heading;
}
function baseHeading(number) {
 const value=String(number||'').trim();
 const match=value.match(/^\d{5}\/(\d{2})(\d{2})(\d{2})\/([01])\d{6}$/);
 if(!match)return 'Декларация: '+(value||'не определена');
 const [,day,month,year,tariff]=match;
 const date=new Date(Date.UTC(2000+Number(year),Number(month)-1,Number(day)));
 if(date.getUTCDate()!==Number(day)||date.getUTCMonth()+1!==Number(month))return 'Декларация: '+value;
 return `Декларация: ${value} (${day}.${month}.20${year}) ${tariff==='0'?'ЕТТ':'ВТО'}`;
}
