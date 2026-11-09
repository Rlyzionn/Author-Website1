export const COVER_W = 512;
export const COVER_H = 768;

export const PALETTE = {
  josh:   { bg: '#0a0a0b', ink: '#f2efe9', accent: '#c8102e', back: '#0d0d0e' },
  hawk:   { bg: '#0b1630', ink: '#e9d9a8', accent: '#c9a24b', back: '#0a1328' },
  true:   { bg: '#141414', ink: '#f2efe9', accent: '#c8102e', back: '#121212' },
  dragon: { bg: '#07201c', ink: '#f3d79a', accent: '#d9a441', back: '#061a14' },
  trail:  { bg: '#162019', ink: '#efe4c8', accent: '#e89a4a', back: '#121a14' },
  kids:   { bg: '#f2c14e', ink: '#1f2a44', accent: '#e4572e', back: '#c99e3c' },
};

export async function ensureFonts() {
  const faces = ['400 44px Anton'];
  try { await Promise.all(faces.map((f) => document.fonts.load(f))); } catch { /* fall back to system fonts */ }
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

// A text-only treatment for titles without a verified cover.
export function drawCover(book) {
  const canvas = document.createElement('canvas');
  canvas.width = COVER_W;
  canvas.height = COVER_H;
  const ctx = canvas.getContext('2d');
  const palette = PALETTE[book.series];
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, COVER_W, COVER_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const { size, lines } = fitLines(ctx, book.title, '400 {s}px Georgia', COVER_W - 84, 65, 32, 4);
  ctx.fillStyle = palette.ink;
  ctx.font = `400 ${size}px Georgia`;
  lines.forEach((line, index) => {
    ctx.fillText(line, COVER_W / 2, COVER_H / 2 + (index - (lines.length - 1) / 2) * size * 1.1);
  });
  ctx.font = '400 22px sans-serif';
  ctx.fillText(book.cover ? 'Joe Broadmeadow' : 'Cover unavailable', COVER_W / 2, COVER_H - 60);
  return canvas;
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
      const ctx = c.getContext('2d');
      const scale = Math.min(COVER_W / img.naturalWidth, COVER_H / img.naturalHeight);
      const width = img.naturalWidth * scale, height = img.naturalHeight * scale;
      ctx.fillStyle = PALETTE[book.series].bg;
      ctx.fillRect(0, 0, COVER_W, COVER_H);
      ctx.drawImage(img, (COVER_W - width) / 2, (COVER_H - height) / 2, width, height);
      resolve(c);
    };
    img.onerror = () => resolve(null);
    img.src = book.cover;
  });
}
