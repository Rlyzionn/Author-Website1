// Procedural covers drawn in each series' design language. They stand in
// until real cover art is dropped into assets/covers/ (see data.js).

import { SERIES } from './data.js';

export const COVER_W = 512;
export const COVER_H = 768;

export const PALETTE = {
  josh:   { bg: '#0a0a0b', ink: '#f2efe9', accent: '#c8102e', accent2: '#2457ff', back: '#0d0d0e' },
  hawk:   { bg: '#0b1630', ink: '#e9d9a8', accent: '#c9a24b', accent2: '#e9d9a8', back: '#0a1328' },
  true:   { bg: '#141414', ink: '#f2efe9', accent: '#c8102e', accent2: '#8a8a8a', back: '#121212' },
  dragon: { bg: '#07201c', ink: '#f3d79a', accent: '#d9a441', accent2: '#ff6a2b', back: '#061a17' },
  trail:  { bg: '#162019', ink: '#efe4c8', accent: '#e89a4a', accent2: '#7d9a7a', back: '#121a14' },
  kids:   { bg: '#f2c14e', ink: '#1f2a44', accent: '#e4572e', accent2: '#4cb5ae', back: '#f2c14e' },
};

export async function ensureFonts() {
  const faces = ['400 80px Anton', '400 30px "Special Elite"', '700 60px Cinzel', '700 30px Archivo', '800 60px Archivo'];
  try { await Promise.all(faces.map((f) => document.fonts.load(f))); } catch { /* fall back to system fonts */ }
}

// Deterministic randomness so a title always gets the same cover.
function rng(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507), h = Math.imul(h ^ (h >>> 13), 3266489909), (h ^= h >>> 16) >>> 0) / 4294967296);
}

function grain(ctx, w, h, amount, rand) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// Moody, blurred "photograph" made of light blobs, which the noir covers sit on.
function noirPhoto(ctx, w, h, rand, tint = [255, 255, 255]) {
  for (let i = 0; i < 7; i++) {
    const x = rand() * w, y = h * (0.15 + rand() * 0.6), r = 80 + rand() * 260;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.05 + rand() * 0.16;
    g.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function fitLines(ctx, text, font, maxW, maxSize, minSize, maxLines) {
  for (let size = maxSize; size >= minSize; size -= 2) {
    ctx.font = font.replace('{s}', size);
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    lines.push(line);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) return { lines, size };
  }
  ctx.font = font.replace('{s}', minSize);
  return { lines: [text], size: minSize };
}

function spaced(ctx, text, x, y, spacing) {
  // Canvas letterSpacing support is uneven, so space characters by hand (centered).
  const widths = [...text].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let cx = x - total / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  [...text].forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = prev;
}

function drop(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2.4);
  ctx.bezierCurveTo(x + r * 0.2, y - r * 1.4, x + r, y - r * 0.6, x + r, y);
  ctx.arc(x, y, r, 0, Math.PI, false);
  ctx.bezierCurveTo(x - r, y - r * 0.6, x - r * 0.2, y - r * 1.4, x, y - r * 2.4);
  ctx.fill();
}

