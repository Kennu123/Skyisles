'use strict';
// =====================================================================
//  World: tiles, zones and procedural generation of every island
// =====================================================================
const GT = { VOID: 0, WATER: 1, SAND: 2, GRASS: 3, DIRT: 4, FARM: 5, STONE: 6, PATH: 7, WALL: 8, SWAMP: 9, CAVE: 10, VOIDSTONE: 11, PLAZA: 12, MYCEL: 13, DFLOOR: 14, DWALL: 15, ICE: 16, ASH: 17, LAVA: 18, DOCK: 19, ICEWALL: 20 };
const GROUND = [
  { c: '#0b0816', solid: 1, edge: 1 },          // void
  { c: '#2f86c6', solid: 1, water: 1 },          // water
  { c: '#e8d69c' },                               // sand
  { c: '#5cb24c', grassy: 1 },                    // grass
  { c: '#8a6a44' },                               // dirt
  { c: '#6b4528', farm: 1 },                      // farmland
  { c: '#8f8f96' },                               // stone floor
  { c: '#c9b68c' },                               // path
  { c: '#3b3742', solid: 1, wall: 1 },           // cave wall
  { c: '#4c6b3a', grassy: 1 },                    // swamp grass
  { c: '#4c4753' },                               // cave floor
  { c: '#2c2340' },                               // void stone
  { c: '#c4bba9' },                               // plaza
  { c: '#6c5a7c', grassy: 1 },                    // mycelium
  { c: '#3c3631' },                               // dungeon floor
  { c: '#1f1b24', solid: 1, wall: 1 },           // dungeon wall
  { c: '#bfe2f2' },                               // ice
  { c: '#4a3c38' },                               // ash
  { c: '#ff5a1a', solid: 1, lava: 1 },            // lava
  { c: '#a8743c' },                               // wooden dock
  { c: '#7fa8c8', solid: 1, wall: 1 },           // ice wall
];
GROUND.forEach(g => { g.sh = [shade(g.c, -0.06), shade(g.c, -0.02), shade(g.c, 0.03), shade(g.c, 0.07)]; });

function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function thash(x, y) { let h = Math.imul(x * 374761393 + y * 668265263, 1274126177); h ^= h >>> 13; return (h >>> 0) % 1000 / 1000; }
function pickW(list, rnd) { let s = 0; for (const [, w] of list) s += w; let r = rnd() * s; for (const [k, w] of list) { if ((r -= w) <= 0) return k; } return list[0][0]; }

