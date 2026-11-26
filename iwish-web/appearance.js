/* Preferencias visuales locales. No contiene ni sincroniza datos de cuentas. */
(() => {
  'use strict';
  const key = 'iwish_appearance_v1';
  const sizes = ['normal', 'large', 'xlarge'];
  let prefs = {text: 'normal', journal: 'normal'};
  try { const saved = JSON.parse(localStorage.getItem(key) || '{}'); for (const k of ['text','journal']) if (sizes.includes(saved[k])) prefs[k] = saved[k]; } catch (_) {}
  const apply = () => {
    document.documentElement.dataset.textSize = prefs.text;
    document.documentElement.dataset.journalSize = prefs.journal;
  };
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    const status = document.getElementById('appearance-status');
    const save = () => {
      apply();
      try { localStorage.setItem(key, JSON.stringify(prefs)); status.textContent = 'Preferencia guardada en este dispositivo.'; return true; }
      catch (_) { status.textContent = 'El tamaño se aplicó, pero este navegador no permitió guardarlo.'; return false; }
    };
    document.querySelectorAll('[name="text-size"]').forEach(input => {
      input.checked = input.value === prefs.text;
      input.addEventListener('change', () => { if (sizes.includes(input.value)) { prefs.text = input.value; save(); } });
    });
    const readingControls = [...document.querySelectorAll('.journal-type-control')];
    const readingLabels = {normal:'Normal',large:'Grande',xlarge:'Muy grande'};
    const updateReadingControls = () => {
      const index = sizes.indexOf(prefs.journal);
      document.querySelectorAll('[data-journal-size-label]').forEach(label => { label.textContent = readingLabels[prefs.journal]; });
      document.querySelectorAll('[data-journal-size-step]').forEach(button => {
        const next = index + Number(button.dataset.journalSizeStep);
        button.disabled = next < 0 || next >= sizes.length;
      });
    };
    document.querySelectorAll('[data-journal-size-step]').forEach(button => button.addEventListener('click', () => {
      const next = sizes.indexOf(prefs.journal) + Number(button.dataset.journalSizeStep);
      if (next < 0 || next >= sizes.length) return;
      // Solo cambia una variable CSS. No se renderiza ni se reinicia el formulario.
      prefs.journal = sizes[next];
      const saved = save();
      updateReadingControls();
      readingControls.forEach(control => {
        control.querySelector('[data-journal-size-status]').textContent = saved
          ? 'Tamaño guardado en este dispositivo.'
          : 'El tamaño se aplicó, pero no se pudo guardar la preferencia.';
      });
    }));
    updateReadingControls();
    document.addEventListener('click', event => readingControls.forEach(control => {
      if (!control.contains(event.target)) control.open = false;
    }));
    readingControls.forEach(control => control.addEventListener('keydown', event => {
      if (event.key === 'Escape' && control.open) {
        event.preventDefault(); control.open = false; control.querySelector('summary').focus();
      }
    }));
    const nav = document.querySelector('.bottom-nav');
    const measure = () => {
      const height = Math.ceil(nav.getBoundingClientRect().height);
      if (height) document.documentElement.style.setProperty('--nav-height', `${height}px`);
    };
    if (window.ResizeObserver) new ResizeObserver(measure).observe(nav);
    measure();
    // One lightweight, consistent line icon family for existing navigation contracts.
    const paths = {
      home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
      wishes:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
      agenda:'M4 5h16v16H4ZM8 3v4m8-4v4M4 11h16m-12 4h2m4 0h2',
      finance:'M3 6h17v15H3Zm0 0V4h14v2m-2 6h6v5h-6Z',
      journal:'M4 3h15v18H4ZM8 3v18m3-13h5m-5 4h5',
      settings:'M9.5 3h5l.5 2.5 2 1.2 2.4-.8 2.5 4.2-1.9 1.7v.4l1.9 1.7-2.5 4.2-2.4-.8-2 1.2-.5 2.5h-5L9 18.5 7 17.3l-2.4.8-2.5-4.2L4 12.2v-.4l-1.9-1.7 2.5-4.2 2.4.8 2-1.2ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6'
    };
    document.querySelectorAll('.nav-item > span, .bottom-nav .nav-icon, #settings-toggle > span').forEach(span => {
      const path=paths[span.parentElement.dataset.route]; if(!path)return;
      span.setAttribute('aria-hidden','true');
      span.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="${path}"/></svg>`;
    });
    const visualViewport = window.visualViewport;
    if(visualViewport) {
      let restingHeight = Math.max(window.innerHeight, visualViewport.height);
      const updateKeyboard = () => {
        const active = document.activeElement;
        const editing = active?.matches('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), [contenteditable="true"]');
        const wasOpen = document.body.classList.contains('keyboard-open');
        if (!editing && !wasOpen) restingHeight = Math.max(window.innerHeight, visualViewport.height);
        const reduced = Math.max(restingHeight, window.innerHeight) - visualViewport.height > 140;
        // El zoom de accesibilidad no es un teclado: no debe ocultar la navegación.
        const open = matchMedia('(max-width:760px)').matches && visualViewport.scale <= 1.05 && reduced && (editing || wasOpen);
        document.body.classList.toggle('keyboard-open', !!open);
        nav.inert = !!open;
      };
      visualViewport.addEventListener('resize',updateKeyboard);
      window.addEventListener('resize',updateKeyboard);
      window.addEventListener('orientationchange', () => {
        restingHeight = 0; document.body.classList.remove('keyboard-open'); nav.inert = false;
      });
      document.addEventListener('focusin',updateKeyboard);
      document.addEventListener('focusout',()=>requestAnimationFrame(updateKeyboard));
    }
  });
})();
