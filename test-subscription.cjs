const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=__dirname,origin='https://keden44.com';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const width of [390,1440])for(const state of ['anonymous','trial','active','promo','blocked','offline']){
   const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
   const page=await context.newPage(),errors=[],calls=[];
   page.on('pageerror',e=>errors.push(e.message));
   if(state!=='anonymous')await context.addInitScript(()=>localStorage.setItem('keden44-telegram-device-v1',JSON.stringify({accountId:'fixture',deviceSecret:'fixture-secret'})));
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin==='https://accounts.google.com')return route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{id:{initialize(o){window.fixtureGoogle=o},renderButton(el){el.textContent="Google"}}}}'});
    if(url.origin==='https://www.googletagmanager.com')return route.fulfill({body:''});
    if(url.origin==='https://api.keden44.com'){
     calls.push(url.pathname);
     let body={ok:true};
     if(url.pathname.endsWith('/register'))Object.assign(body,{accountId:'fixture',deviceSecret:'fixture-secret'});
     else if(url.pathname.endsWith('/connection'))body.identity={email:'fixture@example.invalid'};
     else if(url.pathname.endsWith('/challenge'))body.nonce='fixture-nonce';
     else if(url.pathname.endsWith('/access/status')){
      if(state==='offline')return route.abort();
      body.access={allowed:state!=='blocked',state,validUntil:'2027-01-01T00:00:00Z',trialUntil:'2026-12-02T00:00:00Z'};
     }
     return route.fulfill({status:state==='blocked'&&url.pathname.endsWith('/access/status')?402:200,contentType:'application/json',body:JSON.stringify(body)});
    }
    if(url.origin===origin){
     if(url.pathname==='/shared/access-copy.json'&&state==='offline')return route.abort();
     if(url.pathname==='/shared/access-copy.json'&&state==='promo')return route.fulfill({contentType:'application/json',body:JSON.stringify({trial:'GitHub fallback fixture'})});
     const file=path.resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
     if(!file.startsWith(root+path.sep))return route.fulfill({status:403});
     const body=await fs.readFile(file).catch(()=>null);
     return body?route.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/javascript'}):route.fulfill({status:404});
    }
    return route.abort();
   });
   await page.goto(origin+'/subscription/?return=%2Ftools%2Faccounting%2F');
   await page.locator('.k44-footer-inner').waitFor();
   if(state==='anonymous'){
    await page.getByText('Для доступа нужно авторизоваться через Google или Telegram.',{exact:true}).waitFor();
    assert.equal(await page.locator('#purchaseLink').isVisible(),false);
    assert.equal(await page.locator('#returnToTool').isVisible(),false);
    await page.locator('#googleSignIn').getByText('Google',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>fixtureGoogle.nonce),'fixture-nonce');
    await page.screenshot({path:path.join(root,`subscription-login-${width}.png`),fullPage:true});
    await page.evaluate(()=>fixtureGoogle.callback({credential:'fixture-credential'}));
    await page.waitForFunction(()=>document.querySelector('#subscriptionAccount').textContent.includes('fixture@example.invalid'));
    assert.ok(calls.some(p=>p.endsWith('/auth/google')));
   }else{
    await page.waitForFunction(()=>!document.querySelector('#checkSubscriptionStatus').disabled);
    await page.waitForFunction(()=>!document.querySelector('#subscriptionStatus').textContent.includes('Проверяем'));
    const text=await page.locator('#subscriptionStatus').textContent();
    assert.ok(state==='trial'?text.includes('Пробный доступ'):state==='promo'?text.includes('приглашению'):state==='active'?text.includes('Оплата подтверждена'):state==='offline'?text.includes('Это не означает'):text.includes('не найдена'),text);
    assert.equal(await page.locator('#returnToTool').isVisible(),!['blocked','offline'].includes(state));
    assert.equal(await page.locator('#returnToTool').getAttribute('href'),'/tools/accounting/');
    await page.locator('#checkSubscriptionStatus').click();
    await page.waitForFunction(()=>!document.querySelector('#checkSubscriptionStatus').disabled);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.equal(await page.evaluate(()=>dataLayer.filter(x=>x[0]==='event'&&x[1]==='page_view').length),1);
   assert.equal(await page.evaluate(()=>dataLayer.find(x=>x[0]==='event')[2].page_location),origin+'/subscription/');
   assert.deepEqual(errors,[]);
   if(state==='promo')assert.equal(await page.locator('[data-access-copy="trial"]').textContent(),'GitHub fallback fixture');
   if(state==='offline')assert.ok((await page.locator('[data-access-copy="trial"]').textContent()).includes('Новым аккаунтам'));
   assert.equal(await page.evaluate(async()=>{
    const copy=await import('/shared/access-copy.js?v=20261125');await copy.copyReady;
    const original=copy.ACCESS_COPY.trial;
    copy.setServerAccessCopy({trial:'Server test',signIn:22,unknown:'ignored'});
    if(copy.ACCESS_COPY.trial!=='Server test'||copy.ACCESS_COPY.unknown)return false;
    copy.setServerAccessCopy({trial:''});
    return copy.ACCESS_COPY.trial===original;
   }),true);
   if(state==='active'){
    for(const [time,november,december] of [['2026-11-30T18:59:59Z',true,false],['2026-11-30T19:00:00Z',false,true],['2026-12-31T19:00:00Z',false,false]]){
     await page.evaluate(async time=>{const {refreshTimedContent}=await import('/shared/timed-content.js?v=20261125');refreshTimedContent(document,Date.parse(time));},time);
     assert.equal(await page.locator('#purchaseLink').isVisible(),november);
     assert.equal(await page.locator('#decemberPurchaseLink').isVisible(),december);
    }
    assert.equal(await page.locator('#decemberPurchaseLink').getAttribute('href'),'https://boosty.to/zhanat-arch/posts/b3d3ef91-c48f-4057-8896-cb7977d878ac');
   }
   assert.equal(await page.evaluate(async()=>{
    const {isVisibleAt}=await import('/shared/timed-content.js?v=20261125');
    const el=document.createElement('p');el.setAttribute('data-visible-until','2026-12-01T00:00:00+05:00');
    return isVisibleAt(el,Date.parse('2026-11-30T18:59:59Z'))&&!isVisibleAt(el,Date.parse('2026-11-30T19:00:00Z'));
   }),true);
   if(state==='anonymous'||state==='trial')await page.screenshot({path:path.join(root,`subscription-${state}-${width}.png`),fullPage:true});
   await context.close();
  }
  console.log('PASS subscription 390/1440: anonymous/Google login, trial, paid, promo, blocked, retry, return path, footer, canonical analytics, layout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
