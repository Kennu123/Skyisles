'use strict';
// =====================================================================
//  Rendering: tiles, objects, characters, mobs, effects and lighting
// =====================================================================
const RD = { cv: null, ctx: null, W: 0, H: 0, S: 48, base: 48, zoom: 1, dpr: 1, lc: null, lx: null, ox: 0, oy: 0 };
function setZoom(z) { RD.zoom = clamp(z, 0.45, 2.2); RD.S = Math.round(RD.base * RD.zoom); try { localStorage.setItem('skyisles.zoom', RD.zoom); } catch (e) { } }
const FONT = '"Lilita One", "Trebuchet MS", sans-serif';
for (const id in NODES) { const n = NODES[id]; if (n.leaf) { n.leafD = shade(n.leaf, -0.28); n.leafL = shade(n.leaf, 0.22); n.barkD = shade(n.bark, -0.3); } if (n.base) { n.baseD = shade(n.base, -0.3); n.baseL = shade(n.base, 0.18); } }
const CAT_COL = { home: '#7ad8ff', hub: '#7ad8ff', farming: '#e8d84a', mining: '#ff9a3a', foraging: '#5fd36a', combat: '#ff4a4a', dungeon: '#b86bff', fishing: '#3fc3ff' };

function initRender() {
  RD.cv = document.getElementById('game'); RD.ctx = RD.cv.getContext('2d');
  RD.lc = document.createElement('canvas'); RD.lx = RD.lc.getContext('2d');
  resize(); window.addEventListener('resize', resize);
}
function resize() {
  RD.dpr = Math.min(2, window.devicePixelRatio || 1);
  RD.W = window.innerWidth; RD.H = window.innerHeight;
  RD.cv.width = RD.W * RD.dpr; RD.cv.height = RD.H * RD.dpr;
  RD.cv.style.width = RD.W + 'px'; RD.cv.style.height = RD.H + 'px';
  RD.lc.width = RD.W; RD.lc.height = RD.H;
  RD.base = TILE * clamp(Math.min(RD.H / 860, RD.W / 1300), 0.72, 1.25);
  if (!RD.zoomLoaded) { RD.zoomLoaded = 1; try { const zz = parseFloat(localStorage.getItem('skyisles.zoom')); if (zz) RD.zoom = zz; } catch (e) { } }
  setZoom(RD.zoom);
}
const sx = x => (x - G.cam.x) * RD.S + RD.W / 2 + RD.ox;
const sy = y => (y - G.cam.y) * RD.S + RD.H / 2 + RD.oy;
function screenToWorld(px, py) { return { x: (px - RD.W / 2) / RD.S + G.cam.x, y: (py - RD.H / 2) / RD.S + G.cam.y }; }

