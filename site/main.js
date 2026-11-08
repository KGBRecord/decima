/* Dissend landing: motion and the queue playground.
   Every animation here has a job: hierarchy (word reveals, hero entry), storytelling (the upload
   rail and staggered card entry) or feedback (buttons, the playground).
   Nothing runs when the visitor prefers reduced motion; the page is complete without it. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ---------- queue playground (works with or without motion) ---------- */
  (function playground() {
    const files = $('#files'), per = $('#per'), stage = $('#pg-stage');
    const out = $('#pg-out'), status = $('#pg-status'), run = $('#pg-run');
    if (!files) return;
    let timer = 0;
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

    function render() {
      clearInterval(timer); timer = 0; run.disabled = false; run.textContent = 'Simulate a run'; status.textContent = '';
      const f = +files.value, p = +per.value, n = Math.ceil(f / p), last = f - (n - 1) * p;
      $('#files-v').textContent = f; $('#per-v').textContent = p;
      [files, per].forEach((r) => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%'));
      stage.innerHTML = Array.from({ length: n }, (_, m) => {
        const c = m === n - 1 ? last : p;
        return `<div class="msg${c < p ? ' part' : ''}" style="--i:${m}">${'<i></i>'.repeat(c)}</div>`;
      }).join('');
      out.textContent = `${plural(f, 'file')} ${n === 1 ? 'becomes' : 'become'} ${plural(n, 'message')}. ` + (n === 1 ? '' : last === p ? 'Every message is full.' : `The last one carries ${last}.`);
    }

    run.addEventListener('click', () => {
      const tiles = $$('.msg', stage); if (!tiles.length) return;
      tiles.forEach((t) => t.classList.remove('sent', 'now'));
      run.disabled = true; stage.scrollTop = 0;
      const step = Math.min(450, Math.max(70, 2600 / tiles.length));
      let i = 0;
      timer = setInterval(() => {
        if (i > 0) { tiles[i - 1].classList.remove('now'); tiles[i - 1].classList.add('sent'); }
        if (i >= tiles.length) {
          clearInterval(timer); timer = 0; run.disabled = false; run.textContent = 'Run it again';
          status.textContent = `Done. ${plural(tiles.length, 'message')} posted.`; return;
        }
        tiles[i].classList.add('now');
        tiles[i].scrollIntoView({ block: 'nearest', inline: 'nearest' });
        status.textContent = `Sending message ${i + 1} of ${tiles.length}`;
        i++;
      }, step);
    });
    files.addEventListener('input', render);
    per.addEventListener('input', render);
    render();
  })();

  /* ---------- everything below needs motion + GSAP ---------- */
  const animated = root.classList.contains('anim');
  if (!animated) { drawStaticField(); return; }
  if (!window.gsap || !window.ScrollTrigger) { root.classList.remove('anim'); drawStaticField(); return; }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  gsap.defaults({ ease: 'power3.out' });

  /* split text into words, keeping inline elements (the accent span) and <br> */
  function splitWords(el) {
    const wrap = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.append(' '); return; }
            const w = document.createElement('span'); w.className = 'w';
            const i = document.createElement('span'); i.className = 'wi'; i.textContent = tok;
            w.append(i); frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') wrap(n);
      });
    };
    wrap(el); el.classList.add('split');
    return $$('.wi', el);
  }
  $$('[data-words]').forEach((el) => { el.__w = splitWords(el); gsap.set(el.__w, { yPercent: 112 }); });

  /* 1. upload row: the rail fills with scroll and lights each step node; cards rise in turn */
  (function flowRow() {
    const row = $('.flow-row'); if (!row) return;
    const rail = $('.flow-rail', row), nodes = $$('.flow-rail b', row), steps = $$('.flow-steps li', row);
    gsap.set(steps, { opacity: 0, y: 56 });
    ScrollTrigger.create({ trigger: row, start: 'top 82%', once: true,
      onEnter: () => gsap.to(steps, { opacity: 1, y: 0, duration: 1, stagger: 0.16, ease: 'power4.out', clearProps: 'transform,opacity' }) });
    gsap.to($('.flow-rail i', row), { scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: row, start: 'top 72%', end: 'bottom 62%', scrub: 0.5,
        onUpdate: (s) => { const w = rail.offsetWidth; nodes.forEach((n) => n.classList.toggle('on', s.progress > 0 && s.progress * w >= n.offsetLeft)); } } });
  })();

  /* 3. page-level: progress line, nav that gets out of the way */
  gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.2 } });
  const nav = $('.nav');
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => nav.classList.toggle('hide', s.direction === 1 && s.scroll() > 420) });

  /* 4. hero entry, then parallax on the way out */
  const h1w = $('.hero h1').__w;
  gsap.timeline({ delay: 0.15 })
    .to(h1w, { yPercent: 0, duration: 1.15, ease: 'power4.out', stagger: 0.075 })
    .fromTo('.hero .lede', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, '-=0.7')
    .fromTo('.hero .cta', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, '-=0.7')
    .fromTo('.hero-shot', { y: 90, opacity: 0, rotate: 2.5 }, { y: 0, opacity: 1, rotate: 0, duration: 1.4, ease: 'power4.out' }, 0.25);
  gsap.to('.hero-par', { yPercent: -14, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.aura i:nth-child(1)', { yPercent: 30, xPercent: -10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* 5. scroll reveals: headings word by word, blocks as they arrive */
  $$('h2[data-words]').forEach((h2) => {
    ScrollTrigger.create({ trigger: h2, start: 'top 86%', once: true,
      onEnter: () => gsap.to(h2.__w, { yPercent: 0, duration: 1.05, ease: 'power4.out', stagger: 0.05 }) });
  });
  ScrollTrigger.batch('[data-rv]', { start: 'top 90%', once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.95, stagger: 0.09, overwrite: true }) });
  gsap.set('.install-steps li', { opacity: 0, y: 40 });
  ScrollTrigger.batch('.install-steps li', { start: 'top 92%', once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, clearProps: 'transform,opacity' }) });

  /* 6. footer wordmark fills as the page ends */
  gsap.to('.mark-fill', { clipPath: 'inset(0 0% 0 0)', ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top 92%', end: 'bottom bottom', scrub: 0.4 } });

  /* 7. pointer physics: hero tilt, magnetic buttons (fine pointers only) */
  if (fine) {
    const tilt = $('.tilt'), shot = $('.hero-shot');
    const rx = gsap.quickTo(tilt, 'rotationX', { duration: 0.6, ease: 'power3' });
    const ry = gsap.quickTo(tilt, 'rotationY', { duration: 0.6, ease: 'power3' });
    shot.addEventListener('pointermove', (e) => {
      const b = shot.getBoundingClientRect();
      ry(((e.clientX - b.left) / b.width - 0.5) * 14);
      rx(-((e.clientY - b.top) / b.height - 0.5) * 12);
    });
    shot.addEventListener('pointerleave', () => { rx(0); ry(0); });
    $$('.magnetic').forEach((b) => {
      const x = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'power3' }), y = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'power3' });
      b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * 0.28); y((e.clientY - r.top - r.height / 2) * 0.4); });
      b.addEventListener('pointerleave', () => { x(0); y(0); });
    });
  }

  /* 8. hero field: files drifting, every tenth one lit */
  startField();

  window.addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.__dsReady = true;

  /* ---------- hero canvas ---------- */
  function fieldCtx() {
    const c = $('#field'); if (!c) return null;
    const ctx = c.getContext('2d');
    const st = { c, ctx, w: 0, h: 0, pts: [], mx: -999, my: -999 };
    st.resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2), r = c.getBoundingClientRect();
      st.w = r.width; st.h = r.height; c.width = r.width * dpr; c.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(140, (st.w * st.h) / 9500));
      st.pts = Array.from({ length: n }, (_, i) => ({ x: Math.random() * st.w, y: Math.random() * st.h, vx: (Math.random() - 0.5) * 0.22, vy: -0.08 - Math.random() * 0.22, s: 5 + Math.random() * 8, lit: i % 10 === 0 }));
    };
    st.draw = () => {
      ctx.clearRect(0, 0, st.w, st.h);
      for (const p of st.pts) {
        ctx.fillStyle = p.lit ? 'rgba(200,255,61,.85)' : 'rgba(239,237,230,.16)';
        ctx.beginPath(); ctx.roundRect(p.x, p.y, p.s, p.s * 1.25, 2); ctx.fill();
      }
    };
    st.resize();
    return st;
  }
  function drawStaticField() { const st = fieldCtx(); if (st) { st.draw(); addEventListener('resize', () => { st.resize(); st.draw(); }); } }
  function startField() {
    const st = fieldCtx(); if (!st) return;
    let on = false, raf = 0;
    const hero = $('.hero');
    hero.addEventListener('pointermove', (e) => { const r = st.c.getBoundingClientRect(); st.mx = e.clientX - r.left; st.my = e.clientY - r.top; });
    hero.addEventListener('pointerleave', () => { st.mx = st.my = -999; });
    const tick = () => {
      for (const p of st.pts) {
        const dx = p.x - st.mx, dy = p.y - st.my, d2 = dx * dx + dy * dy;
        if (d2 < 19600) { const d = Math.sqrt(d2) || 1, f = (140 - d) / 140; p.x += (dx / d) * f * 3.2; p.y += (dy / d) * f * 3.2; }
        p.x += p.vx; p.y += p.vy;
        if (p.y < -14) { p.y = st.h + 8; p.x = Math.random() * st.w; }
        if (p.x < -14) p.x = st.w + 8; else if (p.x > st.w + 14) p.x = -8;
      }
      st.draw(); raf = requestAnimationFrame(tick);
    };
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !on) { on = true; raf = requestAnimationFrame(tick); }
      else if (!e.isIntersecting && on) { on = false; cancelAnimationFrame(raf); }
    }).observe(hero);
    let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(st.resize, 200); });
  }
})();
