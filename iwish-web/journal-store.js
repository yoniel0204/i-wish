/* I Wish Diario: almacenamiento por cuenta, cola durable y versiones del servidor. */
(() => {
  'use strict';
  const uuid = () => crypto.randomUUID();
  const moods = ['feliz','tranquilo','triste','preocupado','cansado'];
  const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number(s.slice(0,4)) >= 1 && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
  const validId = id => typeof id==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  function cleanBook(value) {
    if(!value || typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>120||typeof value.purpose!=='string'||!value.purpose.trim()||value.purpose.trim().length>500)throw Error('Escribe un nombre y un propósito para tu diario.');
    return {name:value.name.trim(),purpose:value.purpose.trim()};
  }
  function clean(value) {
    if (!value || typeof value.title !== 'string' || value.title.length > 200 || typeof value.content !== 'string' || value.content.length > 100000 || !value.content.trim() || !validDate(value.entry_date) || (value.mood !== null && !moods.includes(value.mood))) throw Error('Revisa el contenido, la fecha y el estado de ánimo.');
    if(value.notebook_id!=null&&!validId(value.notebook_id))throw Error('El diario no es válido.');
    return {title:value.title, content:value.content, entry_date:value.entry_date, mood:value.mood,notebook_id:value.notebook_id||null};
  }
  class JournalStore {
    constructor({client, storage=localStorage, onChange=()=>{}, online=()=>navigator.onLine, namespace=''}) {
      this.client=client; this.storage=storage; this.onChange=onChange; this.online=online; this.namespace=namespace;
      this.owner=null; this.generation=0; this.busy=false; this.error='';
    }
    scope(owner) { if (owner===this.owner) return; this.owner=owner; this.generation++; this.busy=false; this.error=''; this.onChange(); }
    prefix() { if (!this.owner) throw Error('Inicia sesión para usar tu Diario privado.'); return `iwish_diary_v1:${this.namespace}:${this.owner}:`; }
    read(key, fallback=null) { const raw=this.storage.getItem(this.prefix()+key); return raw ? JSON.parse(raw) : fallback; }
    write(key,value) { this.storage.setItem(this.prefix()+key,JSON.stringify(value)); }
    remove(key) { this.storage.removeItem(this.prefix()+key); }
    items(type) {
      if (!this.owner) return [];
      const prefix=this.prefix()+type+':', rows=[];
      for(let i=0;i<this.storage.length;i++) { const key=this.storage.key(i); if(key?.startsWith(prefix)) rows.push(JSON.parse(this.storage.getItem(key))); }
      return rows;
    }
    pending() { return this.items('op').sort((a,b)=>a.created.localeCompare(b.created)||a.mutation.localeCompare(b.mutation)); }
    hasPending() { return this.pending().length>0 || this.items('notebook-op').length>0; }
    createNotebook(value) {
      const book={...cleanBook(value),id:uuid(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      this.write('notebook-op:'+book.id,book);this.onChange();return book;
    }
    notebooks() {
      const books=new Map(this.items('notebook').map(b=>[b.id,{...b}]));
      for(const b of this.items('notebook-op'))books.set(b.id,{...b,_pending:true});
      const rows=this.rows(), drafts=this.drafts();
      if(rows.some(r=>!r.notebook_id)||drafts.some(d=>!d.notebook_id))books.set(null,{id:null,name:'Mi diario',purpose:'',created_at:'',updated_at:'',legacy:true});
      for(const book of books.values()) {
        const entries=rows.filter(r=>(r.notebook_id||null)===book.id), localDrafts=drafts.filter(d=>(d.notebook_id||null)===book.id);
        book.count=entries.filter(r=>!r.deleted_at).length;book.draftCount=localDrafts.length;
        book.updated_at=[book.updated_at,...entries.map(r=>r.updated_at||r.created_at),...localDrafts.map(d=>d.saved_at)].filter(Boolean).sort().at(-1)||book.created_at;
        book._pending=book._pending||entries.some(r=>r._pending);
      }
      return [...books.values()];
    }
    drafts() { return this.items('draft').sort((a,b)=>b.saved_at.localeCompare(a.saved_at)); }
    putDraft(draft) { this.write('draft:'+draft.draftId,{...draft,saved_at:new Date().toISOString()}); }
    deleteDraft(id) { this.remove('draft:'+id); this.onChange(); }
    cache(row) {
      const current=this.read('entry:'+row.id);
      if (!current || current.version <= row.version) this.write('entry:'+row.id,row);
    }
    rows() {
      const map=new Map(this.items('entry').map(e=>[e.id,{...e}]));
      const ops=this.pending(); const visited=new Set();
      // Topological order preserves several offline edits even within one millisecond.
      const add = op => {
        if(visited.has(op.mutation)) return; visited.add(op.mutation);
        const parent=ops.find(o=>o.mutation===op.depends); if(parent) add(parent);
        map.set(op.id,{...op.value,id:op.id,version:op.base,created_at:op.created,deleted_at:op.delete?op.created:null,_pending:op.mutation,_conflict:!!op.conflict});
      };
      ops.forEach(add);
      for (const op of ops.filter(o=>o.conflict)) { const row=map.get(op.id); if(row) row._conflict=true; }
      return [...map.values()].sort((a,b)=>b.entry_date.localeCompare(a.entry_date)||b.created_at.localeCompare(a.created_at)||a.id.localeCompare(b.id));
    }
    enqueue(value, {id=uuid(),base=0,depends=null,deleted=false}={}) {
      const fields=clean(value);
      const op={id,base,depends,delete:deleted,value:fields,mutation:uuid(),created:new Date().toISOString()};
      this.write('op:'+op.mutation,op); this.onChange(); return op;
    }
    export() { return this.owner ? {version:2,owner_id:this.owner,project:this.namespace,notebooks:this.notebooks().filter(b=>b.id),entries:this.items('entry'),pending:this.pending(),drafts:this.drafts()} : null; }
    validateBackup(data) {
      if(data==null) return;
      if(!this.owner) throw Error('Inicia sesión para importar el Diario.');
      if(![1,2].includes(data.version) || !Array.isArray(data.entries) || !Array.isArray(data.pending) || !Array.isArray(data.drafts)) throw Error('El respaldo del Diario no es válido.');
      if(data.version===2){if(!Array.isArray(data.notebooks))throw Error('Respaldo de diarios inválido.');for(const book of data.notebooks){cleanBook(book);if(!validId(book.id))throw Error('Diario inválido.');}}
      const known=new Set((data.notebooks||[]).map(b=>b.id));
      for(const row of [...data.entries,...data.pending.map(o=>o.value),...data.drafts])if(row?.notebook_id&&!known.has(row.notebook_id))throw Error('Falta un diario en el respaldo.');
      for(const row of data.entries) if(!row.deleted_at) clean(row);
      for(const op of data.pending) { if(!op.delete) clean(op.value); if(typeof op.id!=='string') throw Error('Respaldo inválido.'); }
      for(const d of data.drafts) if(typeof d.content!=='string'||d.content.length>100000||typeof d.title!=='string'||d.title.length>200||!validDate(d.entry_date)||(d.mood!==null&&!moods.includes(d.mood))) throw Error('Borrador inválido.');
    }
    importBackup(data) {
      if(!data) return {entries:0,drafts:0};
      this.validateBackup(data);
      const bookMap=new Map();
      for(const book of data.notebooks||[]) {
        const key='importbook:'+String(data.project||'')+':'+String(data.owner_id||'')+':'+book.id;
        const previous=this.read(key), own=data.owner_id===this.owner&&data.project===this.namespace;
        const existing=this.notebooks().find(b=>b.id===(previous?.id||(own?book.id:null)));
        const target=existing||this.createNotebook(book);bookMap.set(book.id,target.id);this.write(key,{id:target.id});
      }
      const remap=row=>({...row,notebook_id:bookMap.get(row.notebook_id)||null});
      // Importación como copias: nunca aplica eliminaciones ni sobrescribe entradas actuales.
      const rows=new Map(data.entries.filter(e=>!e.deleted_at).map(e=>[e.id,e]));
      data.pending.forEach(op=>op.delete?rows.delete(op.id):rows.set(op.id,op.value));
      let count=0, drafts=0;
      for(const row of rows.values()) {
        const value=clean(remap(row)), fingerprint=JSON.stringify(value);
        if(this.rows().some(r=>!r.deleted_at&&JSON.stringify(clean(r))===fingerprint)) continue;
        this.enqueue(value); count++;
      }
      for(const d of data.drafts) {
        if(this.drafts().some(x=>x.title===d.title&&x.content===d.content&&x.entry_date===d.entry_date&&x.mood===d.mood&&(x.notebook_id||null)===(bookMap.get(d.notebook_id)||null))) continue;
        this.putDraft({notebook_id:bookMap.get(d.notebook_id)||null,title:d.title,content:d.content,entry_date:d.entry_date,mood:d.mood,id:uuid(),base:0,depends:null,draftId:uuid()}); drafts++;
      }
      this.onChange(); return {entries:count,drafts};
    }
    resolve(id, keepCopy) {
      const ops=this.pending().filter(o=>o.id===id), row=this.rows().find(r=>r.id===id);
      if(!ops.some(o=>o.conflict)) return;
      if(keepCopy && row) this.enqueue(row); // Persist copy before removing anything.
      for(const op of ops) this.remove('op:'+op.mutation);
      this.onChange();
    }
    async sync() {
      if(!this.owner||!this.client||!this.online()||this.busy) return false;
      const owner=this.owner,generation=this.generation;
      const current=()=>this.owner===owner&&this.generation===generation;
      this.busy=true; this.error=''; this.onChange();
      const run=async()=>{
        if(!current()) return;
        // Create notebooks before their queued entries; each UUID is idempotent.
        for(const book of this.items('notebook-op')) {
          const response=await this.client.rpc('iwish_create_journal_notebook',{p_owner_id:owner,p_id:book.id,p_name:book.name,p_purpose:book.purpose});
          if(!current())return;if(response.error)throw response.error;
          if(response.data?.user_id!==owner)throw Error('Cuenta inesperada.');
          this.write('notebook:'+book.id,response.data);this.remove('notebook-op:'+book.id);
        }
        for(let start=0;;start+=500){
          const response=await this.client.from('journal_notebooks').select('*').eq('user_id',owner).order('id').range(start,start+499);
          if(!current())return;if(response.error)throw response.error;
          for(const book of response.data||[])this.write('notebook:'+book.id,book);
          if((response.data||[]).length<500)break;
        }
        // Pull all pages, including tombstones. Never infer deletion from a missing page.
        for(let start=0;;start+=500) {
          const result=await this.client.from('journal_entries').select('*').eq('user_id',owner).order('id').range(start,start+499);
          if(!current()) return;
          if(result.error) throw result.error;
          for(const row of result.data||[]) this.cache(row);
          if((result.data||[]).length<500) break;
        }
        const queue=this.pending();
        for(let pass=0;pass<=queue.length;pass++) {
          let progress=false;
          for(const original of queue) {
            const op=this.read('op:'+original.mutation);
            if(!op||op.conflict) continue;
            if(op.depends) {
              const parent=this.read('op:'+op.depends);
              if(parent) continue;
              const receipt=this.read('receipt:'+op.depends);
              if(!receipt) { op.conflict=true; op.server=this.read('entry:'+op.id); this.write('op:'+op.mutation,op); continue; }
              op.base=receipt.version; op.depends=null; this.write('op:'+op.mutation,op);
            }
            const result=await this.client.rpc('iwish_save_journal',{p_owner_id:owner,p_id:op.id,p_base_version:op.base,p_mutation:op.mutation,p_title:op.value.title,p_date:op.value.entry_date,p_content:op.value.content,p_mood:op.value.mood,p_delete:op.delete,p_notebook_id:op.value.notebook_id||null});
            if(!current()) return;
            if(result.error) throw result.error;
            const answer=result.data;
            if(answer?.status==='saved' && answer.entry?.user_id===owner) {
              this.cache(answer.entry);
              this.write('receipt:'+op.mutation,{version:answer.entry.version});
              this.remove('op:'+op.mutation); progress=true;
            } else if(answer?.status==='conflict') {
              if(answer.entry) this.cache(answer.entry);
              op.conflict=true; op.server=answer.entry; this.write('op:'+op.mutation,op);
            } else throw Error('Respuesta inesperada al sincronizar.');
            this.onChange();
          }
          if(!progress) break;
        }
      };
      try {
        if(globalThis.navigator?.locks) await navigator.locks.request('iwish-journal-sync:'+this.namespace+':'+owner,run); else await run();
        return current()&&!this.hasPending();
      } catch(error) {
        if(current()) this.error=error.code==='42P01'||error.code==='PGRST202'||error.code==='PGRST205'?'Falta activar Diario en Supabase. Tus cambios siguen en este dispositivo.':'No se pudo sincronizar. Tus cambios siguen en este dispositivo; vuelve a intentarlo.';
        return false;
      } finally { if(current()) {this.busy=false;this.onChange();} }
    }
  }
  window.IWishJournalStore=JournalStore;
})();