function render() {
  const ctx = RD.ctx, z = G.zone, S = RD.S, t = G.t;
  ctx.setTransform(RD.dpr, 0, 0, RD.dpr, 0, 0);
  RD.ox = G.shake > 0 ? rand(-1, 1) * G.shake * 22 : 0; RD.oy = G.shake > 0 ? rand(-1, 1) * G.shake * 22 : 0;
  ctx.fillStyle = z.def.sky || '#2a7fb8'; ctx.fillRect(0, 0, RD.W, RD.H);
  const x0 = Math.floor(G.cam.x - RD.W / 2 / S) - 2, x1 = Math.ceil(G.cam.x + RD.W / 2 / S) + 2;
  const y0 = Math.floor(G.cam.y - RD.H / 2 / S) - 2, y1 = Math.ceil(G.cam.y + RD.H / 2 / S) + 3;
  // ground
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawTile(ctx, z, x, y, sx(x), sy(y), S, t);
  // zone labels
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const l of z.labels) { ctx.font = `${S * 0.7}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillText(l.t, sx(l.x), sy(l.y)); }
  // flat objects
  const upright = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = z.o(x, y); if (!o) continue;
    if (isFlat(o)) drawObj(ctx, z, o, x, y, S, t); else upright.push({ y: y + 0.95, o, x, ty: y });
  }
  // telegraphs
  for (const tg of z.tele) drawTele(ctx, tg, S);
  // entities
  for (const m of z.mobs) upright.push({ y: m.y + m.r * 0.5, m });
  for (const d of z.drops) upright.push({ y: d.y, d });
  const me = G.me;
  upright.push({ y: me.y + 0.3, me: 1 });
  if (G.pet) upright.push({ y: G.pet.y + 0.2, pet: G.pet });
  for (const [id, p] of NET.players) if (p.zone === z.key && p.rx != null) upright.push({ y: p.ry + 0.3, rp: p });
  upright.sort((a, b) => a.y - b.y);
  for (const e of upright) {
    if (e.o) drawObj(ctx, z, e.o, e.x, e.ty, S, t);
    else if (e.m) drawMob(ctx, e.m, S, t);
    else if (e.d) drawDrop(ctx, e.d, S, t);
    else if (e.me) drawPlayer(ctx, S, t);
    else if (e.pet) drawPet(ctx, e.pet, S, t);
    else if (e.rp) drawRemote(ctx, e.rp, S, t);
  }
  for (const p of z.projs) drawProj(ctx, p, S);
  if (z.bolts) for (const b of z.bolts) drawLightning(ctx, b, S);
  if (me.fish) drawLine(ctx, me.fish, S, t);
  // particles
  for (const p of G.particles) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.fall) { drawFallingTree(ctx, p, S, a); continue; }
    ctx.globalAlpha = a; ctx.fillStyle = p.col;
    const s = p.size * (RD.S / 48);
    if (p.sq) ctx.fillRect(sx(p.x) - s / 2, sy(p.y) - s / 2, s, s); else { ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), s / 2, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  drawCursor(ctx, z, S, t);
  // lighting
  const ev = currentEvent();
  let dark = z.dark || 0;
  if (ev.active && ev.ev.id === 'bloodmoon' && z.def.cat === 'combat') dark = Math.max(dark, 0.35);
  if (dark > 0) drawLighting(ctx, z, dark, x0, x1, y0, y1, S, ev.active && ev.ev.id === 'bloodmoon' && z.def.cat === 'combat');
  // floating text on top of lighting
  for (const f of G.floaters) {
    const a = clamp(f.life / f.max * 1.6, 0, 1), sz = f.size * S * (f.crit ? 1 + Math.max(0, f.life - 0.8) : 1);
    ctx.globalAlpha = a; ctx.font = `${sz}px ${FONT}`; ctx.lineWidth = Math.max(2, sz / 7); ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText(f.text, sx(f.x), sy(f.y)); ctx.fillStyle = f.col; ctx.fillText(f.text, sx(f.x), sy(f.y));
  }
  ctx.globalAlpha = 1;
  drawTutArrow(ctx, S, t);
}

// ------------------------------------------------------------ minimap
const MM = { base: null, key: null, t: 0, big: false };
const hexRGB = h => { const c = h.replace('#', ''); return [parseInt(c.substr(0, 2), 16), parseInt(c.substr(2, 2), 16), parseInt(c.substr(4, 2), 16)]; };
const GROUND_RGB = GROUND.map(g => hexRGB(g.c));
function objRGB(o) {
  switch (o.k) {
    case 'tree': return hexRGB(NODES[o.id].leaf); case 'rock': return NODES[o.id].spot ? hexRGB(NODES[o.id].spot) : [150, 150, 150];
    case 'crop': return hexRGB(NODES['crop_' + o.id].col); case 'bpart': case 'bldg': return [150, 92, 70];
    case 'block': return ITEMS[o.id].place.floor ? null : [190, 150, 100]; case 'mach': return hexRGB(MACHINES[o.id].col); case 'conv': return [70, 70, 80];
    case 'deco': return o.solid ? [90, 120, 80] : null; default: return null;
  }
}
function buildMinimapBase(z) {
  const c = MM.base || (MM.base = document.createElement('canvas')); c.width = z.w; c.height = z.h;
  const x = c.getContext('2d'), img = x.createImageData(z.w, z.h), d = img.data;
  for (let i = 0; i < z.w * z.h; i++) {
    const o = z.objs[i]; let rgb = (o && objRGB(o)) || GROUND_RGB[z.ground[i]];
    d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = z.ground[i] === GT.VOID ? 60 : 255;
  }
  x.putImageData(img, 0, 0); MM.key = z.key;
}
function drawMinimap(dt) {
  const cv = $('minimap'); if (!cv || !G.zone) return;
  const z = G.zone; MM.t -= dt;
  if (MM.key !== z.key || MM.t <= 0) { MM.t = 1.5; buildMinimapBase(z); }
  const size = MM.big ? Math.min(window.innerWidth - 60, window.innerHeight - 120, 720) : 170;
  if (cv.width !== size) { cv.width = size; cv.height = size; }
  const c = cv.getContext('2d'); c.clearRect(0, 0, size, size);
  const sc = size / Math.max(z.w, z.h), ox = (size - z.w * sc) / 2, oy = (size - z.h * sc) / 2;
  c.imageSmoothingEnabled = false; c.globalAlpha = 0.95; c.drawImage(MM.base, ox, oy, z.w * sc, z.h * sc); c.globalAlpha = 1;
  const dot = (x, y, col, r) => { c.fillStyle = col; c.beginPath(); c.arc(ox + x * sc, oy + y * sc, r, 0, 7); c.fill(); };
  z.objs.forEach((o, i) => {
    if (!o) return; const x = i % z.w + 0.5, y = Math.floor(i / z.w) + 0.5;
    if (o.k === 'portal') { dot(x, y, CAT_COL[(ZONES[o.to.split('@')[0]] || ZONES.hub).cat], MM.big ? 6 : 3.5); if (MM.big) { c.font = '12px ' + FONT; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText(o.label, ox + x * sc, oy + y * sc - 9); } }
    else if (o.k === 'npc') { dot(x, y, '#ffd23a', MM.big ? 5 : 2.5); if (MM.big) { c.font = '11px ' + FONT; c.textAlign = 'center'; c.fillStyle = '#ffe9a8'; c.fillText(NPCS[o.id].name, ox + x * sc, oy + y * sc + 15); } }
  });
  for (const m of z.mobs) if (!m.dead) dot(m.x, m.y, m.def.boss ? '#ff2a2a' : '#ff8a8a', m.def.boss ? 5 : 1.8);
  for (const [, p] of NET.players) if (p.zone === z.key) dot(p.x, p.y, '#7ad8ff', 4);
  if (G.tutTarget) dot(G.tutTarget.x, G.tutTarget.y, '#ffd23a', 4 + Math.sin(G.t * 6) * 1.5);
  const me = G.me; c.save(); c.translate(ox + me.x * sc, oy + me.y * sc); c.rotate(me.dir); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5); c.lineTo(-2, 0); c.lineTo(-5, 5); c.closePath(); c.fill(); c.stroke(); c.restore();
}
function isFlat(o) {
  switch (o.k) {
    case 'conv': case 'sort': case 'portal': case 'stump': case 'rubble': case 'bpart': return true;
    case 'block': return !!ITEMS[o.id].place.floor;
    case 'deco': return ['flowers', 'web', 'bones', 'shroom'].includes(o.id);
    case 'door': return o.open;
  }
  return false;
}

// ---------------------------------------------------------------- tiles
function drawTile(ctx, z, x, y, X, Y, S, t) {
  const g = z.g(x, y), gd = GROUND[g], h = thash(x, y);
  if (g === GT.WATER) {
    const shallow = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => { const n = z.g(x + i, y + j); return n !== GT.WATER && n !== GT.VOID; });
    ctx.fillStyle = shallow ? '#3d9ad3' : (h > 0.5 ? '#2f86c6' : '#2c80be'); ctx.fillRect(X, Y, S + 1, S + 1);
    const above = z.g(x, y - 1);
    if (above !== GT.WATER && above !== GT.VOID && !GROUND[above].wall) { ctx.fillStyle = '#6b4a2e'; ctx.fillRect(X, Y, S + 1, S * 0.22); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(X, Y + S * 0.22, S + 1, S * 0.12); }
    if (h > 0.72) { const w = Math.sin(t * 1.6 + x * 0.9 + y * 1.3); if (w > 0.2) { ctx.fillStyle = `rgba(255,255,255,${(w - 0.2) * 0.35})`; ctx.fillRect(X + S * 0.2 + w * S * 0.1, Y + S * (0.3 + h * 0.4), S * 0.35, 2); } }
    return;
  }
  if (g === GT.LAVA) {
    const w = Math.sin(t * 2 + x * 1.3 + y * 0.7) * 0.5 + 0.5;
    ctx.fillStyle = w > 0.5 ? '#ff6a1a' : '#f2501a'; ctx.fillRect(X, Y, S + 1, S + 1);
    ctx.fillStyle = `rgba(255,220,90,${0.25 + w * 0.35})`; ctx.beginPath(); ctx.arc(X + h * S, Y + ((h * 7 + t * 0.2) % 1) * S, S * 0.12, 0, 7); ctx.fill();
    const above = z.g(x, y - 1); if (above !== GT.LAVA) { ctx.fillStyle = '#3a2a24'; ctx.fillRect(X, Y, S + 1, S * 0.18); }
    return;
  }
  if (g === GT.VOID) {
    ctx.fillStyle = '#0b0816'; ctx.fillRect(X, Y, S + 1, S + 1);
    const above = z.g(x, y - 1);
    if (above !== GT.VOID && above !== GT.WATER) { ctx.fillStyle = '#1e1630'; ctx.fillRect(X, Y, S + 1, S * 0.35); ctx.fillStyle = '#140e22'; ctx.fillRect(X, Y + S * 0.35, S + 1, S * 0.2); }
    if (h > 0.9) { ctx.fillStyle = `rgba(220,200,255,${0.4 + Math.sin(t * 2 + h * 40) * 0.4})`; ctx.fillRect(X + h * S, Y + (1 - h) * S * 4 % S, 2, 2); }
    return;
  }
  ctx.fillStyle = gd.sh[(h * 4) | 0]; ctx.fillRect(X, Y, S + 1, S + 1);
  if (gd.wall) {
    const below = z.g(x, y + 1);
    ctx.fillStyle = shade(gd.c, 0.12); ctx.fillRect(X, Y, S + 1, S * 0.65);
    if (!GROUND[below].wall) { ctx.fillStyle = shade(gd.c, -0.25); ctx.fillRect(X, Y + S * 0.65, S + 1, S * 0.35); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(X, Y + S, S + 1, S * 0.18); }
    if (h > 0.7) { ctx.fillStyle = shade(gd.c, 0.2); ctx.fillRect(X + h * S * 0.6, Y + S * 0.2, S * 0.18, S * 0.1); }
    return;
  }
  if (gd.grassy && h > 0.55) {
    ctx.fillStyle = shade(gd.c, -0.18);
    const bx = X + h * S * 0.7, by = Y + ((h * 7) % 1) * S * 0.7;
    ctx.fillRect(bx, by, 2, 5); ctx.fillRect(bx + 4, by + 1, 2, 4);
  }
  if (g === GT.ICE && h > 0.6) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(X + h * S * 0.5, Y + S * 0.3, S * 0.35, 2); ctx.fillRect(X + h * S * 0.5 + 4, Y + S * 0.3 + 5, S * 0.2, 2); }
  if (g === GT.DOCK) { ctx.fillStyle = 'rgba(0,0,0,.22)'; for (let i = 1; i < 4; i++) ctx.fillRect(X, Y + i * S / 4, S + 1, 2); ctx.fillStyle = '#6a4424'; ctx.fillRect(X + 2, Y + 2, 4, 4); ctx.fillRect(X + S - 6, Y + S - 6, 4, 4); }
  if (g === GT.FARM) { ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 3; i++) ctx.fillRect(X + 2, Y + S * (0.2 + i * 0.3), S - 4, 3); }
  if (g === GT.PLAZA || g === GT.DFLOOR) { ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1; ctx.strokeRect(X + 0.5, Y + 0.5, S, S); }
  if (g === GT.PATH && h > 0.6) { ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.beginPath(); ctx.arc(X + h * S, Y + S * 0.6, S * 0.12, 0, 7); ctx.fill(); }
  if (g === GT.SAND && h > 0.8) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(X + h * S * 0.8, Y + S * 0.4, 3, 3); }
}

// -------------------------------------------------------------- objects
function drawObj(ctx, z, o, x, y, S, t) {
  const X = sx(x), Y = sy(y), cx = X + S / 2, by = Y + S;
  switch (o.k) {
    case 'tree': return drawTree(ctx, cx, by, S, NODES[o.id], o, x, y, t);
    case 'rock': return drawRock(ctx, cx, by, S, NODES[o.id], o, x, y, t);
    case 'crop': return drawCrop(ctx, cx, by, S, z, o, x, y, t);
    case 'stump': { const n = NODES[o.id]; ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, cx, by - S * 0.25, S * 0.25, S * 0.1); ctx.fillStyle = n.bark; ell(ctx, cx, by - S * 0.32, S * 0.16, S * 0.09); ctx.fillStyle = '#d8b27a'; ell(ctx, cx, by - S * 0.34, S * 0.11, S * 0.06); regrowRing(ctx, cx, by - S * 0.6, S, o, n); return; }
    case 'rubble': { ctx.fillStyle = NODES[o.id].baseD; [[-0.15, 0.3], [0.12, 0.25], [0, 0.4]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(cx + a * S, by - b * S, S * 0.07, 0, 7); ctx.fill(); }); regrowRing(ctx, cx, by - S * 0.6, S, o, NODES[o.id]); return; }
    case 'bpart': return;
    case 'bldg': return drawBuilding(ctx, o.b, S, t);
    case 'sapling': { const tr = NODES[o.tree], p = clamp((Date.now() - o.t0) / ((45 + tr.idx * 15) * 1000), 0, 1); ctx.save(); ctx.translate(cx, by - S * 0.2); ctx.scale(0.5 + p * 0.6, 0.5 + p * 0.6); ctx.drawImage(iconCanvas(o.tree + '_sapling'), -S * 0.4, -S * 0.75, S * 0.8, S * 0.8); ctx.restore(); return; }
    case 'block': return drawBlock(ctx, X, Y, S, o, t, z, x, y);
    case 'conv': return drawConveyor(ctx, X, Y, S, o, t);
    case 'sort': return drawSorter(ctx, X, Y, S, o, t);
    case 'mach': return drawMachine(ctx, X, Y, S, o, t);
    case 'npc': return drawNpc(ctx, cx, Y + S * 0.6, S, o, t);
    case 'portal': return drawPortal(ctx, cx, Y + S / 2, S, o, t);
    case 'deco': return drawDeco(ctx, X, Y, S, o, x, y, t);
    case 'door': {
      if (o.open) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(X, Y + S * 0.8, S, S * 0.2); return; }
      ctx.fillStyle = '#4a4a55'; ctx.fillRect(X, Y, S, S); ctx.fillStyle = '#8a8a99'; for (let i = 0; i < 4; i++) ctx.fillRect(X + S * (0.1 + i * 0.24), Y, S * 0.08, S);
      ctx.fillStyle = '#c38bff'; ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.3; ctx.fillRect(X, Y + S * 0.45, S, S * 0.08); ctx.globalAlpha = 1; return;
    }
    case 'rchest': {
      const bob = o.opened ? 0 : Math.sin(t * 3) * S * 0.04;
      if (!o.opened) { ctx.fillStyle = 'rgba(255,210,58,.25)'; ctx.beginPath(); ctx.arc(cx, Y + S * 0.5, S * (0.7 + Math.sin(t * 4) * 0.08), 0, 7); ctx.fill(); }
      ctx.drawImage(iconCanvas('chest'), X - S * 0.1, Y - S * 0.15 + bob, S * 1.2, S * 1.2);
      if (!o.opened) label(ctx, cx, Y - S * 0.2, 'Right-click to open', '#ffd23a', S * 0.28);
      return;
    }
  }
}
function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); }
function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
function hpBar(ctx, x, y, w, frac, col = '#5dff6a') {
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = frac > 0.5 ? col : frac > 0.25 ? '#ffd23a' : '#ff4a4a'; ctx.fillRect(x - w / 2, y, w * clamp(frac, 0, 1), 4);
}
function label(ctx, x, y, text, col, size) {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(10,12,20,.55)'; rr(ctx, x - w / 2 - 5, y - size * 0.65, w + 10, size * 1.3, 4); ctx.fill();
  ctx.fillStyle = col; ctx.fillText(text, x, y + 1);
}
function drawTree(ctx, cx, by, S, n, o, x, y, t) {
  const sway = Math.sin(t * 1.3 + x * 0.7 + y * 0.31) * S * 0.025;
  const sh = o.shake ? Math.sin(t * 70) * o.shake * S * 0.07 : 0;
  const sc = n.shape === 'huge' ? 1.35 : n.shape === 'big' ? 1.18 : 1;
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ell(ctx, cx, by - S * 0.14, S * 0.46 * sc, S * 0.16);
  ctx.fillStyle = n.barkD; ctx.fillRect(cx - S * 0.1 * sc + sh, by - S * 0.7, S * 0.2 * sc, S * 0.58);
  ctx.fillStyle = n.bark; ctx.fillRect(cx - S * 0.1 * sc + sh, by - S * 0.7, S * 0.12 * sc, S * 0.58);
  if (n.id === 'birch') { ctx.fillStyle = '#333'; ctx.fillRect(cx - S * 0.08 + sh, by - S * 0.5, S * 0.07, 3); ctx.fillRect(cx + sh, by - S * 0.32, S * 0.06, 3); }
  const X = cx + sh + sway, Y = by - S * 0.98 * sc;
  if (n.shape === 'cone') {
    for (let i = 0; i < 3; i++) { const w = S * (0.55 - i * 0.12), yy = Y + S * 0.25 - i * S * 0.28; ctx.fillStyle = n.leafD; tri(ctx, X, yy - S * 0.42, w, S * 0.5); ctx.fillStyle = n.leaf; tri(ctx, X - S * 0.03, yy - S * 0.42, w * 0.82, S * 0.44); }
  } else if (n.shape === 'flat') {
    ctx.fillStyle = n.leafD; ell(ctx, X, Y + S * 0.08, S * 0.7, S * 0.3); ctx.fillStyle = n.leaf; ell(ctx, X - S * 0.04, Y, S * 0.62, S * 0.24); ctx.fillStyle = n.leafL; ell(ctx, X - S * 0.2, Y - S * 0.06, S * 0.25, S * 0.1);
  } else if (n.shape === 'crystal') {
    ctx.save(); ctx.shadowColor = '#9af0ff'; ctx.shadowBlur = 16 + Math.sin(t * 2 + x) * 6;
    const shards = [[-0.3, 0.1, 0.22, 0.75], [0.25, 0.05, 0.2, 0.65], [0, -0.1, 0.26, 0.95], [-0.12, 0.2, 0.16, 0.5]];
    for (const [ox, oy, w, h] of shards) { ctx.fillStyle = 'rgba(160,230,255,.75)'; ctx.beginPath(); ctx.moveTo(X + ox * S, Y + oy * S - h * S * 0.5); ctx.lineTo(X + (ox + w / 2) * S, Y + oy * S + h * S * 0.3); ctx.lineTo(X + (ox - w / 2) * S, Y + oy * S + h * S * 0.3); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(X + ox * S - 1, Y + oy * S - h * S * 0.3, 2, h * S * 0.4); }
    ctx.restore();
  } else {
    const r = S * 0.46 * sc;
    ctx.fillStyle = n.leafD; circ(ctx, X, Y + S * 0.08, r); circ(ctx, X - r * 0.55, Y + S * 0.12, r * 0.7); circ(ctx, X + r * 0.55, Y + S * 0.1, r * 0.72);
    ctx.fillStyle = n.leaf; circ(ctx, X - r * 0.1, Y - S * 0.02, r * 0.85); circ(ctx, X + r * 0.4, Y + S * 0.04, r * 0.55);
    ctx.fillStyle = n.leafL; circ(ctx, X - r * 0.3, Y - r * 0.3, r * 0.38);
    if (n.id === 'cherry') { ctx.fillStyle = '#fff0f6'; for (let i = 0; i < 5; i++) circ(ctx, X + Math.cos(i * 2.3 + x) * r * 0.6, Y + Math.sin(i * 1.7 + y) * r * 0.5, 2.5); }
    if (n.id === 'ancient') { ctx.fillStyle = '#c8ff7a'; for (let i = 0; i < 4; i++) { const a = t * 0.8 + i * 1.6; circ(ctx, X + Math.cos(a) * r * 0.9, Y + Math.sin(a * 1.3) * r * 0.5, 2); } }
  }
  if (o.hp < o.mhp) hpBar(ctx, cx, by - S * 1.7 * sc, S * 0.8, o.hp / o.mhp, '#5dff6a');
}
function tri(ctx, x, y, w, h) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x - w, y + h); ctx.closePath(); ctx.fill(); }
function drawRock(ctx, cx, by, S, n, o, x, y, t) {
  const sh = o.shake ? Math.sin(t * 70) * o.shake * S * 0.06 : 0, c = cx + sh, cy = by - S * 0.38;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, cx, by - S * 0.12, S * 0.44, S * 0.14);
  ctx.beginPath();
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 - Math.PI / 2, r = S * 0.4 * (0.82 + thash(x * 7 + i, y * 3) * 0.28); const px = c + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.82; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fillStyle = n.baseD; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = n.base; ctx.fillRect(c - S, cy - S, S * 2, S * 0.92); ctx.fillStyle = n.baseL; ell(ctx, c - S * 0.12, cy - S * 0.2, S * 0.18, S * 0.08); ctx.restore();
  if (n.spot) {
    const glow = n.idx >= 6;
    if (glow) { ctx.save(); ctx.shadowColor = n.spot; ctx.shadowBlur = 10; }
    ctx.fillStyle = n.spot;
    for (let i = 0; i < 5; i++) { const a = thash(x + i * 13, y) * 6.28, r = S * 0.22 * thash(x, y + i * 7); circ(ctx, c + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, S * (0.045 + thash(i, x) * 0.035)); }
    if (glow) ctx.restore();
    if (glow && Math.sin(t * 3 + x * 2 + y) > 0.85) { ctx.fillStyle = '#fff'; const px = c + S * 0.12, py = cy - S * 0.12; ctx.fillRect(px - 4, py - 0.5, 8, 1.5); ctx.fillRect(px - 0.5, py - 4, 1.5, 8); }
  }
  if (o.hp < o.mhp) hpBar(ctx, cx, by - S * 0.95, S * 0.7, o.hp / o.mhp, '#5aa8ff');
}
function drawCrop(ctx, cx, by, S, z, o, x, y, t) {
  const n = NODES['crop_' + o.id], p = cropProg(z, o), sway = Math.sin(t * 2 + x * 0.8 + y * 0.5) * S * 0.04;
  const base = by - S * 0.18;
  if (p < 1) {
    const s = 0.25 + p * 0.6; ctx.strokeStyle = '#4fa83a'; ctx.lineWidth = Math.max(2, S * 0.05);
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * S * 0.15, base); ctx.quadraticCurveTo(cx + i * S * 0.2 + sway, base - S * 0.3 * s, cx + i * S * 0.22 + sway * 1.5, base - S * 0.55 * s); ctx.stroke(); }
    return;
  }
  switch (o.id) {
    case 'wheat': ctx.strokeStyle = '#c9a43a'; ctx.lineWidth = 2.5; for (let i = -2; i <= 2; i++) { const tx = cx + i * S * 0.1 + sway; ctx.beginPath(); ctx.moveTo(cx + i * S * 0.08, base); ctx.lineTo(tx, base - S * 0.55); ctx.stroke(); ctx.fillStyle = n.col; ell(ctx, tx, base - S * 0.6, S * 0.05, S * 0.12); } break;
    case 'carrot': case 'potato': ctx.fillStyle = '#3f9a3a'; for (let i = -1; i <= 1; i++) ell(ctx, cx + i * S * 0.14 + sway, base - S * 0.25, S * 0.08, S * 0.2); ctx.fillStyle = n.col; ell(ctx, cx, base - S * 0.02, S * 0.14, S * 0.09); break;
    case 'pumpkin': case 'melon': ctx.fillStyle = shade(n.col, -0.25); ell(ctx, cx, base - S * 0.18, S * 0.34, S * 0.25); ctx.fillStyle = n.col; ell(ctx, cx - S * 0.03, base - S * 0.2, S * 0.3, S * 0.22);
      ctx.strokeStyle = o.id === 'melon' ? '#2f7a2a' : shade(n.col, -0.35); ctx.lineWidth = 2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(cx + i * S * 0.1, base - S * 0.19, S * 0.06, S * 0.21, 0, 0, 7); ctx.stroke(); }
      ctx.fillStyle = '#5a7a2a'; ctx.fillRect(cx - 2, base - S * 0.48, 4, S * 0.1); break;
    case 'sugarcane': for (let i = -1; i <= 1; i++) { ctx.fillStyle = i ? '#7ac86a' : '#8fd67a'; const h = S * (0.8 + i * 0.1); ctx.fillRect(cx + i * S * 0.18 - 3 + sway * (1 + i * 0.3), base - h, 6, h); ctx.fillStyle = '#5a9a4a'; for (let k = 1; k < 4; k++) ctx.fillRect(cx + i * S * 0.18 - 3 + sway, base - h * k / 4, 6, 2); } break;
    case 'cocoa': ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, base); ctx.lineTo(cx + sway, base - S * 0.6); ctx.stroke(); ctx.fillStyle = n.col; [[-0.13, -0.4], [0.13, -0.28], [-0.1, -0.15]].forEach(([a, b]) => ell(ctx, cx + a * S + sway, base + b * S, S * 0.07, S * 0.11)); break;
    case 'netherwart': ctx.fillStyle = shade(n.col, -0.3); for (let i = 0; i < 5; i++) circ(ctx, cx + Math.cos(i * 1.3) * S * 0.16 + sway * 0.5, base - S * 0.15 - Math.sin(i * 1.7) * S * 0.12, S * 0.1); ctx.fillStyle = n.col; for (let i = 0; i < 4; i++) circ(ctx, cx + Math.cos(i * 1.9) * S * 0.12 + sway * 0.5, base - S * 0.2 - Math.sin(i * 2.1) * S * 0.1, S * 0.08); break;
    case 'mushroom': ctx.fillStyle = '#efe4d0'; ctx.fillRect(cx - S * 0.06, base - S * 0.3, S * 0.12, S * 0.3); ctx.fillStyle = n.col; ctx.beginPath(); ctx.ellipse(cx + sway * 0.4, base - S * 0.32, S * 0.3, S * 0.2, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff'; [[-0.12, -0.4], [0.08, -0.44], [0.16, -0.36]].forEach(([a, b]) => circ(ctx, cx + a * S, base + b * S, S * 0.035)); break;
    case 'starfruit': { ctx.save(); ctx.translate(cx, base - S * 0.32); ctx.rotate(Math.sin(t + x) * 0.2); ctx.shadowColor = '#ffe94d'; ctx.shadowBlur = 14; ctx.fillStyle = n.col; star(ctx, 0, 0, S * 0.25, S * 0.11, 5); ctx.restore(); ctx.strokeStyle = '#4fa83a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, base); ctx.lineTo(cx, base - S * 0.12); ctx.stroke(); break; }
  }
  if (Math.sin(t * 2.3 + x * 3.1 + y * 1.7) > 0.97) { ctx.fillStyle = '#fff'; circ(ctx, cx + S * 0.2, base - S * 0.45, 2); }
}
function star(ctx, x, y, R, r, n) { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2 - Math.PI / 2, rad = i % 2 ? r : R; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } ctx.closePath(); ctx.fill(); }
const SHADES = new Map();
function sh(c, f) { const k = c + f; let v = SHADES.get(k); if (!v) { v = shade(c, f); SHADES.set(k, v); } return v; }
const isWallBlock = o => o && o.k === 'block' && ITEMS[o.id].place.solid && !ITEMS[o.id].place.station && !ITEMS[o.id].place.chest && o.id !== 'fence' && o.id !== 'lamp';
// solid building blocks fill their whole tile and join seamlessly with their neighbours
function drawBlock(ctx, X, Y, S, o, t, z, x, y) {
  const p = ITEMS[o.id].place, ic = ITEMS[o.id].icon;
  if (p.floor) {
    if (p.deco) { ctx.drawImage(iconCanvas(o.id), X + S * 0.15, Y + S * 0.05, S * 0.7, S * 0.7); return; }
    ctx.fillStyle = ic.c; ctx.fillRect(X, Y, S + 1, S + 1); ctx.fillStyle = sh(ic.c, -0.18);
    if (ic.pat === 'planks') for (let i = 1; i < 4; i++) ctx.fillRect(X, Y + i * S / 4, S + 1, 2);
    else { const h = thash(x, y); for (const [a, b] of [[0.08, 0.1], [0.55, 0.12], [0.1, 0.55], [0.55, 0.55]]) { rr(ctx, X + a * S + h * 3, Y + b * S, S * 0.38, S * 0.36, 4); ctx.fill(); } }
    return;
  }
  if (o.id === 'fence') {
    const post = sh(ic.c, -0.15), cx = X + S / 2;
    ctx.fillStyle = ic.c;
    const link = (dx, dy) => { const n = z.o(x + dx, y + dy); return n && n.k === 'block' && (n.id === 'fence' || isWallBlock(n)); };
    if (link(-1, 0)) { ctx.fillRect(X, Y + S * 0.15, S / 2, S * 0.1); ctx.fillRect(X, Y + S * 0.45, S / 2, S * 0.1); }
    if (link(1, 0)) { ctx.fillRect(cx, Y + S * 0.15, S / 2 + 1, S * 0.1); ctx.fillRect(cx, Y + S * 0.45, S / 2 + 1, S * 0.1); }
    if (link(0, -1)) ctx.fillRect(cx - S * 0.05, Y - S * 0.3, S * 0.1, S * 0.5);
    if (link(0, 1)) ctx.fillRect(cx - S * 0.05, Y + S * 0.5, S * 0.1, S * 0.5);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(cx - S * 0.1, Y + S * 0.72, S * 0.22, S * 0.1);
    ctx.fillStyle = post; ctx.fillRect(cx - S * 0.08, Y - S * 0.1, S * 0.16, S * 0.85); ctx.fillStyle = ic.c; ctx.fillRect(cx - S * 0.08, Y - S * 0.1, S * 0.16, S * 0.12);
    return;
  }
  if (o.id === 'lamp') {
    const cx = X + S / 2; ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, cx, Y + S * 0.85, S * 0.22, S * 0.07);
    ctx.fillStyle = '#3a3a44'; ctx.fillRect(cx - S * 0.04, Y - S * 0.2, S * 0.08, S * 1.05); ctx.fillRect(cx - S * 0.14, Y + S * 0.78, S * 0.28, S * 0.08);
    ctx.save(); ctx.shadowColor = '#ffd23a'; ctx.shadowBlur = 18; ctx.fillStyle = '#fff2b0'; rr(ctx, cx - S * 0.13, Y - S * 0.5, S * 0.26, S * 0.32, 4); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#3a3a44'; ctx.fillRect(cx - S * 0.17, Y - S * 0.56, S * 0.34, S * 0.07);
    return;
  }
  if (!isWallBlock(o)) {
    // stations and chests: chunky single props
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(X + S * 0.05, Y + S * 0.82, S * 0.95, S * 0.2);
    ctx.drawImage(iconCanvas(o.id), X - S * 0.12, Y - S * 0.28, S * 1.24, S * 1.24);
    if (o.id === 'furnace' && o.fz && o.fz.active) {
      ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(t * 12) * 0.2; ctx.fillStyle = '#ffb02a'; ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 20; ctx.fillRect(X + S * 0.3, Y + S * 0.28, S * 0.4, S * 0.2); ctx.restore();
      if (Math.random() < 0.08) G.particles.push({ x: x + 0.5 + rand(-0.1, 0.1), y: y - 0.2, vx: rand(-0.3, 0.3), vy: -1.5, life: 1.2, max: 1.2, col: 'rgba(140,140,140,.55)', size: 7, grav: 0 });
    }
    if (o.id === 'enchant_table') { ctx.fillStyle = `rgba(160,120,255,${0.4 + Math.sin(t * 3) * 0.3})`; ctx.font = `${S * 0.3}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('✦', X + S * 0.5 + Math.sin(t * 2) * S * 0.3, Y - S * 0.3 + Math.cos(t * 1.7) * S * 0.1); }
    const bt = p.bt; if (bt > 1) { ctx.font = `${S * 0.22}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd23a'; ctx.fillText(ROMAN[bt], X + S * 0.85, Y - S * 0.12); }
    return;
  }
  const col = ic.c || ic.c1, fh = S * 0.3, top = Y - fh;
  const same = (dx, dy) => isWallBlock(z.o(x + dx, y + dy));
  ctx.fillStyle = col; ctx.fillRect(X, top, S + 1, S + 1);
  ctx.fillStyle = sh(col, -0.14);
  const pat = ic.pat || (ITEMS[o.id].tags && ITEMS[o.id].tags.includes('log') ? 'log' : 'smooth'), h = thash(x, y);
  if (pat === 'planks') for (let i = 1; i < 4; i++) ctx.fillRect(X, top + i * S / 4, S + 1, 2);
  else if (pat === 'cobble') { for (let i = 0; i < 5; i++) { circ(ctx, X + thash(x * 3 + i, y) * S, top + thash(x, y * 5 + i) * S, S * 0.11); } }
  else if (pat === 'bricks') { for (let r = 0; r < 4; r++) { ctx.fillRect(X, top + r * S / 4, S + 1, 2); for (let k = 0; k < 2; k++) ctx.fillRect(X + ((r % 2) * 0.25 + k * 0.5) * S, top + r * S / 4, 2, S / 4); } }
  else if (pat === 'hedge') { ctx.fillStyle = sh(col, 0.18); for (let i = 0; i < 4; i++) circ(ctx, X + (0.25 + (i % 2) * 0.5) * S, top + (0.25 + (i >> 1) * 0.5) * S, S * 0.2); }
  else if (pat === 'log') { ctx.fillStyle = ic.c2; ctx.beginPath(); ctx.arc(X + S / 2, top + S / 2, S * 0.36, 0, 7); ctx.fill(); ctx.strokeStyle = sh(ic.c2, -0.25); ctx.lineWidth = 2; for (const r of [0.24, 0.12]) { ctx.beginPath(); ctx.arc(X + S / 2, top + S / 2, S * r, 0, 7); ctx.stroke(); } }
  else if (h > 0.5) { ctx.fillRect(X + S * 0.2, top + S * 0.3, S * 0.25, 2); }
  // outline only where the wall ends, so joined blocks read as one surface
  ctx.fillStyle = sh(col, -0.35);
  if (!same(-1, 0)) ctx.fillRect(X, top, 2, S); if (!same(1, 0)) ctx.fillRect(X + S - 1, top, 2, S); if (!same(0, -1)) { ctx.fillStyle = sh(col, 0.2); ctx.fillRect(X, top, S + 1, 3); }
  if (!same(0, 1)) { ctx.fillStyle = sh(col, -0.3); ctx.fillRect(X, top + S, S + 1, fh); ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(X, Y + S, S + 1, S * 0.15); if (pat === 'planks' || pat === 'bricks') { ctx.fillStyle = sh(col, -0.42); ctx.fillRect(X, top + S + fh / 2, S + 1, 2); } }
}
function regrowRing(ctx, cx, cy, S, o, n) {
  const d = Math.hypot(G.me.x - (cx - RD.W / 2 - RD.ox) / S - G.cam.x, G.me.y - (cy - RD.H / 2 - RD.oy) / S - G.cam.y); if (d > 4) return;
  const total = n.respawn * (G.zone.isHome ? 2.5 : 1) * 1000, f = clamp(1 - (o.at - Date.now()) / total, 0, 1);
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, S * 0.12, 0, 7); ctx.stroke();
  ctx.strokeStyle = '#9aff8a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, S * 0.12, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
}
function drawBuilding(ctx, b, S, t) {
  const X = sx(b.x), Y = sy(b.y), W = b.w * S, H = b.h * S;
  const roofH = H * (b.style === 'tower' ? 0.62 : 0.5), wallY = Y + roofH * 0.85, wallH = Y + H - wallY;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(X + S * 0.2, Y + H - S * 0.05, W, S * 0.3);
  // walls
  ctx.fillStyle = b.wall; ctx.fillRect(X + S * 0.15, wallY, W - S * 0.3, wallH);
  ctx.fillStyle = sh(b.wall, -0.15); ctx.fillRect(X + S * 0.15, Y + H - S * 0.35, W - S * 0.3, S * 0.35);
  if (b.style === 'forge') { ctx.fillStyle = sh(b.wall, -0.1); for (let r = 0; r < 4; r++) for (let c = 0; c < b.w; c++) { ctx.fillRect(X + S * 0.15 + c * S + (r % 2) * S * 0.5, wallY + r * wallH / 4, 2, wallH / 4); } }
  // columns for the bank and the auction hall
  if (b.style === 'bank' || b.style === 'hall') { ctx.fillStyle = '#ffffff'; const n = b.style === 'hall' ? 6 : 4; for (let i = 0; i < n; i++) { const cx = X + S * 0.5 + i * (W - S) / (n - 1); ctx.fillRect(cx - S * 0.14, wallY + S * 0.1, S * 0.28, wallH - S * 0.2); ctx.fillStyle = '#d8d8e0'; ctx.fillRect(cx - S * 0.2, wallY, S * 0.4, S * 0.15); ctx.fillStyle = '#ffffff'; } }
  // windows
  const winY = wallY + wallH * 0.22, glow = 0.75 + Math.sin(t * 1.5 + b.x) * 0.1;
  const wins = Math.max(2, Math.floor(b.w / 3));
  for (let i = 0; i < wins; i++) {
    const wx = X + S * 0.7 + i * (W - S * 1.4) / Math.max(1, wins - 1) - S * 0.35; if (Math.abs(wx + S * 0.35 - (X + W / 2)) < S * 0.9) continue;
    ctx.fillStyle = sh(b.roof, -0.3); ctx.fillRect(wx - 3, winY - 3, S * 0.7 + 6, S * 0.7 + 6);
    ctx.fillStyle = `rgba(255,214,120,${glow})`; ctx.fillRect(wx, winY, S * 0.7, S * 0.7); ctx.fillStyle = sh(b.roof, -0.3); ctx.fillRect(wx + S * 0.33, winY, 3, S * 0.7); ctx.fillRect(wx, winY + S * 0.33, S * 0.7, 3);
  }
  // door
  const dx = X + W / 2 - S * 0.45, dy = Y + H - S * 1.25;
  ctx.fillStyle = sh(b.roof, -0.45); rr(ctx, dx - 4, dy - 4, S * 0.9 + 8, S * 1.25 + 4, S * 0.4); ctx.fill();
  ctx.fillStyle = '#6a4424'; rr(ctx, dx, dy, S * 0.9, S * 1.25, S * 0.36); ctx.fill(); ctx.fillStyle = '#ffd23a'; circ(ctx, dx + S * 0.7, dy + S * 0.7, S * 0.05);
  // roof
  ctx.fillStyle = sh(b.roof, -0.25);
  if (b.style === 'tower') {
    ctx.beginPath(); ctx.moveTo(X + W / 2, Y - S * 1.6); ctx.lineTo(X + W + S * 0.2, wallY + S * 0.2); ctx.lineTo(X - S * 0.2, wallY + S * 0.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = b.roof; ctx.beginPath(); ctx.moveTo(X + W / 2, Y - S * 1.6); ctx.lineTo(X + W, wallY); ctx.lineTo(X + W / 2, wallY); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.shadowColor = '#c38bff'; ctx.shadowBlur = 16; ctx.fillStyle = `rgba(210,170,255,${0.6 + Math.sin(t * 3) * 0.3})`; star(ctx, X + W / 2, Y - S * 1.7 + Math.sin(t * 2) * 4, S * 0.3, S * 0.13, 4); ctx.restore();
  } else {
    ctx.beginPath(); ctx.moveTo(X - S * 0.25, wallY + S * 0.15); ctx.lineTo(X + S * 0.6, Y); ctx.lineTo(X + W - S * 0.6, Y); ctx.lineTo(X + W + S * 0.25, wallY + S * 0.15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = b.roof; ctx.beginPath(); ctx.moveTo(X - S * 0.1, wallY); ctx.lineTo(X + S * 0.65, Y + S * 0.05); ctx.lineTo(X + W - S * 0.65, Y + S * 0.05); ctx.lineTo(X + W + S * 0.1, wallY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = sh(b.roof, -0.15); ctx.lineWidth = 2; for (let r = 1; r < 4; r++) { const yy = Y + (wallY - Y) * r / 4; ctx.beginPath(); ctx.moveTo(X + S * 0.6 - r * S * 0.17, yy); ctx.lineTo(X + W - S * 0.6 + r * S * 0.17, yy); ctx.stroke(); }
  }
  if (b.style === 'market') { for (let i = 0; i < b.w; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#e8503a'; ctx.beginPath(); ctx.moveTo(X + i * S, wallY - S * 0.05); ctx.lineTo(X + (i + 1) * S, wallY - S * 0.05); ctx.lineTo(X + (i + 1) * S, wallY + S * 0.4); ctx.arc(X + (i + 0.5) * S, wallY + S * 0.4, S / 2, 0, Math.PI); ctx.closePath(); ctx.fill(); } }
  if (b.style === 'forge' || b.style === 'workshop' || b.style === 'cottage') {
    const cx = X + W - S * 1.6; ctx.fillStyle = '#6a5a52'; ctx.fillRect(cx, Y - S * 0.6, S * 0.6, S * 1.2); ctx.fillStyle = '#4a3a32'; ctx.fillRect(cx - S * 0.05, Y - S * 0.7, S * 0.7, S * 0.2);
    if (Math.random() < (b.style === 'forge' ? 0.25 : 0.06)) G.particles.push({ x: b.x + b.w - 1.3 + rand(-0.1, 0.1), y: b.y - 0.8, vx: rand(-0.2, 0.4), vy: -1.6, life: 2.2, max: 2.2, col: b.style === 'forge' ? 'rgba(70,70,70,.5)' : 'rgba(200,200,200,.4)', size: 10, grav: -0.2 });
  }
  if (b.style === 'workshop') { ctx.save(); ctx.translate(X + S * 1.3, Y + roofH * 0.45); ctx.rotate(t * 0.8); ctx.fillStyle = '#ffd23a'; for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-S * 0.08, -S * 0.42, S * 0.16, S * 0.16); } circ(ctx, 0, 0, S * 0.3); ctx.fillStyle = sh(b.roof, -0.3); circ(ctx, 0, 0, S * 0.12); ctx.restore(); }
  // sign
  const n = NPCS[b.id], sy2 = wallY - S * 0.05;
  ctx.font = `${S * 0.34}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(b.sign).width + S * 0.9;
  ctx.fillStyle = '#4a2f1a'; rr(ctx, X + W / 2 - tw / 2, sy2 - S * 0.3, tw, S * 0.6, 6); ctx.fill(); ctx.fillStyle = '#7a5230'; rr(ctx, X + W / 2 - tw / 2 + 3, sy2 - S * 0.3 + 3, tw - 6, S * 0.6 - 6, 4); ctx.fill();
  ctx.fillStyle = '#ffe9a8'; ctx.fillText(b.sign, X + W / 2 + S * 0.2, sy2 + 1);
  ctx.font = `${S * 0.32}px ${EMOJI_FONT}`; ctx.fillText(n.e, X + W / 2 - tw / 2 + S * 0.35, sy2);
}
function drawConveyor(ctx, X, Y, S, o, t) {
  ctx.fillStyle = '#22252c'; ctx.fillRect(X + 1, Y + 1, S - 2, S - 2);
  ctx.fillStyle = '#3a3f4a'; ctx.fillRect(X + S * 0.08, Y + S * 0.08, S * 0.84, S * 0.84);
  ctx.save(); ctx.translate(X + S / 2, Y + S / 2); ctx.rotate(o.dir * Math.PI / 2);
  ctx.beginPath(); ctx.rect(-S * 0.42, -S * 0.42, S * 0.84, S * 0.84); ctx.clip();
  ctx.strokeStyle = o.fast ? 'rgba(255,90,58,.7)' : 'rgba(255,210,58,.55)'; ctx.lineWidth = Math.max(2, S * 0.06);
  const off = (t * (o.fast ? 3.2 : 1.6) % 1) * S * 0.5;
  for (let i = -2; i < 3; i++) { const bx = i * S * 0.5 + off - S * 0.1; ctx.beginPath(); ctx.moveTo(bx - S * 0.1, -S * 0.2); ctx.lineTo(bx + S * 0.06, 0); ctx.lineTo(bx - S * 0.1, S * 0.2); ctx.stroke(); }
  ctx.restore();
  const [dx, dy] = DIRS[o.dir];
  for (const it of o.items) { const px = X + S / 2 + dx * (it.p - 0.5) * S, py = Y + S / 2 + dy * (it.p - 0.5) * S; ctx.drawImage(iconCanvas(it.id), px - S * 0.22, py - S * 0.26, S * 0.44, S * 0.44); }
}
function drawMachine(ctx, X, Y, S, o, t) {
  const M = MACHINES[o.id], cx = X + S / 2, act = o.anim > 0;
  if (o.anim) o.anim = Math.max(0, o.anim - 0.016);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(X + S * 0.08, Y + S * 0.84, S * 0.9, S * 0.18);
  ctx.fillStyle = '#2a2d36'; rr(ctx, X + S * 0.04, Y - S * 0.06, S * 0.92, S * 0.98, S * 0.14); ctx.fill();
  ctx.fillStyle = M.col; rr(ctx, X + S * 0.08, Y - S * 0.1, S * 0.84, S * 0.84, S * 0.12); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.28)'; rr(ctx, X + S * 0.18, Y, S * 0.64, S * 0.6, S * 0.08); ctx.fill();
  ctx.save(); ctx.translate(cx, Y + S * 0.3);
  const sp = t * (act ? 8 : 2.5);
  if (o.id === 'lumber_bot' || o.id === 'mob_grinder') {
    ctx.rotate(sp); ctx.fillStyle = o.id === 'lumber_bot' ? '#ddd' : '#c33'; for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-S * 0.04, -S * 0.25, S * 0.08, S * 0.1); } circ(ctx, 0, 0, S * 0.17); ctx.fillStyle = '#555'; circ(ctx, 0, 0, S * 0.06);
  } else if (o.id === 'auto_drill') {
    const b = Math.sin(t * (act ? 20 : 4)) * S * 0.04; ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(-S * 0.14, -S * 0.2 + b); ctx.lineTo(S * 0.14, -S * 0.2 + b); ctx.lineTo(0, S * 0.22 + b); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#888'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-S * 0.1 + i * 0.03 * S, -S * 0.1 + i * S * 0.1 + b); ctx.lineTo(S * 0.1 - i * 0.03 * S, -S * 0.05 + i * S * 0.1 + b); ctx.stroke(); }
    if (act && Math.random() < 0.3) burst((cx - RD.W / 2 - RD.ox) / S + G.cam.x, (Y + S * 0.5 - RD.H / 2 - RD.oy) / S + G.cam.y, '#ffd27a', 2, 2, 3);
  } else if (o.id === 'auto_grower') {
    const g = 0.5 + Math.sin(t * 2) * 0.15; ctx.strokeStyle = '#4fa83a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, S * 0.22); ctx.lineTo(0, -S * 0.15 * g * 2); ctx.stroke(); ctx.fillStyle = '#6fd34a'; ell(ctx, -S * 0.08, -S * 0.05, S * 0.09, S * 0.05); ell(ctx, S * 0.08, -S * 0.12, S * 0.09, S * 0.05);
    ctx.fillStyle = '#7ad8ff'; for (let i = 0; i < 3; i++) circ(ctx, -S * 0.2 + i * S * 0.2, -S * 0.2 + ((t * 1.5 + i * 0.3) % 1) * S * 0.4, 2);
  } else if (o.id === 'auto_furnace') {
    ctx.fillStyle = '#1a1a1a'; rr(ctx, -S * 0.2, -S * 0.12, S * 0.4, S * 0.3, 4); ctx.fill(); ctx.fillStyle = act ? '#ffb02a' : '#a0501a'; ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = act ? 16 : 4; rr(ctx, -S * 0.15, -S * 0.04 + Math.sin(t * 9) * 1.5, S * 0.3, S * 0.16, 3); ctx.fill();
  } else if (o.id === 'compactor') {
    const pz = Math.abs(Math.sin(t * (act ? 6 : 1.5))) * S * 0.16; ctx.fillStyle = '#ddd'; ctx.fillRect(-S * 0.22, -S * 0.24 + pz, S * 0.44, S * 0.08); ctx.fillStyle = '#888'; ctx.fillRect(-S * 0.03, -S * 0.3, S * 0.06, pz + S * 0.06); ctx.fillStyle = '#c38bff'; ctx.fillRect(-S * 0.12, S * 0.1, S * 0.24, S * 0.12);
  } else if (o.id === 'auto_seller') {
    ctx.scale(Math.cos(t * (act ? 8 : 2)), 1); ctx.fillStyle = '#ffd23a'; circ(ctx, 0, 0, S * 0.17); ctx.fillStyle = '#c89a1a'; ctx.font = `${S * 0.22}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 1);
  }
  ctx.restore();
  ctx.font = `${S * 0.24}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(ROMAN[o.tier], X + S * 0.82, Y - S * 0.02);
  if (M.kind === 'gather') {
    const per = machinePeriod(o.id, o.tier) * 1000, full = bufCount(o) >= machineCap(o.tier);
    if (full) label(ctx, cx, Y - S * 0.32, 'FULL', '#ff6a6a', S * 0.24);
    else if (o.res) { const f = clamp((Date.now() - o.last) / per, 0, 1); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X + S * 0.16, Y - S * 0.02, S * 0.09, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); }
    else label(ctx, cx, Y - S * 0.32, 'Pick a resource', '#ffd23a', S * 0.2);
  }
  const bc = bufCount(o); if (bc) { ctx.font = `${S * 0.22}px ${FONT}`; ctx.fillStyle = '#ffd23a'; ctx.fillText(bc, X + S * 0.5, Y + S * 0.7); }
}
function drawNpc(ctx, cx, cy, S, o, t) {
  const n = NPCS[o.id];
  drawChar(ctx, cx, cy, S, { shirt: n.shirt, hair: n.hair, skin: '#f2c9a0', dir: Math.PI / 2 + Math.sin(t * 0.5 + cx) * 0.4, walkT: 0, moving: false, swing: 0 });
  const bob = Math.sin(t * 2.5 + cx * 0.01) * S * 0.06;
  ctx.font = `${S * 0.42}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n.e, cx, cy - S * 1.25 + bob);
  label(ctx, cx, cy - S * 0.88, n.name, '#ffe9a8', S * 0.26);
  const d = Math.hypot(G.me.x - (cx - RD.W / 2 - RD.ox) / S - G.cam.x, G.me.y - (cy - RD.H / 2 - RD.oy) / S - G.cam.y);
  if (d < 2.6) label(ctx, cx, cy + S * 0.55, 'Press F', '#9ef0ff', S * 0.22);
}
function drawPortal(ctx, cx, cy, S, o, t) {
  const base = o.to.split('@')[0], d = ZONES[base], col = CAT_COL[d ? d.cat : 'hub'];
  const locked = !!zoneReq(base);
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(ctx, 0, S * 0.32, S * 0.55, S * 0.16);
  ctx.fillStyle = '#5a5560'; ctx.beginPath(); ctx.ellipse(0, 0, S * 0.55, S * 0.42, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.scale(1, 0.75);
  for (let i = 0; i < 3; i++) {
    ctx.rotate(t * (1.2 + i * 0.5) * (i % 2 ? -1 : 1));
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, S * (0.48 - i * 0.12));
    g.addColorStop(0, '#fff'); g.addColorStop(0.5, locked ? '#666' : col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, S * (0.48 - i * 0.12), S * (0.4 - i * 0.1), 0, 0, 7); ctx.fill();
  }
  ctx.restore(); ctx.restore();
  if (!locked && Math.random() < 0.15) G.particles.push({ x: (cx - RD.W / 2 - RD.ox) / S + G.cam.x + rand(-0.4, 0.4), y: (cy - RD.H / 2 - RD.oy) / S + G.cam.y + rand(-0.2, 0.2), vx: 0, vy: -2, life: 0.8, max: 0.8, col, size: 3, grav: 0 });
  label(ctx, cx, cy - S * 0.78, (locked ? '🔒 ' : '') + o.label, locked ? '#aaa' : col, S * 0.26);
  if (locked) label(ctx, cx, cy - S * 1.15, zoneReq(base), '#ff8a8a', S * 0.2);
}
function drawDeco(ctx, X, Y, S, o, x, y, t) {
  const cx = X + S / 2, by = Y + S;
  switch (o.id) {
    case 'fountain': {
      // draw the town fountain 1.7× larger around its base
      if (!drawDeco.big) { drawDeco.big = 1; ctx.save(); ctx.translate(cx, by - S * 0.2); ctx.scale(1.7, 1.7); ctx.translate(-cx, -by); drawDeco(ctx, X, Y, S, o, x, y, t); ctx.restore(); drawDeco.big = 0; return; }
      ctx.fillStyle = '#9a96a0'; ell(ctx, cx, by - S * 0.35, S * 1.3, S * 0.75); ctx.fillStyle = '#7ab8e8'; ell(ctx, cx, by - S * 0.42, S * 1.1, S * 0.6);
      ctx.fillStyle = '#b8b4be'; ctx.fillRect(cx - S * 0.12, by - S * 1.3, S * 0.24, S * 0.9); ctx.fillStyle = '#a8a4ae'; ell(ctx, cx, by - S * 1.3, S * 0.35, S * 0.14);
      ctx.fillStyle = 'rgba(200,235,255,.8)'; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, p = (t * 0.8 + i * 0.17) % 1; circ(ctx, cx + Math.cos(a) * S * 0.5 * p, by - S * 1.35 + S * 0.9 * p * p - Math.sin(p * Math.PI) * S * 0.3, 2.5); }
      return;
    }
    case 'grave': ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, cx, by - S * 0.15, S * 0.3, S * 0.1); ctx.fillStyle = '#7a7a82'; rr(ctx, cx - S * 0.22, by - S * 0.85, S * 0.44, S * 0.7, S * 0.18); ctx.fill(); ctx.fillStyle = '#5a5a62'; ctx.fillRect(cx - S * 0.03, by - S * 0.72, S * 0.06, S * 0.3); ctx.fillRect(cx - S * 0.1, by - S * 0.64, S * 0.2, S * 0.06); return;
    case 'bones': ctx.fillStyle = '#e6e0cc'; ctx.save(); ctx.translate(cx, by - S * 0.4); ctx.rotate(thash(x, y) * 3); ctx.fillRect(-S * 0.2, -2, S * 0.4, 4); circ(ctx, -S * 0.2, -2, 3); circ(ctx, S * 0.2, 2, 3); ctx.restore(); return;
    case 'deadtree': ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = S * 0.12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, by - S * 0.15); ctx.lineTo(cx, by - S * 1.1); ctx.moveTo(cx, by - S * 0.7); ctx.lineTo(cx - S * 0.35, by - S * 1.0); ctx.moveTo(cx, by - S * 0.85); ctx.lineTo(cx + S * 0.3, by - S * 1.2); ctx.stroke(); return;
    case 'web': ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, Y + S / 2); ctx.lineTo(cx + Math.cos(a) * S * 0.5, Y + S / 2 + Math.sin(a) * S * 0.5); ctx.stroke(); } for (let r = 1; r < 4; r++) { ctx.beginPath(); ctx.arc(cx, Y + S / 2, r * S * 0.13, 0, 7); ctx.stroke(); } return;
    case 'crystal': ctx.save(); ctx.shadowColor = '#c070ff'; ctx.shadowBlur = 14; ctx.fillStyle = 'rgba(190,120,255,.85)'; tri(ctx, cx, by - S * 1.1, S * 0.18, S * 0.95); ctx.fillStyle = 'rgba(150,90,230,.85)'; tri(ctx, cx + S * 0.2, by - S * 0.7, S * 0.12, S * 0.55); ctx.restore(); return;
    case 'torch': ctx.fillStyle = '#6a4a2a'; ctx.fillRect(cx - 2, by - S * 0.7, 4, S * 0.5); ctx.save(); ctx.shadowColor = '#ffb02a'; ctx.shadowBlur = 14; ctx.fillStyle = '#ffd23a'; ell(ctx, cx, by - S * 0.78 + Math.sin(t * 12 + x) * 1.5, S * 0.07, S * 0.12); ctx.restore(); return;
    case 'flowers': [['#ff6a8a', 0.2, 0.3], ['#ffe94d', 0.6, 0.55], ['#8ab8ff', 0.35, 0.75]].forEach(([c, a, b]) => { ctx.fillStyle = '#3f8a3a'; ctx.fillRect(X + a * S, Y + b * S, 2, S * 0.12); ctx.fillStyle = c; circ(ctx, X + a * S + 1, Y + b * S, S * 0.055); }); return;
    case 'ptree': return drawTree(ctx, cx, by, S, NODES[thash(x, y) > 0.5 ? 'oak' : 'cherry'], { hp: 1, mhp: 1 }, x, y, t);
    case 'bench': ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(X + S * 0.05, by - S * 0.2, S * 0.9, S * 0.12); ctx.fillStyle = '#7a5230'; ctx.fillRect(X + S * 0.05, by - S * 0.55, S * 0.9, S * 0.12); ctx.fillRect(X + S * 0.05, by - S * 0.8, S * 0.9, S * 0.1); ctx.fillStyle = '#3a3a44'; ctx.fillRect(X + S * 0.1, by - S * 0.5, S * 0.08, S * 0.35); ctx.fillRect(X + S * 0.82, by - S * 0.5, S * 0.08, S * 0.35); return;
    case 'stall': { const c = ['#e8503a', '#3a8ae0', '#ffb020'][(x + y) % 3]; ctx.fillStyle = '#7a5230'; ctx.fillRect(X + S * 0.05, by - S * 0.55, S * 0.9, S * 0.45); ctx.fillStyle = '#5a3a1a'; ctx.fillRect(X + S * 0.08, by - S * 1.2, S * 0.08, S * 0.7); ctx.fillRect(X + S * 0.84, by - S * 1.2, S * 0.08, S * 0.7);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#fff' : c; ctx.fillRect(X - S * 0.05 + i * S * 0.275, by - S * 1.35, S * 0.275, S * 0.25); }
      ctx.font = `${S * 0.3}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.fillText(['🍎', '🐟', '💎'][(x + y) % 3], cx, by - S * 0.6); return; }
    case 'banner': { const wave = Math.sin(t * 2.5 + x) * S * 0.05; ctx.fillStyle = '#5a5a62'; ctx.fillRect(cx - 2, by - S * 1.6, 4, S * 1.5); ctx.fillStyle = '#9a3a3a'; ctx.beginPath(); ctx.moveTo(cx + 2, by - S * 1.55); ctx.lineTo(cx + S * 0.5 + wave, by - S * 1.5); ctx.lineTo(cx + S * 0.45 + wave, by - S * 0.85); ctx.lineTo(cx + S * 0.25 + wave, by - S * 0.95); ctx.lineTo(cx + 2, by - S * 0.85); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffd23a'; circ(ctx, cx + S * 0.25 + wave * 0.6, by - S * 1.25, S * 0.08); return; }
    case 'shroom': ctx.fillStyle = '#efe4d0'; ctx.fillRect(cx - 2, Y + S * 0.5, 4, S * 0.2); ctx.fillStyle = thash(x, y) > 0.5 ? '#c84aff' : '#d63a3a'; ctx.beginPath(); ctx.ellipse(cx, Y + S * 0.52, S * 0.12, S * 0.08, 0, Math.PI, 0); ctx.fill(); return;
  }
}

