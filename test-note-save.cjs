const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=__dirname,origin='http://localhost:3094';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'}),errors=[],patches=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin===origin){
     const file=path.resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
     if(!file.startsWith(root+path.sep))return route.fulfill({status:403});
     const body=await fs.readFile(file).catch(()=>null);
     return body?route.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/javascript'}):route.fulfill({status:404});
    }
    if(url.origin==='https://api.keden44.com'){
     const headers={'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'};
     if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});
     const name=url.pathname.split('/').slice(3).join('/');
     if(name==='cloud/patch')patches.push(route.request().postDataJSON());
     const result=name==='connection'?{identity:{email:'fixture@example.test'}}:name==='cloud/pull'?{cloud:{records:[],settings:{}}}:name==='access/status'?{access:{allowed:true,state:'active'}}:{};
     return route.fulfill({headers,json:{ok:true,...result}});
    }
    return route.request().resourceType()==='script'?route.fulfill({contentType:'text/javascript',body:''}):route.fulfill({status:204});
   });
   await page.addInitScript(()=>{
    localStorage.setItem('keden44-telegram-device-v1',JSON.stringify({accountId:'fixture',deviceSecret:'fixture'}));
    localStorage.setItem('dt-board-settings-v1',JSON.stringify({helpQrChecks:false,helpCoworkers:false}));
    localStorage.setItem('dt-board-records-v6',JSON.stringify([{id:'note-target',dtNumber:'12345/010126/0000001',status:'В работе',updatedAt:'2026-11-23T00:00:00Z',history:[]}]));
   });
   await page.goto(origin+'/monitor/');
   await page.waitForFunction(()=>document.querySelector('#line').textContent.includes('Синхронизация завершена'));
   await page.locator('[data-action=note]').click();await page.locator('[data-note-editor] input').fill('849');
   // A background read replaces objects even when their visible data is unchanged.
   await page.evaluate(()=>{const key='dt-board-records-v6',newValue=localStorage.getItem(key);window.dispatchEvent(new StorageEvent('storage',{key,newValue}));});
   await page.waitForTimeout(250);
   assert.equal(await page.locator('[data-note-editor] input').inputValue(),'849');
   await page.locator('[data-note-save]').click();
   await page.waitForFunction(()=>dtBoardDebug.records[0].specialistNote==='849');
   await page.locator('[data-action=note]').click();await page.locator('[data-note-editor] input').fill('850');
   // A real remote change must not discard an unsaved input during card redraw.
   await page.evaluate(()=>{const key='dt-board-records-v6',rows=JSON.parse(localStorage.getItem(key));rows[0].status='Зарегистрирована';const newValue=JSON.stringify(rows);localStorage.setItem(key,newValue);window.dispatchEvent(new StorageEvent('storage',{key,newValue}));});
   await page.waitForTimeout(300);
   assert.equal(await page.locator('[data-note-editor]').isVisible(),true);
   assert.equal(await page.locator('[data-note-editor] input').inputValue(),'850');
   await page.locator('[data-note-save]').click();
   await page.waitForFunction(()=>dtBoardDebug.records[0].specialistNote==='850');
   await page.locator('[data-action=note]').click();await page.locator('[data-note-editor] input').press('Escape');
   await page.locator('[data-action=note]').click();await page.locator('[data-note-editor] input').fill('851');
   await page.locator('[data-note-editor] input').press('Enter');
   await page.waitForFunction(()=>dtBoardDebug.records[0].specialistNote==='851');
   assert.equal(await page.evaluate(()=>dtBoardDebug.records[0].history.filter(line=>line.includes('заметка обновлена')).length),3);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dt-board-records-v6'))[0].specialistNote),'851');
   await page.waitForTimeout(1600);
   assert.ok(patches.some(p=>p.records.some(r=>r.specialistNote==='851')));
   await page.locator('.k44-footer-inner').waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS notes 390/1440: stale object save, draft survives redraw, repeated open/Escape/Enter, no duplicate history, local save and cloud delta, footer and layout');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
