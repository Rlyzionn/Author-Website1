// Page behaviour. Everything here is an enhancement: the HTML already holds
// the full story, every book and every link, so the page works if this file,
// the CDN libraries or WebGL fail.

import { BOOKS, SERIES, byId, bySeries, STACKED } from './data.js';
import { ensureFonts, drawCover, drawSpine, loadCoverImage } from './covers.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?snap turns off easing in the 3D stage (handy for screenshots and QA)
// ?lite forces the low-cost renderer (no shadows or bloom), as used on phones
const params = new URLSearchParams(location.search);
const snap = params.has('snap');
const finePointer = matchMedia('(pointer: fine)').matches;
// phones get the low-cost renderer in either orientation
const phone = !finePointer && Math.min(screen.width, screen.height) < 600;
const state = { s: 0.5, heroScroll: 0, spin: 0, joshP: 0, trailP: 0, mx: 0, my: 0, intro: 0, reduced: reducedMotion || snap, mobile: matchMedia(STACKED).matches, lite: params.has('lite') || phone };

const chapters = $$('.chapter');
const josh = bySeries('josh');
const statusEl = $('#stageStatus');
const setStatus = (text) => { statusEl.textContent = text; };

// ---------- motion system: Lenis + GSAP (only if the CDN scripts loaded) ----------
const { gsap, ScrollTrigger, SplitText, Flip, Lenis } = window;
const hasGsap = Boolean(gsap && ScrollTrigger);
let lenis = null;
if (hasGsap) {
  gsap.registerPlugin(ScrollTrigger, ...[SplitText, Flip].filter(Boolean));
  if (!reducedMotion && Lenis) {
    lenis = new Lenis({ lerp: 0.085, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
}
const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.4 }) : scrollTo({ top: y, behavior: reducedMotion ? 'auto' : 'smooth' }));

// ---------- scroll → story position ----------
let layout = { chapters: [], josh: { top: 0, h: 1 }, trail: { top: 0, h: 1 }, max: 1 };
function measure() {
  const box = (el) => ({ top: el.offsetTop, h: el.offsetHeight });
  layout = {
    chapters: chapters.map(box),
    josh: box($('#josh')),
    trail: box($('#trail')),
    max: Math.max(1, document.documentElement.scrollHeight - innerHeight),
  };
  state.mobile = matchMedia(STACKED).matches;
}

let lastY = 0;
let chapter = -1;
let joshIndex = -1;
const nav = $('#nav');
const milesEl = $('#miles');
function onScroll() {
  const y = scrollY, vh = innerHeight, mid = y + vh / 2;
  let s = 0;
  layout.chapters.forEach((c, i) => { if (mid >= c.top) s = i + clamp((mid - c.top) / c.h); });
  state.s = s;
  state.heroScroll = y / vh;

  // on phones the swipe cards turn the Josh shelf instead of the page scroll
  if (!state.mobile) {
    state.joshP = clamp((y - layout.josh.top) / (layout.josh.h - vh));
    // a little hysteresis so the book can't flip back and forth at a boundary
    const at = state.joshP * (josh.length - 1);
    if (joshIndex === -1 || Math.abs(at - joshIndex) > 0.6) setJosh(Math.round(at));
  }

  state.trailP = clamp(((mid - layout.trail.top) / layout.trail.h) * 1.35 - 0.12);
  const miles = Math.round(state.trailP * 2185).toLocaleString('en-US');
  if (milesEl.textContent !== miles) milesEl.textContent = miles;

  const c = Math.min(chapters.length - 1, Math.floor(s));
  if (c !== chapter) setChapter(c);

  const progress = clamp(y / layout.max);
  $('#scrollLine').style.transform = `scaleX(${progress})`;
  dockRing.style.strokeDashoffset = 94.25 * (1 - progress);
  dock.classList.toggle('is-in', y > vh * 0.55);
  nav.classList.toggle('is-solid', y > 40);
  nav.classList.toggle('is-hidden', y > lastY + 2 && y > vh * 0.7);
  if (y < lastY - 2) nav.classList.remove('is-hidden');
  lastY = y;
}

function setChapter(c) {
  chapter = c;
  document.body.dataset.chapter = c;
  const id = chapters[c].id;
  $$('.nav__links a').forEach((a) => a.classList.toggle('is-active', a.hash === `#${id}` || (id === 'hawk' && a.hash === '#josh')));
  $$('#dockList button').forEach((b, i) => b.classList.toggle('is-current', i === c));
  const name = $('#dockName');
  name.textContent = chapters[c].dataset.name;
  if (hasGsap && !reducedMotion) gsap.fromTo(name, { yPercent: 110 }, { yPercent: 0, duration: 0.5, ease: 'power3.out' });
}