// ------------------------------------------------------------ characters
function drawChar(ctx, x, y, S, c) {
  const s = S * (c.scale || 1), bob = c.moving ? Math.abs(Math.sin(c.walkT)) * s * 0.06 : 0;
  const leg = c.moving ? Math.sin(c.walkT) * s * 0.08 : 0, fx = Math.cos(c.dir), fy = Math.sin(c.dir);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, x, y + s * 0.3, s * 0.3, s * 0.1);
  const back = fy < -0.35;
  if (back && c.heldId) drawHeld(ctx, x, y - bob, s, c);
  const A = c.armor || {};
  ctx.fillStyle = A.legs || '#2a2a3a'; ctx.fillRect(x - s * 0.15, y + s * 0.08 + leg, s * 0.12, s * 0.2); ctx.fillRect(x + s * 0.03, y + s * 0.08 - leg, s * 0.12, s * 0.2);
  if (A.boots) { ctx.fillStyle = A.boots; ctx.fillRect(x - s * 0.17, y + s * 0.2 + leg, s * 0.16, s * 0.1); ctx.fillRect(x + s * 0.01, y + s * 0.2 - leg, s * 0.16, s * 0.1); }
  const shirt = A.chest || c.shirt;
  ctx.fillStyle = shirt; rr(ctx, x - s * 0.22, y - s * 0.28 - bob, s * 0.44, s * 0.42, s * 0.12); ctx.fill();
  ctx.fillStyle = sh(shirt, -0.25); ctx.fillRect(x - s * 0.22, y + s * 0.02 - bob, s * 0.44, s * 0.06);
  if (A.chest) { ctx.fillStyle = sh(A.chest, 0.3); ctx.fillRect(x - s * 0.04, y - s * 0.24 - bob, s * 0.08, s * 0.24); }
  ctx.fillStyle = c.skin || '#f2c9a0'; circ(ctx, x, y - s * 0.5 - bob, s * 0.25);
  ctx.fillStyle = A.helmet || c.hair || '#4a2a1a';
  ctx.beginPath(); ctx.arc(x, y - s * 0.52 - bob, s * (A.helmet ? 0.28 : 0.26), Math.PI * (back ? 0 : 1.05), Math.PI * (back ? 2 : 1.95)); ctx.fill();
  if (A.helmet && !back) { ctx.fillStyle = sh(A.helmet, -0.3); ctx.fillRect(x - s * 0.27, y - s * 0.56 - bob, s * 0.54, s * 0.05); }
  if (!back) { ctx.fillStyle = '#1a1a2a'; const ex = fx * s * 0.07, ey = Math.max(0, fy) * s * 0.04; circ(ctx, x - s * 0.09 + ex, y - s * 0.47 - bob + ey, s * 0.035); circ(ctx, x + s * 0.09 + ex, y - s * 0.47 - bob + ey, s * 0.035); }
  if (c.hurt > 0) { ctx.fillStyle = `rgba(255,40,40,${c.hurt})`; circ(ctx, x, y - s * 0.3, s * 0.4); }
  if (!back && c.heldId) drawHeld(ctx, x, y - bob, s, c);
  if (c.swing > 0 && c.sword) { ctx.strokeStyle = `rgba(255,255,255,${c.swing * 0.6})`; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.arc(x, y - s * 0.2, s * 1.2, c.dir - 1 + (1 - c.swing) * 0.5, c.dir + 1 - (1 - c.swing) * 1.2); ctx.stroke(); }
}
function drawHeld(ctx, x, y, s, c) {
  const hx = x + Math.cos(c.dir) * s * 0.3, hy = y - s * 0.12 + Math.sin(c.dir) * s * 0.18;
  const swing = c.swing > 0 ? Math.sin(c.swing * Math.PI) * 1.5 : 0;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(c.dir + Math.PI / 4 - 0.6 + swing);
  ctx.drawImage(iconCanvas(c.heldId), -s * 0.12, -s * 0.52, s * 0.6, s * 0.6);
  ctx.restore();
}
function drawPlayer(ctx, S, t) {
  const me = G.me, h = held();
  const t0 = h && ITEMS[h.id].tool;
  drawChar(ctx, sx(me.x), sy(me.y), S, { shirt: G.P.shirt, hair: '#3a2a1a', dir: me.dir, walkT: me.walkT, moving: me.moving, swing: me.swing, heldId: h ? h.id : null, hurt: me.hurtT > 0 ? me.hurtT : 0, sword: t0 && t0.kind === 'sword', armor: armorColors(G.P.armor) });
  const fs = fullSet(); if (fs && Math.random() < 0.12) G.particles.push({ x: me.x + rand(-0.3, 0.3), y: me.y + rand(-0.6, 0.2), vx: 0, vy: -1, life: 0.6, max: 0.6, col: fs.col, size: 3, grav: 0 });
  if (NET.connected) label(ctx, sx(me.x), sy(me.y) - S * 0.95, G.P.name, '#ffffff', S * 0.24);
  // pet follow
  const p = activePet();
  if (p) {
    if (!G.pet || G.pet.uid !== p.uid) G.pet = { uid: p.uid, x: me.x - 0.8, y: me.y, p };
    const tx = me.x - Math.cos(me.dir) * 0.9, ty = me.y - 0.3 - Math.sin(me.dir) * 0.5;
    G.pet.x += (tx - G.pet.x) * 0.06; G.pet.y += (ty - G.pet.y) * 0.06; G.pet.p = p;
  } else G.pet = null;
}
function armorColors(A) { const o = {}; if (A) for (const sl of ARMOR_SLOTS) if (A[sl] && ITEMS[A[sl].id]) o[sl] = ITEMS[A[sl].id].icon.c; return o; }
// bouncing arrow over the tutorial target, or at the screen edge when it is off-screen
function drawTutArrow(ctx, S, t) {
  const tg = G.tutTarget; if (!tg) return;
  let X = sx(tg.x), Y = sy(tg.y) - S * 1.6 + Math.sin(t * 5) * S * 0.15;
  const m = 60, off = X < m || X > RD.W - m || Y < m || Y > RD.H - m;
  ctx.save();
  if (off) {
    const a = Math.atan2(Y - RD.H / 2, X - RD.W / 2); X = clamp(X, m, RD.W - m); Y = clamp(Y, m, RD.H - m);
    ctx.translate(X, Y); ctx.rotate(a); ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; tri2(ctx, S * 0.5, 0, S * 0.5); ctx.stroke(); ctx.fill();
  } else {
    ctx.translate(X, Y); ctx.rotate(Math.PI / 2); ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(S * 0.45, 0); ctx.lineTo(-S * 0.05, -S * 0.35); ctx.lineTo(-S * 0.05, -S * 0.14); ctx.lineTo(-S * 0.4, -S * 0.14); ctx.lineTo(-S * 0.4, S * 0.14); ctx.lineTo(-S * 0.05, S * 0.14); ctx.lineTo(-S * 0.05, S * 0.35); ctx.closePath(); ctx.stroke(); ctx.fill();
  }
  ctx.restore();
}
function drawPet(ctx, pet, S, t) {
  const X = sx(pet.x), Y = sy(pet.y), bob = Math.sin(t * 3) * S * 0.08, p = pet.p;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ell(ctx, X, Y + S * 0.3, S * 0.18, S * 0.06);
  if (p.rar >= 3) { ctx.fillStyle = RCOL[p.rar] + '44'; circ(ctx, X, Y - bob, S * 0.32); }
  ctx.font = `${S * 0.5}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(PETS[p.id].e, X, Y - bob);
  ctx.font = `${S * 0.2}px ${FONT}`; ctx.fillStyle = RCOL[p.rar]; ctx.fillText(`Lv${p.lvl}`, X, Y - S * 0.45 - bob);
}
function drawRemote(ctx, p, S, t) {
  drawChar(ctx, sx(p.rx), sy(p.ry), S, { shirt: p.shirt || '#888', hair: '#2a2a2a', dir: p.dir || 0, walkT: p.walkT || 0, moving: p.moving, swing: p.swing || 0, heldId: p.held && ITEMS[p.held] ? p.held : null });
  label(ctx, sx(p.rx), sy(p.ry) - S * 0.95, p.name || 'Friend', '#7ad8ff', S * 0.24);
  if (p.pet && PETS[p.pet]) { ctx.font = `${S * 0.42}px ${EMOJI_FONT}`; ctx.fillText(PETS[p.pet].e, sx(p.rx) - S * 0.7, sy(p.ry) - S * 0.2 + Math.sin(t * 3) * 3); }
  if (p.emote && p.emoteT > Date.now()) label(ctx, sx(p.rx), sy(p.ry) - S * 1.3, p.emote, '#fff', S * 0.26);
}

// ------------------------------------------------------------------ mobs
function drawMob(ctx, m, S, t) {
  const d = m.def, X = sx(m.x), Y = sy(m.y), r = m.r * S, w = m.walkT;
  ctx.save();
  // (no ctx.filter here: canvas filters are very slow and made every hit stutter)
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, X, Y + r * 0.7, r * 0.9, r * 0.3);
  const face = m.face != null ? m.face : Math.PI / 2;
  switch (d.shape) {
    case 'slime': { const sq = 1 + Math.sin(w * 6) * 0.15; ctx.fillStyle = d.col + 'cc'; ctx.beginPath(); ctx.ellipse(X, Y + r * 0.2 * (sq - 1), r * sq, r / sq, 0, 0, 7); ctx.fill(); ctx.fillStyle = shade(d.col, -0.35); ell(ctx, X, Y + r * 0.1, r * 0.45, r * 0.4); ctx.fillStyle = '#fff'; circ(ctx, X - r * 0.35, Y - r * 0.35, r * 0.15); ctx.fillStyle = '#123'; circ(ctx, X - r * 0.2 + Math.cos(face) * 2, Y - r * 0.1, r * 0.1); circ(ctx, X + r * 0.2 + Math.cos(face) * 2, Y - r * 0.1, r * 0.1); break; }
    case 'humanoid': drawChar(ctx, X, Y, S, { shirt: d.col2 || '#555', skin: d.col, hair: shade(d.col, -0.3), dir: face, walkT: w * 8, moving: true, swing: m.lunge > 0 ? m.lunge * 4 : 0, scale: m.r / 0.33 }); if (m.type === 'golden_goblin') { ctx.fillStyle = '#ffd23a'; ctx.font = `${S * 0.3}px ${FONT}`; ctx.fillText('$', X, Y - S * 0.95); } break;
    case 'spider': { ctx.strokeStyle = shade(d.col, -0.2); ctx.lineWidth = Math.max(2, r * 0.12); for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) { const a = (i - 1.5) * 0.45, lw = Math.sin(w * 10 + i + (sd > 0 ? 1 : 0)) * 0.2; ctx.beginPath(); ctx.moveTo(X, Y); ctx.quadraticCurveTo(X + sd * r * 1.1, Y + (a + lw) * r - r * 0.5, X + sd * r * 1.5, Y + (a + lw) * r * 1.4 + r * 0.3); ctx.stroke(); }
      ctx.fillStyle = d.col; ell(ctx, X, Y + r * 0.1, r * 0.75, r * 0.6); ctx.fillStyle = shade(d.col, 0.15); ell(ctx, X + Math.cos(face) * r * 0.5, Y + Math.sin(face) * r * 0.35, r * 0.42, r * 0.36);
      ctx.fillStyle = m.def.boss ? d.col2 : '#ff2a2a'; for (let i = -1; i <= 1; i += 2) circ(ctx, X + Math.cos(face) * r * 0.75 + i * r * 0.12, Y + Math.sin(face) * r * 0.5 - r * 0.1, r * 0.08); break; }
    case 'beast': { const fx = Math.cos(face) >= 0 ? 1 : -1, bob = Math.abs(Math.sin(w * 8)) * r * 0.1; ctx.fillStyle = shade(d.col, -0.25); for (let i = 0; i < 4; i++) ctx.fillRect(X + (i - 1.5) * r * 0.4, Y + r * 0.2 + (i % 2 ? bob : -bob), r * 0.18, r * 0.45);
      ctx.fillStyle = d.col; ell(ctx, X, Y - bob, r, r * 0.55); ell(ctx, X + fx * r * 0.85, Y - r * 0.35 - bob, r * 0.45, r * 0.4); tri(ctx, X + fx * r * 0.75, Y - r * 1 - bob, r * 0.12, r * 0.35); tri(ctx, X + fx * r * 1.05, Y - r * 1 - bob, r * 0.12, r * 0.35);
      ctx.fillStyle = '#111'; circ(ctx, X + fx * r * 1.0, Y - r * 0.42 - bob, r * 0.07); ctx.strokeStyle = d.col; ctx.lineWidth = r * 0.15; ctx.beginPath(); ctx.moveTo(X - fx * r * 0.9, Y - bob); ctx.lineTo(X - fx * r * 1.3, Y - r * 0.5 - bob + Math.sin(w * 10) * r * 0.2); ctx.stroke(); break; }
    case 'tall': { const sw = Math.sin(w * 6) * r * 0.2; ctx.fillStyle = d.col; ctx.fillRect(X - r * 0.3, Y - r * 2.4, r * 0.6, r * 2.2); ctx.fillRect(X - r * 0.35 + sw, Y - r * 0.4, r * 0.2, r * 0.9); ctx.fillRect(X + r * 0.15 - sw, Y - r * 0.4, r * 0.2, r * 0.9); ctx.fillRect(X - r * 0.6, Y - r * 2.1, r * 0.25, r * 1.6); ctx.fillRect(X + r * 0.35, Y - r * 2.1, r * 0.25, r * 1.6);
      ctx.fillRect(X - r * 0.4, Y - r * 3.1, r * 0.8, r * 0.75); ctx.save(); ctx.shadowColor = d.col2; ctx.shadowBlur = 10; ctx.fillStyle = d.col2; ctx.fillRect(X - r * 0.3, Y - r * 2.8, r * 0.22, r * 0.1); ctx.fillRect(X + r * 0.08, Y - r * 2.8, r * 0.22, r * 0.1); ctx.restore();
      if (Math.random() < 0.15) G.particles.push({ x: m.x + rand(-0.4, 0.4), y: m.y - rand(0, 1.4), vx: 0, vy: -1, life: 0.7, max: 0.7, col: d.col2, size: 3, grav: 0 }); break; }
    case 'ghost': { const fl = Math.sin(t * 3 + m.id) * r * 0.2; ctx.fillStyle = d.col + 'bb'; ctx.beginPath(); ctx.arc(X, Y - r * 0.4 + fl, r, Math.PI, 0); for (let i = 0; i <= 4; i++) ctx.lineTo(X + r - i * r / 2, Y + r * 0.5 + fl + (i % 2 ? -r * 0.25 : 0) + Math.sin(t * 6 + i) * 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#123'; ell(ctx, X - r * 0.35, Y - r * 0.5 + fl, r * 0.15, r * 0.22); ell(ctx, X + r * 0.35, Y - r * 0.5 + fl, r * 0.15, r * 0.22); if (m.type === 'squid') { ctx.strokeStyle = d.col; ctx.lineWidth = 3; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(X + i * r * 0.3, Y + r * 0.4 + fl); ctx.lineTo(X + i * r * 0.4 + Math.sin(t * 5 + i) * 4, Y + r * 1.1 + fl); ctx.stroke(); } } break; }
    case 'golem': { const st = Math.sin(w * 5) * r * 0.08; ctx.fillStyle = shade(d.col, -0.25); ctx.fillRect(X - r * 0.75, Y - r * 0.2 + st, r * 0.45, r * 0.85); ctx.fillRect(X + r * 0.3, Y - r * 0.2 - st, r * 0.45, r * 0.85);
      ctx.fillStyle = d.col; rr(ctx, X - r * 0.8, Y - r * 1.5, r * 1.6, r * 1.45, r * 0.2); ctx.fill(); ctx.fillStyle = shade(d.col, -0.15); ctx.fillRect(X - r * 1.15, Y - r * 1.3 - st, r * 0.38, r * 1.2); ctx.fillRect(X + r * 0.77, Y - r * 1.3 + st, r * 0.38, r * 1.2);
      ctx.fillStyle = shade(d.col, 0.1); rr(ctx, X - r * 0.45, Y - r * 2.05, r * 0.9, r * 0.65, r * 0.15); ctx.fill();
      ctx.save(); ctx.shadowColor = d.col2; ctx.shadowBlur = 14; ctx.fillStyle = d.col2; circ(ctx, X, Y - r * 0.85, r * 0.22 * (1 + Math.sin(t * 4) * 0.15)); ctx.fillRect(X - r * 0.28, Y - r * 1.8, r * 0.18, r * 0.12); ctx.fillRect(X + r * 0.1, Y - r * 1.8, r * 0.18, r * 0.12); ctx.restore(); break; }
    case 'wyrm': {
      const tr = m.trail;
      for (let i = Math.min(tr.length - 1, 36); i >= 4; i -= 4) { const p = tr[i], k = 1 - i / 44; ctx.fillStyle = i % 8 ? d.col : shade(d.col, 0.15); circ(ctx, sx(p.x), sy(p.y) - r * 0.4, r * 0.7 * k + r * 0.15); ctx.fillStyle = d.col2; circ(ctx, sx(p.x), sy(p.y) - r * 0.4 - r * 0.5 * k, r * 0.12 * k); }
      ctx.fillStyle = d.col; ell(ctx, X, Y - r * 0.4, r * 0.9, r * 0.75); ctx.save(); ctx.shadowColor = d.col2; ctx.shadowBlur = 12; ctx.fillStyle = d.col2; circ(ctx, X + Math.cos(face) * r * 0.5 - r * 0.2, Y - r * 0.6 + Math.sin(face) * r * 0.3, r * 0.12); circ(ctx, X + Math.cos(face) * r * 0.5 + r * 0.2, Y - r * 0.6 + Math.sin(face) * r * 0.3, r * 0.12); ctx.restore();
      ctx.fillStyle = shade(d.col, 0.3); tri(ctx, X - r * 0.4, Y - r * 1.5, r * 0.12, r * 0.55); tri(ctx, X + r * 0.4, Y - r * 1.5, r * 0.12, r * 0.55); break; }
    case 'tree': { const sw = Math.sin(t * 2) * r * 0.08; ctx.fillStyle = d.col; rr(ctx, X - r * 0.45, Y - r * 1.6, r * 0.9, r * 1.7, r * 0.2); ctx.fill(); ctx.strokeStyle = d.col; ctx.lineWidth = r * 0.25; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(X - r * 0.4, Y - r * 1.1); ctx.lineTo(X - r * 1.1, Y - r * 0.6 + sw * 3); ctx.moveTo(X + r * 0.4, Y - r * 1.1); ctx.lineTo(X + r * 1.1, Y - r * 0.6 - sw * 3); ctx.stroke();
      ctx.fillStyle = shade(d.col2, -0.3); circ(ctx, X + sw, Y - r * 2.1, r * 1.0); ctx.fillStyle = d.col2; circ(ctx, X - r * 0.2 + sw, Y - r * 2.25, r * 0.75); ctx.save(); ctx.shadowColor = '#ffe94d'; ctx.shadowBlur = 10; ctx.fillStyle = '#ffe94d'; circ(ctx, X - r * 0.2, Y - r * 1.25, r * 0.1); circ(ctx, X + r * 0.2, Y - r * 1.25, r * 0.1); ctx.restore(); break; }
    case 'scarecrow': { const sw = Math.sin(t * 1.5) * 0.08; ctx.save(); ctx.translate(X, Y); ctx.rotate(sw); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-r * 0.08, -r * 2, r * 0.16, r * 2.2); ctx.fillRect(-r * 1.1, -r * 1.5, r * 2.2, r * 0.16); ctx.fillStyle = d.col2; rr(ctx, -r * 0.5, -r * 1.65, r, r * 1.1, r * 0.2); ctx.fill();
      ctx.fillStyle = '#e8c547'; for (let i = -1; i <= 1; i += 2) for (let k = 0; k < 3; k++) ctx.fillRect(i * r * 1.1 - 2, -r * 1.45 + k * 4, i * r * 0.25, 2); ctx.fillStyle = '#ff9a1a'; circ(ctx, 0, -r * 2.05, r * 0.45); ctx.fillStyle = '#2a1a0a'; tri(ctx, -r * 0.16, -r * 2.15, r * 0.08, r * 0.12); tri(ctx, r * 0.16, -r * 2.15, r * 0.08, r * 0.12); ctx.fillStyle = '#c89a4a'; ell(ctx, 0, -r * 2.42, r * 0.75, r * 0.16); rr(ctx, -r * 0.35, -r * 2.85, r * 0.7, r * 0.45, 4); ctx.fill(); ctx.restore(); break; }
  }
  if (m.slow > 0) { ctx.globalAlpha = 0.3; ctx.fillStyle = '#9af0ff'; ell(ctx, X, Y - r * 0.4, r * 1.1, r * 1.1); ctx.globalAlpha = 1; }
  if (m.flash > 0) { ctx.globalAlpha = 0.55; ctx.fillStyle = '#fff'; const tall = d.shape === 'tall' ? 2.4 : d.shape === 'humanoid' || d.shape === 'golem' || d.shape === 'tree' || d.shape === 'scarecrow' ? 1.5 : 0.6; ell(ctx, X, Y - r * tall * 0.5, r * 1.05, r * (0.8 + tall * 0.6)); }
  ctx.restore();
  if (!d.boss) {
    const near = Math.hypot(m.x - G.me.x, m.y - G.me.y) < 7;
    if (near || m.hp < m.mhp) {
      const top = Y - r * (d.shape === 'tall' ? 3.4 : d.shape === 'humanoid' ? 2.4 : 1.7) - S * 0.15;
      hpBar(ctx, X, top, S * 0.8, m.hp / m.mhp, '#ff5a5a');
      ctx.font = `${S * 0.2}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(`Lv${d.lvl * (m.scale > 1 ? m.scale : 1)} ${d.name}`, X, top - S * 0.14);
    }
  } else {
    ctx.save(); ctx.globalAlpha = 0.4 + Math.sin(t * 4) * 0.2; ctx.strokeStyle = m.phase ? '#ff2a2a' : (d.col2 || '#fff'); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(X, Y + r * 0.6, r * 1.3, r * 0.45, 0, 0, 7); ctx.stroke(); ctx.restore();
  }
}
function drawDrop(ctx, d, S, t) {
  const X = sx(d.x), Y = sy(d.y) - d.h * S - Math.sin(t * 3 + d.x * 5) * S * 0.05 - S * 0.1, s = S * 0.46;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(ctx, sx(d.x), sy(d.y) + S * 0.12, S * 0.18, S * 0.06);
  const r = d.d && d.d.rec ? Math.min(5, ITEMS[d.id].rar + 1) : ITEMS[d.id].rar;
  if (r >= 2) { ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.15; ctx.fillStyle = RCOL[r]; circ(ctx, X, Y, s * 0.7); ctx.restore(); if (r >= 3 && Math.random() < 0.1) G.particles.push({ x: d.x + rand(-0.2, 0.2), y: d.y - 0.3, vx: 0, vy: -1.5, life: 0.6, max: 0.6, col: RCOL[r], size: 3, grav: 0 }); }
  ctx.drawImage(iconCanvas(d.id), X - s / 2, Y - s / 2, s, s);
  if (d.n > 1) { ctx.font = `${S * 0.2}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(d.n, X + s * 0.4, Y + s * 0.4); ctx.fillStyle = '#fff'; ctx.fillText(d.n, X + s * 0.4, Y + s * 0.4); }
}
function drawProj(ctx, p, S) {
  const X = sx(p.x), Y = sy(p.y) - S * 0.3;
  if (p.kind === 'arrow') { const a = Math.atan2(p.vy, p.vx); ctx.save(); ctx.translate(X, Y); ctx.rotate(a); ctx.strokeStyle = '#a8743c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-S * 0.3, 0); ctx.lineTo(S * 0.2, 0); ctx.stroke(); ctx.fillStyle = '#ddd'; tri2(ctx, S * 0.28, 0, S * 0.12); ctx.fillStyle = '#fff'; ctx.fillRect(-S * 0.32, -3, S * 0.1, 6); ctx.restore(); return; }
  ctx.save(); ctx.shadowColor = p.col; ctx.shadowBlur = 14; ctx.fillStyle = p.col; circ(ctx, X, Y, p.r * S); ctx.fillStyle = '#fff'; circ(ctx, X, Y, p.r * S * 0.45); ctx.restore();
}
function tri2(ctx, x, y, s) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s, y - s * 0.6); ctx.lineTo(x - s, y + s * 0.6); ctx.closePath(); ctx.fill(); }
function drawTele(ctx, tg, S) {
  const k = clamp(tg.t / tg.dur, 0, 1);
  ctx.save();
  if (tg.type === 'circle') {
    const X = sx(tg.x), Y = sy(tg.y), r = tg.r * S;
    ctx.fillStyle = `rgba(255,40,40,${0.12 + k * 0.15})`; ctx.beginPath(); ctx.ellipse(X, Y, r, r * 0.75, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,80,80,.8)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,40,40,.3)'; ctx.beginPath(); ctx.ellipse(X, Y, r * k, r * 0.75 * k, 0, 0, 7); ctx.fill();
  } else if (tg.type === 'line') {
    ctx.translate(sx(tg.x), sy(tg.y)); ctx.rotate(tg.a);
    ctx.fillStyle = `rgba(255,40,40,${0.15 + k * 0.2})`; ctx.fillRect(0, -tg.w * S / 2, tg.len * S, tg.w * S);
    ctx.fillStyle = 'rgba(255,60,60,.35)'; ctx.fillRect(0, -tg.w * S / 2, tg.len * S * k, tg.w * S);
  }
  ctx.restore();
}
function drawLine(ctx, f, S, t) {
  const me = G.me, ax = sx(me.x + Math.cos(me.dir) * 0.6), ay = sy(me.y - 0.6 + Math.sin(me.dir) * 0.3);
  let bx = sx(f.x), by = sy(f.y);
  if (f.state === 'fly') { const k = clamp(f.t / 0.35, 0, 1); bx = sx(f.sx + (f.x - f.sx) * k); by = sy(f.sy + (f.y - f.sy) * k) - Math.sin(k * Math.PI) * S; }
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, Math.max(ay, by) + S * 0.4, bx, by); ctx.stroke();
  const bob = f.state === 'bite' ? Math.sin(t * 30) * 3 + 3 : Math.sin(t * 3) * 1.5;
  ctx.fillStyle = '#fff'; circ(ctx, bx, by + bob, S * 0.08); ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(bx, by + bob, S * 0.08, Math.PI, 0); ctx.fill();
  if (f.state === 'wait' && Math.random() < 0.05) G.particles.push({ x: f.x + rand(-0.3, 0.3), y: f.y, vx: 0, vy: 0, life: 0.6, max: 0.6, col: 'rgba(255,255,255,.6)', size: 3, grav: 0 });
}
function drawFallingTree(ctx, p, S, a) {
  const n = NODES[p.id], X = sx(p.x), Y = sy(p.y) + S * 0.4, k = 1 - a;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(X, Y); ctx.rotate(k * 1.4);
  ctx.fillStyle = n.bark; ctx.fillRect(-S * 0.1, -S * 0.7, S * 0.2, S * 0.6);
  ctx.fillStyle = n.leaf; circ(ctx, 0, -S * 1.0, S * 0.45);
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawCursor(ctx, z, S, t) {
  if (G.mouse.overUI || UI.isOpen()) return;
  const tx = Math.floor(G.mouse.wx), ty = Math.floor(G.mouse.wy), me = G.me;
  const dist = Math.hypot(tx + 0.5 - me.x, ty + 0.5 - me.y), s = held(), d = s && ITEMS[s.id];
  const tool = d && d.tool;
  if (tool && ['sword', 'bow', 'wand', 'rod'].includes(tool.kind)) return;
  const X = sx(tx), Y = sy(ty), o = z.o(tx, ty);
  if (d && (d.place || d.plant) && z.buildable && !o && dist <= REACH) {
    const ok = d.plant ? z.g(tx, ty) === GT.FARM : !canPlaceAt(z, tx, ty);
    ctx.globalAlpha = 0.55; ctx.drawImage(iconCanvas(s.id), X, Y - S * 0.1, S, S); ctx.globalAlpha = 1;
    ctx.strokeStyle = ok ? 'rgba(120,255,140,.9)' : 'rgba(255,90,90,.9)'; ctx.lineWidth = 2; ctx.strokeRect(X + 1, Y + 1, S - 2, S - 2);
    if (d.place && d.place.k === 'conv') { ctx.save(); ctx.translate(X + S / 2, Y + S / 2); ctx.rotate(G.placeDir * Math.PI / 2); ctx.fillStyle = '#ffd23a'; tri2(ctx, S * 0.4, 0, S * 0.25); ctx.restore(); label(ctx, X + S / 2, Y - S * 0.3, 'R to rotate', '#ffd23a', S * 0.2); }
    return;
  }
  if (o && dist <= REACH + 0.6 && !isFlat(o)) { ctx.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 6) * 0.25})`; ctx.lineWidth = 2; ctx.strokeRect(X + 2, Y + 2, S - 4, S - 4); }
  else if (tool && tool.kind === 'hoe' && z.buildable && !o && dist <= REACH && (GROUND[z.g(tx, ty)].grassy || z.g(tx, ty) === GT.DIRT)) { ctx.strokeStyle = 'rgba(255,220,120,.7)'; ctx.lineWidth = 2; ctx.strokeRect(X + 2, Y + 2, S - 4, S - 4); }
}
function drawLighting(ctx, z, dark, x0, x1, y0, y1, S, blood) {
  const lx = RD.lx, W = RD.W, H = RD.H;
  lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, W, H);
  lx.fillStyle = blood ? `rgba(40,0,0,${dark})` : `rgba(4,3,12,${dark})`; lx.fillRect(0, 0, W, H);
  lx.globalCompositeOperation = 'destination-out';
  const light = (x, y, r, a = 1) => { const X = sx(x), Y = sy(y), R = r * S; const g = lx.createRadialGradient(X, Y, 0, X, Y, R); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lx.fillStyle = g; lx.fillRect(X - R, Y - R, R * 2, R * 2); };
  light(G.me.x, G.me.y - 0.3, 6.5 + Math.sin(G.t * 3) * 0.1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = z.o(x, y); if (!o) continue;
    if (o.light || (o.k === 'block' && ITEMS[o.id].place.light)) light(x + 0.5, y + 0.2, 4 + Math.sin(G.t * 5 + x) * 0.15, 0.95);
    else if (o.k === 'rock' && NODES[o.id].idx >= 6) light(x + 0.5, y + 0.5, 1.4, 0.6);
    else if (o.k === 'portal') light(x + 0.5, y + 0.5, 3, 0.9);
    else if (o.k === 'mach') light(x + 0.5, y + 0.5, 2, 0.6);
    if (z.g(x, y) === GT.LAVA && (x + y) % 2 === 0) light(x + 0.5, y + 0.5, 2.2, 0.7);
  }
  for (const p of z.projs) if (p.kind !== 'arrow') light(p.x, p.y, 1.5, 0.7);
  for (const m of z.mobs) if (m.def.boss) light(m.x, m.y, 4, 0.5);
  for (const [, p] of NET.players) if (p.zone === z.key && p.rx != null) light(p.rx, p.ry, 4, 0.8);
  ctx.drawImage(RD.lc, 0, 0, W, H);
}