class Zone {
  constructor(key, w, h) {
    this.key = key; this.base = key.split('@')[0]; this.def = ZONES[this.base] || ZONES.home;
    this.w = w; this.h = h;
    this.ground = new Uint8Array(w * h); this.objs = new Array(w * h).fill(null);
    this.mobs = []; this.drops = []; this.projs = []; this.tele = []; this.labels = [];
    this.auto = new Set(); this.spawn = { x: w / 2, y: h / 2 }; this.spawnArea = null; this.bossTimer = 180; this.bossEventCycle = -1;
    this.rooms = null; this.mobId = 1;
  }
  idx(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  g(x, y) { return this.inb(x, y) ? this.ground[y * this.w + x] : (this.def.cat === 'combat' && this.def.ground === 'void' ? GT.VOID : GT.WATER); }
  setG(x, y, v) { if (this.inb(x, y)) { this.ground[y * this.w + x] = v; if (this.dirty) this.dirty.add(y * this.w + x); } }
  o(x, y) { return this.inb(x, y) ? this.objs[y * this.w + x] : null; }
  set(x, y, ob) {
    if (!this.inb(x, y)) return;
    const i = y * this.w + x; this.objs[i] = ob;
    if (this.dirty) this.dirty.add(i);
    if (ob && (ob.k === 'mach' || ob.k === 'conv' || ob.k === 'sort' || (ob.k === 'block' && ob.id === 'furnace'))) this.auto.add(i); else this.auto.delete(i);
  }
  solid(x, y) {
    if (GROUND[this.g(x, y)].solid) return true;
    const o = this.o(x, y); return !!(o && objSolid(o));
  }
  get isHome() { return this.base === 'home'; }
  get buildable() { return this.base === 'home'; }
}
function objSolid(o) {
  switch (o.k) {
    case 'tree': case 'rock': case 'npc': case 'mach': case 'rchest': case 'bldg': case 'bpart': return true;
    case 'block': { const p = ITEMS[o.id] && ITEMS[o.id].place; return !!(p && p.solid); }
    case 'deco': return !!o.solid;
    case 'door': return !o.open;
    default: return false;
  }
}

// ------------------------------------------------------------ helpers
function blob(z, cx, cy, rx, ry, rnd, inner = GT.GRASS, rim = GT.SAND, wob = 1.6) {
  const s1 = rnd() * 6, s2 = rnd() * 6, s3 = rnd() * 6;
  for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, a = Math.atan2(dy, dx);
    const d = Math.sqrt(dx * dx + dy * dy) * Math.min(rx, ry);
    const r = Math.min(rx, ry) + wob * (Math.sin(a * 3 + s1) * 0.5 + Math.sin(a * 5 + s2) * 0.3 + Math.sin(a * 9 + s3) * 0.2);
    if (d < r - 1.3) z.setG(x, y, inner); else if (d < r) z.setG(x, y, rim);
  }
}
function nodeObj(id) { const n = NODES[id]; return { k: n.k, id, hp: n.hp, mhp: n.hp }; }
function cropObj(id, ripe = true) { const n = NODES['crop_' + id]; return { k: 'crop', id, t0: Date.now() - (ripe ? n.grow * 1000 : 0) }; }
function freeTile(z, x, y) { return z.inb(x, y) && !GROUND[z.g(x, y)].solid && !z.o(x, y); }
function nearSpawn(z, x, y, d) { return Math.hypot(x + 0.5 - z.spawn.x, y + 0.5 - z.spawn.y) < d; }
function placePortal(z, x, y, to, label) { z.set(x, y, { k: 'portal', to, label: label || (ZONES[to] ? ZONES[to].name : to) }); }
function clearAround(z, x, y, r) { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const o = z.o(x + i, y + j); if (o && o.k !== 'portal' && o.k !== 'npc') z.set(x + i, y + j, null); } }

