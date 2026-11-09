// Page behaviour. Everything here is an enhancement: the HTML already holds
// the full story, every book and every link, so the page works if this file,
// the CDN libraries or WebGL fail.

import { BOOKS, SERIES, byId, bySeries, STACKED } from './data.js';
import { ensureFonts, drawCover, drawSpine, loadCoverImage } from './covers.js';
import { fetchPosts, formatDate, isFresh } from './blog-feed.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?snap turns off easing in the 3D stage (handy for screenshots and QA)
// ?lite forces the low-cost renderer used on phones
const params = new URLSearchParams(location.search);
const snap = params.has('snap');
const finePointer = matchMedia('(pointer: fine)').matches;
// phones get the low-cost renderer in either orientation
const phone = !finePointer && Math.min(screen.width, screen.height) < 600;
const state = { s: 0.5, heroScroll: 0, spin: 0, joshP: 0, trailP: 0, mx: 0, my: 0, reduced: reducedMotion || snap, mobile: matchMedia(STACKED).matches, lite: params.has('lite') || phone };

const chapters = $$('.chapter');
const josh = bySeries('josh');
const statusEl = $('#stageStatus');
const setStatus = (text) => { if (!statusEl.classList.contains('is-done')) statusEl.textContent = text; };

// Native scrolling supplies the position for the stage and chapter transitions.
const { gsap, ScrollTrigger } = window;
const hasGsap = Boolean(gsap && ScrollTrigger);
if (hasGsap) gsap.registerPlugin(ScrollTrigger);
const scrollToY = (y) => scrollTo({ top: y, behavior: reducedMotion ? 'instant' : 'smooth' });

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

let navY = 0;
let lastMiles = -1;
let trailProgress = -1;
let scrollFrame = 0;
let chapter = -1;
let joshIndex = -1;
const nav = $('#nav');
const milesEl = $('#miles');
const milesGauge = $('#milesGauge');
const scrollLine = $('#scrollLine');
function onScroll() {
  scrollFrame = 0;
  const y = scrollY, vh = innerHeight, mid = y + vh / 2;
  let s = 0;
  layout.chapters.forEach((c, i) => { if (mid >= c.top) s = i + clamp((mid - c.top) / c.h); });
  state.s = s;
  state.heroScroll = y / vh;

  // on phones the swipe cards turn the Josh shelf instead of the page scroll
  if (!state.mobile) {
    state.joshP = clamp((y - layout.josh.top) / Math.max(1, layout.josh.h - vh));
    // a little hysteresis so the book can't flip back and forth at a boundary
    const at = state.joshP * (josh.length - 1);
    if (joshIndex === -1 || Math.abs(at - joshIndex) > 0.6) setJosh(Math.round(at));
  }

  state.trailP = clamp(((mid - layout.trail.top) / layout.trail.h) * 1.35 - 0.12);
  const miles = Math.round(state.trailP * 2185);
  if (miles !== lastMiles) {
    milesEl.textContent = miles.toLocaleString('en-US');
    lastMiles = miles;
  }
  if (state.trailP !== trailProgress) {
    milesGauge.style.strokeDashoffset = 1 - state.trailP;
    trailProgress = state.trailP;
  }

  const c = Math.min(chapters.length - 1, Math.floor(s));
  if (c !== chapter) setChapter(c);

  const progress = clamp(y / layout.max);
  scrollLine.style.transform = `scaleX(${progress})`;
  if (state.mobile) dockRing.style.strokeDashoffset = 94.25 * (1 - progress);
  dock.classList.toggle('is-in', y > vh * 0.55);
  nav.classList.toggle('is-solid', y > 40);
  if (y <= vh * 0.7 || Math.abs(y - navY) > 10) {
    nav.classList.toggle('is-hidden', y > vh * 0.7 && y > navY);
    navY = y;
  }
}