function drawSorter(ctx, X, Y, S, o, t) {
  ctx.fillStyle = '#22252c'; ctx.fillRect(X + 1, Y + 1, S - 2, S - 2);
  ctx.fillStyle = '#4a5878'; rr(ctx, X + S * 0.08, Y + S * 0.08, S * 0.84, S * 0.84, 6); ctx.fill();
  ctx.save(); ctx.translate(X + S / 2, Y + S / 2); ctx.rotate(o.dir * Math.PI / 2);
  ctx.fillStyle = '#7aff8a'; tri2(ctx, S * 0.44, 0, S * 0.14);
  ctx.fillStyle = o.filter ? '#ffd23a' : '#7aff8a'; ctx.save(); ctx.rotate(Math.PI / 2); tri2(ctx, S * 0.44, 0, S * 0.12); ctx.rotate(Math.PI); tri2(ctx, S * 0.44, 0, S * 0.12); ctx.restore();
  ctx.restore();
  if (o.filter) { const id = o.filter === '#greasy' ? 'greasy_wheat' : o.filter; if (ITEMS[id]) ctx.drawImage(iconCanvas(id), X + S * 0.25, Y + S * 0.25, S * 0.5, S * 0.5); }
  else { ctx.font = `${S * 0.34}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔀', X + S / 2, Y + S / 2); }
  if (o.item) { const [dx, dy] = DIRS[o.dir]; ctx.drawImage(iconCanvas(o.item.id), X + S / 2 - S * 0.2 + dx * (o.item.p - 0.5) * S * 0.3, Y + S / 2 - S * 0.24 + dy * (o.item.p - 0.5) * S * 0.3, S * 0.4, S * 0.4); }
}
function drawLightning(ctx, b, S) {
  const x1 = sx(b.x1), y1 = sy(b.y1), x2 = sx(b.x2), y2 = sy(b.y2), n = 7;
  ctx.save(); ctx.shadowColor = b.col; ctx.shadowBlur = 14; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.globalAlpha = clamp(b.life / 0.25, 0, 1);
  ctx.beginPath(); ctx.moveTo(x1, y1);
  for (let i = 1; i < n; i++) { const k = i / n; ctx.lineTo(x1 + (x2 - x1) * k + rand(-8, 8), y1 + (y2 - y1) * k + rand(-8, 8)); }
  ctx.lineTo(x2, y2); ctx.stroke(); ctx.strokeStyle = b.col; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
}