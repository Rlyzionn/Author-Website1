// Page behaviour. Everything here is an enhancement: the HTML already holds
// the full story, every book and every link, so the page works if this file,
// the CDN libraries or WebGL fail.

import { BOOKS, bySeries, STACKED } from './data.js';
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
const state = { s: 0.5, heroScroll: 0, joshP: 0, trailP: 0, mx: 0, my: 0, intro: 0, reduced: reducedMotion || snap, mobile: matchMedia(STACKED).matches, lite: params.has('lite') || phone };

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

  state.joshP = clamp((y - layout.josh.top) / (layout.josh.h - vh));
  // a little hysteresis so the book can't flip back and forth at a boundary
  const at = state.joshP * (josh.length - 1);
  if (joshIndex === -1 || Math.abs(at - joshIndex) > 0.6) setJosh(Math.round(at));

  state.trailP = clamp(((mid - layout.trail.top) / layout.trail.h) * 1.35 - 0.12);
  const miles = Math.round(state.trailP * 2185).toLocaleString('en-US');
  if (milesEl.textContent !== miles) milesEl.textContent = miles;

  const c = Math.min(chapters.length - 1, Math.floor(s));
  if (c !== chapter) setChapter(c);

  $('#scrollLine').style.transform = `scaleX(${clamp(y / layout.max)})`;
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

async function fillCovers(art) {
  const urls = {};
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
  enhanceButtons();
  setupFilters();
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
