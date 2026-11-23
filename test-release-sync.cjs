const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=__dirname, origin='http://localhost:3089';
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png'};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for (const width of [390,1440]) {
   const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});
   page.setDefaultTimeout(10000);
   const errors=[],patches=[];
   let cloud={records:[],settings:{}};
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin===origin){
     const file=path.resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
     if(!file.startsWith(root+path.sep))return route.fulfill({status:403});
     const body=await fs.readFile(file).catch(()=>null);
     return body?route.fulfill({contentType:types[path.extname(file)],body}):route.fulfill({status:404});
    }
    if(url.origin==='https://api.keden44.com'&&url.pathname.startsWith('/v1/telegram/')){
     const headers={'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'};
     if(route.request().method()==='OPTIONS')return route.fulfill({headers,status:204});
     const name=url.pathname.slice('/v1/telegram/'.length);
     if(name==='cloud/patch'){
      const body=route.request().postDataJSON();patches.push(body);
      const merged=new Map(cloud.records.map(r=>[r.id,r]));
      body.records.forEach(r=>merged.set(r.id,r));cloud={records:[...merged.values()],settings:{...cloud.settings,...body.settings}};
     }
     const data=name==='connection'?{identity:{email:'fixture@example.com'}}:name==='cloud/pull'?{cloud}:name==='access/status'?{access:{allowed:true,state:'active'}}:{};
     return route.fulfill({headers,json:{ok:true,...data}});
    }
    return route.request().resourceType()==='script'?route.fulfill({contentType:'text/javascript',body:''}):route.fulfill({json:{ok:true,linked:false}});
   });
   await page.addInitScript(()=>{
    localStorage.setItem('keden44-telegram-device-v1',JSON.stringify({accountId:'fixture',deviceSecret:'fixture'}));
    localStorage.setItem('dt-board-settings-v1',JSON.stringify({helpQrChecks:false,helpCoworkers:false}));
    localStorage.setItem('dt-board-records-v6',JSON.stringify([{id:'target',dtNumber:'57507/191126/0003764',status:'В работе',checkedAt:'2026-11-18T00:00:00Z',updatedAt:'2026-11-18T00:00:00Z',kedenNotificationIds:['release'],history:[]}]));
   });
   await page.goto(origin+'/monitor/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.KEDEN44_MONITOR&&document.querySelector('#line').textContent.includes('Синхронизация завершена'));
   await page.waitForTimeout(1600);
   await page.evaluate(()=>KEDEN44_MONITOR.applyNotifications([{id:'release',dtNumbers:['57507/191126/0003764'],text:'ДТ 57507/191126/0003764 выпущена.',deliveredAt:'2026-11-19T07:26:18Z'}],{share:false,notify:false}));
   assert.equal(await page.evaluate(()=>dtBoardDebug.records.find(r=>r.id==='target').status),'Выпущена');
   assert.equal(await page.evaluate(()=>dtBoardDebug.records.find(r=>r.id==='target').history.length),0,'known notice repaired without duplicating history');
   await page.waitForTimeout(1600);
   const before=patches.length;
   await page.evaluate(()=>{
    const key='dt-board-records-v6',rows=JSON.parse(localStorage.getItem(key));
    rows.push({id:'external',dtNumber:'57507/231126/0009999',status:'В работе',updatedAt:new Date().toISOString()});
    const newValue=JSON.stringify(rows);localStorage.setItem(key,newValue);window.dispatchEvent(new StorageEvent('storage',{key,newValue}));
   });
   await page.waitForTimeout(1600);
   assert.ok(patches.slice(before).some(p=>p.records.some(r=>r.id==='external')),'external DT must upload without manual save');
   assert.ok(patches.slice(before).every(p=>p.records.every(r=>r.id==='external')),'unchanged cards must not upload again');
   await page.locator('.k44-footer-inner').waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.deepEqual(errors,[]);
   await page.close();
  }
  console.log('PASS 390/1440: known Cyrillic release repairs card; external storage DT synchronizes automatically using delta; no duplicate history; footer and layout');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
