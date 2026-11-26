/* PostgreSQL local en PGlite. Simula los roles y el JWT de Supabase. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.IWISH_PGLITE||'@electric-sql/pglite');
const migration=fs.readFileSync(path.join(__dirname,'../supabase/001-agenda.sql'),'utf8');
const accountA='aaaaaaaa-0000-4000-8000-000000000000';
const accountB='bbbbbbbb-0000-4000-8000-000000000000';
const taskId='11111111-0000-4000-8000-000000000000';
const task={id:taskId,kind:'task',title:'Álgebra',description:'Ejercicio',completed:false,history:[],priority:1,reminder_minutes:30,starts_at:'2027-01-20T18:00:00.000Z',deleted_at:null};
async function run(){
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated;
   create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as
     $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
   grant usage on schema auth to anon, authenticated;
   insert into auth.users values ('${accountA}'), ('${accountB}');
  `);
  await db.exec(migration);
  async function account(role,id=''){
   await db.exec('reset role');
   await db.query("select set_config('request.jwt.claim.sub', $1, false)",[id]);
   await db.exec('set role '+role);
  }
  async function sync(changes=[]){
   const {rows}=await db.query('select public.iwish_agenda_sync($1::jsonb) as result',[JSON.stringify(changes)]);
   return rows[0].result;
  }
  const change=(value,base=null)=>({bucket:'events',id:taskId,value,base});

  await account('authenticated',accountA);
  assert.deepEqual((await sync()).rows,[]);
  assert.deepEqual((await sync([change(task)])).rows[0].value,task);
  assert.deepEqual((await sync([change(task)])).conflicts,[]);
  assert.deepEqual((await sync()).rows[0].value,task);

  const edited={...task,title:'Programación'};
  assert.deepEqual((await sync([change(edited,task)])).rows[0].value,edited);
  const stale=await sync([change({...task,title:'Versión vieja'},task)]);
  assert.deepEqual(stale.conflicts,[{bucket:'events',id:taskId}]);
  assert.deepEqual(stale.rows[0].value,edited);
  await assert.rejects(sync([{...change(task,edited),bucket:'wishes'}]));

  const done={...edited,completed:true,history:[{status:'completed',at:'2027-01-20T19:00:00.000Z'}]};
  assert.equal((await sync([change(done,edited)])).rows[0].value.completed,true);
  const deleted={...done,deleted_at:'2027-01-20T20:00:00.000Z'};
  assert.equal((await sync([change(deleted,done)])).rows[0].value.deleted_at,deleted.deleted_at);
  assert.equal((await sync([change(done,edited)])).rows[0].value.deleted_at,deleted.deleted_at);

  await account('authenticated',accountB);
  assert.deepEqual((await sync()).rows,[]);
  assert.deepEqual((await db.query('select * from public.iwish_agenda_events')).rows,[]);
  assert.deepEqual((await db.query("update public.iwish_agenda_events set value=value returning id")).rows,[]);
  await assert.rejects(db.query('insert into public.iwish_agenda_events(owner_id,id,value) values ($1,$2,$3)',[accountA,taskId,JSON.stringify(task)]),{code:'42501'});
  assert.deepEqual((await sync([change({...task,title:'De B'})])).rows[0].value.title,'De B');
  await account('authenticated',accountA);
  assert.deepEqual((await sync()).rows[0].value,deleted);

  await account('anon');
  await assert.rejects(sync(),{code:'42501'});
  await assert.rejects(db.query('select * from public.iwish_agenda_events'),{code:'42501'});
  console.log('OK PostgreSQL: migración, crear/editar/completar/borrar, reintento, conflicto, aislamiento A/B y acceso anónimo.');
 }finally{await db.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
