const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const tools=path.join(__dirname,'tools');globalThis.Big=require(path.join(tools,'vendor/big.js'));globalThis.ExcelJS=require(path.join(tools,'vendor/exceljs.min.js'));
const item=(text,x,top,width=text.length*4)=>({str:text,width,height:8,transform:[1,0,0,8,x,900-top-6.4]});
function fakePdf(unit,extra){
 const main=[item('ДЕКЛАРАЦИЯ НА ТОВАРЫ',10,5),item('12345/010126/0000001',10,25),item('32',315,300,9),item('Товар',330,300,18),item('1',315,315,4),item('1234567890',343,315,40),item('1. ТЕСТОВЫЙ ТОВАР',67,325),item('34',343,355,8),item('CN',343,368,8)];
 if(extra)main.push(item('41',343,410,8),item(extra.code,343,423,15),item(extra.quantity,390,423,20));
 const appendix=[item('Графа 31',10,10),item('1',10,40,4),item(`ГРУППА ТОВАРОВ 1: ТЕСТОВЫЙ ТОВАР; КОЛИЧЕСТВО 0,55 ${unit}; ПРОИЗВОДИТЕЛЬ ТЕСТ;`,25,40)];
 return {numPages:2,getPage:async n=>({getTextContent:async()=>({items:n===1?main:appendix}),getViewport:()=>({height:900}),cleanup(){}}),destroy:async()=>{}};
}
(async()=>{
 const {parseDeclaration}=await import(pathToFileURL(path.join(tools,'accounting-engine.js')));
 const {makeReport}=await import(pathToFileURL(path.join(tools,'excel-report.js')));
 const profiles=JSON.parse(fs.readFileSync(path.join(tools,'templates.json'))),catalog=JSON.parse(fs.readFileSync(path.join(tools,'payment-types.json')));
 const {quantityUnitCode}=await import(pathToFileURL(path.join(tools,'unit-classifier.js')));
 const unitCodes={'ШТ':'796','М':'006','М²':'055','РУЛОН':'736'};
 for(const [name,code] of Object.entries({...unitCodes,'м³':'113','пог. м':'018','КГ':'166','штука':'796','055':'055'}))assert.equal(quantityUnitCode(name,catalog),code);
 assert.equal(quantityUnitCode('НАБОР',catalog),'704');
 for(const name of ['НЕИЗВЕСТНО','ШТ И РУЛОНЫ','КВ','0.55',''])assert.equal(quantityUnitCode(name,catalog),null);
 for(const [currency,code] of Object.entries({USD:'840',EUR:'978',CNY:'156',GBP:'826',AED:'784',AUD:'036',KZT:'398',JPY:'392',INR:'356'}))assert.equal(catalog.currencies[currency],code);
 assert.equal(Object.keys(catalog.currencies).length,178);
 assert.equal(catalog.units.length,728);
 let cases=0;
 for(const unit of ['ШТ','М','М²','РУЛОН'])for(const extra of [null,{code:'055',quantity:'0,55'},{code:'796',quantity:'3'}]){
  globalThis.pdfjsLib={GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve(fakePdf(unit,extra))})};
  const data=await parseDeclaration({name:'synthetic-units.pdf',size:0,arrayBuffer:async()=>new ArrayBuffer(0)},catalog);
  assert.equal(data.items.length,1);const product=data.items[0];
  assert.equal(product.quantity,'0.55');assert.equal(product.unitName,unit);assert.equal(product.quantityUnit,undefined);
  assert.equal(product.extraUnit||null,extra?.code||null);assert.equal(product.extraQuantity??null,extra?String(Number(extra.quantity.replace(',','.'))):null);
  product.quantityUnit='796'; // Legacy cached inferred code must not leak into graph 41.
  for(const profile of profiles){
   const bytes=await makeReport(data,profile,catalog),wb=new ExcelJS.Workbook();await wb.xlsx.load(bytes);const sheet=wb.getWorksheet(profile.sheet),row=profile.headerRow+1;
   const codeColumn=profile.id==='classic'?25:profile.id==='extended'?34:7;
   const qtyColumn=profile.id==='classic'?26:profile.id==='extended'?35:80;
   assert.equal(sheet.getCell(row,codeColumn).value,profile.id==='detailed'?unitCodes[unit]:extra?.code||null);
   assert.equal(sheet.getCell(row,qtyColumn).value,extra?Number(extra.quantity.replace(',','.')):null);
   if(profile.id==='detailed'){assert.equal(sheet.getCell(row,6).value,0.55);assert.equal(sheet.getCell(row,8).value,unit);assert.equal(sheet.getCell(row,79).value,extra?.code||null);assert.equal(profile.headers[77],'Характеристики товара (графа 31)');assert.equal(profile.headers.length,80);}
   cases++;
  }
 }
 console.log(`PASS ${cases} exports: graph31 classified separately from graph41, 178 currencies, 728 units, unknown units blank, decimal quantity, leading zero, stale code ignored, existing columns preserved`);
})().catch(e=>{console.error(e);process.exitCode=1;});
