/* Calendario Panamá, dinero en centavos y proyecciones sin contenido del Diario. */
(function(root){
'use strict';
const collections=['budgets','goals','transfers','routines','occurrences'];
const categories=['Comida','Transporte','Universidad','Negocio','Salud','Entretenimiento','Hogar','Salario','Ventas','Otro'];
const clone=x=>JSON.parse(JSON.stringify(x));
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const equal=(a,b)=>canonical(a??null)===canonical(b??null);
const dateOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&s>='1900-01-01'&&s<='2199-12-31'&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
function cents(value){const s=String(value).trim();if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Usa un importe positivo con hasta dos decimales.');const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>99999999999)throw Error('El importe es demasiado grande.');return n;}
const today=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Panama',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const addDays=(d,n)=>{const v=new Date(d+'T12:00:00Z');v.setUTCDate(v.getUTCDate()+n);return v.toISOString().slice(0,10)};
const monday=d=>addDays(d,-((new Date(d+'T12:00:00Z').getUTCDay()+6)%7));
const previousMonth=m=>{const d=new Date(m+'-15T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7)};
const monthEnd=m=>new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7)),0,12)).toISOString().slice(0,10);
const stamp=(d,time='23:59')=>`${d}T${time}:00-05:00`;
const active=a=>(a||[]).filter(x=>!x.deleted_at);
const dataRows=(data,c)=>Object.entries(data[c]||{}).filter(([,v])=>v!=null).map(([id,v])=>({...v,id}));
function budgetRows(data,transactions,month){
 const spent={};active(transactions).filter(t=>t.type==='expense'&&t.transaction_date.startsWith(month)).forEach(t=>spent[t.category]=(spent[t.category]||0)+cents(t.amount));
 const limits=dataRows(data,'budgets').filter(b=>b.month===month);const names=new Set([...limits.map(b=>b.category),...Object.keys(spent)]);
 return [...names].map(category=>{const b=limits.find(b=>b.category===category),used=spent[category]||0,limit=b?.limit??null,pct=limit?used/limit*100:null;return {id:b?.id,category,used,limit,pct,remaining:limit===null?null:limit-used,level:limit===null?'none':used>limit?'over':used===limit?'full':used>=limit*.8?'warning':'ok'};}).sort((a,b)=>b.used-a.used||a.category.localeCompare(b.category));
}
const goalBalance=(data,id)=>dataRows(data,'transfers').filter(t=>t.goal===id).reduce((s,t)=>s+(t.kind==='deposit'?t.amount:-t.amount),0);
function validate(data){
 if(!data||typeof data!=='object')throw Error('Respaldo de planificación inválido.');
 const integer=n=>Number.isSafeInteger(n)&&n>0&&n<=99999999999;
 const title=s=>typeof s==='string'&&s.trim().length>0&&s.length<=500;
 for(const c of collections){if(!data[c]||typeof data[c]!=='object'||Array.isArray(data[c]))throw Error('Faltan datos de planificación.');for(const [id,v]of Object.entries(data[c])){if(!id||id.length>600)throw Error('Identificador inválido.');if(v===null)continue;if(typeof v!=='object'||Array.isArray(v))throw Error('Registro inválido.');if(v.history!==undefined&&(!Array.isArray(v.history)||v.history.some(h=>!h||!['pending','completed','skipped'].includes(h.status)||!Number.isFinite(Date.parse(h.at)))))throw Error('Historial de estados inválido.');
 if(c==='budgets'&&(!/^\d{4}-\d{2}$/.test(v.month)||!dateOK(v.month+'-01')||!title(v.category)||!integer(v.limit)||id!==v.month+'|'+v.category))throw Error('Presupuesto inválido.');
 if(c==='goals'&&(!title(v.name)||!integer(v.target)||(v.deadline&&!dateOK(v.deadline))))throw Error('Meta inválida.');
 if(c==='transfers'&&(!integer(v.amount)||!['deposit','withdrawal'].includes(v.kind)||!dateOK(v.date)||!data.goals[v.goal]))throw Error('Aporte o retiro inválido.');
 if(c==='routines'){
  if(!Array.isArray(v.versions)||(!v.program&&!v.versions.length))throw Error('Rutina inválida.');
  if(v.program){
   const p=v.program;
   if(p.schema!==1||!title(p.name)||!title(p.category)||p.name.length>120||p.category.length>60||!Number.isInteger(p.weeks)||p.weeks<1||p.weeks>15600||!dateOK(p.start)||!dateOK(p.end)||addDays(p.start,p.weeks*7-1)!==p.end||!Array.isArray(p.categories)||p.categories.some(c=>!title(c)||c.length>60)||!Array.isArray(p.activities)||!p.activities.length)throw Error('Datos de rutina completa inválidos.');
   const ids=new Set();for(const a of p.activities){if(typeof a.id!=='string'||!/^[a-f0-9-]{36}$/i.test(a.id)||ids.has(a.id)||!Array.isArray(a.versions)||!a.versions.length||(a.stoppedFrom&&!dateOK(a.stoppedFrom)))throw Error('Actividad de rutina inválida.');ids.add(a.id);}
  }
  for(const s of (v.program?v.program.activities.flatMap(a=>a.versions):v.versions)){if((s.remindersEnabled!==undefined&&typeof s.remindersEnabled!=='boolean')||!title(s.title)||!['Universidad','Trabajo','Negocio','Personal'].includes(s.area)||![1,2,3].includes(s.priority)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)||!Number.isInteger(s.reminder)||s.reminder<0||!dateOK(s.from)||(s.until&&(!dateOK(s.until)||s.until<s.from))||!['daily','weekly','monthly'].includes(s.repeat)||!Number.isInteger(s.day)||s.day<1||s.day>31||!Array.isArray(s.days)||(s.repeat==='weekly'&&!s.days.length)||s.days.some(n=>!Number.isInteger(n)||n<0||n>6))throw Error('Revisa las fechas y la repetición de la rutina.');}
  if(!Array.isArray(v.pauses)||v.pauses.some(p=>!dateOK(p.from)||(p.until&&(!dateOK(p.until)||p.until<p.from))))throw Error('Pausa inválida.');
 }
 if(c==='occurrences'&&(!data.routines[v.routine]||(data.routines[v.routine]?.program&&!v.activity)||!dateOK(v.date)||id!==v.routine+(v.activity?'/'+v.activity:'')+':'+v.date|| (v.activity&&!data.routines[v.routine]?.program?.activities.some(a=>a.id===v.activity))||!['pending','completed','skipped'].includes(v.status)||(v.status==='completed'&&!Number.isFinite(Date.parse(v.completed_at)))))throw Error('Repetición inválida.');
 }}
 for(const g of dataRows(data,'goals'))if(goalBalance(data,g.id)<0)throw Error('Un retiro supera el ahorro disponible.');
 return data;
}
const blank=()=>Object.fromEntries(collections.map(c=>[c,{}]));
function instances(data,from,to){
 const out=new Map();
 for(const parent of dataRows(data,'routines')){
 for(const r of (parent.program?parent.program.activities.map(a=>({...a,id:parent.id+'/'+a.id,parentId:parent.id,activity:a.id,pauses:parent.pauses,programName:parent.program.name,programCategory:parent.program.category})): [parent])){ 
  const versions=[...r.versions].sort((a,b)=>a.from.localeCompare(b.from));
  for(let d=from;d<=to;d=addDays(d,1)){
   const v=versions.filter(v=>v.from<=d).at(-1);if((r.stoppedFrom&&d>=r.stoppedFrom)||!v||(v.until&&d>v.until)||r.pauses.some(p=>p.from<=d&&(!p.until||d<=p.until)))continue;
   const weekday=new Date(d+'T12:00:00Z').getUTCDay();
   if(v.repeat==='weekly'&&!v.days.includes(weekday))continue;
   if(v.repeat==='monthly'&&Number(d.slice(8))!==Math.min(v.day,Number(monthEnd(d.slice(0,7)).slice(8))))continue;
   const id=r.id+':'+d;out.set(id,{...v,id,routine:r.parentId||r.id,...(r.activity?{activity:r.activity,programName:r.programName,programCategory:r.programCategory}:{}),date:d,status:'pending',starts_at:stamp(d,v.time),completed_at:null});
  }
 }
 }
 // An explicit task survives future schedule edits and pauses: it is history.
 for(const o of dataRows(data,'occurrences'))if(o.date>=from&&o.date<=to){const scheduled=out.get(o.id);if(o.reminder_only&&!scheduled)continue;const merged={...(scheduled||{}),...o};out.set(o.id,{...merged,starts_at:stamp(o.date,merged.time||'23:59')});}
 return [...out.values()].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)||a.id.localeCompare(b.id));
}
function tasks(data,events,from,to){return [...instances(data,from,to),...active(events).filter(e=>e.kind==='task'&&today(new Date(e.starts_at))>=from&&today(new Date(e.starts_at))<=to).map(e=>({...e,date:today(new Date(e.starts_at)),status:e.completed?'completed':'pending',priority:e.priority||1}))];}
function week(data,state,start,now=new Date()){
 const end=addDays(start,6),inWeek=d=>d>=start&&d<=end,tx=active(state.transactions).filter(t=>inWeek(t.transaction_date));
 const sum=type=>tx.filter(t=>t.type===type).reduce((s,t)=>s+cents(t.amount),0);
 const transfers=dataRows(data,'transfers').filter(t=>inWeek(t.date)),deposit=transfers.filter(t=>t.kind==='deposit').reduce((s,t)=>s+t.amount,0),withdrawal=transfers.filter(t=>t.kind==='withdrawal').reduce((s,t)=>s+t.amount,0);
 const planned=tasks(data,state.events,start,end),cutoff=Math.min(now.getTime(),new Date(stamp(end)).getTime()+59999);
 const count={completed:0,pending:0,overdue:0,skipped:0,unknown:0};for(const original of planned){let t=original;const atClose=(original.history||[]).filter(h=>Date.parse(h.at)<=cutoff).at(-1);if(atClose)t={...original,status:atClose.status,completed_at:atClose.status==='completed'?atClose.at:null,status_at:atClose.at};else if(original.history?.length)t={...original,status:'pending',completed_at:null};if(t.status==='completed'&&!t.completed_at&&end<today(now)){count.unknown++;continue;}const done=t.status==='completed'&&(!t.completed_at||new Date(t.completed_at).getTime()<=cutoff);if(done)count.completed++;else if(t.status==='skipped'&&(!t.status_at||new Date(t.status_at).getTime()<=cutoff))count.skipped++;else if(new Date(t.starts_at).getTime()<cutoff)count.overdue++;else count.pending++;}
 const completionDates=[...dataRows(data,'occurrences'),...active(state.events).filter(e=>e.kind==='task')].filter(t=>(t.history||[]).some(h=>h.status==='completed'&&inWeek(today(new Date(h.at))))||((t.status==='completed'||t.completed)&&t.completed_at&&inWeek(today(new Date(t.completed_at)))));
 const spending={};tx.filter(t=>t.type==='expense').forEach(t=>spending[t.category]=(spending[t.category]||0)+cents(t.amount));
 return {start,end,income:sum('income'),expense:sum('expense'),balance:sum('income')-sum('expense'),deposit,withdrawal,net:deposit-withdrawal,count,planned,completedDuring:completionDates.length,spending,hasData:tx.length+transfers.length+planned.length>0};
}
const api={collections,categories,clone,equal,canonical,dateOK,cents,today,addDays,monday,previousMonth,monthEnd,stamp,active,dataRows,budgetRows,goalBalance,validate,blank,instances,tasks,week};
root.IWishCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
