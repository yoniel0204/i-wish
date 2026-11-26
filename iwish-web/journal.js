(() => {
  'use strict';
  window.createIWishJournal = ({client,namespace,toast,onStatus=()=>{}}) => {
    const $=id=>document.getElementById(id), uuid=()=>crypto.randomUUID();
    const moods={feliz:'Feliz',tranquilo:'Tranquilo',triste:'Triste',preocupado:'Preocupado',cansado:'Cansado'};
    const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
    const dateText=s=>s?new Date(s.length===10?s+'T12:00:00':s).toLocaleDateString('es-PA',{day:'numeric',month:'long',year:'numeric'}):'';
    const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
    const button=(label,action,kind='secondary')=>{const b=el('button',label,'btn '+kind);b.type='button';b.addEventListener('click',action);return b;};
    let screen='home',selected=undefined,editor=null,viewer=null,dirty=false,storageError='';
    const store=new window.IWishJournalStore({client,namespace:'e2:'+namespace,onChange:()=>{render();onStatus();}});
    const inBook=r=>(r.notebook_id||null)===selected;
    const currentBook=()=>store.notebooks().find(b=>b.id===selected);
    function safely(fn){try{const result=fn();storageError='';return result;}catch(e){storageError='No se pudo guardar en este dispositivo. Conserva tu texto antes de cerrar.';toast(storageError);renderStatus();return false;}}
    function fields(){return {title:$('journal-title').value,entry_date:editor?.entry_date||today(),content:$('journal-content').value,mood:$('journal-mood').value||null,notebook_id:editor?.notebook_id||null};}
    function capture(){if(!editor||!store.owner)return;Object.assign(editor,fields());dirty=true;safely(()=>store.putDraft(editor));renderStatus();}
    function release(){if(editor&&dirty)capture();editor=null;dirty=false;$('journal-form').reset();}
    function show(next){screen=next;document.body.classList.toggle('journal-writing',next==='editor'||next==='reader');render();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
    function home(){release();selected=undefined;viewer=null;show('home');}
    function library(){release();viewer=null;show('library');}
    function create(){release();if(!store.owner){toast('Inicia sesión para crear un diario.');return;}const draft=store.read('notebook-draft',{});$('journal-name').value=draft.name||'';$('journal-purpose').value=draft.purpose||'';show('create');$('journal-name').focus();}
    function openBook(id){release();selected=id;viewer=null;$('journal-search').value='';$('journal-month').value='';show('book');}
    function openEditor(row=null,draft=null){
      if(!store.owner){toast('Inicia sesión para escribir.');return;}
      if(selected===undefined){create();return;}
      release();
      editor=draft?{...draft,draftId:uuid(),recoveredFrom:draft.draftId}:{id:row?.id||uuid(),base:row?.version||0,depends:row?._pending||null,draftId:uuid(),title:row?.title||'',content:row?.content||'',entry_date:row?.entry_date||today(),mood:row?.mood||null,notebook_id:selected};
      dirty=!!draft;storageError='';
      $('journal-title').value=editor.title;$('journal-content').value=editor.content;$('journal-mood').value=editor.mood||'';
      $('journal-date').textContent=dateText(editor.entry_date);$('journal-editor-book').textContent=currentBook()?.name||'Mi diario';
      if(draft)safely(()=>store.putDraft(editor));viewer=null;show('editor');$('journal-content').focus({preventScroll:true});
    }
    function closeEditor(){release();show('book');}
    function readEntry(id){release();viewer=id;show('reader');}
    function removeEntry(id){
      const row=store.rows().find(r=>r.id===id);if(!row||row._conflict)return;
      if(!confirm('¿Eliminar esta entrada?'))return;
      const result=safely(()=>store.enqueue(row,{id,base:row.version,depends:row._pending||null,deleted:true}));
      if(result===false)return;viewer=null;show('book');store.sync();
    }
    function renderStatus(){
      const row=editor&&store.rows().find(r=>r.id===editor.id);
      const message=storageError||(dirty?'Borrador guardado en este dispositivo':row?._conflict?'Guardado aquí · cambios por revisar':row?._pending?'Entrada guardada aquí · pendiente de sincronizar':row?'Guardado en tu cuenta':store.error?'Puedes escribir; se guardará en este dispositivo':'');
      $('journal-save-status').textContent=message;
      $('journal-error').textContent=storageError||store.error;
      $('journal-error').classList.toggle('hidden',!storageError&&!store.error);
      $('journal-sync').disabled=store.busy;
      $('journal-sync').textContent=store.busy?'Sincronizando…':store.hasPending()?'Pendiente de sincronizar':'Sincronizar';
    }
    function renderLibrary(){
      const search=$('journal-book-search').value.trim().toLocaleLowerCase('es'),order=$('journal-book-sort').value||'edited-desc';
      let books=store.notebooks().filter(b=>b.name.toLocaleLowerCase('es').includes(search));
      books.sort((a,b)=>order==='name-asc'?a.name.localeCompare(b.name,'es',{sensitivity:'base'}):order==='name-desc'?b.name.localeCompare(a.name,'es',{sensitivity:'base'}):order==='edited-asc'?a.updated_at.localeCompare(b.updated_at):b.updated_at.localeCompare(a.updated_at)||a.name.localeCompare(b.name,'es'));
      const list=$('journal-books');list.replaceChildren();
      if(!books.length){const empty=el('div',undefined,'journal-empty');empty.append(el('p',search?'No hay diarios con ese nombre.':'Todavía no tienes diarios.'));if(!search)empty.append(button('Nuevo diario',create,'primary'));list.append(empty);}
      for(const book of books){
        const b=el('button',undefined,'journal-book-card');b.type='button';b.addEventListener('click',()=>openBook(book.id));
        b.append(el('span',book.draftCount?'Borrador disponible':`${book.count} ${book.count===1?'entrada':'entradas'}`,'journal-book-kicker'),el('h3',book.name));
        if(book.purpose)b.append(el('p',book.purpose,'journal-book-purpose'));
        const foot=el('span',undefined,'journal-book-foot');foot.append(el('span',(book._pending?'Pendiente · ':'Editado · ')+dateText(book.updated_at)),el('span','↗','journal-book-arrow'));b.append(foot);list.append(b);
      }
    }
    function renderDrafts(){
      const list=$('journal-drafts');list.replaceChildren();
      for(const d of store.drafts().filter(inBook)){
        const card=el('div',undefined,'journal-draft');card.append(el('span',`Borrador · ${d.title||dateText(d.entry_date)}`),button('Continuar',()=>openEditor(null,d)),button('Descartar',()=>{if(confirm('¿Descartar este borrador?'))safely(()=>store.deleteDraft(d.draftId));}));list.append(card);
      }
    }
    function renderConflicts(){
      const box=$('journal-conflicts');box.replaceChildren();
      const ids=[...new Set(store.pending().filter(o=>o.conflict&&inBook(o.value)).map(o=>o.id))];
      for(const id of ids){
        const op=store.pending().find(o=>o.id===id&&o.conflict),local=store.rows().find(r=>r.id===id),remote=store.read('entry:'+id)||op.server;
        const card=el('article',undefined,'panel journal-conflict');card.append(el('h3','Esta entrada tiene dos versiones'));
        const comparison=el('div',undefined,'journal-comparison');
        for(const [label,row] of [['Tus cambios',local],['En tu cuenta',remote]]){const part=el('div');part.append(el('h4',label),el('strong',row?.title||''),el('p',row?.deleted_at?'Entrada eliminada':row?.content||'No disponible','journal-text'));comparison.append(part);}
        const actions=el('div',undefined,'button-row');actions.append(button('Conservar ambas',()=>{safely(()=>store.resolve(id,true));store.sync();},'primary'),button('Usar la de mi cuenta',()=>{if(confirm('¿Descartar tus cambios pendientes y usar la versión de tu cuenta?'))safely(()=>store.resolve(id,false));}));card.append(comparison,actions);box.append(card);
      }
    }
    function renderBook(){
      const book=currentBook();$('journal-book-name').textContent=book?.name||'Mi diario';$('journal-book-purpose').textContent=book?.purpose||'';
      renderDrafts();renderConflicts();
      const search=$('journal-search').value.trim().toLocaleLowerCase('es'),month=$('journal-month').value;
      const rows=store.rows().filter(r=>inBook(r)&&!r.deleted_at&&(!month||r.entry_date.startsWith(month))&&(!search||(r.title+'\n'+r.content).toLocaleLowerCase('es').includes(search)));
      const list=$('journal-list');list.replaceChildren();
      if(!rows.length){const empty=el('div',undefined,'journal-empty');empty.append(el('p',search||month?'No hay entradas con estos filtros.':'Tu primera página te espera.'));if(!search&&!month)empty.append(button('Escribir',()=>openEditor(),'primary'));list.append(empty);}
      for(const row of rows){const b=el('button',undefined,'journal-entry-row');b.type='button';b.addEventListener('click',()=>readEntry(row.id));
        const head=el('span',undefined,'journal-entry-head');head.append(el('span',dateText(row.entry_date),'journal-meta'));if(row._pending||row._conflict)head.append(el('span',row._conflict?'Revisar cambios':'Pendiente','journal-state'));
        b.append(head,el('h3',row.title||dateText(row.entry_date)),el('p',row.content.slice(0,180),'journal-preview'));list.append(b);
      }
    }
    function renderReader(){
      const row=store.rows().find(r=>r.id===viewer&&!r.deleted_at);if(!row){viewer=null;screen='book';render();return;}
      $('journal-reader-title').textContent=row.title||'';$('journal-reader-meta').textContent=dateText(row.entry_date)+(row.mood?' · '+moods[row.mood]:'');$('journal-reader-content').textContent=row.content;
      $('journal-reader-status').textContent=row._conflict?'Cambios por revisar':row._pending?'Pendiente de sincronizar':'Guardado en tu cuenta';
      $('journal-reader-actions').replaceChildren();
      if(!row._conflict)$('journal-reader-actions').append(button('Editar',()=>openEditor(store.rows().find(r=>r.id===viewer)),'primary'),button('Eliminar',()=>removeEntry(viewer),'danger'));
      else $('journal-reader-actions').append(button('Revisar versiones',()=>show('book'),'primary'));
    }
    function render(){
      try{
        const signed=!!store.owner;$('journal-guest').classList.toggle('hidden',signed);$('journal-private').classList.toggle('hidden',!signed);
        for(const name of ['home','create','library','book','editor','reader'])$('journal-'+name).classList.toggle('hidden',!signed||screen!==name);
        if(!signed)return;
        if(screen==='library')renderLibrary();if(screen==='book')renderBook();if(screen==='reader')renderReader();renderStatus();
      }catch(e){storageError='No se pudo leer el Diario de este dispositivo. Conserva un respaldo.';$('journal-error').textContent=storageError;$('journal-error').classList.remove('hidden');}
    }
    $('journal-new').addEventListener('click',create);$('journal-continue').addEventListener('click',library);
    document.querySelectorAll('[data-journal-home]').forEach(b=>b.addEventListener('click',home));document.querySelectorAll('[data-journal-library]').forEach(b=>b.addEventListener('click',library));
    $('journal-library-new').addEventListener('click',create);$('journal-write').addEventListener('click',()=>openEditor());$('journal-reader-back').addEventListener('click',()=>show('book'));
    $('journal-book-form').addEventListener('input',()=>{if(store.owner)safely(()=>store.write('notebook-draft',{name:$('journal-name').value,purpose:$('journal-purpose').value}));});
    $('journal-book-form').addEventListener('submit',event=>{
      event.preventDefault();if(!store.owner)return;
      try{const book=store.createNotebook({name:$('journal-name').value,purpose:$('journal-purpose').value});store.remove('notebook-draft');$('journal-book-form').reset();selected=book.id;openEditor();store.sync();}catch(e){toast(e.message);}
    });
    $('journal-form').addEventListener('input',capture);$('journal-form').addEventListener('change',capture);
    $('journal-editor-close').addEventListener('click',closeEditor);
    $('journal-discard').addEventListener('click',()=>{if(editor&&confirm('¿Descartar este borrador?')){safely(()=>store.deleteDraft(editor.draftId));dirty=false;closeEditor();}});
    $('journal-form').addEventListener('submit',event=>{
      event.preventDefault();if(!editor||!store.owner||(!dirty&&store.rows().some(r=>r.id===editor.id)))return;
      capture();if(storageError)return;
      try{
        const op=store.enqueue(fields(),{id:editor.id,base:editor.base,depends:editor.depends});store.deleteDraft(editor.draftId);
        if(editor.recoveredFrom){const original=store.read('draft:'+editor.recoveredFrom);if(original&&original.saved_at===editor.saved_at)store.deleteDraft(editor.recoveredFrom);}
        editor={...editor,depends:op.mutation,draftId:uuid(),recoveredFrom:null};dirty=false;renderStatus();store.sync();
      }catch(e){toast(e.message);}
    });
    for(const id of ['journal-book-search','journal-search'])$(id).addEventListener('input',render);
    for(const id of ['journal-book-sort','journal-month'])$(id).addEventListener('change',render);
    $('journal-clear-month').addEventListener('click',()=>{$('journal-month').value='';render();});$('journal-sync').addEventListener('click',()=>store.sync());
    window.addEventListener('online',()=>store.sync());window.addEventListener('offline',render);window.addEventListener('focus',()=>store.sync());window.addEventListener('storage',e=>{if(store.owner&&e.key?.startsWith(store.prefix()))render();});
    window.addEventListener('beforeunload',event=>{if(editor&&dirty)capture();if(storageError){event.preventDefault();event.returnValue='';}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&editor&&dirty)capture();});setInterval(()=>{if(!document.hidden)store.sync();},30000);
    return {store,render,home,leave:()=>{release();document.body.classList.remove('journal-writing');},newEntry:()=>selected===undefined?create():openEditor(),sync:()=>store.sync(),export:()=>store.export(),validateBackup:d=>store.validateBackup(d),importBackup:d=>store.importBackup(d),
      scope(owner){
        if(owner===store.owner)return;release();selected=undefined;viewer=null;dirty=false;storageError='';screen='home';document.body.classList.remove('journal-writing');
        $('journal-book-form').reset();$('journal-form').reset();
        for(const id of ['journal-reader-title','journal-reader-content','journal-reader-meta','journal-reader-status','journal-reader-actions','journal-books','journal-list','journal-drafts','journal-conflicts','journal-book-name','journal-book-purpose','journal-editor-book','journal-date','journal-save-status','journal-error'])$(id).replaceChildren();
        $('journal-book-search').value='';$('journal-search').value='';$('journal-month').value='';store.scope(owner);
      }
    };
  };
})();
