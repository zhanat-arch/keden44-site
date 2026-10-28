export function declarationHeading(number) {
 const value=String(number||'').trim();
 const match=value.match(/^\d{5}\/(\d{2})(\d{2})(\d{2})\/([01])\d{6}$/);
 if(!match)return 'Декларация: '+(value||'не определена');
 const [,day,month,year,tariff]=match;
 const date=new Date(Date.UTC(2000+Number(year),Number(month)-1,Number(day)));
 if(date.getUTCDate()!==Number(day)||date.getUTCMonth()+1!==Number(month))return 'Декларация: '+value;
 return `Декларация: ${value} (${day}.${month}.20${year}) ${tariff==='0'?'ЕТТ':'ВТО'}`;
}