// --------------------------------------------------------- generators
function genHome(key, radius, seedName) {
  const z = new Zone(key, 48, 48), rnd = mulberry(hashStr('home' + seedName));
  z.ground.fill(GT.WATER);
  blob(z, 24, 24, radius + 0.5, radius + 0.5, rnd, GT.GRASS, GT.SAND, 1.2);
  z.spawn = { x: 24.5, y: 24.5 };
  const put = (id, n) => { let tries = 0; while (n > 0 && tries++ < 500) { const x = 24 + Math.floor((rnd() - 0.5) * radius * 1.6), y = 24 + Math.floor((rnd() - 0.5) * radius * 1.6); if (z.g(x, y) === GT.GRASS && !z.o(x, y) && !nearSpawn(z, x, y, 3.2)) { const o = nodeObj(id); o.nat = 1; z.set(x, y, o); n--; } } };
  put('oak', 7); put('birch', 3); put('stone', 5); put('coal', 2);
  z.set(27, 22, { k: 'npc', id: 'guide' });
  return z;
}
function expandHome(z, radius, seedName) {
  const rnd = mulberry(hashStr('home' + seedName)), tmp = new Zone('tmp', z.w, z.h);
  tmp.ground.fill(GT.WATER); blob(tmp, 24, 24, radius + 0.5, radius + 0.5, rnd, GT.GRASS, GT.SAND, 1.2);
  for (let i = 0; i < z.ground.length; i++) {
    const cur = z.ground[i], nw = tmp.ground[i];
    if (cur === GT.WATER && nw !== GT.WATER) z.ground[i] = nw;
    else if (cur === GT.SAND && nw === GT.GRASS) z.ground[i] = GT.GRASS;
  }
}
// shop buildings in the SkyHub town (x, y = top-left tile; the door faces south)
const HUB_BUILDINGS = [
  { id: 'bazaar', x: 24, y: 14, w: 10, h: 7, style: 'market', roof: '#2f8a5a', wall: '#e9dcc0', sign: 'Bazaar' },
  { id: 'banker', x: 37, y: 14, w: 9, h: 7, style: 'bank', roof: '#2a4a8a', wall: '#e8e6f0', sign: 'Bank' },
  { id: 'auction', x: 54, y: 13, w: 11, h: 8, style: 'hall', roof: '#9a3a3a', wall: '#efe2c8', sign: 'Auction House' },
  { id: 'petshop', x: 68, y: 14, w: 8, h: 7, style: 'cottage', roof: '#d89a2a', wall: '#f2e2c4', sign: 'Pet Shop' },
  { id: 'merchant', x: 24, y: 29, w: 9, h: 6, style: 'shop', roof: '#b8662a', wall: '#ecd8b4', sign: 'General Store' },
  { id: 'guide', x: 68, y: 29, w: 8, h: 6, style: 'cottage', roof: '#2a90b8', wall: '#e8e4d8', sign: 'Guide Hall' },
  { id: 'blacksmith', x: 24, y: 44, w: 9, h: 7, style: 'forge', roof: '#4a4a55', wall: '#9a8f86', sign: 'Forge' },
  { id: 'enchanter', x: 36, y: 42, w: 8, h: 9, style: 'tower', roof: '#5a2aa0', wall: '#cfc6e0', sign: 'Arcanum' },
  { id: 'engineer', x: 56, y: 44, w: 10, h: 7, style: 'workshop', roof: '#c8601a', wall: '#d8c8a8', sign: 'Workshop' },
  { id: 'petsitter', x: 68, y: 44, w: 8, h: 7, style: 'cottage', roof: '#7a5ad8', wall: '#efe4f4', sign: 'Pet Care' },
];
function genHub() {
  const W = 100, H = 80, z = new Zone('hub', W, H), rnd = mulberry(77);
  z.ground.fill(GT.WATER);
  blob(z, 50, 40, 47, 37, rnd, GT.GRASS, GT.SAND, 1.2);
  // town ground, central square and roads
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (z.g(x, y) === GT.WATER || z.g(x, y) === GT.SAND) continue;
    const town = x >= 22 && x <= 78 && y >= 12 && y <= 59;
    const road = (Math.abs(y - 40) <= 1 && (x < 22 || x > 78)) || (Math.abs(x - 50) <= 1 && (y < 12 || y > 59));
    if (town) z.setG(x, y, GT.PLAZA); else if (road) z.setG(x, y, GT.PATH);
  }
  for (let y = 23; y <= 41; y++) for (let x = 36; x <= 64; x++) { const lawn = (x >= 38 && x <= 45 || x >= 55 && x <= 62) && (y >= 35 && y <= 40); if (lawn) z.setG(x, y, GT.GRASS); }
  z.spawn = { x: 50.5, y: 37.5 };
  // buildings with their keeper standing at the door
  for (const b of HUB_BUILDINGS) {
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) z.set(b.x + i, b.y + j, { k: 'bpart' });
    z.set(b.x, b.y + b.h - 1, { k: 'bldg', b });
    z.set(b.x + Math.floor(b.w / 2), b.y + b.h, { k: 'npc', id: b.id });
  }
  // central square
  for (let j = 31; j <= 32; j++) for (let i = 49; i <= 51; i++) z.set(i, j, { k: 'bpart' });
  z.set(50, 32, { k: 'deco', id: 'fountain', solid: 1 });
  for (const [x, y] of [[48, 31], [52, 31], [48, 33], [52, 33]]) z.set(x, y, { k: 'deco', id: 'flowers' });
  placePortal(z, 50, 25, 'home', 'Your Island');
  z.set(45, 31, { k: 'npc', id: 'bounty' });
  for (const [x, y] of [[36, 23], [64, 23], [36, 41], [64, 41], [46, 26], [54, 26], [23, 40], [77, 40], [49, 12], [51, 59]]) z.set(x, y, { k: 'block', id: 'lamp', fixed: 1 });
  for (const [x, y] of [[40, 35], [43, 39], [57, 36], [60, 39]]) z.set(x, y, { k: 'deco', id: 'ptree', solid: 1 });
  for (const [x, y] of [[38, 37], [45, 37], [55, 37], [62, 37]]) z.set(x, y, { k: 'deco', id: 'flowers' });
  for (const [x, y] of [[44, 29], [56, 29], [44, 35], [56, 35]]) z.set(x, y, { k: 'deco', id: 'bench', solid: 1 });
  for (const [x, y] of [[26, 23], [30, 23], [34, 23]]) z.set(x, y, { k: 'deco', id: 'stall', solid: 1 });
  for (const [x, y] of [[53, 22], [65, 22]]) z.set(x, y, { k: 'deco', id: 'banner', solid: 1 });
  for (let x = 22; x <= 78; x += 4) { if (Math.abs(x - 50) > 2) { z.set(x, 12, { k: 'deco', id: 'ptree', solid: 1 }); z.set(x, 59, { k: 'deco', id: 'ptree', solid: 1 }); } }
  // crafting corner (shared workbenches + furnaces)
  for (const [x, y] of [[44, 55], [56, 55]]) { z.set(x, y, { k: 'block', id: 'workbench', fixed: 1 }); z.set(x + 1, y, { k: 'block', id: 'furnace', fixed: 1 }); }
  z.labels = [{ x: 50, y: 57.3, t: 'CRAFTING CORNER' }];
  // west: starter mine
  for (let y = 24; y < 57; y++) for (let x = 4; x < 21; x++) {
    if (z.g(x, y) !== GT.GRASS) continue;
    if (Math.hypot((x - 12.5) / 9, (y - 40) / 16.5) > 1) continue;
    z.setG(x, y, GT.STONE);
    if (rnd() < 0.3 && Math.abs(y - 40) > 1.5) z.set(x, y, nodeObj(rnd() < 0.7 ? 'stone' : 'coal'));
  }
  // east: starter fields
  ['wheat', 'carrot', 'potato', 'wheat'].forEach((c, k) => {
    for (let y = 24 + k * 8; y < 29 + k * 8; y++) for (let x = 81; x < 94; x++) if (z.g(x, y) === GT.GRASS && Math.abs(y - 40) > 1) { z.setG(x, y, GT.FARM); z.set(x, y, cropObj(c)); }
  });
  // north: starter woods
  for (let y = 2; y < 11; y++) for (let x = 12; x < 88; x++) {
    if (z.g(x, y) !== GT.GRASS || Math.abs(x - 50) < 3) continue;
    if ((x + y) % 2 === 0 && rnd() < 0.35) z.set(x, y, nodeObj(rnd() < 0.75 ? 'oak' : 'birch'));
  }
  // south: graveyard with monsters
  for (let y = 62; y < 79; y++) for (let x = 10; x < 90; x++) {
    if (z.g(x, y) !== GT.GRASS) continue;
    z.setG(x, y, GT.SWAMP);
    if (rnd() < 0.05 && Math.abs(x - 50) > 2 && y < 72) z.set(x, y, { k: 'deco', id: 'grave', solid: 1 });
  }
  z.spawnArea = { x0: 18, y0: 62, x1: 82, y1: 71, mobs: [['zombie', 3], ['slime', 3]], cap: 8 };
  // portals at the edges of the island
  [['farm1', 92, 30], ['farm2', 92, 36], ['farm3', 92, 44], ['farm4', 92, 50]].forEach(p => placePortal(z, p[1], p[2], p[0]));
  [['mine1', 7, 30], ['mine2', 7, 36], ['mine3', 7, 44], ['mine4', 7, 50]].forEach(p => placePortal(z, p[1], p[2], p[0]));
  [['forest1', 38, 5], ['forest2', 44, 5], ['forest3', 56, 5], ['forest4', 62, 5]].forEach(p => placePortal(z, p[1], p[2], p[0]));
  [['combat1', 32, 73], ['combat2', 37, 73], ['combat3', 42, 73], ['combat4', 47, 73], ['dungeon1', 53, 73], ['dungeon2', 58, 73], ['dungeon3', 63, 73], ['fishing1', 68, 73]].forEach(p => placePortal(z, p[1], p[2], p[0]));
  for (let i = 0; i < z.objs.length; i++) { const o = z.objs[i]; if (o && o.k === 'portal') { const x = i % W, y = Math.floor(i / W); for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const g = z.g(x + k, y + j); if (g === GT.WATER || g === GT.SAND) z.setG(x + k, y + j, GT.PATH); const ob = z.o(x + k, y + j); if (ob && ob !== o && ob.k !== 'npc') z.set(x + k, y + j, null); } } }
  z.labels.push({ x: 87, y: 21, t: 'FARMING' }, { x: 12, y: 22, t: 'MINING' }, { x: 30, y: 11.5, t: 'FORAGING' }, { x: 50, y: 61, t: 'COMBAT & DUNGEONS' });
  return z;
}
function genFarm(key) {
  const d = ZONES[key], z = new Zone(key, d.w, d.h), rnd = mulberry(hashStr(key));
  z.ground.fill(GT.WATER);
  const inner = d.ground === 'mycel' ? GT.MYCEL : GT.GRASS;
  blob(z, d.w / 2, d.h / 2, d.w / 2 - 3, d.h / 2 - 3, rnd, inner, GT.SAND, 1.4);
  z.spawn = { x: d.w / 2 + 0.5, y: d.h - 8.5 };
  let k = 0;
  for (let fy = 6; fy < d.h - 12; fy += 7) for (let fx = 6; fx < d.w - 12; fx += 12) {
    const crop = d.crops[k++ % d.crops.length];
    for (let y = fy; y < fy + 5; y++) for (let x = fx; x < fx + 10; x++) if (z.g(x, y) === inner) { z.setG(x, y, GT.FARM); z.set(x, y, cropObj(crop)); }
  }
  for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) if (z.g(x, y) === inner && !z.o(x, y) && rnd() < 0.03) z.set(x, y, { k: 'deco', id: d.ground === 'mycel' ? 'shroom' : 'flowers' });
  placePortal(z, Math.floor(z.spawn.x), Math.floor(z.spawn.y) + 2, 'hub', 'SkyHub');
  clearAround(z, Math.floor(z.spawn.x), Math.floor(z.spawn.y), 1);
  z.fastGrow = 14;
  return z;
}
function genMine(key) {
  const d = ZONES[key], z = new Zone(key, d.w, d.h), rnd = mulberry(hashStr(key));
  const icy = d.ground === 'ice';
  z.ground.fill(icy ? GT.ICEWALL : GT.WALL);
  let cells = new Uint8Array(d.w * d.h);
  for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
    const edge = x < 2 || y < 2 || x >= d.w - 2 || y >= d.h - 2;
    cells[y * d.w + x] = edge ? 1 : (rnd() < 0.36 ? 1 : 0);
  }
  for (let it = 0; it < 4; it++) {
    const nx = new Uint8Array(cells.length);
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
      let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; n += (xx < 0 || yy < 0 || xx >= d.w || yy >= d.h) ? 1 : cells[yy * d.w + xx]; }
      nx[y * d.w + x] = (x < 2 || y < 2 || x >= d.w - 2 || y >= d.h - 2) ? 1 : (n >= 5 ? 1 : 0);
    }
    cells = nx;
  }
  z.spawn = { x: d.w / 2 + 0.5, y: d.h / 2 + 0.5 };
  for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
    const open = !cells[y * d.w + x] || (Math.hypot(x - d.w / 2, y - d.h / 2) < 4) || (Math.abs(y - d.h / 2) < 1.5 && x > 3 && x < d.w - 4) || (Math.abs(x - d.w / 2) < 1.5 && y > 3 && y < d.h - 4);
    if (open) z.setG(x, y, icy ? GT.ICE : GT.CAVE);
  }
  for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
    if (z.g(x, y) !== (icy ? GT.ICE : GT.CAVE) || nearSpawn(z, x, y, 3.5)) continue;
    let wallN = 0; for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (GROUND[z.g(x + i, y + j)].wall) wallN++;
    if (rnd() < 0.16 + wallN * 0.08) z.set(x, y, nodeObj(pickW(d.rocks, rnd)));
    else if (rnd() < 0.02) z.set(x, y, { k: 'deco', id: 'torch', light: 1 });
  }
  placePortal(z, Math.floor(z.spawn.x), Math.floor(z.spawn.y) + 1, 'hub', 'SkyHub');
  z.set(Math.floor(z.spawn.x) - 2, Math.floor(z.spawn.y), { k: 'deco', id: 'torch', light: 1 });
  z.set(Math.floor(z.spawn.x) + 2, Math.floor(z.spawn.y), { k: 'deco', id: 'torch', light: 1 });
  z.dark = d.dark;
  return z;
}
function genForest(key) {
  const d = ZONES[key], z = new Zone(key, d.w, d.h), rnd = mulberry(hashStr(key));
  z.ground.fill(GT.WATER);
  blob(z, d.w / 2, d.h / 2, d.w / 2 - 3, d.h / 2 - 3, rnd, GT.GRASS, GT.SAND, 1.6);
  z.spawn = { x: d.w / 2 + 0.5, y: d.h / 2 + 0.5 };
  for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
    if (z.g(x, y) !== GT.GRASS || nearSpawn(z, x, y, 4)) continue;
    if ((x + y) % 2 === 0 && rnd() < 0.36) z.set(x, y, nodeObj(pickW(d.trees, rnd)));
    else if (rnd() < 0.03) z.set(x, y, { k: 'deco', id: 'flowers' });
  }
  placePortal(z, Math.floor(z.spawn.x), Math.floor(z.spawn.y) + 2, 'hub', 'SkyHub');
  return z;
}
function genCombat(key) {
  const d = ZONES[key], z = new Zone(key, d.w, d.h), rnd = mulberry(hashStr(key));
  const isVoid = d.ground === 'void';
  z.ground.fill(isVoid ? GT.VOID : GT.WATER);
  const inner = d.ground === 'swamp' ? GT.SWAMP : d.ground === 'dirt' ? GT.DIRT : d.ground === 'ash' ? GT.ASH : GT.VOIDSTONE;
  blob(z, d.w / 2, d.h / 2, d.w / 2 - 3, d.h / 2 - 3, rnd, inner, isVoid ? GT.VOIDSTONE : GT.SAND, 2);
  z.spawn = { x: d.w / 2 + 0.5, y: d.h - 9.5 };
  for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
    if (z.g(x, y) !== inner || nearSpawn(z, x, y, 4)) continue;
    const r = rnd();
    if (d.ground === 'ash' && r < 0.02) { for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) if (z.g(x + i, y + j) === inner && !nearSpawn(z, x + i, y + j, 6)) z.setG(x + i, y + j, GT.LAVA); }
    else if (d.ground === 'swamp' && r < 0.025) { for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) if (z.g(x + i, y + j) === inner && !nearSpawn(z, x + i, y + j, 5)) z.setG(x + i, y + j, GT.WATER); }
    else if (r < 0.04) z.set(x, y, { k: 'deco', id: d.ground === 'swamp' ? 'deadtree' : d.ground === 'dirt' ? 'web' : d.ground === 'ash' ? 'deadtree' : 'crystal', solid: d.ground !== 'dirt' ? 1 : 0, light: d.ground === 'void' ? 1 : 0 });
    else if (r < 0.06) z.set(x, y, { k: 'deco', id: 'bones' });
  }
  z.spawnArea = { x0: 3, y0: 3, x1: d.w - 3, y1: d.h - 3, mobs: d.mobs, cap: d.cap };
  placePortal(z, Math.floor(z.spawn.x), Math.floor(z.spawn.y) + 2, 'hub', 'SkyHub');
  z.dark = isVoid ? 0.35 : d.ground === 'dirt' ? 0.25 : d.ground === 'ash' ? 0.3 : 0;
  return z;
}
function genDungeon(key) {
  const d = ZONES[key], cols = 4, rows = 3, RW = 13, RH = 11;
  const z = new Zone(key, cols * (RW + 1) + 1, rows * (RH + 1) + 1), rnd = mulberry(Date.now() & 0xffffff);
  z.ground.fill(GT.DWALL);
  const rooms = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = 1 + c * (RW + 1), y = 1 + r * (RH + 1);
    rooms.push({ c, r, x, y, w: RW, h: RH, links: [], depth: -1, cleared: false, spawned: false, boss: false, mobs: 0 });
    for (let j = 0; j < RH; j++) for (let i = 0; i < RW; i++) z.setG(x + i, y + j, GT.DFLOOR);
  }
  const at = (c, r) => rooms[r * cols + c];
  const start = at(0, 1); start.depth = 0;
  const stack = [start], seen = new Set([start]);
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => at(cur.c + dc, cur.r + dr)).filter(n => n && !seen.has(n) && n.c >= 0 && n.c < cols && n.r >= 0 && n.r < rows && Math.abs(n.c - cur.c) + Math.abs(n.r - cur.r) === 1);
    if (!nb.length) { stack.pop(); continue; }
    const n = nb[Math.floor(rnd() * nb.length)]; seen.add(n); n.depth = cur.depth + 1; cur.links.push(n); n.links.push(cur); n.parent = cur; stack.push(n);
  }
  // extra loop connection for variety
  const a = rooms[Math.floor(rnd() * rooms.length)];
  const opening = (A, B, door) => {
    if (A.c !== B.c) { const x = Math.max(A.x, B.x) - 1, y0 = A.y + Math.floor(RH / 2) - 1; for (let j = 0; j < 3; j++) { z.setG(x, y0 + j, GT.DFLOOR); if (door) z.set(x, y0 + j, { k: 'door', open: false }); } }
    else { const y = Math.max(A.y, B.y) - 1, x0 = A.x + Math.floor(RW / 2) - 1; for (let i = 0; i < 3; i++) { z.setG(x0 + i, y, GT.DFLOOR); if (door) z.set(x0 + i, y, { k: 'door', open: false }); } }
  };
  let boss = rooms.reduce((m, r) => r.depth > m.depth ? r : m, rooms[0]);
  boss.boss = true;
  for (const r of rooms) if (r.parent) opening(r, r.parent, r === boss);
  const nbr = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => at(a.c + dc, a.r + dr)).find(n => n && n !== boss && a !== boss && !a.links.includes(n) && Math.abs(n.c - a.c) + Math.abs(n.r - a.r) === 1 && n.c < cols && n.c >= 0);
  if (nbr) { opening(a, nbr, false); a.links.push(nbr); nbr.links.push(a); }
  start.cleared = true; start.spawned = true;
  z.spawn = { x: start.x + RW / 2, y: start.y + RH / 2 };
  // decor: pillars + torches
  for (const r of rooms) {
    if (r !== start && !r.boss && rnd() < 0.6) for (const [i, j] of [[3, 3], [RW - 4, 3], [3, RH - 4], [RW - 4, RH - 4]]) z.setG(r.x + i, r.y + j, GT.DWALL);
    z.set(r.x + 1, r.y + 1, { k: 'deco', id: 'torch', light: 1 }); z.set(r.x + RW - 2, r.y + RH - 2, { k: 'deco', id: 'torch', light: 1 });
    if (rnd() < 0.4 && r !== start) z.set(r.x + 2 + Math.floor(rnd() * (RW - 4)), r.y + 2 + Math.floor(rnd() * (RH - 4)), { k: 'deco', id: 'bones' });
  }
  z.rooms = rooms; z.dark = 0.6; z.floor = d.floor;
  z.run = { start: Date.now(), deaths: 0, kills: 0, need: Math.ceil((rooms.length - 2) * 0.75), done: false };
  return z;
}
function genFishing(key) {
  const d = ZONES[key], z = new Zone(key, d.w, d.h), rnd = mulberry(hashStr(key));
  z.ground.fill(GT.WATER);
  const isles = [[32, 26, 9, 7], [11, 11, 5, 4], [53, 11, 5, 4], [11, 41, 5, 4], [53, 41, 6, 4], [32, 7, 4, 3], [32, 46, 4, 3]];
  for (const [cx, cy, rx, ry] of isles) blob(z, cx, cy, rx, ry, rnd, GT.GRASS, GT.SAND, 0.8);
  // wooden docks join the little islands and make great fishing spots
  for (const [cx, cy] of isles.slice(1)) {
    const n = Math.ceil(Math.hypot(cx - 32, cy - 26));
    for (let k = 0; k <= n; k++) { const x = Math.round(32 + (cx - 32) * k / n), y = Math.round(26 + (cy - 26) * k / n); if (GROUND[z.g(x, y)].water) z.setG(x, y, GT.DOCK); }
  }
  for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) {
    if (z.g(x, y) !== GT.GRASS || Math.hypot(x - 32, y - 28) < 4) continue;
    const r = rnd(); if (r < 0.06) z.set(x, y, { k: 'deco', id: 'ptree', solid: 1 }); else if (r < 0.1) z.set(x, y, { k: 'deco', id: 'flowers' });
  }
  z.spawn = { x: 32.5, y: 28.5 };
  placePortal(z, 32, 30, 'hub', 'SkyHub');
  z.spawnArea = { x0: 3, y0: 3, x1: z.w - 4, y1: z.h - 4, mobs: d.mobs, cap: d.cap };
  return z;
}
function generateZone(key) {
  const z = generateZoneRaw(key);
  if (z.dark == null && z.def.dark) z.dark = z.def.dark;
  // quest givers (and the black market) stand at fixed spots or next to the island's arrival point
  const spots = Object.entries(QUESTGIVERS).filter(([, g]) => g.zone === z.base).map(([id, g]) => [id, g.at ? g.at : [Math.floor(z.spawn.x) + g.rel[0], Math.floor(z.spawn.y) + g.rel[1]]]);
  if (z.base === 'hub') spots.push(['blackmarket', [23, 57]]);
  for (const [id, [x, y]] of spots) { const p = nearestFree(z, x + 0.5, y + 0.5, 4); z.set(Math.floor(p.x), Math.floor(p.y), { k: 'npc', id }); }
  if (['combat', 'fishing', 'farming', 'mining', 'foraging'].includes(z.def.cat)) z.safeR = 7;
  return z;
}
function generateZoneRaw(key) {
  const base = key.split('@')[0], d = ZONES[base];
  if (base === 'hub') return genHub();
  if (d.cat === 'fishing') return genFishing(base);
  switch (d.cat) {
    case 'farming': return genFarm(base);
    case 'mining': return genMine(base);
    case 'foraging': return genForest(base);
    case 'combat': return genCombat(base);
    case 'dungeon': return genDungeon(base);
  }
  return genHub();
}

// ------------------------------------------------------- serialization
function serializeZone(z) {
  const g = []; let prev = -1, run = 0;
  for (let i = 0; i < z.ground.length; i++) { const v = z.ground[i]; if (v === prev) run++; else { if (run) g.push(prev, run); prev = v; run = 1; } }
  g.push(prev, run);
  const o = [];
  for (let i = 0; i < z.objs.length; i++) { const ob = z.objs[i]; if (ob) { const c = Object.assign({}, ob); delete c.shake; delete c.anim; delete c.pushT; o.push([i, c]); } }
  return { w: z.w, h: z.h, g, o, spawn: z.spawn };
}
function deserializeZone(key, s) {
  const z = new Zone(key, s.w, s.h);
  let p = 0; for (let k = 0; k < s.g.length; k += 2) { z.ground.fill(s.g[k], p, p + s.g[k + 1]); p += s.g[k + 1]; }
  for (const [i, ob] of s.o) z.set(i % s.w, Math.floor(i / s.w), ob);
  if (s.spawn) z.spawn = s.spawn;
  return z;
}
