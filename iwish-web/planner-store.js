/* Guardado coordinado por espacio. El servidor recibe solo las colecciones configuradas. */
(function(root){
'use strict';
const C=root.IWishCore;
const legacy=['wishes','transactions','events'];
const buckets=[...C.collections,...legacy];
const empty=()=>Object.fromEntries(buckets.map(bucket=>[bucket,{}]));

class IWishStore {
  constructor({client,namespace='local',storage=localStorage,locks=root.navigator?.locks,onChange=()=>{},online=()=>navigator.onLine,syncBuckets=buckets}){
    Object.assign(this,{client,namespace,storage,locks,onChange,online,syncBuckets});
    this.generation=0;
    this.clearScope();
  }

  key(owner=this.owner){return `iwish_e2:${this.namespace}:${owner}`;}

  read(owner=this.owner){
    const saved=JSON.parse(this.storage.getItem(this.key(owner))||'null');
    const data=saved?.data||empty(),base=saved?.base||empty();
    for(const bucket of buckets){data[bucket]??={};base[bucket]??={};}
    return {data,base,conflicts:saved?.conflicts||[],dark:!!saved?.dark};
  }

  clearScope(){
    Object.assign(this,{owner:null,busy:false,error:'',data:empty(),base:empty(),conflicts:[],dark:false});
    this.generation++;
  }

  scope(owner='guest'){
    const snapshot=this.read(owner);
    this.clearScope();
    Object.assign(this,snapshot,{owner});
  }

  refresh(){
    if(!this.owner)return;
    Object.assign(this,this.read());
    this.onChange(false);
  }

  async mutate(change,notify=true){
    const owner=this.owner,generation=this.generation;
    if(!owner)throw Error('Abre tu espacio antes de guardar.');
    if(!this.locks)throw Error('Abre I Wish por HTTPS en un navegador actualizado para guardar.');
    return this.locks.request(this.key(owner),()=>{
      if(generation!==this.generation)throw Error('Cambió la cuenta. Abre el formulario de nuevo.');
      const next=this.read(owner);
      change(next);
      try{this.storage.setItem(this.key(owner),JSON.stringify(next));}
      catch(error){throw Error('No se pudo guardar en este dispositivo. Libera espacio e inténtalo de nuevo.',{cause:error});}
      Object.assign(this,next);
      try{this.onChange(notify);}catch(error){console.error(error);}
    });
  }

  legacyRow(bucket,row){
    const value=C.clone(row);
    delete value.user_id;
    if(bucket==='events'){value.priority??=1;value.completed_at??=null;value.history??=[];}
    return value;
  }

  legacy(){return Object.fromEntries(legacy.map(bucket=>[bucket,Object.values(this.data[bucket]).filter(Boolean).map(C.clone)]));}

  changes(){
    return this.syncBuckets.flatMap(bucket=>Object.entries(this.data[bucket])
      .filter(([id,value])=>!C.equal(value,this.base[bucket][id]))
      .map(([id,value])=>({bucket,id,value:C.clone(value),base:C.clone(this.base[bucket][id]??null)})));
  }

  setDark(dark){return this.mutate(next=>{next.dark=dark;},false);}

  put(bucket,id,value){
    const original=this.data[bucket][id];
    return this.batch(data=>{
      if(!C.equal(data[bucket][id],original))throw Error('El registro cambió en otra pestaña. Revisa la versión actual.');
      data[bucket][id]=value;
    });
  }

  batch(change){return this.mutate(({data})=>{change(data);C.validate(data);});}

  snapshot(){return C.clone(Object.fromEntries(C.collections.map(bucket=>[bucket,this.data[bucket]])));}

  resolve(bucket,id,useLocal){
    const original=this.data[bucket][id],base=this.base[bucket][id];
    return this.mutate(next=>{
      if(!C.equal(next.data[bucket][id],original)||!C.equal(next.base[bucket][id],base))throw Error('El conflicto cambió. Revisa las versiones actuales.');
      if(!useLocal)next.data[bucket][id]=C.clone(next.base[bucket][id]??null);
      C.validate(next.data);
      next.conflicts=next.conflicts.filter(c=>c.bucket!==bucket||c.id!==id);
    });
  }

  async sync(){
    if(!this.owner||this.owner==='guest'||!this.client||!this.online()||!this.locks||this.busy)return;
    const owner=this.owner,generation=this.generation;
    this.busy=true;this.error='';this.onChange(false);
    try{
      await this.locks.request(this.key(owner)+':sync',async()=>{
        if(generation!==this.generation)return;
        for(let pass=0;pass<3;pass++){
          this.refresh();
          if(this.conflicts.length||!this.online())return;
          const changes=this.changes(),sent=this.data,sentBase=this.base;
          const {data,error}=await this.client.rpc('iwish_agenda_sync',{changes});
          if(generation!==this.generation)return;
          if(error)throw error;
          const remote=empty();
          for(const row of data.rows)remote[row.bucket][row.id]=row.value;
          await this.mutate(next=>{
            next.conflicts=data.conflicts||[];
            for(const bucket of this.syncBuckets){
              const ids=new Set([...Object.keys(remote[bucket]),...Object.keys(next.data[bucket])]);
              for(const id of ids){
                const pending=!C.equal(sent[bucket][id],sentBase[bucket][id]);
                const changed=!C.equal(sent[bucket][id],next.data[bucket][id]);
                const conflict=next.conflicts.some(c=>c.bucket===bucket&&c.id===id);
                if(!changed&&!(pending&&conflict))next.data[bucket][id]=C.clone(remote[bucket][id]??null);
              }
              next.base[bucket]=remote[bucket];
            }
          },false);
          if(this.conflicts.length||!this.changes().length)return;
        }
      });
    }catch(error){if(generation===this.generation)this.error=error.message||'No se pudo sincronizar.';}
    finally{if(generation===this.generation){this.busy=false;this.onChange(false);}}
  }
}
root.IWishStore=IWishStore;
if(typeof module!=='undefined')module.exports=IWishStore;
})(typeof window!=='undefined'?window:globalThis);
