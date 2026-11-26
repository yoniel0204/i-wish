(() => {
  'use strict';

  const CATEGORY_LABELS = {personal:'Personal', material:'Material', tech:'Tecnología', amor:'Amor', probar:'Cosas a probar'};
  const QUOTES = [
    ['Primero di qué clase de persona quieres ser, luego haz lo que debes hacer.','Epicteto'],
    ['No dejes que lo que está fuera de tu control agite lo que está dentro de ti.','Marco Aurelio'],
    ['La felicidad consiste en apreciar lo que posees mientras avanzas hacia lo que deseas.','Reflexión estoica'],
    ['Un deseo con fecha se convierte en meta; una meta con acción se convierte en camino.','I Wish']
  ];
  const state = {
    wishes: [], transactions: [], events: [], dark: false, route: 'home',
    wishFilter: 'all', agendaFilter: 'upcoming', selectedDate: '', calendarDate: new Date(),
    session: null, offlineMode: false
  };
  const C = window.IWishCore;
  let store = null;
  let planner = null;
  let client = null;
  let project = 'local';
  let journal = null;
  let welcome = null;
  let authMode = 'login';
  let confirmationEmail = '';
  let resendUntil = 0;
  let resendTimer = null;
  let modalContext = null;
  let toastTimer = null;
  let dataScope = null;
  let dataGeneration = 0;
  let profileOwner = null;

  const $ = id => document.getElementById(id);
  const active = rows => rows.filter(row => !row.deleted_at);
  const nowIso = () => new Date().toISOString();
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2,14).padEnd(12,'0')}`;
  const money = value => new Intl.NumberFormat('es-PA',{style:'currency',currency:'USD'}).format(Number(value)||0);
  const dateText = value => new Date(value).toLocaleDateString('es-PA',{day:'numeric',month:'short',year:'numeric'});
  const dateTimeText = value => new Date(value).toLocaleString('es-PA',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
  const dayKey = value => {
    const d = new Date(value); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const toLocalInput = value => {
    const d = value ? new Date(value) : new Date(Date.now()+3600000);
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function switchDataScope(session) {
    const nextScope = session?.user?.id || 'guest';
    if (dataScope === nextScope) {state.session=session;return true;}
    clearTimeout(scheduleSync.timer);
    dataGeneration += 1;
    if ($('form-modal').open) $('form-modal').close();
    $('modal-fields').replaceChildren(); modalContext=null;
    try {
      store.scope(nextScope);
      journal?.scope(session?.user?.id || null);
    } catch(error) {
      store.clearScope();
      dataScope=null;
      state.session=null;
      state.offlineMode=false;
      showAuth();
      Object.assign(state,store.legacy(),{dark:false});
      journal?.scope(null);
      showAuthError(error.cause?error.message:'No se pudieron abrir los datos locales. Recarga e inténtalo de nuevo.');
      return false;
    }
    state.session=session;
    dataScope=nextScope;
    Object.assign(state,store.legacy(),{dark:store.dark});
    planner?.reset();
    applyTheme();
    return true;
  }

  async function setTheme(dark) {
    try{await store.setDark(dark);}
    catch(error){toast(error.message);applyTheme();}
  }

  function configureCloud() {
    const {supabaseUrl,supabaseKey}=window.IWISH_CONFIG||{};
    if(!supabaseUrl&&!supabaseKey)return;
    const url=new URL(supabaseUrl);
    if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||
       !/^sb_publishable_[A-Za-z0-9_-]+$/.test(supabaseKey)||!window.supabase?.createClient)throw Error('Revisa la URL y la clave publicable de Supabase.');
    project=url.origin;
    client=window.supabase.createClient(project,supabaseKey);
  }

  async function initAuth() {
    if (!client) { welcome?.ready(); if(switchDataScope(null)){showApp();updateSyncStatus();} return; }
    const {data} = await client.auth.getSession();
    welcome?.ready();
    if(!switchDataScope(data.session))return;
    client.auth.onAuthStateChange((_event, session) => {
      if(!switchDataScope(session))return;
      if (session) { state.offlineMode = false; showApp(); setTimeout(() => { syncAll(); journal?.sync(); }, 0); } else if (!state.offlineMode) showAuth();
      updateAccount(); updateSyncStatus();
    });
    if (state.session) { showApp(); journal?.sync(); await syncAll(); } else showAuth();
  }

  function showAuth() { $('app').classList.add('hidden'); $('auth-view').classList.toggle('hidden',!!welcome?.open); }
  function showApp() { if(state.session){confirmationEmail='';clearInterval(resendTimer);setAuthMode('login');} $('auth-view').classList.add('hidden'); $('app').classList.toggle('hidden',!!welcome?.open); renderAll(); }

  function authError(error) {
    const code=error?.code||'';
    const messages={invalid_credentials:'El correo o la contraseña no coinciden.',email_not_confirmed:'Confirma tu correo antes de iniciar sesión. Revisa también Spam.',user_already_exists:'Ya existe una cuenta con este correo. Inicia sesión.',weak_password:'Elige una contraseña más segura.',over_email_send_rate_limit:'Se alcanzó el límite de correos. Espera unos minutos e inténtalo otra vez.',over_request_rate_limit:'Demasiados intentos. Espera unos minutos.',email_address_invalid:'Revisa que el correo electrónico esté bien escrito.',signup_disabled:'El registro no está disponible en este momento.'};
    return messages[code] || (error?.status===429 ? messages.over_request_rate_limit : 'No se pudo completar la solicitud. Revisa tus datos y tu conexión e inténtalo de nuevo.');
  }
  function showAuthError(message) { $('auth-error').textContent=message; $('auth-error').focus(); }
  function setAuthMode(mode) {
    authMode=mode;
    const signup=mode==='signup';
    $('auth-entry').dataset.mode=mode;
    $('auth-entry').classList.remove('hidden'); $('auth-confirmation').classList.add('hidden');
    $('auth-error').textContent='';
    $('auth-name-field').classList.toggle('hidden',!signup);
    $('auth-name').disabled=!signup; $('auth-name').required=signup;
    $('auth-title').textContent=signup?'Crea tu espacio':'Entra a tu espacio';
    $('auth-submit').textContent=signup?'Crear mi cuenta':'Iniciar sesión';
    $('auth-toggle').textContent=signup?'Ya tengo cuenta':'Crear mi cuenta';
    $('auth-new-note').classList.toggle('hidden',signup);
    $('auth-password').autocomplete=signup?'new-password':'current-password';
  }
  function toggleAuthMode() { setAuthMode(authMode==='login'?'signup':'login'); (authMode==='signup'?$('auth-name'):$('auth-email')).focus(); }
  function startResendCooldown() {
    resendUntil=Date.now()+60000; clearInterval(resendTimer);
    const tick=()=>{const seconds=Math.max(0,Math.ceil((resendUntil-Date.now())/1000));$('confirmation-resend').disabled=seconds>0;$('confirmation-resend').textContent=seconds?`Reenviar en ${seconds} s`:'Reenviar correo';if(!seconds)clearInterval(resendTimer);};
    tick();resendTimer=setInterval(tick,1000);
  }
  function showConfirmation(email) {
    confirmationEmail=email; $('auth-password').value='';
    $('confirmation-email').textContent=email;
    $('confirmation-status').textContent='';
    $('auth-entry').classList.add('hidden');$('auth-confirmation').classList.remove('hidden');
    $('confirmation-title').focus();startResendCooldown();
  }
  async function handleAuth(event) {
    event.preventDefault();
    if (!client) { showAuthError('La conexión segura todavía no está configurada.'); return; }
    const email=$('auth-email').value.trim(),password=$('auth-password').value,username=cleanName($('auth-name').value),mode=authMode;
    if(mode==='signup'&&!validName(username)){showAuthError('Escribe un nombre de entre 2 y 40 caracteres.');return;}
    $('auth-error').textContent='';
    const button=$('auth-submit');button.disabled=true;$('auth-toggle').disabled=true;$('offline-entry').disabled=true;button.textContent=mode==='signup'?'Creando tu cuenta…':'Entrando…';$('auth-form').setAttribute('aria-busy','true');
    try {
      const result=mode==='login'
        ?await client.auth.signInWithPassword({email,password})
        :await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin,data:{display_name:username}}});
      if(result.error){showAuthError(authError(result.error));return;}
      if(mode==='signup'&&!result.data.session)showConfirmation(email);
      else if(result.data.session){$('auth-password').value='';confirmationEmail='';if(switchDataScope(result.data.session)){state.offlineMode=false;showApp();}}
    }catch(_){showAuthError('No se pudo conectar. Revisa tu conexión e inténtalo otra vez.');}
    finally{button.disabled=false;$('auth-toggle').disabled=false;$('offline-entry').disabled=false;button.textContent=authMode==='login'?'Iniciar sesión':'Crear mi cuenta';$('auth-form').removeAttribute('aria-busy');}
  }
  async function resendConfirmation() {
    if(!client||!confirmationEmail||Date.now()<resendUntil)return;
    const email=confirmationEmail;
    $('confirmation-resend').disabled=true;$('confirmation-status').textContent='Solicitando un nuevo correo…';
    try{
      const {error}=await client.auth.resend({type:'signup',email,options:{emailRedirectTo:location.origin}});
      if(confirmationEmail!==email)return;
      $('confirmation-status').textContent=error?authError(error):'Solicitud enviada. Revisa tu correo y la carpeta Spam; la entrega puede tardar unos minutos.';
    }catch(_){$('confirmation-status').textContent='No se pudo conectar. Inténtalo cuando recuperes la conexión.';}
    finally{if(confirmationEmail===email)startResendCooldown();}
  }

  function cleanName(value) { return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''; }
  function validName(value) { return value.length >= 2 && value.length <= 40 && !/[<>\x00-\x1f\x7f]/.test(value); }
  function displayName() {
    const name = cleanName(state.session?.user?.user_metadata?.display_name);
    return validName(name) ? name : '';
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!client || !state.session) return;
    const name = cleanName($('profile-name').value);
    const feedback = $('profile-feedback');
    if (!validName(name)) { feedback.textContent = 'Escribe entre 2 y 40 caracteres, sin símbolos < o >.'; return; }
    if (!navigator.onLine) { feedback.textContent = 'Conéctate a internet para guardar tu nombre.'; return; }
    const owner = state.session.user.id;
    $('profile-save').disabled = true; feedback.textContent = 'Guardando…';
    try {
      const {data,error} = await client.auth.updateUser({data:{display_name:name}});
      if (state.session?.user?.id !== owner) return;
      if (error) throw error;
      state.session = {...state.session,user:data.user};
      updateAccount(); renderHome();
      feedback.textContent = 'Nombre guardado en tu cuenta.';
    } catch (_) {
      if (state.session?.user?.id === owner) feedback.textContent = 'No se pudo guardar. Tu nombre anterior se mantiene; vuelve a intentarlo.';
    } finally { $('profile-save').disabled = false; }
  }

  async function refreshProfile() {
    if (!client || !state.session || !navigator.onLine) return;
    const owner = state.session.user.id;
    try {
      const {data,error} = await client.auth.getUser();
      if (!error && data.user && state.session?.user?.id === owner) {
        state.session = {...state.session,user:data.user}; updateAccount(); renderHome();
      }
    } catch (_) { /* Cached name remains available while offline. */ }
  }

  async function syncAll(showMessage=false) {
    if(!store)return;
    await store.sync();
    if(showMessage)toast(!state.session?'Agenda guardada en este navegador.':
      store.error||store.conflicts.length?'Revisa la sincronización de Agenda en Ajustes.':
      !navigator.onLine||store.changes().length?'Agenda guardada aquí. Se sincronizará al conectarse.':'Agenda sincronizada.');
  }

  function scheduleSync() { clearTimeout(scheduleSync.timer); scheduleSync.timer=setTimeout(()=>syncAll(),500); }

  function refreshLocal(sync=true) {
    Object.assign(state,store.legacy(),{dark:store.dark});
    renderAll();
    if(sync)scheduleSync();
  }

  function updateSyncStatus() {
    const dot=$('sync-dot'), title=$('sync-title'), copy=$('sync-copy');
    const pending=store?.changes().length,connected=!!state.session&&navigator.onLine;
    dot.classList.toggle('online',connected&&!store.busy&&!store.error&&!pending&&!store.conflicts.length);
    if(!state.session){title.textContent='Modo local';copy.textContent='Datos guardados en este navegador';}
    else if(!navigator.onLine){title.textContent='Sin conexión';copy.textContent='La Agenda se sincronizará al volver';}
    else if(store.busy){title.textContent='Sincronizando Agenda';copy.textContent='Comprobando cambios';}
    else if(store.error||store.conflicts.length){title.textContent='Revisar Agenda';copy.textContent='Abre Ajustes para ver el estado';}
    else if(pending){title.textContent='Agenda pendiente';copy.textContent='Cambios guardados en este dispositivo';}
    else{title.textContent='Agenda conectada';copy.textContent='Sin cambios pendientes en este dispositivo';}
    $('mobile-sync-status').textContent=title.textContent+' · '+copy.textContent;
  }

  function navigate(route) {
    if(route==='journal' && state.route!=='journal')journal?.home();
    if(state.route==='journal' && route!=='journal')journal?.leave();
    if(route==='finance' && state.route!=='finance')planner?.enterFinance();
    if(route==='agenda' && state.route!=='agenda')planner?.enterAgenda();
    state.route=route;
    document.body.dataset.route=route;
    $('theme-toggle').classList.toggle('hidden',route==='journal');
    document.querySelectorAll('.page').forEach(page=>page.classList.toggle('active',page.id===`page-${route}`));
    document.querySelectorAll('[data-route]').forEach(btn=>{btn.classList.toggle('active',btn.dataset.route===route);if(btn.dataset.route===route)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');});
    const titles={home:'Mi día',wishes:'Mis deseos',agenda:'Agenda',finance:'Mi economía',settings:'Ajustes',journal:'Diario'};
    $('page-title').textContent=titles[route]; window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); renderRoute();
  }

  function renderAll() {
    applyTheme(); renderHome(); renderWishes(); renderAgenda(); renderFinance(); renderReflection(); journal?.render(); planner?.renderSync(); updateAccount(); updateSyncStatus();
  }
  function renderRoute(){ if(state.route==='home')renderHome(); if(state.route==='wishes')renderWishes(); if(state.route==='agenda')renderAgenda(); if(state.route==='finance')renderFinance(); if(state.route==='settings'){updateAccount();planner?.renderSync();} if(state.route==='journal'){renderReflection();journal?.render();} }

  function applyTheme() {
    document.body.classList.toggle('dark',state.dark); $('theme-toggle').textContent=state.dark?'☀':'☾';
    $('appearance-theme').value=state.dark?'dark':'light';
    document.querySelector('meta[name="theme-color"]').content=state.dark?'#11110f':'#f7f5ef';
  }

  function renderHome() {
    const hour=new Date().getHours(); const greeting=hour<12?'Buenos días':hour<18?'Buenas tardes':'Buenas noches';
    const name=displayName();
    $('greeting').textContent=name ? `${greeting}, ${name}.` : `${greeting}.`;
    $('complete-profile').classList.toggle('hidden', !state.session || !!name);
    $('today-label').textContent=new Date().toLocaleDateString('es-PA',{weekday:'long',day:'numeric',month:'long'});
    const today=C.today();
    const dailyEvents=active(state.events).filter(e=>!e.completed&&C.today(new Date(e.starts_at))===today).map(e=>({...e,recurring:false}));
    const dailyRoutines=store?C.instances(store.data,today,today).filter(t=>t.status==='pending').map(t=>({...t,recurring:true})):[];
    const forToday=[...dailyEvents,...dailyRoutines].sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
    $('day-summary').textContent=forToday.length?`${forToday.length} ${forToday.length===1?'actividad pendiente':'actividades pendientes'} para hoy. Un paso a la vez.`:'Hoy tienes espacio. ¿Qué te gustaría hacer?';
    const olderEvents=active(state.events).filter(e=>!e.completed&&new Date(e.starts_at)<new Date()&&C.today(new Date(e.starts_at))<today).length;
    const firstRoutine=store?Object.values(store.data.routines).filter(Boolean).flatMap(r=>r.program?r.program.activities.flatMap(a=>a.versions.map(v=>v.from)):r.versions.map(v=>v.from)).sort()[0]:null;
    const olderRoutines=firstRoutine&&firstRoutine<today?C.instances(store.data,firstRoutine,C.addDays(today,-1)).filter(t=>t.status==='pending').length:0;
    const arrears=olderEvents+olderRoutines;
    $('home-agenda').innerHTML=(forToday.length?forToday.slice(0,3).map(e=>`<div class="list-row"><span class="list-icon" aria-hidden="true">${e.recurring?'↻':e.kind==='task'?'✓':'□'}</span><div class="list-main"><strong>${escapeHtml(e.title)}</strong><small>${dateTimeText(e.starts_at)}${e.recurring?' · Rutina':''}</small></div>${e.recurring?`<button class="tiny-btn" data-plan="complete" data-id="${escapeHtml(e.id)}" aria-label="Completar ${escapeHtml(e.title)}">✓</button>`:e.kind==='task'?`<button class="tiny-btn" data-complete-event="${escapeHtml(e.id)}" aria-label="Completar ${escapeHtml(e.title)}">✓</button>`:''}</div>`).join(''):empty('Nada programado para hoy','Puedes crear una actividad o seguir con tus ideas.'))+(forToday.length>3?`<button class="link-btn" data-route-jump="agenda">Ver las ${forToday.length} actividades en Agenda</button>`:'')+(arrears?`<div class="home-alert"><span>${arrears} ${arrears===1?'actividad anterior pendiente':'actividades anteriores pendientes'}</span><button class="link-btn" data-route-jump="agenda">Revisar</button></div>`:'');
    planner?.renderHome();
  }

  // La misma selección diaria de frases públicas; nunca utiliza entradas privadas.
  function renderReflection() {
    const q=QUOTES[new Date().getDate()%QUOTES.length]; $('daily-quote').textContent=`“${q[0]}”`; $('daily-author').textContent=`— ${q[1]}`;
  }

  function renderWishes() {
    const filters=[['all','Todos'],...Object.entries(CATEGORY_LABELS),['done','Logrados']];
    $('wish-filters').innerHTML=filters.map(([id,label])=>`<button class="chip ${state.wishFilter===id?'active':''}" data-wish-filter="${id}">${label}</button>`).join('');
    const all=active(state.wishes), done=all.filter(w=>w.completed).length; const pct=all.length?Math.round(done/all.length*100):0;
    $('wish-progress-label').textContent=`${done} de ${all.length} logrados`; $('wish-progress-bar').style.width=`${pct}%`;
    let rows=all; if(state.wishFilter==='done')rows=rows.filter(w=>w.completed); else if(state.wishFilter!=='all')rows=rows.filter(w=>w.category===state.wishFilter);
    rows=rows.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    $('wish-list').innerHTML=rows.length?rows.map(w=>`<article class="wish-card ${w.completed?'done':''}"><div class="card-top"><span class="category-tag">${CATEGORY_LABELS[w.category]||'Personal'}</span><button class="card-menu" data-delete="wishes" data-id="${w.id}" aria-label="Eliminar">×</button></div><h3>${escapeHtml(w.title)}</h3><div class="wish-meta"><span>${'★'.repeat(w.priority)}${'☆'.repeat(3-w.priority)} ${w.deadline?`· ${dateText(`${w.deadline}T12:00:00`)}`:''}</span><button class="check-btn ${w.completed?'checked':''}" data-toggle-wish="${w.id}">${w.completed?'Logrado':'Marcar logrado'}</button></div>${planner?.wishLink(w.id)||''}</article>`).join(''):empty('Todavía no hay deseos','Escribe algo que quieras lograr, vivir o conseguir.');
  }

  function renderCalendar() {
    const base=new Date(state.calendarDate.getFullYear(),state.calendarDate.getMonth(),1); $('cal-title').textContent=base.toLocaleDateString('es-PA',{month:'long',year:'numeric'});
    const monday=(base.getDay()+6)%7; const start=new Date(base); start.setDate(1-monday); const events=active(state.events);
    $('calendar-grid').innerHTML=Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const key=dayKey(d);const today=key===dayKey(new Date());const selected=key===state.selectedDate;const has=events.some(e=>dayKey(e.starts_at)===key);return `<button class="calendar-day ${d.getMonth()!==base.getMonth()?'muted':''} ${today?'today':''} ${selected?'selected':''} ${has?'has-event':''}" data-calendar-day="${key}">${d.getDate()}</button>`}).join('');
  }

  function renderAgenda() {
    renderCalendar(); document.querySelectorAll('[data-agenda-filter]').forEach(b=>b.classList.toggle('active',b.dataset.agendaFilter===state.agendaFilter));
    const month=`${state.calendarDate.getFullYear()}-${String(state.calendarDate.getMonth()+1).padStart(2,'0')}`;
    const from=state.selectedDate||month+'-01',to=state.selectedDate||C.monthEnd(month);
    const recurring=C.instances(store.data,from,to).map(t=>({...t,completed:t.status==='completed',recurring:true}));
    $('agenda-routine-range').textContent=state.selectedDate?'Actividades de la fecha seleccionada.':'Actividades de rutina del mes mostrado. Selecciona un día para consultar sus detalles.';
    let rows=[...active(state.events),...recurring]; const todayStart=new Date();todayStart.setHours(0,0,0,0);
    if(state.selectedDate)rows=rows.filter(e=>(e.recurring?e.date:dayKey(e.starts_at))===state.selectedDate);
    if(state.agendaFilter==='upcoming')rows=rows.filter(e=>e.recurring?e.status==='pending':!e.completed); if(state.agendaFilter==='done')rows=rows.filter(e=>e.completed);
    rows.sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
    $('agenda-list').innerHTML=rows.length?rows.map(e=>e.recurring?planner.taskCard(e):`<article class="timeline-card ${e.kind}"><div class="time-col"><strong>${new Date(e.starts_at).toLocaleTimeString('es-PA',{hour:'numeric',minute:'2-digit'})}</strong><small>${new Date(e.starts_at).toLocaleDateString('es-PA',{day:'numeric',month:'short'})}</small></div><span class="time-line"></span><div class="event-body"><h3>${escapeHtml(e.title)}</h3>${e.description?`<p>${escapeHtml(e.description)}</p>`:''}<div class="event-meta"><span>${e.kind==='task'?'Tarea':'Evento'}</span><span>Recordar ${reminderLabel(e.reminder_minutes)}</span></div></div><div class="row-actions"><button class="tiny-btn" data-complete-event="${e.id}" title="Completar">${e.completed?'↶':'✓'}</button><button class="tiny-btn" data-edit-event="${e.id}" title="Editar">✎</button><button class="tiny-btn" data-calendar-event="${e.id}" title="Añadir al calendario">＋</button><button class="tiny-btn" data-delete="events" data-id="${e.id}" title="Eliminar">×</button></div></article>`).join(''):empty(state.selectedDate?'Nada este día':'Agenda despejada','Crea una tarea o evento para mantenerte al día.');
    planner?.renderAgenda();
  }

  function renderFinance() {
    const month=$('finance-month').value||C.today().slice(0,7); if(!$('finance-month').value)$('finance-month').value=month;
    const rows=active(state.transactions).filter(t=>t.transaction_date.startsWith(month)).sort((a,b)=>b.transaction_date.localeCompare(a.transaction_date)||new Date(b.created_at)-new Date(a.created_at));
    const incomes=rows.filter(t=>t.type==='income'), expenses=rows.filter(t=>t.type==='expense'); const income=incomes.reduce((s,t)=>s+C.cents(t.amount),0)/100, expense=expenses.reduce((s,t)=>s+C.cents(t.amount),0)/100;
    $('finance-income').textContent=money(income);$('finance-expense').textContent=money(expense);$('finance-balance').textContent=money(income-expense);$('finance-income-count').textContent=`${incomes.length} movimientos`;$('finance-expense-count').textContent=`${expenses.length} movimientos`;
    const categories={};expenses.forEach(t=>categories[t.category]=(categories[t.category]||0)+C.cents(t.amount));const max=Math.max(...Object.values(categories),1);
    $('expense-breakdown').innerHTML=Object.keys(categories).length?Object.entries(categories).sort((a,b)=>b[1]-a[1]).map(([cat,total])=>`<div class="bar-row"><span>${escapeHtml(cat)}</span><div class="bar-track"><span style="width:${Math.round(total/max*100)}%"></span></div><strong>${money(total/100)}</strong></div>`).join(''):empty('Sin gastos este mes','Cuando registres gastos verás aquí su distribución.');
    $('transaction-list').innerHTML=rows.length?rows.map(t=>`<div class="list-row"><span class="list-icon">${t.type==='income'?'↗':'↘'}</span><div class="list-main"><strong>${escapeHtml(t.description)}</strong><small>${escapeHtml(t.category)} · ${dateText(`${t.transaction_date}T12:00:00`)}</small></div><span class="list-value ${t.type==='income'?'positive':'negative'}">${t.type==='income'?'+':'−'}${money(t.amount)}</span><button class="tiny-btn" data-edit-transaction="${t.id}" aria-label="Editar movimiento">✎</button><button class="tiny-btn" aria-label="Eliminar movimiento" data-delete="transactions" data-id="${t.id}">×</button></div>`).join(''):empty('Sin movimientos','Registra un ingreso o gasto con su descripción.');
    planner?.renderFinance();
  }

  function updateAccount() {
    const signed=!!state.session, name=displayName(), owner=state.session?.user?.id || null;
    $('profile-heading').textContent=name || 'Tu espacio';
    $('profile-avatar').textContent=name ? name.split(' ').slice(0,2).map(word=>Array.from(word)[0]).join('').toLocaleUpperCase('es') : '✦';
    $('profile-email').textContent=state.session?.user?.email || '';
    $('profile-form').classList.toggle('hidden', !signed);
    $('profile-local-note').classList.toggle('hidden', signed);
    if (owner !== profileOwner || document.activeElement !== $('profile-name')) $('profile-name').value=name;
    if (owner !== profileOwner) $('profile-feedback').textContent='';
    profileOwner=owner;
    $('account-heading').textContent=signed?(state.session.user.email||'Cuenta conectada'):'Modo local';
    $('account-copy').textContent=signed?'Tus deseos, agenda, economía y Diario se sincronizan de forma privada entre tus dispositivos.':'Tus datos están en este dispositivo. Inicia sesión para sincronizarlos.';
    $('account-action').classList.toggle('hidden',signed);$('sync-now').classList.toggle('hidden',!signed);$('sign-out').classList.toggle('hidden',!signed);
  }

  function empty(title,copy){return `<div class="empty-state"><strong>${title}</strong>${copy}</div>`}
  function reminderLabel(minutes){const n=Number(minutes);if(n===0)return 'a la hora';if(n<60)return `${n} min antes`;if(n<1440)return `${n/60} h antes`;return `${n/1440} día(s) antes`}

  function formField(label,name,type='text',value='',extra='') { return `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra}></label>`; }
  function openModal(type,item=null) {
    modalContext={type,item}; $('modal-error').textContent=''; $('modal-draft').classList.add('hidden'); let fields='';
    if(type==='wish'){
      $('modal-kicker').textContent='Deseos';$('modal-title').textContent=item?'Editar deseo':'Nuevo deseo';
      fields=`<label>¿Qué deseas?<textarea name="title" rows="3" required maxlength="500" placeholder="Escribe tu deseo…">${escapeHtml(item?.title||'')}</textarea></label><div class="field-row"><label>Categoría<select name="category">${Object.entries(CATEGORY_LABELS).map(([v,l])=>`<option value="${v}" ${item?.category===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Prioridad<select name="priority"><option value="1">★ Normal</option><option value="2" ${item?.priority===2?'selected':''}>★★ Importante</option><option value="3" ${item?.priority===3?'selected':''}>★★★ Prioritario</option></select></label></div>${formField('Fecha límite (opcional)','deadline','date',item?.deadline||'')}`;
    } else if(type==='event'){
      $('modal-kicker').textContent='Agenda';$('modal-title').textContent=item?'Editar actividad':'Nueva actividad';
      fields=`<div class="field-row"><label>Tipo<select name="kind"><option value="task">Tarea</option><option value="event" ${item?.kind==='event'?'selected':''}>Evento</option></select></label>${formField('Fecha y hora','starts_at','datetime-local',toLocalInput(item?.starts_at),'required')}</div>${formField('Título','title','text',item?.title||'','required maxlength="300" placeholder="Ej. Entregar laboratorio"')}<label>Descripción (opcional)<textarea name="description" rows="3" maxlength="1000">${escapeHtml(item?.description||'')}</textarea></label><label>Recordatorio<select name="reminder_minutes"><option value="0">A la hora</option><option value="15" ${item?.reminder_minutes===15?'selected':''}>15 minutos antes</option><option value="30" ${!item||item?.reminder_minutes===30?'selected':''}>30 minutos antes</option><option value="60" ${item?.reminder_minutes===60?'selected':''}>1 hora antes</option><option value="1440" ${item?.reminder_minutes===1440?'selected':''}>1 día antes</option><option value="10080" ${item?.reminder_minutes===10080?'selected':''}>1 semana antes</option></select></label>`;
    } else {
      $('modal-kicker').textContent='Economía';$('modal-title').textContent='Registrar movimiento';
      fields=`<div class="field-row"><label>Tipo<select name="type"><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label>${formField('Monto','amount','number','','required min="0.01" step="0.01" placeholder="0.00"')}</div><div class="field-row"><label>Categoría<select name="category"><option>Comida</option><option>Transporte</option><option>Universidad</option><option>Negocio</option><option>Salud</option><option>Entretenimiento</option><option>Hogar</option><option>Salario</option><option>Ventas</option><option>Otro</option></select></label>${formField('Fecha','transaction_date','date',dayKey(new Date()),'required')}</div>${formField('Descripción','description','text','','required maxlength="500" placeholder="Ej. Venta de camiseta"')}`;
    }
    $('modal-fields').innerHTML=fields;
    if(type==='event')$('modal-fields').insertAdjacentHTML('beforeend',`<label>Prioridad<select name="priority"><option value="1">Normal</option><option value="2">Importante</option><option value="3">Alta</option></select></label>`);
    if(type==='transaction'){$('modal-fields').querySelector('[name=category]').innerHTML=[...new Set([...C.categories,...active(state.transactions).map(t=>t.category)])].map(c=>`<option>${escapeHtml(c)}</option>`).join('');if(item)for(const key of ['type','amount','category','transaction_date','description'])$('modal-form').elements[key].value=item[key];}
    if(type==='event')$('modal-form').elements.priority.value=item?.priority||1;
    $('form-modal').showModal();
  }

  async function saveModal(event) {
    event.preventDefault();
    const context=modalContext;
    if(!context||context.saving)return;
    context.saving=true;
    const data=Object.fromEntries(new FormData(event.currentTarget));
    try {
      const ts=nowIso();
      const {type,item}=context;
      const row={...(item||{id:uid(),created_at:ts,deleted_at:null}),updated_at:ts};
      let bucket;
      if((type==='wish'||type==='event')&&!data.title.trim())throw Error('Escribe un título.');
      if(type==='wish'){
        bucket='wishes';
        Object.assign(row,{completed:row.completed??false,title:data.title.trim(),category:data.category,priority:Number(data.priority),deadline:data.deadline||null});
      } else if(type==='event'){
        bucket='events';
        Object.assign(row,{completed:row.completed??false,kind:data.kind,title:data.title.trim(),description:data.description.trim(),starts_at:new Date(data.starts_at).toISOString(),ends_at:null,reminder_minutes:Number(data.reminder_minutes),priority:Number(data.priority),reminded_at:null});
      } else {
        bucket='transactions';
        const amount=C.cents(data.amount);
        if(amount<=0||!data.description.trim()||!C.dateOK(data.transaction_date))throw Error('Revisa el importe, la fecha y la descripción.');
        Object.assign(row,{type:data.type,amount:amount/100,category:data.category,description:data.description.trim(),transaction_date:data.transaction_date});
      }
      await commitRecord(bucket,row,item);
    }catch(error){
      if(context!==modalContext)return;
      if(error.code==='STALE_RECORD'){
        context.draft=data;
        $('modal-draft').classList.remove('hidden');
      }
      $('modal-error').textContent=error.message||'No se pudo guardar.';
      $('modal-error').focus();
      return;
    }finally{context.saving=false;}
    if(context!==modalContext)return;
    $('form-modal').close();
    toast('Guardado correctamente.');
  }

  function commitRecord(bucket,row,original) {
    return store.mutate(({data})=>{
      const current=data[bucket][row.id];
      if(original&&(!current||current.deleted_at||!C.equal(current,original))){
        const error=Error('Este registro cambió o se eliminó. Tu texto sigue aquí. Descarga el borrador antes de cerrar y vuelve a abrir la versión actual.');
        error.code='STALE_RECORD';
        throw error;
      }
      data[bucket][row.id]=store.legacyRow(bucket,row);
    });
  }

  async function updateRecord(bucket,row,original) {
    try{await commitRecord(bucket,row,original);}
    catch(error){toast(error.message||'No se pudo guardar.');return false;}
    return true;
  }

  function softDelete(bucket,id) {
    const row=state[bucket].find(x=>x.id===id);
    if(!row||!confirm('¿Quieres eliminarlo?'))return;
    const ts=nowIso();
    return updateRecord(bucket,{...row,deleted_at:ts,updated_at:ts},row);
  }

  async function toggleWish(id) {
    const row=state.wishes.find(x=>x.id===id);
    if(!row)return;
    if(await updateRecord('wishes',{...row,completed:!row.completed,updated_at:nowIso()},row)&&!row.completed)toast('¡Un deseo más cerca de tu vida!');
  }

  function toggleEvent(id) {
    const row=state.events.find(x=>x.id===id);
    if(!row)return;
    const ts=nowIso(),completed=!row.completed;
    return updateRecord('events',{...row,completed,completed_at:completed?ts:null,history:[...(row.history||[]),{status:completed?'completed':'pending',at:ts}],updated_at:ts},row);
  }

  function addToCalendar(id) {
    const e=state.events.find(x=>x.id===id);if(!e)return;const stamp=d=>new Date(d).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const end=e.ends_at||new Date(new Date(e.starts_at).getTime()+3600000).toISOString();
    const content=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//I Wish//ES','BEGIN:VEVENT',`UID:${e.id}@iwish`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(e.starts_at)}`,`DTEND:${stamp(end)}`,`SUMMARY:${e.title.replace(/[,;\\]/g,'\\$&')}`,`DESCRIPTION:${(e.description||'').replace(/[,;\\]/g,'\\$&')}`,`BEGIN:VALARM`,`TRIGGER:-PT${Math.max(0,e.reminder_minutes)}M`,'ACTION:DISPLAY',`DESCRIPTION:${e.title.replace(/[,;\\]/g,'\\$&')}`,'END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
    downloadBlob(content,`${e.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()||'evento'}.ics`,'text/calendar');toast('Evento listo para añadir a tu calendario.');
  }

  function downloadBlob(content,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function exportFinance(){const month=$('finance-month').value;const rows=active(state.transactions).filter(t=>t.transaction_date.startsWith(month));const csv=['Fecha,Tipo,Categoría,Descripción,Monto',...rows.map(t=>[t.transaction_date,t.type,t.category,t.description,t.amount].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n');downloadBlob('\ufeff'+csv,`iwish-economia-${month}.csv`,'text/csv;charset=utf-8');}
  function exportAll(){store.refresh();downloadBlob(JSON.stringify({version:8,project,owner_id:state.session?.user?.id||'guest',exported_at:nowIso(),planner:store.snapshot(),wishes:state.wishes,transactions:state.transactions,events:state.events,journal:journal.export()},null,2),`iwish-respaldo-${dayKey(new Date())}.json`,'application/json');}
  async function importAll(file){
    const owner=dataScope,generation=dataGeneration;
    try{
      const data=JSON.parse(await file.text());
      if(owner!==dataScope||generation!==dataGeneration)return;
      if(!data||!['wishes','transactions','events'].some(k=>Array.isArray(data[k])))throw Error('Ese archivo no es un respaldo válido.');
      const sameProject=data.project===project;
      if(!sameProject){
        if(!Array.isArray(data.events))throw Error('El respaldo anterior no contiene Agenda.');
        if(!confirm('¿Importar únicamente las tareas y eventos de este respaldo al espacio actual?'))return;
        await importAgenda(data.events);
        toast('Agenda importada.');
        return;
      }
      journal.validateBackup(data.journal);
      const original=store.data,next=C.clone(original),same=data.owner_id===owner,mapped={};
      const mapId=async(id)=>{if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Identificador inválido en el respaldo.');if(same||(!data.owner_id&&['wishes','transactions','events'].some(k=>next[k][id])))return id;if(mapped[id])return mapped[id];const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner+':'+id)));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=[...bytes.slice(0,16)].map(b=>b.toString(16).padStart(2,'0')).join('');return mapped[id]=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
      for(const bucket of ['wishes','transactions','events'])for(const source of data[bucket]||[]){
        if(source.deleted_at)continue;
        const v={...source,id:await mapId(source.id)};delete v.user_id;
        if(bucket==='transactions'){if(!['income','expense'].includes(v.type)||!C.dateOK(v.transaction_date)||C.cents(v.amount)<=0||typeof v.description!=='string'||typeof v.category!=='string')throw Error('Movimiento inválido.');v.amount=C.cents(v.amount)/100;}
        else if(typeof v.title!=='string'||!v.title.trim())throw Error('Título inválido.');
        if(bucket==='events'){if(!Number.isFinite(Date.parse(v.starts_at))||!['task','event'].includes(v.kind))throw Error('Actividad inválida.');v.priority??=1;v.completed_at??=null;v.history??=[];if(!Array.isArray(v.history))throw Error('Historial de actividad inválido.');}
        if(bucket==='wishes'&&(![1,2,3].includes(v.priority)||(v.deadline&&!C.dateOK(v.deadline))))throw Error('Deseo inválido.');
        const existing=next[bucket][v.id];
        if(existing&&!C.equal(existing,v))throw Error('El respaldo contiene una versión distinta de un registro existente. No se importó nada.');
        next[bucket][v.id]=v;
      }
      if(data.planner){C.validate(data.planner);for(const bucket of C.collections)for(const [id,source]of Object.entries(data.planner[bucket])){if(!source)continue;const v=C.clone(source);if(bucket==='goals'&&v.wish)v.wish=await mapId(v.wish);if(next[bucket][id]&&!C.equal(next[bucket][id],v))throw Error('Hay una versión distinta de planificación. No se importó nada.');next[bucket][id]=v;}}
      C.validate(next);
      if(owner!==dataScope||generation!==dataGeneration)return;
      if(!confirm('¿Añadir este respaldo a la cuenta actual? Los datos existentes se conservarán.'+(data.journal?' Incluye un Diario privado que se importará como copias.':'')))return;
      await store.batch(latest=>{
        for(const [bucket,rows] of Object.entries(next))for(const [id,value] of Object.entries(rows)){
          if(C.equal(original[bucket][id],value))continue;
          if(Object.hasOwn(latest[bucket],id)&&!C.equal(latest[bucket][id],value))throw Error('Cambió un registro mientras importabas. Revisa el respaldo e inténtalo de nuevo.');
          latest[bucket][id]=value;
        }
      });
      if(generation!==dataGeneration)return;
      journal.importBackup(data.journal);
      toast('Respaldo importado.');
    }catch(error){toast(error.message||'No se pudo importar.');}
    finally{$('import-all').value='';}
  }

  function importAgenda(rows){
    const events=new Map();
    for(const row of rows){
      if(row?.deleted_at)continue;
      if(!row||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.id)||
         !['task','event'].includes(row.kind)||typeof row.title!=='string'||!row.title.trim()||row.title.length>300||
         !Number.isFinite(Date.parse(row.starts_at))||typeof row.completed!=='boolean'||events.has(row.id))
        throw Error('El respaldo contiene actividades inválidas o repetidas.');
      events.set(row.id,store.legacyRow('events',row));
    }
    return store.mutate(({data,base})=>{
      for(const [id,value] of events){
        if(Object.hasOwn(data.events,id)||Object.hasOwn(base.events,id)){
          if(!C.equal(data.events[id],value))throw Error('Una actividad ya existe con otra versión. No se importó el respaldo.');
        }else data.events[id]=value;
      }
    });
  }

  async function enableNotifications(){if(!('Notification'in window)){toast('Este navegador no admite notificaciones.');return;}const result=await Notification.requestPermission();toast(result==='granted'?'Notificaciones activadas.':'No se concedió permiso.');}
  async function checkReminders(){
    try{await planner?.reminders();}catch(error){console.error(error);}
    const generation=dataGeneration,now=Date.now();
    for(const e of active(state.events).filter(row=>!row.completed&&!row.reminded_at)){
      if(generation!==dataGeneration)return;
      const starts=new Date(e.starts_at).getTime();
      if(now<starts-Number(e.reminder_minutes)*60000||now>=starts+3600000)continue;
      const ts=nowIso();
      try{await commitRecord('events',{...e,reminded_at:ts,updated_at:ts},e);}
      catch(error){if(error.code!=='STALE_RECORD')console.error(error);continue;}
      if(generation!==dataGeneration)return;
      toast(`Recordatorio: ${e.title}`);
      if('Notification'in window&&Notification.permission==='granted'){
        const reg=await navigator.serviceWorker?.getRegistration();
        if(generation!==dataGeneration)return;
        reg?.active?.postMessage({type:'REMINDER',title:e.title,body:dateTimeText(e.starts_at),tag:`event-${e.id}`});
      }
    }
  }

  function bindEvents() {
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-journal-login]')){state.offlineMode=false;showAuth();}
      const route=event.target.closest('[data-route]')?.dataset.route||event.target.closest('[data-route-jump]')?.dataset.routeJump;if(route)navigate(route);
      const modal=event.target.closest('[data-open-modal]')?.dataset.openModal;if(modal)openModal(modal);
      const wf=event.target.closest('[data-wish-filter]')?.dataset.wishFilter;if(wf){state.wishFilter=wf;renderWishes();}
      const af=event.target.closest('[data-agenda-filter]')?.dataset.agendaFilter;if(af){state.agendaFilter=af;state.selectedDate='';renderAgenda();}
      const day=event.target.closest('[data-calendar-day]')?.dataset.calendarDay;if(day){state.selectedDate=state.selectedDate===day?'':day;renderAgenda();}
      const del=event.target.closest('[data-delete]');if(del)softDelete(del.dataset.delete,del.dataset.id);
      const wish=event.target.closest('[data-toggle-wish]')?.dataset.toggleWish;if(wish)toggleWish(wish);
      const complete=event.target.closest('[data-complete-event]')?.dataset.completeEvent;if(complete)toggleEvent(complete);
      const edit=event.target.closest('[data-edit-event]')?.dataset.editEvent;if(edit)openModal('event',state.events.find(x=>x.id===edit));
      const transaction=event.target.closest('[data-edit-transaction]')?.dataset.editTransaction;if(transaction)openModal('transaction',state.transactions.find(x=>x.id===transaction));
      const cal=event.target.closest('[data-calendar-event]')?.dataset.calendarEvent;if(cal)addToCalendar(cal);
    });
    $('profile-form').addEventListener('submit',saveProfile);
    setAuthMode('login');
    $('confirmation-resend').addEventListener('click',resendConfirmation);
    $('confirmation-login').addEventListener('click',()=>{setAuthMode('login');$('auth-email').value=confirmationEmail;$('auth-password').focus();});
    $('confirmation-back').addEventListener('click',()=>{setAuthMode('signup');$('auth-email').value=confirmationEmail;$('auth-email').focus();});
    $('appearance-theme').addEventListener('change',()=>setTheme($('appearance-theme').value==='dark'));
    $('auth-form').addEventListener('submit',handleAuth);$('auth-toggle').addEventListener('click',toggleAuthMode);$('offline-entry').addEventListener('click',()=>{if(switchDataScope(null)){state.offlineMode=true;showApp();}});
    $('theme-toggle').addEventListener('click',()=>setTheme(!state.dark));
    const closeModal=()=>{if(!modalContext?.saving)$('form-modal').close();};
    $('modal-form').addEventListener('submit',saveModal);
    $('modal-close').addEventListener('click',closeModal);
    $('modal-cancel').addEventListener('click',closeModal);
    $('form-modal').addEventListener('cancel',event=>{if(modalContext?.saving)event.preventDefault();});
    $('modal-draft').addEventListener('click',()=>{
      if(!modalContext?.draft)return;
      const fields=Object.fromEntries(new FormData($('modal-form')));
      downloadBlob(JSON.stringify(fields,null,2),'iwish-borrador.json','application/json');
    });
    $('cal-prev').addEventListener('click',()=>{state.calendarDate=new Date(state.calendarDate.getFullYear(),state.calendarDate.getMonth()-1,1);renderAgenda();});$('cal-next').addEventListener('click',()=>{state.calendarDate=new Date(state.calendarDate.getFullYear(),state.calendarDate.getMonth()+1,1);renderAgenda();});
    $('finance-month').addEventListener('change',renderFinance);$('export-finance').addEventListener('click',exportFinance);$('enable-notifications').addEventListener('click',enableNotifications);$('export-all').addEventListener('click',exportAll);$('import-all').addEventListener('change',e=>e.target.files[0]&&importAll(e.target.files[0]));
    $('account-action').addEventListener('click',()=>{state.offlineMode=false;showAuth();});$('sync-now').addEventListener('click',()=>{syncAll(true);journal.sync();});$('sign-out').addEventListener('click',async()=>{const result=await client?.auth.signOut({scope:'local'});if(result?.error){toast('No se pudo cerrar la sesión. Inténtalo de nuevo.');return;}switchDataScope(null);state.offlineMode=false;showAuth();});
    window.addEventListener('storage',event=>{
      if(store.owner&&event.key===store.key()){
        try{store.refresh();}catch(error){toast('No se pudieron recargar los datos de este espacio.');}
      }
    });
    window.addEventListener('focus',()=>{refreshProfile();syncAll();});
    window.addEventListener('online',()=>{updateSyncStatus();syncAll();});window.addEventListener('offline',updateSyncStatus);
  }

  async function boot() {
    welcome=window.createIWishWelcome({onShow:()=>{$('app').classList.add('hidden');$('auth-view').classList.add('hidden');},onEnter:()=>{if(state.session||state.offlineMode||!client)showApp();else showAuth();}});
    let configurationError;
    try{configureCloud();}catch(error){configurationError=error;}
    store=new window.IWishStore({client,namespace:project,syncBuckets:['events'],onChange:refreshLocal});planner=window.createIWishPlanner({store,state,toast,navigate,renderAll,downloadBlob});journal=window.createIWishJournal({client:null,namespace:project,toast,onStatus:updateSyncStatus});bindEvents();applyTheme();navigate('home');
    if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
    try {await initAuth();} catch (_) {welcome.ready();if(switchDataScope(null)){showAuth();toast('No se pudo recuperar la sesión. Vuelve a iniciar sesión.');}}
    if(configurationError)toast('Supabase no está configurado. Esta sesión funciona en modo local.');
    refreshProfile();checkReminders();setInterval(checkReminders,60000);setInterval(()=>syncAll(),60000);
  }
  boot();
})();
