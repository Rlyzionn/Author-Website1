// The fixed WebGL stage behind the page: a dark room with one spotlight,
// where each book (or object) is lit in turn. Every object is a function of
// the scroll position `s` (chapter index + progress through it), so the
// journey is deterministic and plays in reverse when scrolling back.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { bySeries, byId, BOOKS, STACKED } from './data.js';
import { PALETTE } from './covers.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
// 0 before a, eases to 1 by b, holds until c, eases back to 0 by d
const win = (s, a, b, c, d) => (s <= a || s >= d ? 0 : s < b ? ease((s - a) / (b - a)) : s <= c ? 1 : ease(1 - (s - c) / (d - c)));

// Room tint per chapter: hero, about, josh, hawk, true, dragon, trail, shelf, closing
const BG = ['#070708', '#08080a', '#0b0708', '#060b1a', '#0a0a0a', '#03100d', '#090d0a', '#070708', '#070708', '#070708'].map((c) => new THREE.Color(c));
const RIM = ['#c4142f', '#8fa3c4', '#c4142f', '#c8a253', '#8fa3c4', '#e8692c', '#d99a52', '#c4142f', '#c4142f', '#c4142f'].map((c) => new THREE.Color(c));
const FLOOR_Y = -1.55;

function spriteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function pagesCanvas() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 4;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9bea6'; ctx.fillRect(0, 0, 128, 4);
  for (let x = 0; x < 128; x += 2) { ctx.fillStyle = `rgba(110,90,60,${0.06 + Math.random() * 0.12})`; ctx.fillRect(x, 0, 1, 4); }
  return c;
}

function badgeFaceCanvas() {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S * 0.4, S * 0.35, 20, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#f6dc8e'); g.addColorStop(0.6, '#c9a24b'); g.addColorStop(1, '#7c5e22');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#3a2c10'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.47, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.33, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#2b200b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ring = (text, r, start, dir) => {
    ctx.font = '400 46px Anton';
    const step = (Math.PI * 0.9) / text.length;
    [...text].forEach((ch, i) => {
      const a = start + dir * (i - (text.length - 1) / 2) * step;
      ctx.save(); ctx.translate(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r);
      ctx.rotate(a + (dir > 0 ? Math.PI / 2 : -Math.PI / 2)); ctx.fillText(ch, 0, 0); ctx.restore();
    });
  };
  ring('EAST PROVIDENCE', S * 0.4, -Math.PI / 2, 1);
  ring('POLICE', S * 0.4, Math.PI / 2, -1);
  ctx.font = '400 58px Anton'; ctx.fillText('CAPT.', S / 2, S / 2 - 30);
  ctx.font = '400 40px Anton'; ctx.fillText('20 YRS', S / 2, S / 2 + 36);
  return c;
}

function crackCanvas() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1024, 512);
  ctx.strokeStyle = '#ffb347'; ctx.shadowColor = '#ff6a2b'; ctx.shadowBlur = 18; ctx.lineCap = 'round';
  for (let k = 0; k < 9; k++) {
    let x = Math.random() * 1024, y = 60 + Math.random() * 120;
    ctx.lineWidth = 2 + Math.random() * 3;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 0; i < 14; i++) {
      x += (Math.random() - 0.5) * 70; y += 10 + Math.random() * 26;
      ctx.lineTo(x, y);
      if (Math.random() < 0.25) { ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 80, y + Math.random() * 40); ctx.moveTo(x, y); }
    }
    ctx.stroke();
  }
  return c;
}