// a tiny tick under the thumb on phones that support it
// (browsers only allow it after the visitor has touched the page)
const haptic = () => { if (state.mobile && navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(6); };

// ---------- phone dock: chapter, progress and a chapter list ----------
const dock = $('#dock');
const dockRing = $('#dockRing');
function setupDock() {
  const btn = $('#dockChapter'), sheet = $('#dockSheet'), list = $('#dockList');
  chapters.forEach((c, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = c.dataset.name;
    b.addEventListener('click', () => { toggle(false); scrollToY(layout.chapters[i].top + (i ? 2 : 0)); });
    li.append(b);
    list.append(li);
  });
  function toggle(open) {
    dock.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open);
    sheet.inert = !open;
  }
  btn.addEventListener('click', () => toggle(!dock.classList.contains('is-open')));
  document.addEventListener('click', (e) => { if (!dock.contains(e.target)) toggle(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
}

// ---------- phones: swipe cards that turn the Josh Williams shelf ----------
function setupJoshCards() {
  const wrap = $('#jcards');
  josh.forEach((b) => {
    const card = document.createElement('article');
    card.className = 'jcard';
    const series = document.createElement('p'); series.className = 'jcard__series'; series.textContent = 'A Josh Williams novel';
    const title = document.createElement('h3'); title.className = 'jcard__title'; title.textContent = b.title;
    const tag = document.createElement('p'); tag.className = 'jcard__tag'; tag.textContent = b.tagline;
    const links = document.createElement('p'); links.className = 'jcard__links';
    [['Buy on Amazon', b.amazon], ['Goodreads', b.goodreads]].forEach(([text, href]) => {
      const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text;
      links.append(a);
    });
    card.append(series, title, tag, links);
    wrap.append(card);
  });
  const cards = $$('.jcard', wrap);
  let current = -1, raf = 0;
  const update = () => {
    raf = 0;
    const max = wrap.scrollWidth - wrap.clientWidth;
    if (state.mobile) state.joshP = max > 0 ? clamp(wrap.scrollLeft / max) : 0;
    const i = Math.round(clamp(wrap.scrollLeft / Math.max(1, max)) * (cards.length - 1));
    if (i === current) return;
    if (current !== -1) haptic();
    current = i;
    cards.forEach((c, k) => c.classList.toggle('is-on', k === i));
  };
  wrap.addEventListener('scroll', () => { raf ||= requestAnimationFrame(update); }, { passive: true });
  update();
}

// ---------- phones: the shelf is a coverflow ----------
function setupCoverflow() {
  const grid = $('#shelfGrid');
  let raf = 0, current = null, flowing = false;
  const update = () => {
    raf = 0;
    const items = $$('.book', grid).filter((li) => !li.hidden);
    if (!state.mobile) {
      if (flowing) items.forEach((li) => { $('a', li).style.cssText = ''; $('.b3d', li).style.removeProperty('--ry'); delete li.dataset.d; });
      flowing = false;
      return;
    }
    flowing = true;
    const r = grid.getBoundingClientRect(), cx = r.left + r.width / 2;
    let best = null, bestD = 9;
    items.forEach((li) => {
      const b = li.getBoundingClientRect();
      const d = clamp(((b.left + b.width / 2) - cx) / (r.width * 0.6), -1, 1);
      const a = Math.abs(d);
      li.dataset.d = d.toFixed(3);
      $('a', li).style.cssText = `transform: translateY(${a * 22}px) scale(${1 - a * 0.2}); opacity: ${1 - a * 0.55}`;
      // books beside the centre turn their faces in toward it
      $('.b3d', li).style.setProperty('--ry', `${d * 48 - (1 - a) * 12}deg`);
      if (a < bestD) { bestD = a; best = li; }
    });
    if (best !== current) { if (current) haptic(); current = best; }
  };
  grid.addEventListener('scroll', () => { raf ||= requestAnimationFrame(update); }, { passive: true });
  addEventListener('resize', () => { raf ||= requestAnimationFrame(update); });
  $('#filters').addEventListener('click', () => setTimeout(() => { grid.scrollLeft = 0; update(); }, 760));
  update();
}

// ---------- phones: drag across the hero to turn the book ----------
function setupHeroSpin() {
  if (reducedMotion) return;
  const hero = $('#hero');
  let x0 = null, y0 = 0, x1 = 0, active = false;
  hero.addEventListener('touchstart', (e) => {
    if (!state.mobile) return;
    const t = e.touches[0];
    if (t.clientY > innerHeight * 0.55) return; // the book sits in the top half
    x0 = x1 = t.clientX; y0 = t.clientY; active = false;
    if (hasGsap) gsap.killTweensOf(state, 'spin');
  }, { passive: true });
  hero.addEventListener('touchmove', (e) => {
    if (x0 === null) return;
    const t = e.touches[0];
    const dx = t.clientX - x1, tx = t.clientX - x0, ty = t.clientY - y0;
    x1 = t.clientX;
    if (!active && Math.abs(tx) > 8 && Math.abs(tx) > Math.abs(ty)) { active = true; hero.classList.add('is-touched'); }
    if (active) state.spin += dx / 70;
  }, { passive: true });
  const release = () => {
    if (x0 === null) return;
    x0 = null;
    if (!active) return;
    // settle back to the cover by the shortest way round
    const turn = Math.PI * 2;
    state.spin = ((state.spin % turn) + turn * 1.5) % turn - turn / 2;
    if (hasGsap) gsap.to(state, { spin: 0, duration: 1.6, ease: 'elastic.out(1, 0.45)' });
    else state.spin = 0;
  };
  hero.addEventListener('touchend', release, { passive: true });
  hero.addEventListener('touchcancel', release, { passive: true });
}

// ---------- Josh Williams feature ----------
function setJosh(i) {
  if (i === joshIndex) return;
  const first = joshIndex === -1;
  joshIndex = i;
  const b = josh[i];
  $$('#joshPips i').forEach((p, k) => p.classList.toggle('is-on', k === i));
  $('#joshTitle').textContent = b.title;
  $('#joshTag').textContent = b.tagline;
  $('#joshAmazon').href = b.amazon;
  $('#joshGoodreads').href = b.goodreads;
  $$('#joshTicks a').forEach((a, k) => a.classList.toggle('is-active', k === i));
  if (hasGsap && !reducedMotion && !first) {
    gsap.fromTo('#joshBody', { opacity: 0.25, y: 10 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', overwrite: true });
  }
}
$$('#joshTicks a').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  const i = +a.dataset.josh;
  scrollToY(layout.josh.top + (layout.josh.h - innerHeight) * (i / (josh.length - 1)));
}));

// ---------- buttons ----------
function enhanceButtons() {
  $$('.btn__label').forEach((label) => {
    const text = label.textContent.trim();
    const roll = document.createElement('span');
    roll.className = 'btn__roll';
    const a = document.createElement('span');
    const b = document.createElement('span');
    a.textContent = text; b.textContent = text; b.setAttribute('aria-hidden', 'true');
    roll.append(a, b);
    label.replaceChildren(roll);
  });
  // the primary fill grows from wherever the pointer enters
  $$('.btn-primary').forEach((btn) => {
    const at = (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--x', `${e.clientX - r.left}px`);
      btn.style.setProperty('--y', `${e.clientY - r.top}px`);
    };
    btn.addEventListener('pointerenter', at);
    btn.addEventListener('pointerleave', at);
  });
  if (hasGsap && finePointer && !reducedMotion) {
    $$('[data-magnetic]').forEach((btn) => {
      const xTo = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'power3' });
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.22);
        yTo((e.clientY - r.top - r.height / 2) * 0.35);
      });
      btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }
}

