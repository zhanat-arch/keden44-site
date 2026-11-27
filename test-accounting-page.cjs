const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=__dirname,origin='https://keden44.com';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin==='https://www.googletagmanager.com')return route.fulfill({body:''});
   if(url.origin==='https://api.keden44.com')return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,access:{allowed:false,state:'blocked'}})});
   if(url.origin!==origin)return route.abort();
   const file=path.resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
   if(!file.startsWith(root+path.sep))return route.fulfill({status:403});
   const body=await fs.readFile(file).catch(()=>null);
   return body?route.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/javascript'}):route.fulfill({status:404});
  });
  await page.goto(origin+'/tools/accounting/?fixture=private#ignored');
  await page.locator('.k44-footer-inner').waitFor();
  assert.equal(await page.locator('#profile option[value="detailed"]').textContent(),'Новый отчёт · 80 колонок');
  assert.equal(await page.evaluate(async()=>{
   const [catalog,profiles]=await Promise.all([fetch('/tools/payment-types.json').then(r=>r.json()),fetch('/tools/templates.json').then(r=>r.json())]);
   const {quantityUnitCode}=await import('/tools/unit-classifier.js');
   return catalog.currencies.AUD==='036'&&quantityUnitCode('М²',catalog)==='055'&&profiles.find(p=>p.id==='detailed').headers.length===80;
  }),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.equal(await page.evaluate(()=>dataLayer.filter(x=>x[0]==='event'&&x[1]==='page_view').length),1);
  assert.equal(await page.evaluate(()=>dataLayer.find(x=>x[0]==='event')[2].page_location),origin+'/tools/accounting/');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(root,'../../tmp',`accounting-classifiers-${width}.png`),fullPage:true});
  await context.close();
 }}finally{await browser.close();}
 console.log('PASS accounting page 390/1440: classifiers, 80 columns, shared footer, canonical analytics, no overflow or JS errors');
})().catch(e=>{console.error(e);process.exitCode=1;});
