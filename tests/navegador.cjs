/* Requiere Playwright y Chromium. Opcional: IWISH_CHROMIUM=/ruta/al/ejecutable. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require(process.env.IWISH_PLAYWRIGHT||'playwright');
const root=path.join(__dirname,'../iwish-web');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.join(root,pathname==='/'?'index.html':pathname);
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  res.end(await fs.readFile(file));
 }catch{res.writeHead(404).end();}
});
const title='[name=title]';
const modal='#form-modal';
const taskDate='2027-01-20T18:00';
const row=(page,text)=>page.locator('#agenda-list .timeline-card').filter({has:page.getByRole('heading',{name:text,exact:true})});
async function enter(page){
 await page.locator('#welcome-enter').click();
 await page.locator('aside [data-route=agenda]').click();
}
async function createTask(page,name){
 await page.locator('#page-agenda [data-open-modal=event]').click();
 await page.locator(modal+' '+title).fill(name);
 await page.locator(modal+' [name=starts_at]').fill(taskDate);
}
async function save(page){
 await page.locator('#modal-form button[type=submit]').click();
}
async function waitClosed(page){await page.locator(modal).waitFor({state:'hidden'});}
async function edit(page,name){await row(page,name).locator('[data-edit-event]').click();}
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.IWISH_CHROMIUM});
  const context=await browser.newContext({acceptDownloads:true});
  const a=await context.newPage(),b=await context.newPage();
  const errors=[];
  for(const page of [a,b])page.on('pageerror',error=>errors.push(error.message));
  const url='http://127.0.0.1:'+server.address().port;
  await Promise.all([a.goto(url),b.goto(url)]);
  await Promise.all([enter(a),enter(b)]);
  await a.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await b.waitForFunction(()=>!!navigator.serviceWorker.controller);

  await context.setOffline(true);
  await Promise.all([createTask(a,'Tarea A'),createTask(b,'Tarea B')]);
  await Promise.all([save(a),save(b)]);
  await Promise.all([waitClosed(a),waitClosed(b)]);

  await a.locator('aside [data-route=wishes]').click();
  await a.locator('#page-wishes [data-open-modal=wish]').click();
  await a.locator(modal+' '+title).fill('Deseo A');
  await save(a);
  await waitClosed(a);
  await b.locator('#theme-toggle').click();
  await b.waitForFunction(()=>document.body.classList.contains('dark'));

  await a.reload();
  await enter(a);
  await row(a,'Tarea A').waitFor();
  await row(a,'Tarea B').waitFor();
  assert.equal(await a.locator('body').evaluate(el=>el.classList.contains('dark')),true);
  await a.locator('aside [data-route=wishes]').click();
  await a.getByText('Deseo A',{exact:true}).waitFor();
  await a.locator('aside [data-route=agenda]').click();
  console.log('OK Chromium: dos pestañas sin red, recarga sin red, tema y deseo.');

  await edit(a,'Tarea A');
  await a.locator(modal+' '+title).fill('Borrador abierto');
  await edit(b,'Tarea A');
  await b.locator(modal+' '+title).fill('Versión reciente');
  await save(b);
  await waitClosed(b);
  await save(a);
  await a.locator('#modal-error').getByText(/cambió o se eliminó/).waitFor();
  assert.equal(await a.locator(modal+' '+title).inputValue(),'Borrador abierto');
  const downloaded=a.waitForEvent('download');
  await a.locator('#modal-draft').click();
  const download=await downloaded;
  assert.equal(JSON.parse(await fs.readFile(await download.path(),'utf8')).title,'Borrador abierto');
  await a.locator('#modal-cancel').click();
  await row(a,'Versión reciente').waitFor();

  await edit(a,'Versión reciente');
  await a.locator(modal+' '+title).fill('No resucitar');
  b.once('dialog',dialog=>dialog.accept());
  await row(b,'Versión reciente').locator('[data-delete=events]').click();
  await row(b,'Versión reciente').waitFor({state:'hidden'});
  await save(a);
  await a.locator('#modal-error').getByText(/cambió o se eliminó/).waitFor();
  await a.locator('#modal-cancel').click();
  await row(a,'Versión reciente').waitFor({state:'hidden'});
  console.log('OK Chromium: edición y borrado concurrentes, descarga de borrador.');

  await row(a,'Tarea B').locator('[data-complete-event]').click();
  await a.locator('[data-agenda-filter=done]').click();
  await row(a,'Tarea B').waitFor();
  await a.reload();
  await enter(a);
  await a.locator('[data-agenda-filter=done]').click();
  await row(a,'Tarea B').waitFor();
  a.once('dialog',dialog=>dialog.accept());
  await row(a,'Tarea B').locator('[data-delete=events]').click();
  await row(a,'Tarea B').waitFor({state:'hidden'});
  await a.reload();
  await enter(a);
  await a.locator('[data-agenda-filter=all]').click();
  assert.equal(await row(a,'Tarea B').count(),0);
  assert.equal(await row(a,'Versión reciente').count(),0);
  console.log('OK Chromium: completar, borrar y recargar.');

  await createTask(a,'Reintento de cuota');
  await a.evaluate(()=>{
   const write=Storage.prototype.setItem;
   window.restoreIWishWrite=()=>{Storage.prototype.setItem=write;};
   Storage.prototype.setItem=function(key,value){
    if(key.startsWith('iwish_e2:'))throw new DOMException('Cuota simulada','QuotaExceededError');
    return write.call(this,key,value);
   };
  });
  await save(a);
  await a.locator('#modal-error').getByText(/No se pudo guardar/).waitFor();
  assert.equal(await a.locator(modal+' '+title).inputValue(),'Reintento de cuota');
  await a.evaluate(()=>window.restoreIWishWrite());
  await save(a);
  await waitClosed(a);
  await row(a,'Reintento de cuota').waitFor();
  assert.equal(await row(a,'Reintento de cuota').count(),1);
  if(process.env.IWISH_E1_DIR&&process.env.IWISH_AUDIT_DIR){
   const [previous,audited]=await Promise.all([process.env.IWISH_E1_DIR,process.env.IWISH_AUDIT_DIR].map(folder=>fs.readFile(path.join(folder,'planner-store.js'),'utf8')));
   const result=await a.evaluate(({previous,audited})=>{
    const main='iwish_connected_v1:guest',old='iwish_v5:guest';
    const initial=localStorage.getItem('iwish_e2:local:guest');
    const row={id:'e1000000-0000-4000-8000-000000000000',amount:25};
    localStorage.setItem(main,JSON.stringify({data:{transactions:{[row.id]:row}}}));
    localStorage.setItem(old,JSON.stringify({transactions:[{...row,amount:10}]}));
    const openOlder=source=>{
     const frame=document.createElement('iframe');
     document.body.append(frame);
     frame.contentWindow.IWishCore=window.IWishCore;
     frame.contentWindow.eval(source);
     const store=new frame.contentWindow.IWishStore({client:null});
     store.scope('guest',JSON.parse(localStorage.getItem(old)));
     const amount=store.legacy().transactions[0].amount;
     frame.remove();
     return amount;
    };
    const e1=openOlder(previous);
    const audit=openOlder(audited);
    return {e1,audit,e2Unchanged:localStorage.getItem('iwish_e2:local:guest')===initial};
   },{previous,audited});
   assert.deepEqual(result,{e1:25,audit:10,e2Unchanged:true});
   await a.reload();
   await enter(a);
   await row(a,'Reintento de cuota').waitFor();
   console.log('OK Chromium: E1 conserva 25, base auditada vuelve a 10 y E2 permanece intacta.');
  }
  assert.deepEqual(errors,[]);
  console.log('OK Chromium: fallo inyectado de cuota y reintento.');
 }finally{await browser?.close();server.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