// ---------- scroll reveals ----------
function setupReveals() {
  if (!hasGsap) return; // without GSAP, content simply stays visible
  const once = (trigger, start = 'top 86%') => ({ trigger, start, once: true });
  $$('[data-split]').forEach((el) => {
    if (SplitText && !reducedMotion) {
      SplitText.create(el, {
        type: 'lines', mask: 'lines', autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, { yPercent: 108, duration: 1.15, ease: 'expo.out', stagger: 0.09, scrollTrigger: once(el, 'top 84%') }),
      });
    } else {
      gsap.from(el, { autoAlpha: 0, duration: 0.6, scrollTrigger: once(el) });
    }
  });
  $$('[data-reveal]').forEach((el) => {
    gsap.from(el, { autoAlpha: 0, y: reducedMotion ? 0 : 30, duration: reducedMotion ? 0.5 : 1.1, ease: 'power3.out', scrollTrigger: once(el, 'top 90%') });
  });
  $$('.rule').forEach((el) => gsap.from(el, { scaleX: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: once(el) }));
  $$('[data-count]').forEach((el) => {
    const to = +el.dataset.count;
    const fmt = (n) => (el.hasAttribute('data-comma') ? Math.round(n).toLocaleString('en-US') : String(Math.round(n)));
    if (reducedMotion) return;
    const o = { v: 0 };
    gsap.to(o, { v: to, duration: 2, ease: 'power2.out', onUpdate: () => { el.textContent = fmt(o.v); }, scrollTrigger: once(el, 'top 92%') });
  });
}