function drawMotif(ctx, book, p, w, h, rand) {
  switch (book.motif) {
    case 'blood': {
      noirPhoto(ctx, w, h, rand);
      for (let i = 0; i < 9; i++) drop(ctx, 60 + rand() * (w - 120), 120 + rand() * 300, 5 + rand() * 12, p.accent);
      // a long drip from the top edge
      ctx.fillStyle = p.accent;
      ctx.fillRect(w * 0.72, 0, 7, 190);
      drop(ctx, w * 0.72 + 3.5, 200, 9, p.accent);
      break;
    }
    case 'redblue': {
      noirPhoto(ctx, w, h, rand);
      // headlights in the rain
      [[w * 0.3, h * 0.42], [w * 0.62, h * 0.43]].forEach(([x, y]) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, 120);
        g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.08, 'rgba(255,255,240,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      });
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
      for (let i = 0; i < 120; i++) { const x = rand() * w, y = rand() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 28); ctx.stroke(); }
      break;
    }
    case 'redact': {
      noirPhoto(ctx, w, h, rand);
      ctx.fillStyle = 'rgba(255,255,255,.1)';
      for (let i = 0; i < 14; i++) ctx.fillRect(56, 150 + i * 22, 140 + rand() * 260, 8);
      ctx.fillStyle = '#000';
      for (let i = 0; i < 5; i++) ctx.fillRect(56 + rand() * 60, 150 + Math.floor(rand() * 14) * 22 - 4, 120 + rand() * 200, 16);
      ctx.fillStyle = p.accent; ctx.fillRect(56, 300, 400, 22);
      break;
    }
    case 'strata': {
      noirPhoto(ctx, w, h, rand);
      const cols = ['#1d1612', '#261c16', '#140f0c', '#2e2219'];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = cols[i];
        ctx.beginPath(); ctx.moveTo(0, h * (0.62 + i * 0.07));
        for (let x = 0; x <= w; x += 32) ctx.lineTo(x, h * (0.62 + i * 0.07) + Math.sin(x * 0.02 + i) * 10);
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
      }
      ctx.strokeStyle = p.accent; ctx.lineWidth = 3; ctx.beginPath();
      let y = h * 0.62; ctx.moveTo(w * 0.5, y);
      for (let i = 0; i < 9; i++) { y += 22; ctx.lineTo(w * 0.5 + (rand() - 0.5) * 70, y); }
      ctx.stroke();
      break;
    }
    case 'tape': {
      noirPhoto(ctx, w, h, rand);
      [[-0.18, 250], [0.12, 340]].forEach(([a, y]) => {
        ctx.save(); ctx.translate(w / 2, y); ctx.rotate(a);
        ctx.fillStyle = p.accent; ctx.fillRect(-w, -24, w * 2, 48);
        ctx.fillStyle = '#0a0a0b'; ctx.font = '400 26px Anton'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('CRIME SCENE  ·  DO NOT CROSS  ·  CRIME SCENE  ·  DO NOT CROSS', 0, 2);
        ctx.restore();
      });
      break;
    }
    case 'wings': {
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
      ctx.strokeRect(26, 26, w - 52, h - 52); ctx.strokeRect(36, 36, w - 72, h - 72);
      const cx = w / 2, cy = 250;
      ctx.fillStyle = p.accent;
      for (let i = 0; i < 6; i++) {
        const s = 1 - i * 0.13;
        ctx.beginPath();
        ctx.moveTo(cx, cy + i * 16);
        ctx.lineTo(cx - 170 * s, cy - 60 * s + i * 16); ctx.lineTo(cx - 150 * s, cy - 40 * s + i * 16 + 6);
        ctx.lineTo(cx, cy + i * 16 + 14);
        ctx.lineTo(cx + 150 * s, cy - 40 * s + i * 16 + 6); ctx.lineTo(cx + 170 * s, cy - 60 * s + i * 16);
        ctx.closePath(); ctx.globalAlpha = 0.95 - i * 0.12; ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'film': {
      noirPhoto(ctx, w, h, rand, [230, 225, 215]);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 34, h); ctx.fillRect(w - 34, 0, 34, h);
      ctx.fillStyle = '#2a2a2a';
      for (let y = 10; y < h; y += 30) { ctx.fillRect(9, y, 16, 18); ctx.fillRect(w - 25, y, 16, 18); }
      ctx.fillStyle = p.accent; ctx.fillRect(34, 120, w - 68, 10);
      break;
    }
    case 'scales': {
      const g = ctx.createRadialGradient(w / 2, h * 0.38, 10, w / 2, h * 0.38, 330);
      g.addColorStop(0, 'rgba(255,120,40,.55)'); g.addColorStop(0.35, 'rgba(255,106,43,.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(217,164,65,.22)'; ctx.lineWidth = 2;
      for (let row = 0; row < 26; row++) for (let col = -1; col < 12; col++) {
        const x = col * 48 + (row % 2) * 24, y = row * 26;
        ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI); ctx.stroke();
      }
      // a slit-pupil eye
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.38, 70, 34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a0800'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.38, 9, 32, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'mountains': {
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      sky.addColorStop(0, '#1e2b25'); sky.addColorStop(1, '#c46a33');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * 0.6);
      ctx.fillStyle = '#f3c27a'; ctx.beginPath(); ctx.arc(w * 0.66, h * 0.44, 46, 0, Math.PI * 2); ctx.fill();
      ['#3a4a3c', '#26332a', '#162019'].forEach((c, i) => {
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * (0.46 + i * 0.08) - Math.abs(Math.sin(x * 0.012 + i * 2)) * (90 - i * 20) - rand() * 6);
        ctx.lineTo(w, h); ctx.fill();
      });
      ctx.setLineDash([10, 10]); ctx.strokeStyle = p.accent; ctx.lineWidth = 4; ctx.beginPath();
      ctx.moveTo(w * 0.1, h * 0.98); ctx.bezierCurveTo(w * 0.7, h * 0.85, w * 0.2, h * 0.7, w * 0.55, h * 0.6); ctx.stroke(); ctx.setLineDash([]);
      break;
    }
    case 'kids':
    case 'kids2': {
      const k = book.motif === 'kids';
      ctx.fillStyle = k ? '#f2c14e' : '#4cb5ae'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc(rand() * w, rand() * h * 0.6, 6 + rand() * 18, 0, Math.PI * 2); ctx.fill(); }
      // a round, friendly dragon
      const cx = w / 2, cy = h * 0.47;
      ctx.fillStyle = k ? '#4cb5ae' : '#e4572e';
      ctx.beginPath(); ctx.ellipse(cx, cy, 110, 95, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 100, cy - 20); ctx.quadraticCurveTo(cx - 210, cy - 120, cx - 150, cy + 30); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 100, cy - 20); ctx.quadraticCurveTo(cx + 210, cy - 120, cx + 150, cy + 30); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 36, cy - 20, 22, 0, Math.PI * 2); ctx.arc(cx + 36, cy - 20, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1f2a44';
      ctx.beginPath(); ctx.arc(cx - 30, cy - 16, 10, 0, Math.PI * 2); ctx.arc(cx + 42, cy - 24, 10, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = '#1f2a44'; ctx.beginPath(); ctx.arc(cx, cy + 22, 30, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      break;
    }
  }
}

