const normalize=value=>String(value??'').normalize('NFKC').toLocaleUpperCase('ru-RU').replace(/Ё/g,'Е').replace(/\^([23])/g,'$1').replace(/\./g,'').replace(/\s+/g,' ').trim();
const aliases={
 'ШТ':'796','ШТУК':'796','ШТУКИ':'796',
 'М':'006','МЕТРЫ':'006','МЕТРОВ':'006',
 'М2':'055','М 2':'055','КВ М':'055','КВАДРАТНЫЙ МЕТР':'055','КВАДРАТНЫХ МЕТРОВ':'055',
 'М3':'113','М 3':'113','КУБ М':'113','КУБИЧЕСКИЙ МЕТР':'113',
 'ПОГ М':'018','М ПОГ':'018','ПОГОННЫЙ МЕТР':'018',
 'КГ':'166','Г':'163','Л':'112','ПАР':'715','ПАРЫ':'715',
 '1000 КВТ*Ч':'246','1000 Л':'130','1000 М3':'114','1000 М 3':'114',
 'Г Д/И':'306','КАР':'162','КГ 90 % С/В':'845','КГ 90% С/В':'845',
 'КГ H2O2':'841','КГ K2O':'852','КГ KOH':'859','КГ N':'861',
 'КГ NAOH':'863','КГ P2O5':'865','КГ U':'867','КИ':'305',
 'Л 100 % СПИРТА':'831','Л 100% СПИРТА':'831','Т ГРП':'185',
 'РУЛ':'736','РУЛОНЫ':'736','РУЛОНОВ':'736','КОМПЛ':'839',
 '100 ШТ':'797','1000 ШТ':'798','ТЫС ШТ':'798'
};
export function quantityUnitCode(name,catalog){
 const key=normalize(name);if(!key)return null;
 const units=catalog.units||[];
 const matches=new Set(units.filter(unit=>normalize(unit.name)===key||unit.code===String(name).trim()).map(unit=>unit.code));
 if(matches.size===1)return [...matches][0];
 if(matches.size>1)return null;
 const code=aliases[key];return code&&units.some(unit=>unit.code===code)?code:null;
}