// ---------- shelf filters (Flip) ----------
function setupFilters() {
  const bar = $('#filters');
  bar.hidden = false;
  const items = $$('#shelfGrid .book');
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const k = btn.dataset.filter;
    $$('button', bar).forEach((b) => b.setAttribute('aria-pressed', b === btn));
    const before = Flip && !reducedMotion ? Flip.getState(items) : null;
    items.forEach((li) => { li.hidden = !(k === 'all' || li.dataset.series === k); });
    const done = () => { measure(); ScrollTrigger?.refresh(); };
    if (before) {
      Flip.from(before, {
        duration: 0.7, ease: 'power3.inOut', absolute: true, scale: true,
        onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, delay: 0.2 }),
        onLeave: (els) => gsap.to(els, { autoAlpha: 0, duration: 0.25 }),
        onComplete: done,
      });
    } else done();
  });
}

// ---------- covers ----------
async function buildArt() {
  setStatus('Loading type');
  await ensureFonts();
  setStatus('Preparing the covers');
  const art = {};
  for (const b of BOOKS) {
    const real = await loadCoverImage(b);
    art[b.id] = { cover: real || drawCover(b), spine: drawSpine(b) };
  }
  return art;
}

const coverUrls = {};
async function fillCovers(art) {
  const urls = coverUrls;
  await Promise.all(BOOKS.map((b) => new Promise((resolve) => {
    art[b.id].cover.toBlob((blob) => { urls[b.id] = blob ? URL.createObjectURL(blob) : null; resolve(); }, 'image/jpeg', 0.86);
  })));
  $$('[data-cover]').forEach((el) => {
    const url = urls[el.dataset.cover];
    if (!url) return;
    const img = new Image();
    img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    img.width = 512; img.height = 768;
    img.src = url;
    el.setAttribute('aria-hidden', 'true');
    el.append(img);
  });
}

// ---------- 3D books: every cover gets page edges and a spine ----------
function makeBooks3d() {
  $$('.cover[data-cover]').forEach((cover) => {
    const b = document.createElement('span');
    b.className = cover.classList.contains('cover--thumb') ? 'b3d b3d--thumb' : 'b3d';
    b.dataset.series = cover.dataset.series;
    const spine = document.createElement('span'); spine.className = 'b3d__spine';
    const pages = document.createElement('span'); pages.className = 'b3d__pages';
    cover.replaceWith(b);
    b.append(spine, pages, cover);
  });
  if (!finePointer || reducedMotion) return;
  // on the shelf, a book turns toward the pointer
  $$('#shelfGrid .book a').forEach((a) => {
    const b = $('.b3d', a);
    a.addEventListener('pointermove', (e) => {
      const r = a.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      b.style.setProperty('--ry', `${-26 + px * 22}deg`);
      b.style.setProperty('--rx', `${-py * 10}deg`);
    });
    a.addEventListener('pointerleave', () => { b.style.removeProperty('--ry'); b.style.removeProperty('--rx'); });
  });
}