export function drawCover(book) {
  const w = COVER_W, h = COVER_H;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const p = PALETTE[book.series];
  const rand = rng(book.id);
  const isKids = book.series === 'kids';

  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, w, h);
  drawMotif(ctx, book, p, w, h, rand);

  // darken the lower half so the title always reads
  if (!isKids) {
    const shade = ctx.createLinearGradient(0, h * 0.45, 0, h);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.85)');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // series label
  ctx.fillStyle = isKids ? p.ink : p.ink;
  ctx.globalAlpha = 0.85;
  ctx.font = '700 17px Archivo';
  spaced(ctx, SERIES[book.series].label.toUpperCase(), w / 2, 72, 5);
  ctx.globalAlpha = 1;

  // title
  const fantasy = book.series === 'dragon' || book.series === 'hawk';
  const font = fantasy ? '700 {s}px Cinzel' : isKids ? '800 {s}px Archivo' : '400 {s}px Anton';
  const text = fantasy || isKids ? book.title : book.title.toUpperCase();
  const { lines, size } = fitLines(ctx, text, font, w - 80, fantasy ? 66 : 104, 34, 3);
  const lh = size * (fantasy ? 1.05 : 0.95);
  let y = h * 0.74 - (lines.length - 1) * lh;
  lines.forEach((line, i) => {
    if (book.motif === 'redblue') ctx.fillStyle = i === 0 ? p.accent : p.accent2;
    else ctx.fillStyle = p.ink;
    if (book.motif === 'redblue') { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 24; }
    ctx.fillText(line, w / 2, y + i * lh);
    ctx.shadowBlur = 0;
  });
  y += (lines.length - 1) * lh;

  if (book.subtitle) {
    ctx.font = '400 22px "Special Elite"'; ctx.fillStyle = isKids ? p.ink : p.accent;
    if (book.series === 'true') ctx.fillStyle = '#d7d2c8';
    ctx.fillText(book.subtitle, w / 2, y + 44);
  }

  // author
  ctx.fillStyle = isKids ? p.ink : p.ink;
  ctx.font = fantasy ? '700 26px Cinzel' : '400 30px Anton';
  spaced(ctx, 'JOE BROADMEADOW', w / 2, h - 48, fantasy ? 6 : 8);
  if (book.coauthor) {
    ctx.font = '400 19px "Special Elite"'; ctx.fillStyle = '#bdb7ad';
    ctx.fillText(book.coauthor, w / 2, h - 90);
  }

  if (book.soon) {
    ctx.save(); ctx.translate(w - 90, 150); ctx.rotate(0.35);
    ctx.fillStyle = p.accent2; ctx.fillRect(-120, -18, 240, 36);
    ctx.fillStyle = '#07201c'; ctx.font = '400 20px Anton'; ctx.fillText('COMING SOON', 0, 8);
    ctx.restore();
  }

  if (!isKids) grain(ctx, w, h, book.series === 'true' ? 38 : 26, rand);
  return c;
}

export function drawSpine(book) {
  const w = 96, h = COVER_H;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const p = PALETTE[book.series];
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = p.accent; ctx.fillRect(0, 40, w, 6); ctx.fillRect(0, h - 46, w, 6);
  ctx.save();
  ctx.translate(w / 2, h / 2); ctx.rotate(Math.PI / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = p.ink;
  const { size } = fitLines(ctx, book.title.toUpperCase(), '400 {s}px Anton', h - 220, 44, 20, 1);
  ctx.font = `400 ${size}px Anton`;
  ctx.fillText(book.title.toUpperCase(), -40, 2);
  ctx.font = '400 22px Anton'; ctx.fillStyle = p.accent;
  ctx.fillText('BROADMEADOW', h / 2 - 120, 2);
  ctx.restore();
  return c;
}

// Fill a canvas with real cover art when it exists, keeping the same size.
export function loadCoverImage(book) {
  return new Promise((resolve) => {
    if (!book.cover) return resolve(null);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = COVER_W; c.height = COVER_H;
      c.getContext('2d').drawImage(img, 0, 0, COVER_W, COVER_H);
      resolve(c);
    };
    img.onerror = () => resolve(null);
    img.src = book.cover;
  });
}