function queueScroll() {
  scrollFrame ||= requestAnimationFrame(onScroll);
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
    [['Buy on Amazon', b.buy], ['Book page', b.page]].forEach(([text, href]) => {
      if (!href) return;
      const a = document.createElement('a'); a.href = href; a.textContent = text;
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
  const buy = $('#joshAmazon');
  buy.hidden = !b.buy;
  if (b.buy) buy.href = b.buy;
  $('#joshDetails').href = b.page;
  $$('#joshTicks a').forEach((a, k) => a.classList.toggle('is-active', k === i));
  if (hasGsap && !reducedMotion && !first) {
    gsap.fromTo('#joshBody', { opacity: 0.25, y: 10 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', overwrite: true });
  }
}
$$('#joshTicks a').forEach((a) => a.addEventListener('click', (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const i = +a.dataset.josh;
  scrollToY(layout.josh.top + (layout.josh.h - innerHeight) * (i / Math.max(1, josh.length - 1)));
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
  if (!hasGsap || reducedMotion) return;
  const once = (trigger, start = 'top 86%') => ({ trigger, start, once: true });
  $$('[data-split], [data-reveal]').forEach((el) => {
    gsap.from(el, { opacity: 0, y: 15, duration: 0.5, ease: 'power2.out', scrollTrigger: once(el, 'top 94%') });
  });
  $$('.rule').forEach((el) => gsap.from(el, { scaleX: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: once(el) }));

}

// ---------- shelf filters ----------
function setupFilters() {
  const bar = $('#filters');
  bar.hidden = false;
  const items = $$('#shelfGrid .book');
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const k = btn.dataset.filter;
    $$('button', bar).forEach((b) => b.setAttribute('aria-pressed', b === btn));
    items.forEach((li) => { li.hidden = !(k === 'all' || li.dataset.series === k); });
    $('#shelfGrid').scrollTo({ left: 0, behavior: 'instant' });
    measure();
    queueScroll();
    if (hasGsap) ScrollTrigger.refresh();

  });
}

// ---------- covers ----------
async function buildArt() {
  setStatus('Loading type');
  await ensureFonts();
  setStatus('Preparing the covers');
  const entries = await Promise.all(BOOKS.map(async (book) => {
    const cover = await loadCoverImage(book) || drawCover(book);
    return [book.id, { cover, spine: drawSpine(book) }];
  }));
  return Object.fromEntries(entries);
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
function setupCaseFile() {
  const dlg = $('#casefile');
  if (!dlg || typeof dlg.showModal !== 'function') return; // The shelf links open the static book pages.
  const book3d = $('#cfBook'), cover = $('#cfCover'), buy = $('#cfBuy'), sheet = $('.casefile__sheet', dlg);

  function open(b, fromEl) {
    book3d.dataset.series = b.series;
    cover.dataset.series = b.series;
    cover.replaceChildren();
    if (b.cover) {
      const img = new Image(); img.alt = b.artLabel || `Cover of ${b.title}`; img.src = b.cover; img.width = 512; img.height = 768;
      cover.append(img);
    } else {
      const t = document.createElement('span'); t.className = 'cover__title'; t.textContent = b.title;
      cover.append(t);
    }
    $('#cfStamp').textContent = SERIES[b.series].name;
    $('#cfSeries').textContent = b.coauthor ? `${SERIES[b.series].label}, ${b.coauthor}` : SERIES[b.series].label;
    $('#cfTitle').textContent = b.title;
    $('#cfSub').textContent = b.subtitle || '';
    $('#cfTag').textContent = b.description;
    $('#cfDetails').href = b.page;
    buy.hidden = !b.buy;
    if (b.buy) buy.href = b.buy;

    dlg.showModal();
    state.paused = true;
    document.documentElement.classList.add('dialog-open');
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
  dlg.addEventListener('close', () => {
    state.paused = false;
    document.documentElement.classList.remove('dialog-open');
  });

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
// ---------- hero: the latest dispatches from Joe's blog ----------
const make = (tag, className) => Object.assign(document.createElement(tag), { className });
async function setupDispatch() {
  const box = $('#dispatch'), list = $('#dispatchList');
  let posts = [];
  try { ({ posts } = await fetchPosts({ perPage: 3 })); } catch { return; } // the hero simply goes without
  if (!posts.length) return;
  posts.forEach((post) => {
    const li = make('li', 'dispatch__item');
    const a = Object.assign(document.createElement('a'), { href: post.link, target: '_blank', rel: 'noopener' });
    const thumb = make('span', 'dispatch__thumb');
    thumb.innerHTML = '<svg class="dispatch__ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30"/><circle class="dispatch__ring-fill" cx="32" cy="32" r="30" pathLength="1"/></svg>';
    if (post.image) {
      thumb.append(Object.assign(new Image(), { src: post.image, alt: '', loading: 'lazy', decoding: 'async' }));
    } else {
      thumb.append(Object.assign(make('span', 'dispatch__quote'), { textContent: '\u201C' }));
    }
    const meta = make('span', 'dispatch__meta');
    const time = Object.assign(document.createElement('time'), { dateTime: post.date.toISOString(), textContent: formatDate(post.date, false) });
    if (isFresh(post.date)) time.append(' ', Object.assign(make('span', 'dispatch__new'), { textContent: 'New' }));
    meta.append(time, Object.assign(make('span', 'dispatch__title'), { textContent: post.title }));
    a.append(thumb, meta);
    li.append(a);
    list.append(li);
  });
  box.hidden = false;
  if (hasGsap && !reducedMotion) gsap.from(box, { y: 30, autoAlpha: 0, duration: 1.1, ease: 'expo.out' });

  // the ring round the active post fills like a timer, then hands on to the next
  const items = $$('.dispatch__item', list);
  if (reducedMotion || items.length < 2) return;
  let current = 0;
  const activate = (k) => items.forEach((it, j) => it.classList.toggle('is-active', j === k));
  list.addEventListener('animationend', (e) => {
    if (!e.target.classList.contains('dispatch__ring-fill')) return;
    current = (current + 1) % items.length;
    activate(current);
  });
  activate(0);
}

// ---------- circular studio components ----------
function setupCircles() {
  // Set the seal text on a circular path.
  $$('[data-seal]').forEach((el, k) => {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'seal__ring'); svg.setAttribute('viewBox', '0 0 120 120'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path');
    path.id = `seal-${k}`;
    path.setAttribute('d', 'M60,60 m-47,0 a47,47 0 1,1 94,0 a47,47 0 1,1 -94,0');
    path.setAttribute('fill', 'none');
    const text = document.createElementNS(NS, 'text');
    const tp = document.createElementNS(NS, 'textPath');
    tp.setAttribute('href', `#seal-${k}`);
    tp.setAttribute('textLength', '293'); tp.setAttribute('lengthAdjust', 'spacing');
    tp.textContent = el.dataset.seal;
    text.append(tp);
    svg.append(path, text);
    el.prepend(svg);
  });
  // chapter dials beside each label
  $$('.chapter .col > .label, .shelf__head .label').forEach((label) => {
    label.insertAdjacentHTML('afterbegin', '<svg class="dial" viewBox="0 0 24 24" aria-hidden="true"><circle class="dial__track" cx="12" cy="12" r="9.5"/><circle class="dial__fill" cx="12" cy="12" r="9.5" pathLength="1"/></svg>');
    const fill = $('.dial__fill', label);
    if (!hasGsap || reducedMotion) { fill.style.strokeDashoffset = 0; return; }
    ScrollTrigger.create({ trigger: label.closest('.chapter'), start: 'top 75%', end: 'bottom 40%', onUpdate: (self) => { fill.style.strokeDashoffset = 1 - self.progress; } });
  });

  // timeline: the line draws down and each year lights up as it is reached
  const tl = $('.timeline');
  const line = document.createElement('span');
  line.className = 'timeline__line'; line.setAttribute('aria-hidden', 'true');
  tl.prepend(line);
  if (!hasGsap || reducedMotion) { $$('li', tl).forEach((li) => li.classList.add('is-lit')); return; }
  gsap.fromTo(line, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: tl, start: 'top 75%', end: 'bottom 55%', scrub: 0.5 } });
  $$('li', tl).forEach((li) => {
    ScrollTrigger.create({ trigger: li, start: 'top 68%', onEnter: () => li.classList.add('is-lit'), onLeaveBack: () => li.classList.remove('is-lit') });
    gsap.from(li, { x: -24, autoAlpha: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: li, start: 'top 90%', once: true } });
  });
}

// ---------- extra motion per section ----------
function setupSectionMotion() {
  if (!hasGsap || reducedMotion) return;
  const once = (trigger, start = 'top 84%') => ({ trigger, start, once: true });
  // list books stagger in, each tipping up off the page
  $$('.list').forEach((list) => {
    gsap.from($$('.list__item', list), { y: 40, autoAlpha: 0, rotationX: -18, transformPerspective: 800, duration: 0.9, stagger: 0.14, ease: 'power3.out', scrollTrigger: once(list) });
  });
  // the off-duty card and the press card tilt in like papers laid on a desk
  ['.offduty', '.press'].forEach((sel) => {
    gsap.from(sel, { rotationX: -24, rotation: -1.5, y: 40, transformPerspective: 900, transformOrigin: '50% 100%', duration: 1.1, ease: 'expo.out', scrollTrigger: once(sel, 'top 88%') });
  });
  // the round CTA and the portrait stamp land like a stamp
  gsap.from('.seal--cta, .portrait__seal', { scale: 0.4, rotation: -40, autoAlpha: 0, duration: 1, ease: 'back.out(1.8)', scrollTrigger: once('.seal--cta, .portrait__seal', 'top 90%') });
}

function setupTheme() {
  // fill each tape strip with its phrase, repeated well past the screen edge
  $$('.tape__strip span').forEach((sp) => { sp.textContent = Array(14).fill(sp.textContent.trim()).join('   '); });

  // redaction bars peel off once the phrase is in view
  const io = !reducedMotion && 'IntersectionObserver' in window && new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target;
    setTimeout(() => el.classList.add('is-open'), el.closest('.hero') ? 1400 : 450);
    io.unobserve(el);
  }), { threshold: 1, rootMargin: '0px 0px -12% 0px' });
  $$('.redact').forEach((el) => (io ? io.observe(el) : el.classList.add('is-open')));

  if (!hasGsap || reducedMotion || state.mobile) return;
  const scrub = (trigger, extra = {}) => ({ trigger, start: 'top bottom', end: 'bottom top', scrub: 0.6, ...extra });
  // tape slides across as it passes, its two strips in opposite directions
  $$('.tape').forEach((tape) => {
    $$('.tape__strip', tape).forEach((strip, i) => {
      const dir = i ? 1 : -1;
      gsap.fromTo($('span', strip), { xPercent: -4 * dir - 10 }, { xPercent: 4 * dir - 10, ease: 'none', scrollTrigger: scrub(tape, { start: 'top bottom', end: 'top top' }) });
      gsap.from(strip, { x: dir * 260, ease: 'none', scrollTrigger: scrub(tape, { start: 'top bottom', end: 'top 55%' }) });
    });
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
  document.documentElement.classList.add('js');
  makeBooks3d();
  setupDispatch();
  enhanceButtons();
  setupFilters();
  setupCaseFile();
  setupTheme();
  setupCircles();
  setupSectionMotion();
  setupDock();
  setupJoshCards();
  setupHeroSpin();
  measure();
  onScroll();
  addEventListener('scroll', queueScroll, { passive: true });
  const updateLayout = () => { measure(); queueScroll(); };
  addEventListener('resize', updateLayout);
  if (hasGsap) ScrollTrigger.addEventListener('refresh', updateLayout);
  if ('ResizeObserver' in window) new ResizeObserver(updateLayout).observe($('#main'));
  setupReveals();

  let stage = null;
  const showStaticStage = () => {
    stage = null;
    $('#stage').classList.remove('is-ready');
    document.documentElement.classList.add('no-webgl');
    statusEl.classList.add('is-done');
  };
  const statusTimeout = setTimeout(() => statusEl.classList.add('is-done'), 5000);
  try {
    const [{ initScene }, art] = await Promise.all([import('./scene.js'), buildArt()]);
    setStatus('Lighting the stage');
    stage = initScene($('#stage'), art, state);
    if (stage) await stage.start(hasGsap ? gsap.ticker : null, showStaticStage);
    if (stage) $('#stage').classList.add('is-ready');
  } catch (err) {
    stage = null;
    console.warn('3D stage unavailable; the page continues without it.', err);
  }
  clearTimeout(statusTimeout);
  if (!stage) {
    showStaticStage();
    return;
  }
  setStatus('Stage ready');
  setTimeout(() => statusEl.classList.add('is-done'), 600);

}
boot();