// ---------- case file: book detail opened from the shelf ----------
function setLabel(btn, text) {
  const spans = $$('.btn__roll > span', btn);
  if (spans.length) spans.forEach((sp) => { sp.textContent = text; });
  else $('.btn__label', btn).textContent = text;
}
function setupCaseFile() {
  const dlg = $('#casefile');
  if (!dlg || typeof dlg.showModal !== 'function') return; // the shelf links still go to Amazon
  const book3d = $('#cfBook'), cover = $('#cfCover'), buy = $('#cfBuy'), gr = $('#cfGoodreads'), sheet = $('.casefile__sheet', dlg);

  function open(b, fromEl) {
    book3d.dataset.series = b.series;
    cover.dataset.series = b.series;
    cover.replaceChildren();
    if (coverUrls[b.id]) {
      const img = new Image(); img.alt = ''; img.src = coverUrls[b.id]; img.width = 512; img.height = 768;
      cover.append(img);
    } else {
      const t = document.createElement('span'); t.className = 'cover__title'; t.textContent = b.title;
      cover.append(t);
    }
    $('#cfStamp').textContent = SERIES[b.series].name;
    $('#cfSeries').textContent = b.coauthor ? `${SERIES[b.series].label}, ${b.coauthor}` : SERIES[b.series].label;
    $('#cfTitle').textContent = b.title;
    $('#cfSub').textContent = b.subtitle || '';
    $('#cfTag').textContent = b.tagline;
    buy.hidden = b.soon;
    buy.href = b.amazon;
    gr.href = b.goodreads;
    setLabel(gr, b.soon ? 'Follow on Goodreads' : 'Goodreads');

    lenis?.stop();
    dlg.showModal();
    haptic();
    if (!hasGsap || reducedMotion) return;
    if (state.mobile) {
      // phones: the file slides up from the bottom like a native sheet
      gsap.fromTo(sheet, { y: innerHeight }, { y: 0, duration: 0.6, ease: 'expo.out' });
      gsap.from('.casefile__book', { y: 40, rotation: -4, duration: 0.9, delay: 0.1, ease: 'expo.out' });
      gsap.from('.casefile__body > :not(.casefile__stamp)', { autoAlpha: 0, y: 18, duration: 0.6, stagger: 0.05, delay: 0.18, ease: 'power3.out' });
      gsap.from('#cfStamp', { scale: 1.9, autoAlpha: 0, duration: 0.45, delay: 0.45, ease: 'back.out(2.2)' });
      return;
    }
    // the book flies from the shelf into the file
    const holder = $('.casefile__book', dlg);
    const from = fromEl.getBoundingClientRect(), to = book3d.getBoundingClientRect();
    gsap.fromTo(holder, { x: from.left - to.left, y: from.top - to.top, scale: from.width / to.width, transformOrigin: '0 0' },
      { x: 0, y: 0, scale: 1, duration: 0.95, ease: 'expo.out', clearProps: 'transform' });
    gsap.from('.casefile__body > :not(.casefile__stamp), .casefile__tab', { autoAlpha: 0, y: 22, duration: 0.7, stagger: 0.06, delay: 0.12, ease: 'power3.out' });
    gsap.from('#cfStamp', { scale: 1.9, autoAlpha: 0, duration: 0.45, delay: 0.5, ease: 'back.out(2.2)' });
  }

  $('#shelfGrid').addEventListener('click', (e) => {
    const a = e.target.closest('.book a');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const li = a.closest('.book');
    // in the phone coverflow, tapping a side book brings it to the centre first
    if (state.mobile && Math.abs(+li.dataset.d || 0) > 0.2) {
      li.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
      return;
    }
    open(byId[li.dataset.book], $('.b3d', a));
  });

  // closing slides the sheet away on phones
  function close() {
    if (!dlg.open) return;
    if (!state.mobile || !hasGsap || reducedMotion) { dlg.close(); return; }
    gsap.to(sheet, { y: sheet.offsetHeight + 40, duration: 0.35, ease: 'power3.in', onComplete: () => { dlg.close(); gsap.set(sheet, { clearProps: 'transform' }); } });
  }
  $('#cfClose').addEventListener('click', close);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('close', () => lenis?.start());

  // drag the handle down to dismiss
  const grab = $('#cfGrab');
  let y0 = null, dy = 0, t0 = 0;
  grab.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; t0 = performance.now(); grab.setPointerCapture(e.pointerId); });
  grab.addEventListener('pointermove', (e) => {
    if (y0 === null) return;
    dy = Math.max(0, e.clientY - y0);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const drop = () => {
    if (y0 === null) return;
    y0 = null;
    const fast = dy / Math.max(1, performance.now() - t0) > 0.6;
    if (dy > 110 || (fast && dy > 30)) close();
    else if (hasGsap) gsap.fromTo(sheet, { y: dy }, { y: 0, duration: 0.45, ease: 'back.out(1.6)', onStart: () => { sheet.style.transform = ''; } });
    else sheet.style.transform = '';
  };
  grab.addEventListener('pointerup', drop);
  grab.addEventListener('pointercancel', drop);
}

// ---------- themed details: police tape, redactions, depth ----------
function setupTheme() {
  // fill each tape strip with its phrase, repeated well past the screen edge
  $$('.tape__strip span').forEach((sp) => { sp.textContent = Array(14).fill(sp.textContent.trim()).join('   '); });

  // redaction bars peel off once the phrase is in view
  const io = 'IntersectionObserver' in window && new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target;
    setTimeout(() => el.classList.add('is-open'), el.closest('.hero') ? 1400 : 450);
    io.unobserve(el);
  }), { threshold: 1, rootMargin: '0px 0px -12% 0px' });
  $$('.redact').forEach((el) => (io ? io.observe(el) : el.classList.add('is-open')));

  if (!hasGsap || reducedMotion) return;
  const scrub = (trigger, extra = {}) => ({ trigger, start: 'top bottom', end: 'bottom top', scrub: 0.6, ...extra });
  // tape slides across as it passes, its two strips in opposite directions
  $$('.tape').forEach((tape) => {
    $$('.tape__strip', tape).forEach((strip, i) => {
      const dir = i ? 1 : -1;
      gsap.fromTo($('span', strip), { xPercent: -4 * dir - 10 }, { xPercent: 4 * dir - 10, ease: 'none', scrollTrigger: scrub(tape, { start: 'top bottom', end: 'top top' }) });
      gsap.from(strip, { x: dir * 260, ease: 'none', scrollTrigger: scrub(tape, { start: 'top bottom', end: 'top 55%' }) });
    });
  });
  // headlines drift a little slower than the page; the portrait shifts inside its frame
  $$('.chapter:not(.josh):not(.hero) .title').forEach((el) => {
    gsap.fromTo(el, { y: 50 }, { y: -50, ease: 'none', scrollTrigger: scrub(el) });
  });
  gsap.fromTo('.portrait picture img', { yPercent: -5, scale: 1.12 }, { yPercent: 5, scale: 1.12, ease: 'none', scrollTrigger: scrub('.portrait') });
  // list books turn toward the reader as they pass
  $$('.b3d--thumb').forEach((el) => {
    gsap.fromTo(el, { '--ry': '-44deg' }, { '--ry': '-8deg', ease: 'none', scrollTrigger: scrub(el, { end: 'center 40%' }) });
  });
}