// The title page revealed when the hero book opens. Redrawn once the page
// serif has loaded, so the first frame never waits on a font.
function titlePageCanvas(book, seriesLabel) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 768;
  const draw = () => {
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#efe6d2'; ctx.fillRect(0, 0, 512, 768);
    for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(120,96,60,${Math.random() * 0.05})`; ctx.fillRect(Math.random() * 512, Math.random() * 768, 1.4, 1.4); }
    const g = ctx.createLinearGradient(0, 0, 60, 0);
    g.addColorStop(0, 'rgba(60,40,20,.28)'); g.addColorStop(1, 'rgba(60,40,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 60, 768);
    ctx.textAlign = 'center'; ctx.fillStyle = '#1b1712';
    ctx.font = '500 15px Geist, sans-serif';
    ctx.letterSpacing = '5px';
    ctx.fillText(seriesLabel.toUpperCase(), 256, 196);
    ctx.letterSpacing = '0px';
    const words = book.title.split(' ');
    const half = Math.ceil(words.length / 2);
    ctx.font = '400 66px "Instrument Serif", serif';
    ctx.fillText(words.slice(0, half).join(' '), 256, 300);
    ctx.font = 'italic 400 66px "Instrument Serif", serif';
    ctx.fillStyle = '#8f1023';
    ctx.fillText(words.slice(half).join(' '), 256, 368);
    ctx.fillStyle = '#1b1712';
    ctx.fillRect(226, 412, 60, 1.5);
    ctx.font = '500 17px Geist, sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillText('JOE BROADMEADOW', 256, 470);
    ctx.letterSpacing = '0px';
  };
  draw();
  const ready = document.fonts.load('66px "Instrument Serif"').then(() => document.fonts.load('15px Geist')).then(draw).catch(() => {});
  return { canvas: c, ready };
}

// Grey-scale detail maps drawn once: smudges for the floor, a cloth weave
// for the boards, fine wear for the cover laminate. They multiply roughness,
// so they stay light (about 0.6 to 1) and never make a surface mirror-smooth
// under the strong key light.
function detailCanvas(size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  return c;
}
const smudges = (ctx, S) => {
  ctx.fillStyle = '#e2e2e2'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 20 + Math.random() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const v = Math.random() < 0.5 ? 255 : 150;
    g.addColorStop(0, `rgba(${v},${v},${v},${0.1 + Math.random() * 0.2})`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 9000; i++) { const v = 170 + Math.random() * 85 | 0; ctx.fillStyle = `rgba(${v},${v},${v},.15)`; ctx.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5); }
};
const weave = (ctx, S) => {
  ctx.fillStyle = '#e0e0e0'; ctx.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 2) { ctx.fillStyle = `rgba(150,150,150,${0.15 + Math.random() * 0.2})`; ctx.fillRect(0, y, S, 1); }
  for (let x = 0; x < S; x += 2) { ctx.fillStyle = `rgba(255,255,255,${0.06 + Math.random() * 0.1})`; ctx.fillRect(x, 0, 1, S); }
};
const wear = (ctx, S) => {
  ctx.fillStyle = '#e6e6e6'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.08})`; ctx.lineWidth = 0.6 + Math.random();
    ctx.beginPath(); const x = Math.random() * S, y = Math.random() * S; ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 80); ctx.stroke();
  }
  smudges(ctx, S);
};

