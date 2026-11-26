/* Regresiones de guardado. Node.js, sin red. DOM y Storage simulados. */
const test=require('node:test');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../iwish-web'));

class MemoryStorage{
 constructor(){
  this.map=new Map();this.fail=null;
  const pending=new Map();
  this.locks={request(key,fn){
   const result=(pending.get(key)||Promise.resolve()).then(fn);
   pending.set(key,result.catch(()=>{}));
   return result;
  }};
 }
 get length(){return this.map.size;} key(i){return [...this.map.keys()][i]??null;}
 getItem(k){return this.map.get(k)??null;}
 setItem(k,v){if(this.fail?.(k,v))throw Error('QuotaExceededError');this.map.set(k,String(v));}
 removeItem(k){this.map.delete(k);}
}
class Node{
 constructor(){this.value='';this.textContent='';this.innerHTML='';this.children=[];this.dataset={};this.style={};this.elements={};this.handlers={};this.open=false;this.classList={add(){},remove(){},toggle(){},contains(){return false;}};}
 addEventListener(t,fn){(this.handlers[t]??=[]).push(fn);}
 emit(t,e={}){return Promise.all((this.handlers[t]||[]).map(fn=>fn({preventDefault(){},target:this,currentTarget:this,...e})));}
 replaceChildren(...v){this.children=v;} append(...v){this.children.push(...v);}
 setAttribute(){} removeAttribute(){} focus(){} reset(){} close(){this.open=false;} showModal(){this.open=true;}
 querySelectorAll(){return [];} querySelector(){return null;} insertAdjacentHTML(){} click(){} scrollIntoView(){}
}
function env(storage=new MemoryStorage()){
 const nodes=new Map(),document={getElementById(id){if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);},createElement(){return new Node();},querySelectorAll(){return [];},querySelector(){return new Node();},addEventListener(){},body:new Node(),documentElement:new Node(),hidden:false,activeElement:null};
 const ctx={console,structuredClone,URL,Blob,TextEncoder,crypto:webcrypto,localStorage:storage,document,navigator:{onLine:false,locks:storage.locks},location:{origin:'https://local.invalid'},matchMedia:()=>({matches:false}),setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},confirm:()=>true,requestAnimationFrame:fn=>fn()};
 ctx.window=ctx;ctx.globalThis=ctx;ctx.addEventListener=()=>{};ctx.scrollTo=()=>{};
 vm.createContext(ctx);
 const load=(name,change=s=>s)=>vm.runInContext(change(fs.readFileSync(path.join(root,name),'utf8')),ctx,{filename:name});
 load('planner-core.js');load('planner-store.js');load('routine-core.js');load('journal-store.js');
 return {ctx,load,storage,nodes,document};
}
function appEnv(storage){const e=env(storage);e.load('app.js',s=>s.replace('  boot();',`  renderAll=()=>{};
  window.audit={state,switchDataScope,openModal,setStore:x=>store=x,softDelete,toggleWish,toggleEvent,setTheme,refreshLocal};
  bindEvents();`));return {...e,app:e.ctx.audit};}
const id=n=>String(n).padStart(8,'0')+'-0000-4000-8000-000000000000';
const transaction=(n,amount=10)=>({id:id(n),type:'expense',amount,category:'Comida',description:'Prueba',transaction_date:'2026-10-29',created_at:'2026-10-29T12:00:00Z',updated_at:'2026-10-29T12:00:00Z',deleted_at:null});

function openApp(storage, owner='A', namespace='project-a'){
 const e=appEnv(storage);
 const store=new e.ctx.IWishStore({client:null,storage:e.storage,namespace,syncBuckets:['events'],onChange:e.app.refreshLocal});
 e.app.setStore(store);
 assert.equal(e.app.switchDataScope(owner&&{user:{id:owner}}),true);
 return {...e,store};
}

function form(e,type,fields,item){
 const fieldsNode=e.document.getElementById('modal-fields');
 const formNode=e.document.getElementById('modal-form');
 fieldsNode.querySelector=()=>new Node();
 for(const key of Object.keys(fields))formNode.elements[key]=new Node();
 e.app.openModal(type,item);
 e.ctx.FormData=class{constructor(){return Object.entries(fields);}};
 return ()=>e.document.getElementById('modal-form').emit('submit');
}

const wishFields={title:'Tarea de prueba',category:'personal',priority:'1',deadline:''};

const agendaFields={title:'Actividad de prueba',kind:'task',description:'Texto inicial',starts_at:'2026-11-04T18:00',reminder_minutes:'30',priority:'1'};

test('dos pestañas guardan tareas independientes y tema sin sobrescribir deseos',async()=>{
 const a=openApp(),b=openApp(a.storage);
 await form(a,'wish',wishFields)();
 await Promise.all([form(a,'event',agendaFields)(),form(b,'event',{...agendaFields,title:'Pestaña B'})(),b.app.setTheme(true)]);
 const c=openApp(a.storage);
 assert.deepEqual(Array.from(c.app.state.events,row=>row.title).sort(),['Actividad de prueba','Pestaña B']);
 assert.equal(c.app.state.wishes[0].title,wishFields.title);
 assert.equal(c.app.state.dark,true);
});