// ---------- misc ----------
if (finePointer && !reducedMotion) {
  addEventListener('pointermove', (e) => {
    state.mx = (e.clientX / innerWidth - 0.5) * 2;
    state.my = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });
}

const copyBtn = $('#copyBio');
if (navigator.clipboard) {
  copyBtn.hidden = false;
  copyBtn.addEventListener('click', async () => {
    const label = $('.btn__roll', copyBtn) || copyBtn;
    try {
      await navigator.clipboard.writeText($('#pressBio').textContent.trim());
      $$('span', label).forEach((s) => { s.textContent = 'Copied'; });
    } catch {
      $$('span', label).forEach((s) => { s.textContent = 'Select and copy'; });
    }
    setTimeout(() => $$('span', label).forEach((s) => { s.textContent = 'Copy bio'; }), 1800);
  });
}

// ---------- boot ----------
async function boot() {
  makeBooks3d();
  enhanceButtons();
  setupFilters();
  setupCaseFile();
  setupTheme();
  setupDock();
  setupJoshCards();
  setupCoverflow();
  setupHeroSpin();
  measure();
  onScroll();
  (lenis ? lenis.on.bind(lenis, 'scroll') : (fn) => addEventListener('scroll', fn, { passive: true }))(onScroll);
  addEventListener('resize', () => { measure(); onScroll(); });
  if (hasGsap) ScrollTrigger.addEventListener('refresh', () => { measure(); onScroll(); });
  setupReveals();

  const art = await buildArt();
  fillCovers(art);

  setStatus('Lighting the stage');
  let stage = null;
  try {
    const { initScene } = await import('./scene.js');
    stage = initScene($('#stage'), art, state);
  } catch (err) {
    console.warn('3D stage unavailable; the page continues without it.', err);
  }
  if (!stage) {
    document.documentElement.classList.add('no-webgl');
    statusEl.classList.add('is-done');
    return;
  }
  await stage.start(hasGsap ? gsap.ticker : null);
  $('#stage').classList.add('is-ready');
  setStatus('Stage ready');
  setTimeout(() => statusEl.classList.add('is-done'), 600);

  // the hero book swings into its pose once the stage is lit
  const t0 = performance.now(), dur = state.reduced ? 1 : 2000;
  const tick = (now) => { state.intro = clamp((now - t0) / dur); if (state.intro < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
boot();