// A soft volumetric cone for the spotlight: brightest at the lamp, fading
// toward the floor and at the silhouette edges.
function makeBeam() {
  const geo = new THREE.CylinderGeometry(0.06, 1.35, 1, 48, 1, true);
  geo.translate(0, -0.5, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#fff1dc') }, uOpacity: { value: 0.11 } },
    vertexShader: /* glsl */`
      varying float vH; varying vec3 vN; varying vec3 vV;
      void main() {
        vH = -position.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity;
      varying float vH; varying vec3 vN; varying vec3 vV;
      void main() {
        float edge = pow(abs(dot(vN, vV)), 1.6);
        float fall = pow(1.0 - vH, 1.4) * smoothstep(0.0, 0.08, vH);
        gl_FragColor = vec4(uColor, edge * fall * uOpacity);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geo, mat);
}

export function initScene(canvas, art, state) {
  const high = !state.mobile && !state.lite;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: high, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  // ACES, run a little dark: it keeps the deepest blacks for the noir look
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  const scene = new THREE.Scene();
  scene.background = BG[0].clone();
  // exponential haze: the room falls away into smoke rather than a hard edge
  scene.fog = new THREE.FogExp2(BG[0].clone(), 0.062);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(0, 0.15, 6);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();

  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };
  const sprite = spriteTexture();

  // ---------- light: one key spotlight, a cool rim, and a whisper of fill ----------
  scene.add(new THREE.HemisphereLight(0x6f7c92, 0x020202, 0.14));
  const spotTarget = new THREE.Object3D();
  scene.add(spotTarget);
  const spot = new THREE.SpotLight(0xfff1dc, 70, 16, 0.42, 0.85, 1.4);
  spot.position.set(1.6, 5.2, 2.4);
  spot.target = spotTarget;
  scene.add(spot);
  const fill = new THREE.DirectionalLight(0x9fb2cc, 0.16);
  fill.position.set(-4, 2, 5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xc4142f, 2.2);
  rim.position.set(4, 1.5, -3); scene.add(rim);
  const sirenR = new THREE.PointLight(0xff2a44, 0, 6, 1.6);
  const sirenB = new THREE.PointLight(0x3b6dff, 0, 6, 1.6);
  scene.add(sirenR, sirenB);
  const emberLight = new THREE.PointLight(0xff6a2b, 0, 6, 1.5);
  scene.add(emberLight);

  const beam = makeBeam();
  scene.add(beam);

  // ---------- the floor: dark, slightly glossy ----------
  const floorDetail = new THREE.CanvasTexture(detailCanvas(512, smudges));
  floorDetail.wrapS = floorDetail.wrapT = THREE.RepeatWrapping;
  floorDetail.repeat.set(14, 14);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x060607, roughness: 0.55, roughnessMap: floorDetail, metalness: 0.6, envMapIntensity: 0.4,
    transparent: true,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  scene.add(floor);

  // ---------- the room: a pool of light on the back wall, a soft contact shadow ----------
  const radial = (inner, outer) => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, inner); g.addColorStop(0.45, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  };
  // A soft pool of light on the back wall behind the exhibit. Its lower half
  // fades out before the floor line, so it never leaves a hard horizon.
  const poolCanvas = document.createElement('canvas');
  poolCanvas.width = poolCanvas.height = 256;
  {
    const ctx = poolCanvas.getContext('2d');
    const g = ctx.createRadialGradient(128, 110, 0, 128, 110, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    ctx.globalCompositeOperation = 'destination-in';
    const v = ctx.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, '#000'); v.addColorStop(0.55, '#000'); v.addColorStop(0.82, 'rgba(0,0,0,0)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, 256, 256);
  }
  const wallMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(poolCanvas), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(15, 11), wallMat);
  wall.position.set(0, 2.2, -10);
  scene.add(wall);
  const contactMat = new THREE.MeshBasicMaterial({ map: radial('rgba(0,0,0,.85)', 'rgba(0,0,0,.35)'), transparent: true, depthWrite: false, opacity: 0 });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), contactMat);
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = FLOOR_Y + 0.004;
  scene.add(contact);

  // ---------- hardcover books ----------
  const pagesSide = tex(pagesCanvas());
  const pagesTop = tex(pagesCanvas());
  pagesTop.center.set(0.5, 0.5); pagesTop.rotation = Math.PI / 2;
  const pagesSideMat = new THREE.MeshStandardMaterial({ map: pagesSide, roughness: 0.95, envMapIntensity: 0.2 });
  const pagesTopMat = new THREE.MeshStandardMaterial({ map: pagesTop, roughness: 0.95, envMapIntensity: 0.2 });
  const weaveMap = new THREE.CanvasTexture(detailCanvas(256, weave));
  weaveMap.wrapS = weaveMap.wrapT = THREE.RepeatWrapping; weaveMap.repeat.set(3, 4.5);
  const wearMap = new THREE.CanvasTexture(detailCanvas(512, wear));
  const textures = {};
  const texFor = (b) => (textures[b.id] ||= { cover: tex(art[b.id].cover), spine: tex(art[b.id].spine) });
  const boardMats = {};
  const boardMat = (series) => (boardMats[series] ||= new THREE.MeshStandardMaterial({ color: PALETTE[series].back, roughness: 0.78, roughnessMap: weaveMap, envMapIntensity: 0.3 }));
  const geoCache = {};
  const endpaperMat = new THREE.MeshStandardMaterial({ color: 0x3a0d14, roughness: 0.85 });

  function bookGeos(size) {
    if (geoCache[size]) return geoCache[size];
    const W = size, H = 1.5 * size, D = 0.19 * size, T = 0.024 * size, O = 0.02 * size;
    return (geoCache[size] = {
      W, H, D, T, O,
      board: new THREE.BoxGeometry(W + O, H + O * 2, T),
      pages: new THREE.BoxGeometry(W - O * 0.4, H, D - T * 2),
      spine: new THREE.CylinderGeometry(D / 2, D / 2, H + O * 2, 24, 1, true, Math.PI, Math.PI),
    });
  }

  function makeBook(book, size = 1, titlePage = null) {
    const g = bookGeos(size);
    const t = texFor(book);
    const edge = boardMat(book.series);
    const coverMat = high
      ? new THREE.MeshPhysicalMaterial({ map: t.cover, roughness: 0.5, roughnessMap: wearMap, clearcoat: 0.4, clearcoatRoughness: 0.35, clearcoatRoughnessMap: wearMap, envMapIntensity: 0.45 })
      : new THREE.MeshStandardMaterial({ map: t.cover, roughness: 0.5, roughnessMap: wearMap, envMapIntensity: 0.45 });
    const spineMat = new THREE.MeshStandardMaterial({ map: t.spine, roughness: 0.45, envMapIntensity: 0.6, side: THREE.DoubleSide });

    const book3d = new THREE.Group();
    const front = new THREE.Mesh(g.board, [edge, edge, edge, edge, coverMat, titlePage ? endpaperMat : edge]);
    // the front board hangs on a hinge at the spine so it can swing open
    const hinge = new THREE.Group();
    hinge.position.set(-g.W / 2, 0, g.D / 2 - g.T / 2);
    front.position.set(g.O / 2 + g.W / 2, 0, 0);
    hinge.add(front);
    const back = new THREE.Mesh(g.board, edge);
    back.position.set(g.O / 2, 0, -g.D / 2 + g.T / 2);
    const pageFront = titlePage ? new THREE.MeshStandardMaterial({ map: titlePage, color: 0x6e675c, roughness: 1, envMapIntensity: 0.25 }) : pagesSideMat;
    const pages = new THREE.Mesh(g.pages, [pagesSideMat, pagesSideMat, pagesTopMat, pagesTopMat, pageFront, pagesSideMat]);
    pages.position.x = -g.O * 0.2;
    const spine = new THREE.Mesh(g.spine, spineMat);
    spine.position.x = -g.W / 2;
    book3d.add(hinge, back, pages, spine);
    book3d.userData.hinge = hinge;
    book3d.userData.book = book;
    return book3d;
  }

  const anchors = [];
  const anchor = () => { const g = new THREE.Group(); scene.add(g); anchors.push(g); return g; };

  // 0 · hero book
  const heroA = anchor();
  const heroTitle = titlePageCanvas(byId.pieces, 'A Josh Williams Novel');
  const heroTitleTex = tex(heroTitle.canvas);
  heroTitle.ready.then(() => { heroTitleTex.needsUpdate = true; });
  const heroBook = makeBook(byId.pieces, 1.25, heroTitleTex);
  heroA.add(heroBook);

  // the hero's studio set: a turntable plinth the book levitates over, and a
  // Ring light behind the book.
  const plinth = new THREE.Group();
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.32, metalness: 0.75, envMapIntensity: 0.55 });
  const plinthTop = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.06, 0.12, 72), plinthMat);
  const plinthBase = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.16, 0.07, 72), plinthMat);
  plinthBase.position.y = -0.095;
  const rimGlow = new THREE.Mesh(new THREE.TorusGeometry(1.005, 0.007, 8, 120), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc4142f).multiplyScalar(2.4) }));
  rimGlow.rotation.x = Math.PI / 2;
  rimGlow.position.y = 0.061;
  // tick marks around the top show the turntable turning
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.004, 0.09), new THREE.MeshBasicMaterial({ color: 0x8a8278 }), 48);
  {
    const m = new THREE.Object3D();
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.9, 0.062, Math.sin(a) * 0.9);
      m.rotation.set(0, -a + Math.PI / 2, 0);
      m.scale.set(1, 1, i % 4 ? 0.55 : 1);
      m.updateMatrix();
      ticks.setMatrixAt(i, m.matrix);
    }
  }
  plinth.add(plinthTop, plinthBase, rimGlow, ticks);
  plinth.position.y = -1.2;
  heroA.add(plinth);
  const ringLight = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.03, 14, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1dc).multiplyScalar(1.35) }));
  ringLight.position.set(0.15, 0.1, -1.35);
  heroA.add(ringLight);

  // 1 · police badge
  const badgeA = anchor();
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a24b, metalness: 1, roughness: 0.34, envMapIntensity: 0.85 });
  {
    const star = new THREE.Shape();
    for (let i = 0; i < 12; i++) {
      const r = i % 2 ? 0.62 : 1.05, a = (i / 12) * Math.PI * 2 + Math.PI / 2;
      i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    star.closePath();
    const sg = new THREE.ExtrudeGeometry(star, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4 });
    sg.center();
    badgeA.add(new THREE.Mesh(sg, gold));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 16), gold);
      ball.position.set(Math.cos(a) * 1.1, Math.sin(a) * 1.1, 0);
      badgeA.add(ball);
    }
    const face = new THREE.MeshStandardMaterial({ map: tex(badgeFaceCanvas()), metalness: 0.8, roughness: 0.38, envMapIntensity: 0.8 });
    const discGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.1, 64);
    discGeo.rotateY(Math.PI / 2); // turn the cap so the engraving reads upright
    discGeo.rotateX(Math.PI / 2);
    const disc = new THREE.Mesh(discGeo, [gold, face, gold]);
    disc.position.z = 0.06;
    badgeA.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 12, 80), gold);
    ring.position.z = 0.11;
    badgeA.add(ring);
  }

  // 2 · Josh Williams carousel
  const joshA = anchor();
  const shelfRing = new THREE.Group();
  joshA.add(shelfRing);
  const joshBooks = bySeries('josh');
  const R = 1.18;
  joshBooks.forEach((b, i) => {
    const m = makeBook(b, 0.95);
    const a = (i / joshBooks.length) * Math.PI * 2;
    m.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
    m.rotation.y = a;
    shelfRing.add(m);
  });

  // 3 · Hawk Bennett + gold dust
  const hawkA = anchor();
  const hawkBook = makeBook(byId.hate, 1.2);
  hawkA.add(hawkBook);
  const dust = (n, spread, color, size, opacity = 1) => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = spread[0] + Math.random() * spread[1];
      pos.set([Math.cos(a) * r, (Math.random() - 0.5) * spread[2], Math.sin(a) * r], i * 3);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: sprite, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  };
  const goldDust = dust(high ? 300 : 125, [1.0, 1.3, 2.8], 0xe0b860, 0.045);
  hawkA.add(goldDust);

  // 4 · true crime: three exhibits
  const trueA = anchor();
  const trueBooks = bySeries('true').slice(0, 3).map((b, i) => {
    const m = makeBook(b, 0.92);
    trueA.add(m);
    return { m, i };
  });

  // 5 · dragon egg, embers and orbiting books
  const dragonA = anchor();
  const eggGeo = new THREE.IcosahedronGeometry(1, 4);
  {
    const p = eggGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      v.multiplyScalar(1 + (Math.random() - 0.5) * 0.035);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    eggGeo.computeVertexNormals();
  }
  const eggMat = new THREE.MeshStandardMaterial({
    color: 0x0f3a31, metalness: 0.6, roughness: 0.26, flatShading: true,
    emissive: 0xffffff, emissiveMap: tex(crackCanvas()), emissiveIntensity: 1.4, envMapIntensity: 1.2,
  });
  const egg = new THREE.Mesh(eggGeo, eggMat);
  egg.scale.set(0.8, 1.08, 0.8);
  dragonA.add(egg);
  const orbit = new THREE.Group();
  orbit.rotation.set(0.35, 0, -0.25);
  dragonA.add(orbit);
  bySeries('dragon').forEach((b, i) => {
    const m = makeBook(b, 0.55);
    m.userData.phase = (i / 3) * Math.PI * 2;
    orbit.add(m);
  });
  const EMBERS = high ? 300 : 120;
  const emberGeo = new THREE.BufferGeometry();
  const emberPos = new Float32Array(EMBERS * 3);
  const emberSeed = new Float32Array(EMBERS);
  for (let i = 0; i < EMBERS; i++) {
    emberPos.set([(Math.random() - 0.5) * 3.4, -2 + Math.random() * 4.5, (Math.random() - 0.5) * 2.4], i * 3);
    emberSeed[i] = Math.random();
  }
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xff7a33, size: 0.055, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  dragonA.add(embers);

  // 6 · the Appalachian Trail as a topographic dot field
  const trailA = anchor();
  const height = (x, z) => 0.55 * Math.sin(x * 0.8) * Math.cos(z * 0.7) + 0.32 * Math.sin(x * 1.9 + z * 1.2) + 0.14 * Math.sin(x * 4.1 - z * 3.3) + 0.25 * Math.cos(z * 0.9);
  {
    const cols = high ? 130 : 70, rows = high ? 64 : 40;
    const pos = new Float32Array(cols * rows * 3);
    let k = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c / (cols - 1) - 0.5) * 7, z = (r / (rows - 1) - 0.5) * 5;
      pos[k++] = x; pos[k++] = height(x, z); pos[k++] = z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    trailA.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xefe4c8, size: 0.026, transparent: true, opacity: 0.5, depthWrite: false })));
  }
  const trailPts = [];
  for (let i = 0; i <= 24; i++) {
    const x = -3.2 + (i / 24) * 6.4, z = Math.sin(i * 0.55) * 1.1 + 0.4;
    trailPts.push(new THREE.Vector3(x, height(x, z) + 0.05, z));
  }
  const curve = new THREE.CatmullRomCurve3(trailPts);
  const tubeGeo = new THREE.TubeGeometry(curve, 400, 0.022, 8, false);
  trailA.add(new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({ color: 0xffa860 })));
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.065, 20, 16), new THREE.MeshBasicMaterial({ color: 0xfff1d6 }));
  const markerGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: 0xff9a4a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  markerGlow.scale.setScalar(0.7);
  marker.add(markerGlow);
  trailA.add(marker);
  trailA.rotation.x = 0.42;

  // 8 · closing: the whole bibliography in a slow helix
  const helixA = anchor();
  const helix = new THREE.Group();
  helixA.add(helix);
  BOOKS.forEach((b, i) => {
    const m = makeBook(b, 0.5);
    const a = i * 0.62;
    m.position.set(Math.sin(a) * 1.25, (i - (BOOKS.length - 1) / 2) * 0.11, Math.cos(a) * 1.25);
    m.rotation.y = a;
    helix.add(m);
  });

  // dust motes hanging in the beam
  const motes = dust(high ? 420 : 160, [0, 7, 8], 0xffffff, 0.02, 0.45);
  scene.add(motes);

  // ---------- layout ----------
  const L = { objX: 1.6, yOff: 0, scale: 1, mobile: false };
  let maxPR = high ? 1.2 : 1;
  let needsFrame = true;
  function resize() {
    needsFrame = true;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const ratio = Math.min(window.devicePixelRatio, maxPR);
    if (ratio !== renderer.getPixelRatio()) renderer.setPixelRatio(ratio);
    if (canvas.width !== Math.floor(w * ratio) || canvas.height !== Math.floor(h * ratio)) {
      renderer.setSize(w, h, false);
    }
    camera.aspect = w / h;
    L.mobile = matchMedia(STACKED).matches;
    camera.position.z = L.mobile ? 7.4 : 6;
    camera.updateProjectionMatrix();
    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
    L.objX = clamp(halfW * 0.5, 1.2, 2.6);
    L.yOff = L.mobile ? 1.05 : 0;
    L.scale = L.mobile ? 0.82 : clamp(camera.aspect / 1.6, 0.8, 1.1);
  }
  resize();
  window.addEventListener('resize', resize);
  function place(g, v, side, { y = 0, scale = 1 } = {}) {
    g.visible = v > 0.002;
    if (!g.visible) return;
    const out = 1 - v;
    const x = L.mobile ? 0 : L.objX * side;
    // on phones the text scrolls up underneath, so recede in place rather than slide into it
    g.position.set(x + (L.mobile ? 0 : out * side * 2.2), y + L.yOff - out * (L.mobile ? 0 : 0.35), -out * 1.6);
    g.scale.setScalar(scale * L.scale * (0.55 + 0.45 * v));
  }

  // ---------- loop ----------
  const cur = { s: state.s, josh: 0, trail: 0, mx: 0, my: 0 };
  const clock = new THREE.Clock();
  const tmpC = new THREE.Color();
  const focus = new THREE.Vector3(1.6, 0, 0);
  const tmpV = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  let onFirstFrame = null;
  let drewEmpty = false;
  let slowFrames = 0;
  let lastInput = null;

  function frame() {
    if (document.hidden || (state.paused && !onFirstFrame)) return;
    const elapsed = clock.getDelta();
    const dt = Math.min(elapsed, 0.05);
    const input = state.reduced ? state.s + ':' + state.heroScroll + ':' + state.joshP + ':' + state.trailP : null;
    if (!needsFrame && !onFirstFrame && state.reduced && lastInput === input) return;
    if (!needsFrame && !onFirstFrame && drewEmpty && Math.abs(cur.s - state.s) < 0.0001) return;
    lastInput = input;
    const t = clock.elapsedTime;
    const k = state.reduced ? 1 : 1 - Math.exp(-dt * 30);
    cur.s = lerp(cur.s, state.s, k);
    cur.josh = lerp(cur.josh, state.joshP, k);
    cur.trail = lerp(cur.trail, state.trailP, k);
    const km = state.reduced ? 0 : 1 - Math.exp(-dt * 3);
    cur.mx = lerp(cur.mx, state.mx, km);
    cur.my = lerp(cur.my, state.my, km);
    const s = cur.s;
    const motion = state.reduced ? 0 : 1;
    const bob = Math.sin(t * 1.1) * 0.05 * motion;

    const i0 = clamp(Math.floor(s), 0, BG.length - 2), f = clamp(s - i0);
    tmpC.copy(BG[i0]).lerp(BG[i0 + 1], f);
    scene.background.copy(tmpC); scene.fog.color.copy(tmpC);
    rim.color.copy(RIM[i0]).lerp(RIM[i0 + 1], f);

    camera.position.x = cur.mx * 0.3;
    camera.position.y = 0.15 - cur.my * 0.18;
    camera.lookAt(0, 0, 0);

    // 0 hero
    // on phones the headline scrolls up into the book's space, so the book is
    // gone by the time the text reaches it (the hero is taller than the screen there)
    const vHero = L.mobile ? 1 - ease(clamp((state.heroScroll - 0.1) / 0.24)) : win(s, -1, 0, 0.7, 0.92);
    // on phones the set sits a little higher and smaller, clear of the headline
    place(heroA, vHero, 1, { y: bob + (L.mobile ? 0.3 : 0), scale: L.mobile ? 0.84 : 1 });
    // the first scroll opens the book to its title page
    const open = ease(clamp(L.mobile ? state.heroScroll / 0.16 : (s - 0.5) / 0.2));
    heroBook.userData.hinge.rotation.y = -open * 2.1;
    heroBook.rotation.set(0.1 + cur.my * 0.12, lerp(-0.6, 0.18, open) + cur.mx * 0.22 + (state.spin || 0), -0.05 * (1 - open));
    heroBook.position.x = open * 0.35;
    plinth.rotation.y = t * 0.25 * motion + (state.spin || 0) * 0.4;
    ringLight.rotation.set(cur.my * 0.1, cur.mx * 0.14, 0);
    // police lights breathe slowly instead of strobing
    const sweep = 0.5 + 0.5 * Math.sin(t * 1.6 * motion);
    sirenR.intensity = vHero * 7 * sweep;
    sirenB.intensity = vHero * 7 * (1 - sweep);
    sirenR.position.set(heroA.position.x - 1.5, heroA.position.y + 0.8, 1.3);
    sirenB.position.set(heroA.position.x + 1.5, heroA.position.y + 0.8, 1.3);

    // 1 badge
    const vBadge = win(s, 1.0, 1.15, 1.7, 1.86);
    place(badgeA, vBadge, -1, { y: bob + (L.mobile ? 0.15 : 0), scale: L.mobile ? 0.72 : 0.95 });
    badgeA.rotation.set(0.12 + cur.my * 0.15, (s - 1.5) * 2.2 + Math.sin(t * 0.6) * 0.12 * motion, 0.04);

    // 2 Josh Williams carousel, turned by the sticky section's progress
    const vJosh = win(s, 2.0, 2.11, 2.89, 2.99);
    place(joshA, vJosh, 1, { y: bob * 0.6 + (L.mobile ? 0.15 : -0.05), scale: L.mobile ? 0.72 : 0.8 });
    const step = (Math.PI * 2) / joshBooks.length;
    shelfRing.rotation.y = -cur.josh * (joshBooks.length - 1) * step;
    joshA.rotation.set(0.1 + cur.my * 0.08, cur.mx * 0.18, 0);

    // 3 Hawk Bennett
    const vHawk = win(s, 3.0, 3.2, 3.72, 3.9);
    place(hawkA, vHawk, -1, { y: bob });
    hawkBook.rotation.set(0.06, 0.5 - (s - 3.5) * 1.4 + cur.mx * 0.2, 0.04);
    goldDust.rotation.y = t * 0.12 * motion;

    // 4 true crime: the three exhibits settle one after another
    const vTrue = win(s, 4.0, 4.2, 4.72, 4.9);
    place(trueA, vTrue, 1, { scale: 0.9 });
    trueBooks.forEach(({ m, i }) => {
      const d = ease(clamp((s - 4.02 - i * 0.07) / 0.24));
      const tx = (i - 1) * 0.78, tz = i === 1 ? 0.25 : -0.15;
      m.position.set(tx, lerp(3.2, 0, d) + Math.sin(t * 1.1 + i) * 0.03 * motion, tz);
      m.rotation.set(lerp(-1.2, 0.04, d), (1 - i) * 0.36 + cur.mx * 0.14, lerp(0.9 * (i - 1), (i - 1) * -0.04, d));
    });

    // 5 dragon
    const vDragon = win(s, 5.0, 5.2, 5.72, 5.9);
    place(dragonA, vDragon, -1, { y: bob, scale: 0.78 });
    egg.rotation.y = t * 0.22 * motion + s * 0.8;
    const breathe = 1.1 + (Math.sin(t * 2.2) * 0.45 + Math.sin(t * 5.1) * 0.12) * motion;
    eggMat.emissiveIntensity = breathe;
    emberLight.intensity = vDragon * 10 * (breathe / 1.4);
    emberLight.position.set(dragonA.position.x + 0.6, dragonA.position.y - 0.4, 1.6);
    orbit.children.forEach((m) => {
      const a = m.userData.phase + t * 0.32 * motion;
      m.position.set(Math.cos(a) * 1.2, Math.sin(a * 2) * 0.12, Math.sin(a) * 1.2);
      m.rotation.y = -a + Math.PI / 2;
    });
    if (dragonA.visible && motion) {
      const p = emberGeo.attributes.position;
      for (let i = 0; i < EMBERS; i++) {
        let y = p.getY(i) + dt * (0.25 + emberSeed[i] * 0.55);
        if (y > 2.6) y = -2;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t * 1.5 + emberSeed[i] * 20) * dt * 0.12);
      }
      p.needsUpdate = true;
    }

    // 6 trail: drawn along the path as you scroll
    const vTrail = win(s, 6.0, 6.2, 6.74, 6.92);
    trailA.visible = vTrail > 0.002;
    if (trailA.visible) {
      trailA.position.set(L.mobile ? 0 : 1.45, (L.mobile ? 0.6 : -1.05) - (1 - vTrail) * 1.5, -0.4 - (1 - vTrail) * 2);
      trailA.scale.setScalar((L.mobile ? 0.55 : 0.66) * (0.6 + 0.4 * vTrail));
      trailA.rotation.y = -0.15 + cur.mx * 0.12;
      const tp = clamp(cur.trail);
      tubeGeo.setDrawRange(0, Math.floor((tubeGeo.index.count * tp) / 6) * 6);
      marker.position.copy(curve.getPointAt(Math.max(tp, 0.001)));
      marker.position.y += 0.05 + Math.abs(Math.sin(t * 6)) * 0.03 * motion;
    }
    floorMat.opacity = 1 - vTrail;

    // 8 closing helix
    const vHelix = win(s, 8.0, 8.2, 8.9, 9.08);
    place(helixA, vHelix, 1, { scale: 0.82 });
    helix.rotation.y = t * 0.15 * motion + s * 1.2;
    helixA.rotation.x = 0.08 + cur.my * 0.08;

    // the spotlight and its beam follow whichever exhibit is on stage
    let wsum = 0;
    tmpV.set(0, 0, 0);
    [[heroA, vHero], [badgeA, vBadge], [joshA, vJosh], [hawkA, vHawk], [trueA, vTrue], [dragonA, vDragon], [helixA, vHelix]].forEach(([a, v]) => {
      if (v > 0.002) { tmpV.addScaledVector(a.position, v); wsum += v; }
    });
    const onStage = clamp(wsum);
    if (wsum > 0) focus.lerp(tmpV.divideScalar(wsum), 1 - Math.exp(-dt * 6));
    spotTarget.position.set(focus.x, focus.y - 0.4, focus.z);
    spot.position.set(focus.x * 0.85 + 0.3, 5.2, 2.2);
    spot.intensity = 70 * (0.25 + 0.75 * onStage);
    beam.position.copy(spot.position);
    tmpV.copy(spotTarget.position).setY(FLOOR_Y).sub(spot.position);
    beam.scale.set(1, tmpV.length(), 1);
    beam.quaternion.setFromUnitVectors(down, tmpV.normalize());
    beam.material.uniforms.uOpacity.value = 0.1 * onStage;
    wall.position.x = focus.x * 0.6;
    wallMat.color.copy(rim.color).lerp(tmpC.set(0xfff1dc), 0.6).multiplyScalar(0.05 + 0.07 * onStage);
    contact.position.x = focus.x; contact.position.z = focus.z;
    contact.scale.set(2.6, 1.5, 1);
    contactMat.opacity = (high ? 0.45 : 0.85) * onStage;

    motes.rotation.y = t * 0.02 * motion + s * 0.15;
    motes.position.y = -s * 0.25;

    // An empty stage only needs a single frame to clear the previous exhibit.
    const empty = onStage < 0.002 && !trailA.visible;
    if (empty && drewEmpty && !needsFrame && !onFirstFrame) return;
    drewEmpty = empty;
    needsFrame = false;
    renderer.render(scene, camera);
    if (onFirstFrame) { onFirstFrame(); onFirstFrame = null; }

    // Lower resolution once on devices that consistently miss their frame budget.
    if (!drewEmpty && t > 1 && maxPR > 0.75) {
      slowFrames = elapsed > 0.022 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
      if (slowFrames > 10) {
        maxPR = 0.75;
        resize();
      }
    }
  }

  function loop() { requestAnimationFrame(loop); frame(); }
  return {
    // Share the animation ticker when the page has one.
    start(ticker) {
      return new Promise((resolve) => {
        onFirstFrame = resolve;
        if (ticker) ticker.add(frame); else requestAnimationFrame(loop);
      });
    },
  };
}