test('la edición abierta no reemplaza una versión nueva ni restaura un borrado',async()=>{
 const a=openApp();
 await form(a,'event',agendaFields)();
 for(const remove of [false,true]){
  const b=openApp(a.storage);
  const row=b.app.state.events[0];
  const draft=form(b,'event',{...agendaFields,title:'Borrador de B'},row);
  if(remove)await a.app.softDelete('events',row.id);
  else await form(a,'event',{...agendaFields,title:'Versión más reciente'},a.app.state.events[0])();
  await draft();
  assert.equal(b.document.getElementById('form-modal').open,true);
  assert.match(b.document.getElementById('modal-error').textContent,/cambió o se eliminó/);
  const [current]=openApp(a.storage).app.state.events;
  assert.equal(current.title,'Versión más reciente');
  assert.equal(!!current.deleted_at,remove);
 }
});

test('proyecto y usuario aíslan los datos, incluso con el mismo identificador de usuario',async()=>{
 const a=openApp();
 await form(a,'event',agendaFields)();
 assert.equal(openApp(a.storage,'B').app.state.events.length,0);
 assert.equal(openApp(a.storage,'A','project-b').store.changes().length,0);
 assert.equal(openApp(a.storage,'A','project-b').app.state.events.length,0);
 assert.equal(openApp(a.storage).app.state.events.length,1);
});

test('retroceso no toca la nueva versión y la nueva ignora copias antiguas de 10',async()=>{
 const storage=new MemoryStorage();
 const key='iwish_connected_v1:A',v5='iwish_v5:A';
 storage.setItem(key,JSON.stringify({data:{transactions:{[id(1)]:transaction(1,25)}}}));
 const canonical=storage.getItem(key);
 storage.setItem(v5,JSON.stringify({transactions:[transaction(1,10)]}));
 const e=openApp(storage);
 assert.equal(e.app.state.transactions.length,0);
 await e.store.mutate(({data})=>{data.transactions[id(1)]=transaction(1,25);});
 assert.equal(storage.getItem(key),canonical);
 // Emula la sobrescritura 25→10 del almacén auditado al volver a abrirlo.
 storage.setItem(key,JSON.stringify({data:{transactions:{[id(1)]:transaction(1,10)}}}));
 assert.equal(openApp(storage).app.state.transactions[0].amount,25);
 assert.equal(JSON.parse(storage.getItem(v5)).transactions[0].amount,10);
});

test('crear con cuota agotada deja diálogo y datos sin cambios y reintentar guarda una vez',async()=>{
 const e=openApp();
 const submit=form(e,'wish',wishFields);
 const fields=e.document.getElementById('modal-fields'),markup=fields.innerHTML;
 e.storage.fail=()=>true;
 await submit();
 assert.equal(e.document.getElementById('form-modal').open,true);
 assert.equal(fields.innerHTML,markup);
 assert.match(e.document.getElementById('modal-error').textContent,/No se pudo guardar/);
 assert.equal(e.app.state.wishes.length,0);
 assert.equal(openApp(e.storage).app.state.wishes.length,0);
 e.storage.fail=null;
 await submit();
 assert.equal(e.document.getElementById('form-modal').open,false);
 assert.equal(openApp(e.storage).app.state.wishes.length,1);
});

test('editar y completar un deseo o eliminarlo con cuota agotada conserva su valor',async()=>{
 const e=openApp();
 await form(e,'wish',wishFields)();
 const row=e.app.state.wishes[0];
 e.storage.fail=()=>true;
 await form(e,'wish',{...wishFields,title:'Cambio no confirmado'},row)();
 await e.app.toggleWish(row.id);
 await e.app.softDelete('wishes',row.id);
 assert.equal(e.app.state.wishes[0].title,wishFields.title);
 const persisted=openApp(e.storage).app.state.wishes[0];
 assert.equal(persisted.title,wishFields.title);
 assert.equal(persisted.completed,false);
 assert.equal(persisted.deleted_at,null);
 e.storage.fail=null;
 await e.app.toggleWish(row.id);
 await e.app.softDelete('wishes',row.id);
 const updated=openApp(e.storage).app.state.wishes[0];
 assert.equal(updated.completed,true);
 assert.ok(updated.deleted_at);
});

test('agenda conserva historial al fallar el guardado y lo registra una vez al reintentar',async()=>{
 const e=openApp();
 await form(e,'event',{title:'Prueba agenda',kind:'task',description:'',starts_at:'2026-11-04T18:00',reminder_minutes:'30',priority:'1'})();
 const row=e.app.state.events[0];
 e.storage.fail=()=>true;
 await e.app.toggleEvent(row.id);
 assert.equal(openApp(e.storage).app.state.events[0].history.length,0);
 e.storage.fail=null;
 await e.app.toggleEvent(row.id);
 const reopened=openApp(e.storage).app.state.events[0];
 assert.equal(reopened.completed,true);
 assert.equal(reopened.history.length,1);
});

test('respuesta de sync con escritura fallida mantiene datos y cambios pendientes',async()=>{
 const e=openApp();
 await form(e,'event',agendaFields)();
 const [row]=e.app.state.events;
 e.store.online=()=>true;
 e.store.client={rpc:async()=>({data:{rows:[{bucket:'events',id:row.id,value:row}],conflicts:[]}})};
 e.storage.fail=()=>true;
 await e.store.sync();
 assert.match(e.store.error,/No se pudo guardar/);
 assert.equal(e.store.changes().length,1);
 assert.equal(openApp(e.storage).store.changes().length,1);
 e.storage.fail=null;
 await e.store.sync();
 assert.equal(openApp(e.storage).store.changes().length,0);
});
