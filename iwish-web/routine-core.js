/* Rutinas completas: un registro por plan; actividades y versiones viajan juntas. */
(function(root){
'use strict';
const C=root.IWishCore;
const clean=s=>String(s??'').normalize('NFKC').trim().replace(/\s+/g,' ');
const categoryKey=s=>clean(s).toLocaleLowerCase('es');
function categories(data){const values=['Estudio','Deporte',...C.dataRows(data,'routines').flatMap(r=>r.program?[r.program.category,...(r.program.categories||[])]:[])],seen=new Set();return values.map(clean).filter(s=>s&&!seen.has(categoryKey(s))&&seen.add(categoryKey(s)));}
function endDate(start,weeks){if(!C.dateOK(start))throw Error('Elige una fecha de inicio válida.');if(!Number.isInteger(weeks)||weeks<1)throw Error('La duración debe ser una cantidad entera positiva de semanas.');if(weeks>15600)throw Error('La duración supera el calendario admitido.');const end=C.addDays(start,weeks*7-1);if(!C.dateOK(end))throw Error('La fecha final debe ser anterior al año 2200.');return end;}
function status(r,day=C.today()){if(!r.program){const start=r.versions[0].from,end=r.versions.at(-1).until;if(end&&day>end)return 'Finalizada';if(r.pauses.some(p=>p.from<=day&&(!p.until||p.until>=day)))return 'Pausada';return day<start?'Programada':'En curso';}const p=r.program;if(day>p.end)return 'Finalizada';if(r.pauses.some(p=>p.from<=day&&(!p.until||p.until>=day)))return 'Pausada';return day<p.start?'Programada':'En curso';}
function draft(data,id,day=C.today()){
 const r=data.routines[id];if(!r?.program)return {name:'',category:'Estudio',weeks:4,start:day,activities:[],effective:day};
 const p=r.program,effective=p.start>day?p.start:C.addDays(day,1);
 return {name:p.name,category:p.category,weeks:p.weeks,start:p.start,effective,activities:p.activities.filter(a=>!a.stoppedFrom||a.stoppedFrom>effective).map(a=>{const v=[...a.versions].sort((x,y)=>x.from.localeCompare(y.from)).filter(v=>v.from<=effective).at(-1)||a.versions[0];return {id:a.id,name:v.title,days:[...v.days],time:v.time,description:v.description||'',reminder:v.remindersEnabled===false?null:v.reminder};})};
}
function validateDraft(input){
 const d=C.clone(input);d.name=clean(d.name);d.category=clean(d.category);
 if(!d.name||d.name.length>120)throw Error('Escribe un nombre de rutina de hasta 120 caracteres.');
 if(!d.category||d.category.length>60)throw Error('Escribe una categoría de hasta 60 caracteres.');
 d.end=endDate(d.start,Number(d.weeks));d.weeks=Number(d.weeks);
 if(!Array.isArray(d.activities)||!d.activities.length)throw Error('Añade al menos una actividad.');
 const ids=new Set(),slots=new Set();
 d.activities=d.activities.map((a,i)=>{a.name=clean(a.name);if(!a.name||a.name.length>120)throw Error(`Actividad ${i+1}: escribe un nombre de hasta 120 caracteres.`);if(!Array.isArray(a.days)||!a.days.length||a.days.some(n=>!Number.isInteger(n)||n<0||n>6))throw Error(`«${a.name}»: selecciona al menos un día.`);a.days=[...new Set(a.days)].sort((a,b)=>a-b);if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time))throw Error(`«${a.name}»: indica una hora válida.`);if(a.reminder!==null&&(!Number.isInteger(a.reminder)||a.reminder<0||a.reminder>10080))throw Error(`«${a.name}»: revisa el recordatorio.`);a.description=String(a.description||'').trim();if(a.description.length>1000)throw Error('La descripción admite hasta 1000 caracteres.');if(a.id){if(ids.has(a.id))throw Error('La actividad está duplicada.');ids.add(a.id);}for(const day of a.days){const slot=categoryKey(a.name)+'|'+day+'|'+a.time;if(slots.has(slot))throw Error(`«${a.name}» ya está programada ese día a esa hora.`);slots.add(slot);}return a;});
 return d;
}
function save(data,input,id,day=C.today(),makeId=()=>crypto.randomUUID()){
 const d=validateDraft(input),previous=id?data.routines[id]:null;
 if(id&&!previous?.program)throw Error('La rutina ya no está disponible.');
 if(previous&&previous.program.end<day)throw Error('Esta rutina ya finalizó. Crea una nueva para otra etapa.');
 if(previous&&previous.program.start<=day&&d.start!==previous.program.start)throw Error('Conserva la fecha de inicio de una rutina que ya comenzó.');
 const cutoff=previous?(previous.program.start<=day?d.effective:day):d.start;
 if(previous&&(!C.dateOK(cutoff)||(previous.program.start<=day&&cutoff<=day)))throw Error('Los cambios futuros deben comenzar a partir de mañana.');
 if(previous&&d.end<cutoff)throw Error('La fecha final debe incluir la fecha desde la que aplicarás los cambios.');
 if(previous&&Object.values(data.occurrences).some(o=>o&&o.routine===id&&!o.reminder_only&&(o.date<d.start||o.date>d.end)))throw Error('El período debe incluir las actividades que ya tienen un estado registrado. Conserva esas fechas.');
 const result=previous?C.clone(previous):{versions:[],pauses:[]};
 const known=categories(data),category=known.find(c=>categoryKey(c)===categoryKey(d.category))||d.category;
 const past=previous?.program.activities||[],used=new Set();
 const activities=d.activities.map(a=>{
  const old=a.id?past.find(x=>x.id===a.id):null;if(a.id&&!old)throw Error('Una actividad cambió en otro dispositivo. Vuelve a abrir la rutina.');
  const activityId=old?.id||makeId();used.add(activityId);
  const from=previous?maxDate(d.start,cutoff):d.start;
  const versions=old?old.versions.filter(v=>v.from<cutoff).map(C.clone):[];
  versions.push({title:a.name,description:a.description,area:'Personal',priority:1,time:a.time,reminder:a.reminder??0,remindersEnabled:a.reminder!==null,repeat:'weekly',days:a.days,day:1,from,until:d.end});
  return {id:activityId,versions};
 });
 // Las actividades retiradas conservan sus versiones e identificadores históricos.
 for(const a of past)if(!used.has(a.id))activities.push({...C.clone(a),stoppedFrom:a.stoppedFrom&&a.stoppedFrom<cutoff?a.stoppedFrom:cutoff});
 result.program={schema:1,name:d.name,category,categories:[...new Set([...(previous?.program.categories||[]),previous?.program.category,category].filter(Boolean))],weeks:d.weeks,start:d.start,end:d.end,activities};
 const routineId=id||makeId();data.routines[routineId]=result;
 for(const [key,o]of Object.entries(data.occurrences))if(o?.routine===routineId&&o.reminder_only&&o.date>=cutoff)data.occurrences[key]=null;
 return routineId;
}
const maxDate=(a,b)=>a>b?a:b;
function pause(data,id,day=C.today()){
 const r=data.routines[id];if(!r)throw Error('La rutina ya no está disponible.');if(status(r,day)==='Finalizada')throw Error('Esta rutina ya finalizó.');
 const open=r.pauses.find(p=>!p.until);if(open){if(open.from===day)r.pauses=r.pauses.filter(p=>p!==open);else open.until=C.addDays(day,-1);}else r.pauses.push({from:day,until:null});
}
root.IWishRoutines={clean,categoryKey,categories,endDate,status,draft,validateDraft,save,pause};
if(typeof module!=='undefined')module.exports=root.IWishRoutines;
})(typeof window!=='undefined'?window:globalThis);
