const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=__dirname,origin='https://keden44.com';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const width of [390,1440])for(const failure of [false,true]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin==='https://www.googletagmanager.com')return route.fulfill({body:''});
   if(url.origin===origin&&url.pathname==='/tools/access.js')return route.fulfill({contentType:'text/javascript',body:`export async function requireAccess(){};export function recordReport(){};export async function reportToolProblem(body){const r=await fetch('/fixture/problem',{method:'POST',body:JSON.stringify(body)});if(!r.ok)throw Error('offline');return r.json();}`});
   if(url.pathname==='/fixture/problem'){requests.push(JSON.parse(route.request().postData()));return route.fulfill({status:failure?503:200,contentType:'application/json',body:JSON.stringify({reported:true,reference:'PDF-1234ABCD'})});}
   if(url.origin!==origin)return route.abort();
   const file=path.resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
   if(!file.startsWith(root+path.sep))return route.fulfill({status:403});
   const body=await fs.readFile(file).catch(()=>null);
   return body?route.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/javascript'}):route.fulfill({status:404});
  });
  await page.goto(origin+'/tools/accounting/');await page.locator('.k44-footer-inner').waitFor();
  const report=page.getByRole('button',{name:'Сообщить о проблеме'});assert.equal(await report.isVisible(),false);
  await page.locator('#file').setInputFiles({name:'private-document.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')});
  await report.waitFor();assert.equal(requests.length,0);
  await report.click();await page.waitForFunction(()=>document.querySelector('main').textContent.includes('Сам PDF ещё не отправлен.')||document.querySelector('main').textContent.includes('Не удалось подтвердить отправку'));
  assert.equal(requests.length,1);assert.deepEqual(requests[0],{scope:'accounting',reason:'parse_error',extracted:null,expected:null});
  assert.ok(!JSON.stringify(requests).includes('private-document'));
  if(failure){assert.ok((await page.locator('main').textContent()).includes('Не удалось подтвердить'));assert.equal(await report.isDisabled(),false);}
  else{assert.ok((await page.locator('main').textContent()).includes('PDF-1234ABCD'));assert.equal(await report.isDisabled(),true);}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.screenshot({path:path.join(root,'../../tmp',`accounting-problem-${width}-${failure}.png`),fullPage:true});
  await page.getByRole('button',{name:'Очистить'}).click();assert.equal(await report.isVisible(),false);assert.equal(requests.length,1);
  assert.deepEqual(errors,[]);
  const reasons=await page.evaluate(async()=>{const {problemFor}=await import('/tools/accounting/problem.js');return [problemFor({items:[]}),problemFor({items:[{}],complete:false}),problemFor({items:[{}],complete:true})];});
  assert.deepEqual(reasons,['no_items','incomplete',null]);await context.close();
 }}finally{await browser.close();}
 console.log('PASS support 390/1440: explicit click only, parser error, no document transfer, truthful success/failure, clear, partial/empty/success classification');
})().catch(e=>{console.error(e);process.exitCode=1;});
