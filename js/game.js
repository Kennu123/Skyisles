'use strict';
// =====================================================================
//  Core game logic: player, inventory, skills, actions, mobs, automation
// =====================================================================
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rid = () => Math.random().toString(36).slice(2, 10);
const fmt = n => { n = Math.floor(n); return n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e5 ? (n / 1e3).toFixed(1) + 'k' : n.toLocaleString('en-US'); };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const REACH = 3.4;
if (typeof NET === 'undefined') window.NET = { connected: false, isHost: false, players: new Map(), tick() {}, send() {}, onZone() {} };

const G = {
  P: null, me: null, zone: null, zones: {}, cam: { x: 0, y: 0 }, keys: {}, mouse: { x: 0, y: 0, wx: 0, wy: 0, l: false, r: false, lEdge: false, rEdge: false, overUI: false },
  t: 0, particles: [], floaters: [], shake: 0, stats: baseStats(), sel: 0, placeDir: 0, running: false, invDirty: true, lastSave: 0, scale: 1,
};
const SAVE_PREFIX = 'skyisles.v1.';
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

// --------------------------------------------------------------- player
const SHIRTS = ['#e0503a', '#3a8ae0', '#3ac06a', '#c03ae0', '#e0a03a', '#3ad0d0', '#e03a8a', '#8a6ae0'];
function newPlayer(name) {
  return {
    v: 1, name: name.slice(0, 16) || 'Islander', uid: rid() + rid(), shirt: SHIRTS[randi(0, SHIRTS.length - 1)], coins: 0, bank: 0,
    inv: Array(36).fill(null), skills: Object.fromEntries(SKILL_IDS.map(s => [s, { lvl: 0, xp: 0 }])), pets: [], petActive: -1,
    tut: 0, goals: {}, flags: {}, visited: { hub: 1 }, islandR: 0, home: null, bz: null, ah: null, coll: {}, armor: { helmet: null, chest: null, legs: null, boots: null }, met: {},
    stats: { kills: 0, logs: 0, mined: 0, crops: 0, fish: 0, bosses: 0, dungeons: 0, earned: 0 }, sound: true, created: Date.now(), lastSeen: Date.now(),
  };
}
function listProfiles() { try { return JSON.parse(lsGet(SAVE_PREFIX + 'profiles') || '[]'); } catch (e) { return []; } }
function saveGame(quiet = true) {
  const P = G.P; if (!P) return;
  const hz = G.zones[homeKey()];
  if (hz) P.home = serializeZone(hz);
  P.bz = BZ.state; P.ah = AH.state; P.lastSeen = Date.now();
  const ok = lsSet(SAVE_PREFIX + 'p.' + P.uid, JSON.stringify(P));
  const list = listProfiles().filter(p => p.uid !== P.uid); list.unshift({ uid: P.uid, name: P.name, last: Date.now(), coins: P.coins });
  lsSet(SAVE_PREFIX + 'profiles', JSON.stringify(list.slice(0, 12)));
  G.lastSave = Date.now();
  if (!quiet) UI.toast(ok ? 'Game saved' : 'Saving is blocked in this browser — use Export in the menu', ok ? '#5dff6a' : '#ff6a6a');
  return ok;
}
function loadProfile(uid) { try { return JSON.parse(lsGet(SAVE_PREFIX + 'p.' + uid)); } catch (e) { return null; } }
function deleteProfile(uid) { try { localStorage.removeItem(SAVE_PREFIX + 'p.' + uid); } catch (e) { } lsSet(SAVE_PREFIX + 'profiles', JSON.stringify(listProfiles().filter(p => p.uid !== uid))); }
function migrate(P) {
  const d = newPlayer(P.name || 'Islander');
  for (const k in d) if (P[k] === undefined) P[k] = d[k];
  for (const s of SKILL_IDS) if (!P.skills[s]) P.skills[s] = { lvl: 0, xp: 0 };
  for (const k in d.stats) if (P.stats[k] === undefined) P.stats[k] = 0;
  if (P.inv.length < 36) P.inv = P.inv.concat(Array(36 - P.inv.length).fill(null));
  return P;
}
const homeKey = () => 'home@' + G.P.uid;
const lvl = s => G.P.skills[s].lvl;

// ------------------------------------------------------------ inventory
function iDef(s) { return s && ITEMS[s.id]; }
function newItemData(id) {
  const d = ITEMS[id];
  if (d.tool && d.tool.fuel) return { uid: rid(), ench: {}, ref: null, rec: 0, fuel: d.tool.fuel, eng: 0, tank: 0 };
  if (d.tool || d.armor) return { uid: rid(), ench: {}, ref: null, rec: 0 };
  if (d.place && d.place.k === 'mach') return { tier: 1 };
  if (id === 'ench_book') return randomBook(1);
  return null;
}
function randomBook(maxBoost = 1) {
  const ids = Object.keys(ENCHANTS).filter(e => ENCHANTS[e].max > 1);
  const e = ids[randi(0, ids.length - 1)];
  return { uid: rid(), book: e, l: Math.min(ENCHANTS[e].max + maxBoost, randi(Math.max(1, ENCHANTS[e].max - 2), ENCHANTS[e].max + maxBoost)) };
}
function matchTag(id, tag) { const d = ITEMS[id]; return tag[0] === '#' ? !!(d.tags && d.tags.includes(tag.slice(1))) : id === tag; }
function countItem(tag) { let n = 0; for (const s of G.P.inv) if (s && !s.d && matchTag(s.id, tag)) n += s.n; else if (s && s.d && matchTag(s.id, tag) && !ITEMS[s.id].unique) n += s.n; return n; }
function countAny(id) { let n = 0; for (const s of G.P.inv) if (s && s.id === id) n += s.n; return n; }
function addItem(id, n = 1, d = null, feed = true) {
  const inv = G.P.inv, def = ITEMS[id]; if (!def || n <= 0) return 0;
  const start = n;
  if (def.unique || d) {
    while (n > 0) { const k = inv.indexOf(null); if (k < 0) break; inv[k] = { id, n: 1, d: d ? JSON.parse(JSON.stringify(d)) : newItemData(id) }; n--; d = null; }
  } else {
    for (const s of inv) { if (n <= 0) break; if (s && s.id === id && !s.d && s.n < 999) { const a = Math.min(n, 999 - s.n); s.n += a; n -= a; } }
    while (n > 0) { const k = inv.indexOf(null); if (k < 0) break; const a = Math.min(n, 999); inv[k] = { id, n: a }; n -= a; }
  }
  if (feed && start - n > 0) UI.pickup(id, start - n);
  G.invDirty = true; questCheck();
  return n;
}
function addStack(s) { return s.d ? addItem(s.id, 1, s.d) : addItem(s.id, s.n); }
function removeItem(tag, n) {
  const inv = G.P.inv;
  // for "any log" style ingredients, spend the cheapest matching items first
  const order = inv.map((s, k) => k).filter(k => inv[k] && matchTag(inv[k].id, tag) && !ITEMS[inv[k].id].unique)
    .sort((a, b) => ITEMS[inv[a].id].price - ITEMS[inv[b].id].price || b - a);
  for (const k of order) { if (n <= 0) break; const s = inv[k]; const a = Math.min(n, s.n); s.n -= a; n -= a; if (s.n <= 0) inv[k] = null; }
  G.invDirty = true; return n === 0;
}
function matchingIds(tag) { return tag[0] === '#' ? Object.keys(ITEMS).filter(id => matchTag(id, tag)) : [tag]; }
function hasItems(list) { return list.every(([id, n]) => countItem(id) >= n); }
function takeItems(list) { if (!hasItems(list)) return false; list.forEach(([id, n]) => removeItem(id, n)); return true; }
function freeSlots() { return G.P.inv.filter(s => !s).length; }
function held() { return G.P.inv[G.sel]; }
function instRar(s) { return Math.min(5, ITEMS[s.id].rar + (s.d && s.d.rec ? 1 : 0)); }
function getRef(d, ref) { if (!ref) return null; if (ref.startsWith('cr_')) return CRYSTAL_REF[ref] || null; const g = REFORGES[REFORGE_GROUP[gearKind(d)]]; return (g && g[ref]) || null; }
function instName(s) { const d = ITEMS[s.id]; let n = d.name; const rf = s.d && s.d.ref && gearKind(d) && getRef(d, s.d.ref); if (rf) n = rf.n + ' ' + n; if (s.d && s.d.book) n = `Book: ${ENCHANTS[s.d.book].name} ${ROMAN[s.d.l]}`; if (s.d && s.d.tier) n += ' ' + ROMAN[s.d.tier]; return n; }
function instValue(s) {
  const d = ITEMS[s.id]; let v = d.price * (s.n || 1);
  if (s.d && s.d.ench) for (const e in s.d.ench) v += enchantCost(e, s.d.ench[e]).coins * 0.6;
  if (s.d && s.d.rec) v += 4000; if (s.d && s.d.ref) v += REFORGE_COST[instRar(s)] * 0.5;
  if (s.d && s.d.tier) v *= 1 + (s.d.tier - 1) * 1.5;
  if (s.d && s.d.book) v = 150 * s.d.l * s.d.l;
  return Math.round(v);
}
function fortuneKey(kind) { return kind === 'axe' ? 'foragingFortune' : (kind === 'pickaxe' || kind === 'drill') ? 'miningFortune' : kind === 'hoe' ? 'farmingFortune' : 'treasure'; }
function itemStats(s) {
  const d = ITEMS[s.id], out = Object.assign({}, d.stats || {});
  if (!s.d) return out;
  if (s.d.ref && gearKind(d)) {
    const rf = getRef(d, s.d.ref), m = 1 + instRar(s) * 0.5;
    if (rf) for (const k in rf.st) { const key = k === 'fortune' ? fortuneKey(d.tool ? d.tool.kind : '') : k; out[key] = (out[key] || 0) + Math.round(rf.st[k] * m); }
  }
  const e = s.d.ench || {};
  if (e.protection) out.defense = (out.defense || 0) + e.protection * 4;
  if (e.growth) out.health = (out.health || 0) + e.growth * 15;
  if (e.wisdom) out.intelligence = (out.intelligence || 0) + e.wisdom * 15;
  if (e.mana_flow) out.manaSave = (out.manaSave || 0) + e.mana_flow * 5;
  if (s.d.eng) out.breakPct = (out.breakPct || 0) + s.d.eng * 20;
  if (e.fortune) out.miningFortune = (out.miningFortune || 0) + e.fortune * 12;
  if (e.timber) out.foragingFortune = (out.foragingFortune || 0) + e.timber * 12;
  if (e.harvesting) out.farmingFortune = (out.farmingFortune || 0) + e.harvesting * 12;
  if (e.luck) out.treasure = (out.treasure || 0) + e.luck * 2;
  if (e.critical) out.critDamage = (out.critDamage || 0) + e.critical * 10;
  if (e.efficiency) out.breakPct = (out.breakPct || 0) + e.efficiency * 15;
  if (s.d.rec) for (const k in out) out[k] = Math.round(out[k] * 1.1);
  return out;
}
function activePet() { return G.P.pets[G.P.petActive] || null; }
function computeStats() {
  const s = baseStats(), P = G.P;
  for (const id of SKILL_IDS) applySkillPerks(id, P.skills[id].lvl, s);
  const h = held();
  if (h && ITEMS[h.id].tool && usable(h)) { const st = itemStats(h); for (const k in st) s[k] = (s[k] || 0) + st[k]; }
  for (const slot of ARMOR_SLOTS) { const a = P.armor[slot]; if (a && usable(a)) { const st = itemStats(a); for (const k in st) s[k] = (s[k] || 0) + st[k]; } }
  const set = fullSet(); if (set) for (const k in set.st) s[k] += set.st[k];
  const p = activePet(); if (p) { const st = petStats(p); for (const k in st) s[k] += st[k]; }
  return s;
}
function fullSet() {
  const A = G.P.armor, first = A.helmet && ITEMS[A.helmet.id].armor.set;
  return first && ARMOR_SLOTS.every(sl => A[sl] && ITEMS[A[sl].id].armor.set === first && usable(A[sl])) ? SETS[first] : null;
}
function equipArmor(slotIdx) {
  const s = G.P.inv[slotIdx]; if (!s || !ITEMS[s.id].armor) return;
  const sl = ITEMS[s.id].armor.slot, old = G.P.armor[sl];
  G.P.armor[sl] = s; G.P.inv[slotIdx] = old; G.invDirty = true; SFX.place();
  if (!usable(s)) UI.toast(`${esc(useReqText(s))} — it gives no stats until then`, '#ff8a8a');
  const set = fullSet(); if (set && set.id === ITEMS[s.id].armor.set) UI.toast(`Full set bonus: <b>${set.name}</b> — ${set.desc}`, set.col);
}
function unequipArmor(sl) {
  const a = G.P.armor[sl]; if (!a) return; const k = G.P.inv.indexOf(null);
  if (k < 0) return UI.toast('Inventory full', '#ff6a6a');
  G.P.inv[k] = a; G.P.armor[sl] = null; G.invDirty = true;
}

// --------------------------------------------------------- collections
function collTier(id) { const n = (G.P.coll[id] || 0); let t = 0; while (t < COLL_TIERS.length && n >= COLL_TIERS[t]) t++; return t; }
function collUnlocks(id, tier) { return RECIPES.filter(r => r.coll && r.coll[0] === id && r.coll[1] === tier).map(r => ITEMS[r.out].name); }
function addColl(id, n) {
  if (!COLLECTION.has(id) || n <= 0) return;
  const before = collTier(id);
  G.P.coll[id] = (G.P.coll[id] || 0) + n; bountyProgress('gather', id, n);
  const after = collTier(id);
  for (let t = before + 1; t <= after; t++) {
    const reward = 60 * t * t; G.P.coins += reward;
    const un = collUnlocks(id, t);
    UI.banner(`<div class="bk">COLLECTION LEVEL UP</div><div class="bt">${UI.icon(id, 34)} ${esc(ITEMS[id].name)} ${ROMAN[t]}</div><div class="bs">+${fmt(reward)} coins${un.length ? '' : ' · keep gathering for new unlocks'}</div>${un.length ? `<div class="bu">Unlocked: ${un.map(esc).join(' · ')}</div>` : ''}`, 4200, 'lvl');
    SFX.level();
  }
}
// gear above your skill level can be held but not used
function usable(s) { const r = s && ITEMS[s.id] && ITEMS[s.id].useReq; return !r || G.P.skills[r[0]].lvl >= r[1]; }
function useReqText(s) { const r = ITEMS[s.id].useReq; return r ? `Requires ${SKILLS[r[0]].name} ${r[1]} to use` : ''; }
function heldTool() { const h = held(); return h && ITEMS[h.id].tool && usable(h) ? ITEMS[h.id].tool : null; }
function heldEnch() { const h = held(); return (h && h.d && h.d.ench) || {}; }

// --------------------------------------------------------------- coins
function addCoins(n, x, y) {
  n = Math.round(n); if (!n) return;
  G.P.coins += n; if (n > 0) G.P.stats.earned += n;
  if (x != null) floater(x, y - 0.4, (n > 0 ? '+' : '') + fmt(n) + ' coins', '#ffd23a', 0.7);
  if (n > 0) SFX.coin();
  questCheck();
}

// ---------------------------------------------------------------- skills
function gainXP(skill, amt, x, y) {
  if (!(amt > 0)) return;
  const ench = heldEnch().experience || 0;
  let mult = 1 + (G.stats.xpBoost + ench * 8) / 100;
  const ev = currentEvent();
  if (ev.active && ((ev.ev.id === 'timber' && skill === 'foraging') || (ev.ev.id === 'bloodmoon' && skill === 'combat'))) mult *= 2;
  const set = fullSet(); if (set && set[skill + 'Xp']) mult *= 1 + set[skill + 'Xp'] / 100;
  if (skill === 'farming' && heldEnch().green_thumb) mult *= 1 + heldEnch().green_thumb * 0.08;
  amt = Math.round(amt * mult * 10) / 10;
  const sk = G.P.skills[skill];
  sk.xp += amt;
  while (sk.lvl < MAX_SKILL && sk.xp >= xpToNext(sk.lvl)) { sk.xp -= xpToNext(sk.lvl); sk.lvl++; onLevelUp(skill, sk.lvl); }
  if (sk.lvl >= MAX_SKILL) sk.xp = 0;
  UI.skillBar(skill, amt);
  if (x != null) floater(x + rand(-0.2, 0.2), y - 0.8, `+${amt} ${SKILLS[skill].name}`, SKILLS[skill].col, 0.62);
  const p = activePet();
  if (p && p.lvl < PET_MAX) {
    p.xp += amt * (PETS[p.id].skill === skill ? 1 : 0.3);
    while (p.lvl < PET_MAX && p.xp >= petXpToNext(p.lvl)) { p.xp -= petXpToNext(p.lvl); p.lvl++; UI.toast(`${PETS[p.id].e} Your ${PETS[p.id].name} reached level ${p.lvl}!`, RCOL[p.rar]); }
  }
}
function unlocksAt(skill, l) {
  const out = [];
  for (const id in NODES) { const n = NODES[id]; if (n.skill === skill && n.lvl === l) out.push(n.name); }
  for (const id in ZONES) { const z = ZONES[id]; if (z.skill === (skill === 'foraging' ? 'foraging' : skill) && z.req === l && l > 0 && (z.cat === skill || (skill === 'combat' && (z.cat === 'combat' || z.cat === 'dungeon')) || (skill === 'foraging' && z.cat === 'foraging'))) out.push('Island: ' + z.name); }
  for (const r of RECIPES) if (r.req && r.req[0] === skill && r.req[1] === l) out.push('Recipe: ' + ITEMS[r.out].name);
  return [...new Set(out)];
}
function onLevelUp(skill, l) {
  SFX.level();
  G.P.coins += levelCoins(l); FX.flash = 0.45; FX.flashCol = SKILLS[skill].col; FX.ring(G.me.x, G.me.y, 3, SKILLS[skill].col);
  UI.levelUp(skill, l, unlocksAt(skill, l));
  for (let i = 0; i < 40; i++) G.particles.push({ x: G.me.x, y: G.me.y - 0.5, vx: rand(-4, 4), vy: rand(-7, -2), life: rand(0.8, 1.6), max: 1.6, col: ['#ffd23a', '#5dff6a', '#5aa8ff', '#ff5ce1'][i % 4], size: rand(3, 6), grav: 9, sq: 1 });
  G.me.hp = G.stats.health;
}

// ------------------------------------------------------------ fx helpers
function floater(x, y, text, col = '#fff', size = 0.5, opts = {}) { G.floaters.push(Object.assign({ x, y, text, col, size, life: 1.1, max: 1.1, vy: -1.1 }, opts)); }
function burst(x, y, col, n = 8, spd = 3, size = 4, grav = 6) { for (let i = 0; i < n; i++) G.particles.push({ x, y, vx: rand(-spd, spd), vy: rand(-spd * 1.3, spd * 0.4), life: rand(0.35, 0.8), max: 0.8, col, size: rand(size * 0.6, size), grav, sq: 1 }); }

// ---------------------------------------------------------------- zones
function getZone(key) {
  if (G.zones[key]) return G.zones[key];
  let z;
  if (key === homeKey()) {
    z = G.P.home ? deserializeZone(key, G.P.home) : genHome(key, ISLAND_SIZES[G.P.islandR].r, G.P.uid);
    z.dirty = new Set();
  } else z = generateZone(key);
  G.zones[key] = z;
  if (key === homeKey()) ensureHomePortal(z);
  return z;
}
function ensureHomePortal(z) {
  if (G.P.tut < 7) return;
  for (const o of z.objs) if (o && o.k === 'portal') return;
  const x = 24, y = 28;
  for (let j = 0; j < 4; j++) { const yy = y + j; if (!GROUND[z.g(x, yy)].solid && (!z.o(x, yy) || ['tree', 'rock', 'stump', 'rubble'].includes(z.o(x, yy).k))) { z.set(x, yy, { k: 'portal', to: 'hub', label: 'SkyHub' }); burst(x + 0.5, yy + 0.5, '#7ad8ff', 30, 4); return; } }
}
function zoneReq(base) {
  const d = ZONES[base]; if (!d || !d.req) return null;
  const s = d.cat === 'dungeon' ? 'combat' : d.skill;
  return lvl(s) >= d.req ? null : `Requires ${SKILLS[s].name} ${d.req}`;
}
function travel(key, opts = {}) {
  const base = key.split('@')[0];
  if (!opts.force) { const r = zoneReq(base); if (r) { UI.toast('🔒 ' + r, '#ff6a6a'); SFX.error(); return false; } }
  if (key.startsWith('home@') && key !== homeKey()) { NET.visitHost(); return true; }
  const from = G.zone ? G.zone.base : null;
  if (G.zone && G.zone.def.cat === 'dungeon') delete G.zones[G.zone.key];
  if (ZONES[base] && ZONES[base].cat === 'dungeon') delete G.zones[key];
  const z = getZone(key);
  enterZone(z, from);
  return true;
}
function enterZone(z, from) {
  G.zone = z;
  const me = G.me;
  me.x = z.spawn.x; me.y = z.spawn.y;
  if (z.base === 'hub' && from) {
    const pk = from === 'home' ? 'home' : from;
    for (let i = 0; i < z.objs.length; i++) { const o = z.objs[i]; if (o && o.k === 'portal' && o.to === pk) { const x = i % z.w + 0.5, y = Math.floor(i / z.w) + 0.5; const dx = z.spawn.x - x, dy = z.spawn.y - y, d = Math.hypot(dx, dy); me.x = x + dx / d * 2; me.y = y + dy / d * 2; break; } }
  }
  me.portalCd = 1.2; me.fish = null; z.projs.length = 0; z.tele.length = 0; FX.fade = Math.max(FX.fade, 0.9); FX.wx = []; FX.ripples = []; FX.decals = [];
  G.cam.x = me.x; G.cam.y = me.y;
  G.P.visited[z.base] = 1;
  UI.zoneBanner(z);
  SFX.portal();
  NET.onZone();
  questProgress('visit', z.base, 1);
  questCheck();
}

// ------------------------------------------------------------- movement
function solidAt(z, x, y) { return z.solid(Math.floor(x), Math.floor(y)); }
function moveEnt(z, e, dx, dy, r) {
  if (dx) { const nx = e.x + dx, sx = nx + Math.sign(dx) * r; if (!solidAt(z, sx, e.y - r * 0.8) && !solidAt(z, sx, e.y + r * 0.8)) e.x = nx; else e.bumped = 1; }
  if (dy) { const ny = e.y + dy, sy = ny + Math.sign(dy) * r; if (!solidAt(z, e.x - r * 0.8, sy) && !solidAt(z, e.x + r * 0.8, sy)) e.y = ny; else e.bumped = 1; }
}
function nearestFree(z, x, y, maxR = 6) {
  for (let r = 0; r <= maxR; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
    const tx = Math.floor(x) + i, ty = Math.floor(y) + j; if (!z.solid(tx, ty) && z.inb(tx, ty)) return { x: tx + 0.5, y: ty + 0.5 };
  }
  return { x, y };
}

// ------------------------------------------------------- breaking & drops
function actorInfo() {
  const t = heldTool() || {}, e = heldEnch(), s = G.stats;
  return { kind: t.kind || null, tier: t.tier || 0, power: t.power || 1, sweep: t.sweep || 0, cleave: t.cleave || 0, eff: e.efficiency || 0, smelt: !!e.smelting, tele: !!e.telekinesis, abund: e.abundance || 0, repl: e.replenish || 0,
    breakPct: s.breakPct - (e.efficiency || 0) * 15, fort: { foraging: s.foragingFortune, mining: s.miningFortune, farming: s.farmingFortune } };
}
function canBreak(o, a) {
  if (o.k === 'tree' || o.k === 'rock') {
    const n = NODES[o.id];
    if (lvl(n.skill) < n.lvl) return `Requires ${SKILLS[n.skill].name} ${n.lvl}`;
    const match = o.k === 'tree' ? a.kind === 'axe' : (a.kind === 'pickaxe' || a.kind === 'drill');
    const tier = match ? a.tier : 0;
    if (tier < n.tier) return o.k === 'tree' ? `Needs a stronger axe (${MATS[n.tier - 1].n} or better)` : `Needs a stronger pickaxe (${MATS[n.tier - 1].n} or better)`;
    return null;
  }
  if (o.k === 'crop') { const n = NODES['crop_' + o.id]; if (lvl('farming') < n.lvl) return `Requires Farming ${n.lvl}`; }
  return null;
}
function evMult(z, skill) { const ev = currentEvent(); return ev.active && ev.ev.cat === skill && z.def.cat === skill ? 2 : 1; }
function rollDrops(drops, fortune, mult = 1, chanceMult = 1) {
  const out = [];
  drops.forEach(([id, mn, mx, ch], k) => {
    const c = ch >= 1 ? 1 : ch * chanceMult;
    if (Math.random() < c) {
      let n = randi(mn, mx);
      if (k === 0) n *= (1 + fortune / 100) * mult;
      n = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
      if (n > 0) out.push([id, n]);
    }
  });
  return out;
}
function cropRipe(z, o) { const n = NODES['crop_' + o.id]; return Date.now() - o.t0 >= (z.fastGrow && !o.pl ? z.fastGrow : n.grow) * 1000; }
function cropProg(z, o) { const n = NODES['crop_' + o.id]; return clamp((Date.now() - o.t0) / ((z.fastGrow && !o.pl ? z.fastGrow : n.grow) * 1000), 0, 1); }

// Applies a hit to a tile. Used locally AND by a co-op host for guest hits.
function applyHit(z, x, y, a, owner) {
  const o = z.o(x, y); if (!o) return null;
  if (o.k === 'tree' || o.k === 'rock') {
    const n = NODES[o.id];
    const match = o.k === 'tree' ? a.kind === 'axe' : (a.kind === 'pickaxe' || a.kind === 'drill');
    const dmg = (match ? a.power : 1) * (1 + a.eff * 0.15 + a.breakPct / 100);
    o.hp -= dmg; o.shake = 1;
    if (o.hp > 0) return { res: 'hit', k: o.k, id: o.id };
    const skill = n.skill, items = rollDrops(n.drops, a.fort[skill], evMult(z, skill));
    if (a.smelt && o.k === 'rock') items.forEach(it => { const s = ITEMS[it[0]].smelt; if (s) it[0] = s; });
    const triple = a.abund && items[0] && Math.random() < a.abund * 0.03; if (triple) items[0][1] *= 3;
    const xp = o.pl ? 0 : n.xp * (o.grown ? 0.5 : 1);
    if (z.isHome && !o.nat) z.set(x, y, null);
    else z.set(x, y, { k: o.k === 'tree' ? 'stump' : 'rubble', id: o.id, nat: o.nat, at: Date.now() + n.respawn * (z.isHome ? 2.5 : 1) * 1000 });
    return { res: 'broken', k: o.k, id: o.id, items, xp: [[skill, xp]], triple };
  }
  if (o.k === 'crop') {
    if (!cropRipe(z, o)) return { res: 'unripe', k: 'crop', id: o.id };
    const n = NODES['crop_' + o.id];
    const items = rollDrops(n.drops, a.fort.farming, evMult(z, 'farming'));
    const triple = a.abund && items[0] && Math.random() < a.abund * 0.03; if (triple) items[0][1] *= 3;
    z.set(x, y, { k: 'crop', id: o.id, t0: Date.now() - (o.pl && a.repl ? n.grow * 1000 * 0.1 * a.repl : 0), pl: o.pl });
    return { res: 'broken', k: 'crop', id: o.id, items, xp: [['farming', n.xp]], triple };
  }
  if (!z.buildable || o.fixed) return null;
  // player-built things: return the item itself, never XP
  const items = [];
  if (o.k === 'block') { items.push([o.id, 1]); if (o.inv) for (const s of o.inv) if (s) items.push([s.id, s.n, s.d]); if (o.fz) for (const s of [o.fz.inp, o.fz.fuel, o.fz.out]) if (s) items.push([s.id, s.n]); }
  else if (o.k === 'sapling') items.push([o.tree + '_sapling', 1]);
  else if (o.k === 'conv') { items.push([o.fast ? 'fast_conveyor' : 'conveyor', 1]); for (const it of o.items) items.push([it.id, 1]); }
  else if (o.k === 'sort') { items.push(['sorter', 1]); if (o.item) items.push([o.item.id, 1]); }
  else if (o.k === 'mach') { items.push([o.id, 1, { tier: o.tier }]); for (const id in o.buf) items.push([id, o.buf[id]]); for (const id in (o.inq || {})) items.push([id, o.inq[id]]); }
  else return null;
  z.set(x, y, null);
  return { res: 'broken', k: o.k, id: o.id, items, xp: [], built: 1 };
}
function grantReward(r, x, y, direct) {
  if (!r) return;
  for (const [id, n, d] of (r.items || [])) {
    if (direct || G.zone.remote) { const left = d ? addItem(id, 1, d) : addItem(id, n); if (!r.built) addColl(id, n - left); if (left) spawnDrop(G.zone, x, y, id, left, d, !r.built); }
    else spawnDrop(G.zone, x, y, id, n, d, !r.built);
  }
  for (const [skill, amt] of (r.xp || [])) gainXP(skill, amt, x, y);
  if (r.coins) addCoins(r.coins, x, y);
}
function spawnDrop(z, x, y, id, n, d, coll) {
  const max = ITEMS[id] && ITEMS[id].unique ? 1 : 999;
  for (let left = n; left > 0; left -= max) z.drops.push({ id, n: Math.min(left, max), d: d || null, x, y, h: 0, vh: rand(3, 5), vx: rand(-1.6, 1.6), vy: rand(-1.6, 1.6), t: 0, coll: !!coll });
}
function hitFx(x, y, k, id) {
  const cx = x + 0.5, cy = y + 0.5;
  if (k === 'tree') { burst(cx, cy - 0.3, NODES[id].leaf, 5, 2.5, 5); burst(cx, cy + 0.2, NODES[id].bark, 3, 2, 3); SFX.chop(); }
  else if (k === 'rock') { burst(cx, cy, NODES[id].base, 5, 3, 4); if (NODES[id].spot) burst(cx, cy, NODES[id].spot, 3, 3, 3); SFX.mine(); }
  else if (k === 'crop') { burst(cx, cy, NODES['crop_' + id].col, 6, 2.5, 4); SFX.harvest(); }
  else { burst(cx, cy, '#bbb', 5, 2, 3); SFX.place(); }
}
function breakFx(x, y, k, id) {
  const cx = x + 0.5, cy = y + 0.5;
  if (k === 'tree') { burst(cx, cy - 0.4, NODES[id].leaf, 18, 4, 7); G.particles.push({ x: cx, y: cy, fall: 1, id, life: 0.7, max: 0.7, vx: 0, vy: 0, grav: 0, size: 1, col: '#000' }); G.shake = Math.max(G.shake, 0.15); }
  else if (k === 'rock') { burst(cx, cy, NODES[id].base, 14, 4, 6); if (NODES[id].spot) burst(cx, cy, NODES[id].spot, 8, 4, 4); G.shake = Math.max(G.shake, 0.12); }
  else if (k === 'crop') burst(cx, cy, NODES['crop_' + id].col, 10, 3, 4);
  else burst(cx, cy, '#ccc', 10, 3, 4);
}
function onBroken(r, x, y) {
  if (r.k === 'tree') G.P.stats.logs++; else if (r.k === 'rock') G.P.stats.mined++; else if (r.k === 'crop') G.P.stats.crops++;
  questCheck();
}
// local hit at tile (x,y) with current tool
function hitTile(x, y) {
  const z = G.zone, o = z.o(x, y), a = actorInfo();
  if (o.k === 'stump' || o.k === 'rubble') {
    // stumps on your own island can be dug up to make room; elsewhere they just regrow
    if (z.buildable && !z.remote) { z.set(x, y, null); burst(x + 0.5, y + 0.5, o.k === 'stump' ? NODES[o.id].bark : '#888', 10, 2.5, 4); SFX.chop(); }
    else floater(x + 0.5, y, `Regrows in ${Math.max(1, Math.ceil((o.at - Date.now()) / 1000))}s`, '#cfd8ff', 0.4);
    return;
  }
  const err = canBreak(o, a); if (err) { warn(err); return; }
  if (a.kind === 'drill' && o.k === 'rock') {
    const h = held();
    if (!(h.d.fuel > 0)) { warn('Out of fuel! Right-click with the drill to refuel from coal'); return; }
    h.d.fuel--;
  }
  if ((o.k === 'block' || o.k === 'mach' || o.k === 'conv' || o.k === 'sort' || o.k === 'sapling') && (!z.buildable || o.fixed)) return;
  if (o.k === 'crop' && G.keys.shift && z.buildable) { z.set(x, y, null); addItem(NODES['crop_' + o.id].seed, 1); return; }
  const targets = [[x, y]];
  if (o.k === 'crop' && a.sweep) { const r = a.sweep; for (let j = -r + (r === 1 ? 1 : 0); j <= r - (r === 1 ? 1 : 0); j++) for (let i = -r; i <= r; i++) if (i || j) targets.push([x + i, y + j]); }
  for (const [tx, ty] of targets) {
    const ob = z.o(tx, ty); if (!ob) continue;
    if (tx !== x || ty !== y) { if (ob.k !== 'crop' || canBreak(ob, a)) continue; }
    if (z.remote) {
      if (ob.k === 'crop' && !cropRipe(z, ob)) { if (tx === x && ty === y) floater(x + 0.5, y, 'Not ripe yet', '#ccc', 0.4); continue; }
      ob.shake = 1; hitFx(tx, ty, ob.k, ob.id); NET.send({ t: 'hit', x: tx, y: ty, a }); continue;
    }
    const r = applyHit(z, tx, ty, a, true); if (!r) continue;
    if (r.res === 'unripe') { if (tx === x && ty === y) floater(x + 0.5, y, 'Not ripe yet', '#ccc', 0.4); continue; }
    hitFx(tx, ty, r.k, r.id);
    if (r.res === 'broken') { breakFx(tx, ty, r.k, r.id); grantReward(r, tx + 0.5, ty + 0.5, a.tele || r.built); onBroken(r, tx, ty); if (r.triple) floater(tx + 0.5, ty - 0.3, 'TRIPLE DROP!', '#ffd23a', 0.5); }
  }
}
let lastWarn = 0;
function warn(msg) { if (G.t - lastWarn > 1) { lastWarn = G.t; floater(G.me.x, G.me.y - 1.2, msg, '#ff7a7a', 0.42, { life: 1.6, max: 1.6 }); SFX.error(); } }

// ------------------------------------------------------------- placement
function canPlaceAt(z, x, y) {
  if (!z.buildable) return 'You can only build on your island';
  if (!z.inb(x, y) || GROUND[z.g(x, y)].solid) return 'Cannot place here';
  if (z.o(x, y)) return 'Something is already here';
  return null;
}
function placeObjFor(s, z, x, y) {
  const d = ITEMS[s.id], p = d.place;
  if (p.k === 'block') { const o = { k: 'block', id: s.id, pl: 1 }; if (p.chest) o.inv = Array(27).fill(null); return o; }
  if (p.k === 'sapling') { if (!GROUND[z.g(x, y)].grassy && z.g(x, y) !== GT.DIRT) return null; return { k: 'sapling', tree: p.tree, t0: Date.now() }; }
  if (p.k === 'conv') return { k: 'conv', dir: G.placeDir, items: [], fast: p.fast ? 1 : 0 };
  if (p.k === 'sort') return { k: 'sort', dir: G.placeDir, filter: null, item: null };
  if (p.k === 'mach') { const M = MACHINES[p.m]; return { k: 'mach', id: p.m, tier: (s.d && s.d.tier) || 1, res: M.kind === 'gather' ? machineResources(p.m)[0] : null, buf: {}, inq: {}, last: Date.now(), pt: 0, ot: 0 }; }
  return null;
}
function tryPlace(x, y) {
  const z = G.zone, s = held(); if (!s) return;
  const d = ITEMS[s.id];
  if (d.plant) {
    if (!z.buildable) return warn('Plant seeds on your own island');
    if (z.g(x, y) !== GT.FARM || z.o(x, y)) return;
    const n = NODES['crop_' + d.plant]; if (lvl('farming') < n.lvl) return warn(`Requires Farming ${n.lvl}`);
    const ob = { k: 'crop', id: d.plant, t0: Date.now(), pl: 1 };
    if (!consumeHeld()) return;
    if (z.remote) NET.send({ t: 'place', x, y, ob, item: [s.id, 1] }); else z.set(x, y, ob);
    burst(x + 0.5, y + 0.5, '#8a6a3a', 5, 2, 3); SFX.place(); G.me.cd = 0.08; return;
  }
  if (!d.place) return;
  const err = canPlaceAt(z, x, y); if (err) return warn(err);
  const ob = placeObjFor(s, z, x, y); if (!ob) return warn('Cannot place that here');
  if (objSolid(ob) && Math.hypot(x + 0.5 - G.me.x, y + 0.5 - G.me.y) < 0.85) return;
  const copy = { id: s.id, n: 1, d: s.d };
  if (!consumeHeld()) return;
  if (z.remote) NET.send({ t: 'place', x, y, ob, item: [copy.id, 1, copy.d] }); else z.set(x, y, ob);
  if (s.id === 'workbench') { G.P.flags.benchPlaced = 1; questCheck(); }
  if (d.place.k === 'mach') { G.P.flags.machPlaced = 1; questCheck(); }
  burst(x + 0.5, y + 0.5, '#ddd', 6, 2, 3); SFX.place(); G.me.cd = 0.15;
}
function consumeHeld() { const s = held(); if (!s) return false; s.n--; if (s.n <= 0) G.P.inv[G.sel] = null; G.invDirty = true; return true; }
function till(x, y) {
  const z = G.zone; if (!z.buildable) return;
  const g = z.g(x, y); if (!(GROUND[g].grassy || g === GT.DIRT) || z.o(x, y)) return;
  if (z.remote) NET.send({ t: 'till', x, y }); else z.setG(x, y, GT.FARM);
  burst(x + 0.5, y + 0.5, '#7a5230', 6, 2, 3); SFX.harvest(); G.me.cd = 0.15; G.me.swing = 1;
  G.P.flags.tilled = 1; questCheck();
}
function machineResources(mid) {
  const M = MACHINES[mid];
  if (M.res === 'mob') return ['slime', 'zombie', 'skeleton', 'spider', 'wolf', 'voidwalker', 'wraith', 'magma_slime', 'blaze'];
  if (M.res === 'fish') return Object.keys(FISH_RES);
  return Object.keys(NODES).filter(id => NODES[id].k === M.res);
}
// why a gatherer can't be switched to a resource yet (null = allowed)
function machineResLock(mid, res) {
  const M = MACHINES[mid];
  const need = M.res === 'mob' ? Math.floor(MOBS[res].lvl * 0.7) : M.res === 'fish' ? FISH_RES[res] : NODES[res].lvl, item = M.res === 'mob' ? MOBS[res].drops[0][0] : M.res === 'fish' ? res : NODES[res].item;
  if (lvl(M.skill) < need) return `${SKILLS[M.skill].name} ${need}`;
  if (collTier(item) < 1 && res !== machineResources(mid)[0]) return `${ITEMS[item].name} collection I`;
  return null;
}

// --------------------------------------------------------------- combat
function calcDamage(type, base) {
  const s = G.stats, e = heldEnch();
  let d;
  if (type === 'wand') d = base * (1 + s.intelligence / 130) * (1 + (e.arcane || 0) * 0.1) * (1 + s.spellDmg / 100) * (1 + s.damagePct / 300);
  else {
    d = (5 + base) * (1 + s.strength / 100) * (1 + s.damagePct / 100);
    if (type === 'melee') d *= 1 + (e.sharpness || 0) * 0.1;
    if (type === 'bow') d *= 1 + (e.power || 0) * 0.1;
  }
  if (G.zone.def.cat === 'dungeon') d *= 1 + s.dungeonDmg / 100;
  const crit = type !== 'wand' && Math.random() * 100 < s.critChance;
  if (crit) d *= 1 + s.critDamage / 100;
  return { dmg: Math.max(1, Math.round(d * rand(0.95, 1.05))), crit };
}
function meleeSwing() {
  const me = G.me, z = G.zone, t = heldTool(), isSword = t && t.kind === 'sword';
  me.cd = (isSword ? 0.36 : 0.45) * (1 - (heldEnch().haste || 0) * 0.06); me.swing = 1;
  const reach = isSword ? 2.2 : 1.6;
  let hit = false;
  for (const m of z.mobs) {
    if (m.dead) continue;
    const dx = m.x - me.x, dy = m.y - me.y, d = Math.hypot(dx, dy);
    if (d - m.r > reach) continue;
    if (Math.abs(angDiff(Math.atan2(dy, dx), me.dir)) > 1.15 && d > m.r + 0.6) continue;
    const { dmg, crit } = calcDamage('melee', isSword ? t.dmg : 0);
    damageMob(z, m, Math.round(dmg * hitMult(m)), crit, me.dir); hit = true;
    const ls = heldEnch().lifesteal; if (ls) me.hp = Math.min(G.stats.health, me.hp + G.stats.health * ls / 100);
  }
  if (hit) SFX.hit(); else if (isSword) SFX.shoot();
}
function shootArrow() {
  const me = G.me, t = heldTool(); me.cd = 0.5; me.swing = 0.6;
  const { dmg, crit } = calcDamage('bow', t.dmg);
  G.zone.projs.push({ x: me.x + Math.cos(me.dir) * 0.5, y: me.y + Math.sin(me.dir) * 0.5, vx: Math.cos(me.dir) * 15, vy: Math.sin(me.dir) * 15, from: 'p', dmg, crit, r: 0.18, life: 1.2, kind: 'arrow', col: '#eee' });
  SFX.shoot();
}
function castBolt() {
  const me = G.me, t = heldTool(), z = G.zone;
  const cost = Math.max(1, Math.round(t.mana * (1 - Math.min(80, G.stats.manaSave) / 100))); if (me.mana < cost) return warn('Not enough mana');
  me.mana -= cost; me.cd = t.ab === 'chain' ? 0.55 : 0.45; me.swing = 0.6;
  const { dmg } = calcDamage('wand', t.dmg);
  const h = held(), col = ITEMS[h.id].icon.c, ab = t.ab || 'bolt';
  if (ab === 'chain') {
    // lightning: strike the foe nearest the cursor, then arc to up to 3 more
    let cur = null, best = 7;
    for (const m of z.mobs) { if (m.dead) continue; const d = Math.hypot(m.x - G.mouse.wx, m.y - G.mouse.wy); if (d < 2.5 && Math.hypot(m.x - me.x, m.y - me.y) < best) { best = Math.hypot(m.x - me.x, m.y - me.y); cur = m; } }
    if (!cur) for (const m of z.mobs) { if (m.dead) continue; const d = Math.hypot(m.x - me.x, m.y - me.y); if (d < best && Math.abs(angDiff(Math.atan2(m.y - me.y, m.x - me.x), me.dir)) < 0.6) { best = d; cur = m; } }
    let from = { x: me.x, y: me.y - 0.4 }, hits = new Set(), mult = 1;
    for (let k = 0; k < 4 && cur; k++) {
      z.bolts = z.bolts || []; z.bolts.push({ x1: from.x, y1: from.y, x2: cur.x, y2: cur.y - 0.3, life: 0.25, col });
      hits.add(cur.id); damageMob(z, cur, Math.round(dmg * mult * hitMult(cur)), false, Math.atan2(cur.y - from.y, cur.x - from.x));
      from = { x: cur.x, y: cur.y - 0.3 }; mult *= 0.8;
      let nxt = null, nd = 3.8; for (const m of z.mobs) { if (m.dead || hits.has(m.id)) continue; const d = Math.hypot(m.x - from.x, m.y - from.y); if (d < nd) { nd = d; nxt = m; } }
      cur = nxt;
    }
    if (!hits.size) { z.bolts = z.bolts || []; z.bolts.push({ x1: me.x, y1: me.y - 0.4, x2: me.x + Math.cos(me.dir) * 4, y2: me.y + Math.sin(me.dir) * 4, life: 0.15, col }); }
    SFX.zap(); return;
  }
  if (ab === 'heal') { const amt = G.stats.health * 0.1 * (1 + G.stats.intelligence / 400); me.hp = Math.min(G.stats.health, me.hp + amt); floater(me.x, me.y - 1, '+' + Math.round(amt) + ' ❤', '#6aff9a', 0.45); burst(me.x, me.y - 0.4, '#6aff9a', 10, 2, 4, -2); }
  const spd = ab === 'boom' ? 9 : 11;
  z.projs.push({ x: me.x + Math.cos(me.dir) * 0.5, y: me.y + Math.sin(me.dir) * 0.5, vx: Math.cos(me.dir) * spd, vy: Math.sin(me.dir) * spd, from: 'p', dmg, crit: false, r: ab === 'boom' ? 0.34 : 0.3, life: 1.1, kind: 'bolt', ab, col, pierce: ab === 'bolt' ? 3 : ab === 'frost' ? 2 : 1, hit: new Set() });
  SFX.zap();
}
function explode(z, x, y, dmg, col) {
  for (const m of z.mobs) if (!m.dead && Math.hypot(m.x - x, m.y - y) < 1.9 + m.r) damageMob(z, m, Math.round(dmg * 0.8), false, Math.atan2(m.y - y, m.x - x));
  burst(x, y, col, 26, 6, 6, 2); burst(x, y, '#ffe08a', 12, 4, 4, 2); G.shake = Math.max(G.shake, 0.12); SFX.hit();
}
function damageMob(z, m, dmg, crit, ang) {
  m.hp -= dmg; m.flash = 0.12; m.aggro = true;
  const kb = m.def.boss ? 0.6 : 5;
  m.kx = Math.cos(ang) * kb; m.ky = Math.sin(ang) * kb;
  floater(m.x + rand(-0.3, 0.3), m.y - m.r - 0.3, crit ? `✧${fmt(dmg)}✧` : fmt(dmg), crit ? '#ffd23a' : '#fff', crit ? 0.62 : 0.48, { crit });
  burst(m.x, m.y, m.def.col, crit ? 8 : 4, 3, 4);
  if (crit) { SFX.crit(); FX.stop(0.035); } else if (m.def.boss) FX.stop(0.015);
  if (m.hp <= 0 && !m.def.boss) { FX.stop(0.05); FX.punch = Math.max(FX.punch, 0.4); }
  if (m.hp <= 0) killMob(z, m);
}
function killMob(z, m) {
  if (m.dead) return;
  m.dead = true; m.deadT = 0;
  const def = m.def, e = heldEnch(), s = G.stats;
  burst(m.x, m.y, def.col, def.boss ? 60 : 16, def.boss ? 7 : 4, def.boss ? 8 : 5);
  if (def.col2) burst(m.x, m.y, def.col2, def.boss ? 30 : 6, 4, 5);
  const drops = rollDrops(def.drops, 0, m.scale || 1, (1 + (e.looting || 0) * 0.15) * (1 + s.magicFind / 100));
  for (const [id, n] of drops) {
    const d = id === 'ench_book' ? randomBook(def.boss ? 1 : 0) : null;
    spawnDrop(z, m.x, m.y, id, n, d, true);
    const it = ITEMS[id];
    if (it.rar >= 3 || (def.boss && (it.unique || it.egg))) UI.rareDrop(id, d);
  }
  const set = fullSet();
  const coins = randi(def.coins[0], def.coins[1]) * (m.scale || 1) * (1 + (e.scavenger || 0) * 0.2) * (set && set.id === 'gold' ? 1.5 : 1);
  addCoins(coins, m.x, m.y - 0.4);
  gainXP(def.skill || 'combat', def.xp * (m.xpScale || 1), m.x, m.y);
  G.P.stats.kills++; bountyProgress('kill', m.type);
  const vamp = e.vampirism; if (vamp && !G.me.dead) G.me.hp = Math.min(G.stats.health, G.me.hp + (G.stats.health - G.me.hp) * 0.04 * vamp);
  if (def.boss) {
    G.P.stats.bosses++; FX.bossDeath(m); SFX.level();
    UI.announce(`${def.name} defeated!`, '#ffd23a');
    if (z.def.cat === 'dungeon') dungeonBossDown(z, m);
  }
  if (m.room) dungeonMobDown(z, m);
  questCheck();
}
function hurtPlayer(dmg, src) {
  const me = G.me; if (me.dead || me.iframes > 0) return;
  const d = Math.max(1, Math.round(dmg * 100 / (100 + G.stats.defense)));
  me.hp -= d; me.hurtT = 0.35; me.iframes = 0.3; me.lastHit = G.t;
  const th = armorEnch('thorns'); if (th && src && src.def && !src.dead && G.zone.mobs.includes(src)) damageMob(G.zone, src, Math.max(1, Math.round(dmg * th * 0.03)), false, 0);
  floater(me.x + rand(-0.2, 0.2), me.y - 0.9, '-' + d, '#ff4a4a', 0.5);
  G.shake = Math.max(G.shake, 0.12); SFX.hurt();
  if (src) { const a = Math.atan2(me.y - src.y, me.x - src.x); me.kx = Math.cos(a) * 6; me.ky = Math.sin(a) * 6; }
  if (me.hp <= 0) die();
}
function die() {
  const me = G.me, z = G.zone;
  const lost = z.def.cat === 'dungeon' ? 0 : Math.floor(G.P.coins * 0.1);
  G.P.coins -= lost;
  UI.announce('☠ You died!', '#ff4a4a', lost ? `You lost ${fmt(lost)} coins. Keep spare coins in the bank!` : 'Your party respawns at the entrance.');
  me.hp = G.stats.health; me.mana = 100 + G.stats.intelligence; me.fish = null;
  burst(me.x, me.y, '#ff4a4a', 30, 5, 6);
  if (z.def.cat === 'dungeon') {
    z.run.deaths++;
    if (z.run.deaths >= 3) { UI.announce('Dungeon failed', '#ff4a4a', 'Three deaths — the catacombs spit you out.'); travel('hub', { force: true }); return; }
  }
  me.x = z.spawn.x; me.y = z.spawn.y; me.iframes = 2;
}

// ------------------------------------------------------------------ mobs
function spawnMob(z, type, x, y, o = {}) {
  const def = MOBS[type], sc = o.scale || 1, dsc = o.dscale || 1;
  const m = { id: z.mobId++, type, def, x, y, hx: x, hy: y, hp: def.hp * sc, mhp: def.hp * sc, dmg: def.dmg * dsc, r: def.r, atkCd: 1, bt: 2.5, wt: 0, wx: 0, wy: 0, kx: 0, ky: 0, flash: 0, aggro: !!o.aggro, scale: o.loot || 1, xpScale: o.xpScale || 1, room: o.room || null, area: o.area || null, walkT: Math.random() * 10, extra: !!o.extra, trail: [], phase: 0 };
  z.mobs.push(m);
  if (def.boss) { if (z === G.zone) FX.bossIntro(m); else SFX.boss(); }
  burst(x, y, '#2a2a2a', 10, 2, 4, 2);
  return m;
}
function updateMobs(z, dt) {
  const me = G.me, pIn = !me.dead;
  for (const m of z.mobs) {
    if (m.dead) { m.deadT += dt; continue; }
    const def = m.def; m.atkCd -= dt; m.flash -= dt; m.walkT += dt;
    const dx = me.x - m.x, dy = me.y - m.y, safe = playerSafe(z), pd = pIn && !safe ? Math.hypot(dx, dy) : 1e9;
    if (pd < (def.boss ? 15 : def.flee ? 7 : 6.5)) m.aggro = true;
    if (pd > 20 || (m.area && !inArea(m.area, me.x, me.y, 3))) m.aggro = false;
    let mx = 0, my = 0, spd = def.spd * (m.phase ? 1.3 : 1) * (m.slow > 0 ? 0.45 : 1);
    if (m.slow > 0) m.slow -= dt;
    if (m.stun > 0) { m.stun -= dt; spd = 0; }
    else if (m.charge) {
      m.charge.t -= dt; mx = m.charge.dx; my = m.charge.dy; spd = 13;
      if (pd < m.r + 0.5 && !m.charge.hit) { m.charge.hit = 1; hurtPlayer(m.dmg * 1.4, m); }
      if (m.charge.t <= 0) m.charge = null;
    }
    else if (def.flee && pd < 7) { mx = -dx / pd; my = -dy / pd; spd *= 1.1; }
    else if (m.aggro) {
      if (def.ranged && pd < def.ranged.range * 0.55) { mx = -dx / pd * 0.6; my = -dy / pd * 0.6; }
      else if (!def.ranged || pd > def.ranged.range * 0.8) { mx = dx / pd; my = dy / pd; }
      if (m.room && z.rooms) { const r = m.room; if (me.x < r.x || me.x > r.x + r.w || me.y < r.y || me.y > r.y + r.h) { mx = my = 0; } }
    } else {
      m.wt -= dt;
      if (m.wt <= 0) { m.wt = rand(1.5, 4); const a = Math.random() * 7; const go = Math.random() < 0.6; m.wx = go ? Math.cos(a) : 0; m.wy = go ? Math.sin(a) : 0; }
      if (Math.hypot(m.x - m.hx, m.y - m.hy) > 7) { const a = Math.atan2(m.hy - m.y, m.hx - m.x); m.wx = Math.cos(a); m.wy = Math.sin(a); }
      mx = m.wx; my = m.wy; spd *= 0.45;
    }
    if (def.shape === 'slime') spd *= (Math.sin(m.walkT * 6) > 0 ? 1.4 : 0.3);
    // mobs stay inside their own area and never step into a safe zone
    let vx = (mx * spd + m.kx) * dt, vy = (my * spd + m.ky) * dt;
    if (mobBlocked(z, m, m.x + vx, m.y)) { vx = 0; m.kx = 0; if (m.charge) m.charge.t = 0; }
    if (mobBlocked(z, m, m.x, m.y + vy)) { vy = 0; m.ky = 0; if (m.charge) m.charge.t = 0; }
    moveEnt(z, m, vx, vy, m.r * 0.8);
    m.kx *= Math.pow(0.002, dt); m.ky *= Math.pow(0.002, dt);
    if (mx || my) m.face = Math.atan2(my, mx);
    if (def.shape === 'wyrm') { m.trail.unshift({ x: m.x, y: m.y }); if (m.trail.length > 40) m.trail.pop(); }
    // melee contact
    if (def.dmg > 0 && !def.ranged && pd < m.r + 0.45 && m.atkCd <= 0) { hurtPlayer(m.dmg, m); m.atkCd = def.boss ? 0.8 : 1.0; m.lunge = 0.2; }
    if (def.ranged && m.aggro && pd < def.ranged.range && m.atkCd <= 0 && !def.boss) {
      m.atkCd = def.ranged.cd * rand(0.8, 1.2);
      const a = Math.atan2(dy, dx);
      z.projs.push({ x: m.x, y: m.y - 0.2, vx: Math.cos(a) * def.ranged.spd, vy: Math.sin(a) * def.ranged.spd, from: 'm', dmg: m.dmg, r: 0.2, life: 2, kind: def.ranged.kind || 'orb', col: def.ranged.col });
      m.lunge = 0.25; if (def.ranged.kind === 'arrow') SFX.shoot();
    }
    if (def.teleport && m.aggro && Math.random() < dt * 0.25 && pd < 12) {
      const a = Math.random() * 7, p = nearestFree(z, me.x + Math.cos(a) * 2, me.y + Math.sin(a) * 2, 2);
      if (mobBlocked(z, m, p.x, p.y)) continue;
      burst(m.x, m.y, '#c070ff', 12, 3, 4); m.x = p.x; m.y = p.y; burst(m.x, m.y, '#c070ff', 12, 3, 4);
    }
    if (def.boss) bossAI(z, m, dt, pd, dx, dy);
  }
  z.mobs = z.mobs.filter(m => !m.dead || m.deadT < 0.01);
}
function bossAI(z, m, dt, pd, dx, dy) {
  if (!m.aggro) return;
  if (!m.phase && m.hp < m.mhp * 0.5) { m.phase = 1; UI.toast(`${m.def.name} is enraged!`, '#ff5a5a'); G.shake = 0.3; burst(m.x, m.y, m.def.col2 || '#f00', 30, 5, 6); }
  m.bt -= dt; if (m.bt > 0) return;
  m.bt = (m.phase ? 2.3 : 3.2) * rand(0.85, 1.15);
  const atk = m.def.attacks[randi(0, m.def.attacks.length - 1)];
  const a = Math.atan2(dy, dx), col = m.def.col2 || '#ff4a4a';
  if (atk === 'slam') { z.tele.push({ type: 'circle', x: m.x, y: m.y, r: 3.2 + m.r, t: 0, dur: 1.0, dmg: m.dmg * 1.6, src: m }); m.stun = 1.1; FX.hint('jump', 'Jump over slams with Space'); }
  else if (atk === 'ring') {
    const waves = m.phase ? 2 : 1;
    for (let w = 0; w < waves; w++) setTimeout(() => { if (m.dead || G.zone !== z) return; for (let i = 0; i < 16; i++) { const b = i / 16 * Math.PI * 2 + w * 0.2; z.projs.push({ x: m.x, y: m.y, vx: Math.cos(b) * 6, vy: Math.sin(b) * 6, from: 'm', dmg: m.dmg * 0.7, r: 0.25, life: 3, kind: 'orb', col }); } SFX.zap(); }, w * 450);
  }
  else if (atk === 'charge') {
    const len = Math.min(pd + 2, 10);
    z.tele.push({ type: 'line', x: m.x, y: m.y, a, len, w: m.r * 2, t: 0, dur: 0.7, src: m, then: () => { if (!m.dead) m.charge = { dx: Math.cos(a), dy: Math.sin(a), t: len / 13 }; } });
    m.stun = 0.7;
  }
  else if (atk === 'summon') {
    const alive = z.mobs.filter(x => !x.dead && x.extra).length;
    if (alive < 6) for (let i = 0; i < 3; i++) { const p = nearestFree(z, m.x + rand(-2, 2), m.y + rand(-2, 2), 3); spawnMob(z, m.def.summon, p.x, p.y, { aggro: true, extra: true, scale: m.minionScale || 1, dscale: m.minionDscale || 1, room: m.room }); }
    burst(m.x, m.y, '#3a3a3a', 20, 4, 5);
  }
  else if (atk === 'shock') {
    // ground shockwave: an expanding ring you must jump over
    m.stun = 0.9; burst(m.x, m.y, '#c9a070', 30, 5, 6); G.shake = Math.max(G.shake, 0.35); SFX.boss();
    const waves = m.phase ? 2 : 1;
    for (let w = 0; w < waves; w++) z.tele.push({ type: 'shock', x: m.x, y: m.y, r: 0.6 - w * 2.2, t: 0, dur: 2.2 + w * 0.6, max: 10, spd: 5.2, dmg: m.dmg * 1.3, src: m, hit: false, col: col });
    FX.hint('jump', 'Shockwave! Jump with Space');
  }
  else if (atk === 'meteor') {
    // falling rocks: roll out of the marked circles
    const n = m.phase ? 7 : 5;
    for (let i = 0; i < n; i++) { const a2 = Math.random() * 7, d2 = i === 0 ? 0 : rand(1.2, 4.5); z.tele.push({ type: 'meteor', x: G.me.x + Math.cos(a2) * d2, y: G.me.y + Math.sin(a2) * d2, r: 1.25, t: -i * 0.18, dur: 1.3, dmg: m.dmg * 1.5, src: m, col }); }
    FX.hint('roll', 'Meteors! Roll away with Shift');
  }
  else if (atk === 'spit') {
    for (let i = -2; i <= 2; i++) { const b = a + i * 0.18; z.projs.push({ x: m.x, y: m.y, vx: Math.cos(b) * 9, vy: Math.sin(b) * 9, from: 'm', dmg: m.dmg * 0.8, r: 0.25, life: 2.5, kind: 'orb', col }); }
    SFX.shoot();
  }
}
function updateTele(z, dt) {
  const me = G.me;
  for (const t of z.tele) {
    t.t += dt;
    if (t.type === 'shock') {
      t.r += t.spd * dt;
      if (t.r > t.max) { t.done = true; continue; }
      const d = Math.hypot(me.x - t.x, me.y - t.y);
      if (!t.hit && t.r > 0 && Math.abs(d - t.r) < 0.45) { t.hit = true; if (me.z > 0.25 || me.roll) floater(me.x, me.y - 1.2, 'Dodged!', '#9aff8a', 0.45); else hurtPlayer(t.dmg, t.src); }
      if (t.r > 0 && Math.random() < 0.5) { const a = Math.random() * 7; G.particles.push({ x: t.x + Math.cos(a) * t.r, y: t.y + Math.sin(a) * t.r * 0.7, vx: 0, vy: -2, life: 0.4, max: 0.4, col: '#c9a070', size: 5, grav: 4 }); }
      continue;
    }
    if (t.t >= t.dur && !t.done) {
      t.done = true;
      if (t.type === 'circle') {
        if (Math.hypot(me.x - t.x, me.y - t.y) < t.r) { if (me.z > 0.3) floater(me.x, me.y - 1.2, 'Dodged!', '#9aff8a', 0.45); else hurtPlayer(t.dmg, t.src); }
        burst(t.x, t.y, '#c9a070', 40, 6, 6); FX.ring(t.x, t.y, t.r, '#ffd27a'); FX.crater(t.x, t.y, 1.4); G.shake = Math.max(G.shake, 0.4); SFX.hit();
      }
      if (t.type === 'meteor') {
        if (Math.hypot(me.x - t.x, me.y - t.y) < t.r + 0.3) hurtPlayer(t.dmg, t.src);
        burst(t.x, t.y, '#ff8a3a', 30, 6, 6, 3); burst(t.x, t.y, '#3a2a24', 16, 4, 5, 3); FX.crater(t.x, t.y, t.r); G.shake = Math.max(G.shake, 0.3); SFX.hit();
        if (GROUND[G.zone.g(Math.floor(t.x), Math.floor(t.y))].water) FX.ripple(t.x, t.y, true);
      }
      if (t.then) t.then();
    }
  }
  z.tele = z.tele.filter(t => !t.done);
}
function updateProjs(z, dt) {
  const me = G.me;
  for (const p of z.projs) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.kind === 'bolt' && Math.random() < 0.6) G.particles.push({ x: p.x, y: p.y, vx: rand(-0.5, 0.5), vy: rand(-0.5, 0.5), life: 0.3, max: 0.3, col: p.col, size: 4, grav: 0 });
    const g = GROUND[z.g(Math.floor(p.x), Math.floor(p.y))];
    if ((g.wall || (z.o(Math.floor(p.x), Math.floor(p.y)) && objSolid(z.o(Math.floor(p.x), Math.floor(p.y))) && p.from === 'p' && p.kind === 'arrow'))) { p.life = 0; burst(p.x, p.y, p.col, 3, 1.5, 3); continue; }
    if (p.from === 'p') {
      for (const m of z.mobs) {
        if (m.dead || (p.hit && p.hit.has(m.id))) continue;
        if (Math.hypot(m.x - p.x, m.y - p.y) < m.r + p.r) {
          damageMob(z, m, Math.round(p.dmg * hitMult(m)), p.crit, Math.atan2(p.vy, p.vx));
          if (p.ab === 'frost') { m.slow = 3; burst(m.x, m.y, '#bff4ff', 8, 2, 4); }
          if (p.ab === 'boom') { explode(z, p.x, p.y, p.dmg, p.col); p.life = 0; p.boomed = 1; break; }
          if (p.pierce) { p.hit.add(m.id); if (--p.pierce <= 0) p.life = 0; } else p.life = 0;
          SFX.hit(); break;
        }
      }
    } else if (!me.dead && Math.hypot(me.x - p.x, me.y - p.y) < 0.3 + p.r) { hurtPlayer(p.dmg, p); p.life = 0; }
  }
  for (const p of z.projs) if (p.life <= 0 && p.ab === 'boom' && !p.boomed) { p.boomed = 1; explode(z, p.x, p.y, p.dmg, p.col); }
  z.projs = z.projs.filter(p => p.life > 0);
  if (z.bolts) { for (const b of z.bolts) b.life -= dt; z.bolts = z.bolts.filter(b => b.life > 0); }
}
function inArea(a, x, y, pad = 1) { return x >= a.x0 - pad && x <= a.x1 + 1 + pad && y >= a.y0 - pad && y <= a.y1 + 1 + pad; }
function playerSafe(z) { return z.safeR > 0 && Math.hypot(G.me.x - z.spawn.x, G.me.y - z.spawn.y) < z.safeR; }
function mobBlocked(z, m, x, y) {
  if (m.area && !inArea(m.area, x, y, 1)) return true;
  if (z.safeR > 0) { const d = Math.hypot(x - z.spawn.x, y - z.spawn.y); if (d < z.safeR + m.r && d < Math.hypot(m.x - z.spawn.x, m.y - z.spawn.y)) return true; }
  return false;
}

// --------------------------------------------------------------- spawning
function updateSpawning(z, dt) {
  const me = G.me, now = Date.now(), ev = currentEvent(now);
  z.spT = (z.spT || 0) - dt;
  if (z.spT <= 0) {
    z.spT = 1.4;
    const area = z.spawnArea;
    if (area) {
      const alive = z.mobs.filter(m => !m.dead && !m.def.boss && !m.extra).length;
      if (alive < area.cap) for (let tries = 0; tries < 12; tries++) {
        const x = randi(area.x0, area.x1), y = randi(area.y0, area.y1);
        if (z.solid(x, y) || !z.inb(x, y) || Math.hypot(x - me.x, y - me.y) < 7 || nearSpawn(z, x, y, 6)) continue;
        if (GROUND[z.g(x, y)].water) continue;
        if (z.safeR && Math.hypot(x + 0.5 - z.spawn.x, y + 0.5 - z.spawn.y) < z.safeR + 2) continue;
        spawnMob(z, pickW(area.mobs, Math.random), x + 0.5, y + 0.5, { area }); break;
      }
    }
    // events: pests on farms, goblins in mines
    if (ev.active && z.def.cat === ev.ev.cat) {
      const extra = z.mobs.filter(m => !m.dead && (m.type === 'pest' || m.type === 'golden_goblin')).length;
      if (ev.ev.id === 'harvest' && extra < 5 && Math.random() < 0.5) { const p = randomOpen(z); if (p) spawnMob(z, 'pest', p.x, p.y, { scale: z.def.tier, dscale: z.def.tier, loot: z.def.tier, xpScale: z.def.tier }); }
      if (ev.ev.id === 'fiesta' && extra < 1 && Math.random() < 0.06) { const p = randomOpen(z); if (p) { spawnMob(z, 'golden_goblin', p.x, p.y, { loot: z.def.tier }); UI.toast('A Gilded Gremlin is running around!', '#ffd23a'); } }
    }
  }
  // bosses
  const bossId = z.def.boss; if (!bossId || z.def.cat === 'dungeon') return;
  const bossAlive = z.mobs.some(m => !m.dead && m.def.boss);
  if (bossAlive) return;
  const tier3 = z.def.tier === 3, opts = tier3 ? { scale: 3, dscale: 2, loot: 2, xpScale: 2.5 } : {};
  if (tier3) { opts.minionScale = 2; }
  // every island boss has a timer; events summon them early (Blood Moon for combat, the island's own event otherwise)
  const timed = z.def.cat === 'combat' || z.def.cat === 'fishing';
  if (z.bossTimer > (timed ? 240 : 420)) z.bossTimer = timed ? 240 : 420;
  z.bossTimer -= dt;
  const evHit = ev.active && z.bossEventCycle !== ev.cycle && (ev.ev.id === 'bloodmoon' ? z.def.cat === 'combat' : ev.ev.cat === z.def.cat);
  if (z.bossTimer <= 0 || evHit) {
    if (evHit) z.bossEventCycle = ev.cycle; z.bossTimer = timed ? 240 : 420;
    let p = timed ? nearestFree(z, z.w / 2, z.h / 2 - 4) : nearestFree(z, me.x + rand(-6, 6), me.y + rand(-6, 6), 5);
    if (Math.hypot(p.x - z.spawn.x, p.y - z.spawn.y) < (z.safeR || 0) + 3) p = nearestFree(z, z.w / 2, z.h / 3, 6);
    const m = spawnMob(z, bossId, p.x, p.y, opts); m.minionScale = opts.minionScale;
  }
}
function randomOpen(z) {
  for (let i = 0; i < 20; i++) { const x = randi(2, z.w - 3), y = randi(2, z.h - 3); if (!z.solid(x, y) && !GROUND[z.g(x, y)].water && Math.hypot(x - G.me.x, y - G.me.y) > 5) return { x: x + 0.5, y: y + 0.5 }; }
  return null;
}
function updateRespawns(z) {
  const now = Date.now(), me = G.me;
  for (let i = 0; i < z.objs.length; i++) {
    const o = z.objs[i]; if (!o) continue;
    const x = i % z.w, y = (i / z.w) | 0;
    if ((o.k === 'stump' || o.k === 'rubble') && now >= o.at) {
      if (Math.abs(me.x - x - 0.5) < 0.9 && Math.abs(me.y - y - 0.5) < 0.9) continue;
      const n = nodeObj(o.id); if (o.nat) n.nat = 1; z.set(x, y, n); burst(x + 0.5, y + 0.5, '#fff', 6, 1.5, 3, 0);
    } else if (o.k === 'sapling') {
      const tr = NODES[o.tree];
      if (now - o.t0 > (45 + tr.idx * 15) * 1000 && !(Math.abs(me.x - x - 0.5) < 0.9 && Math.abs(me.y - y - 0.5) < 0.9)) { const n = nodeObj(o.tree); n.grown = 1; z.set(x, y, n); burst(x + 0.5, y + 0.5, tr.leaf, 12, 2, 4); }
    }
  }
}

// --------------------------------------------------------------- dungeon
function updateDungeon(z) {
  const me = G.me;
  const room = z.rooms.find(r => me.x > r.x && me.x < r.x + r.w && me.y > r.y && me.y < r.y + r.h);
  z.curRoom = room;
  if (!room || room.spawned) return;
  room.spawned = true;
  const f = z.floor, sc = [1, 3.5, 10][f - 1], ds = [1, 2.2, 4.5][f - 1];
  if (room.boss) {
    const m = spawnMob(z, ZONES[z.base].boss, room.x + room.w / 2, room.y + room.h / 2, { aggro: true, room, xpScale: 1 });
    m.minionScale = sc; m.minionDscale = ds; room.mobs = 1; return;
  }
  const n = 3 + f + randi(0, 3);
  for (let i = 0; i < n; i++) {
    const p = nearestFree(z, room.x + randi(2, room.w - 3) + 0.5, room.y + randi(2, room.h - 3) + 0.5, 3);
    spawnMob(z, ['d_skeleton', 'd_zombie', 'd_mage'][randi(0, 2)], p.x, p.y, { scale: sc, dscale: ds, loot: f, xpScale: f * 1.5, room, aggro: true });
  }
  room.mobs = n;
}
function dungeonMobDown(z, m) {
  const room = m.room; if (!room || m.extra) return;
  room.mobs--;
  if (room.mobs <= 0 && !room.cleared && !room.boss) {
    room.cleared = true;
    const done = z.rooms.filter(r => r.cleared && !r.boss).length - 1;
    UI.toast(`Room cleared! (${done}/${z.run.need})`, '#5dff6a');
    if (Math.random() < 0.5) spawnDrop(z, m.x, m.y, 'dungeon_essence', randi(1, 3) * z.floor);
    if (done >= z.run.need && !z.run.open) {
      z.run.open = true;
      for (const o of z.objs) if (o && o.k === 'door') o.open = true;
      UI.announce('The boss room is open!', '#c38bff', 'Find the iron gate that just swung open.'); SFX.boss();
    }
  }
}
function dungeonBossDown(z, m) {
  const room = m.room || z.curRoom; z.run.done = true;
  const secs = (Date.now() - z.run.start) / 1000;
  const score = clamp(Math.round(100 - z.run.deaths * 15 - Math.max(0, secs - 240) / 6), 20, 100);
  z.run.score = score; z.run.grade = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : 'C';
  const cx = Math.floor(room.x + room.w / 2), cy = Math.floor(room.y + room.h / 2);
  z.set(cx, cy - 1, { k: 'rchest', floor: z.floor });
  z.set(cx, cy + 2, { k: 'portal', to: 'hub', label: 'Exit to SkyHub' });
  G.P.stats.dungeons++;
  gainXP('dungeoneering', [150, 500, 1500][z.floor - 1] * (score / 100) * 2, m.x, m.y);
}
function openRewardChest(z, x, y) {
  const o = z.o(x, y); if (!o || o.opened) return;
  o.opened = true;
  const f = o.floor, sm = z.run.score / 100 + (z.run.grade === 'S' ? 0.3 : 0);
  const got = [];
  for (const [id, ch] of DUNGEON_LOOT[f]) if (Math.random() < ch * sm) got.push([id, id.startsWith('enchanted_') ? randi(1, 3) * f : 1]);
  got.push(['dungeon_essence', randi(4, 10) * f * f]);
  const coins = randi(300, 700) * f * f;
  UI.dungeonReward(z.run, got, coins);
  for (const [id, n] of got) { const d = id === 'ench_book' ? randomBook(1) : null; const left = d ? addItem(id, 1, d) : addItem(id, n); if (left) spawnDrop(z, x + 0.5, y + 0.5, id, left, d); if (ITEMS[id].rar >= 3) UI.rareDrop(id, d); }
  addCoins(coins, x + 0.5, y);
  burst(x + 0.5, y + 0.5, '#ffd23a', 40, 5, 6); SFX.hatch();
}

// ---------------------------------------------------------------- fishing
function fishClick() {
  const me = G.me, z = G.zone, t = heldTool();
  if (!me.fish) {
    const tx = Math.floor(G.mouse.wx), ty = Math.floor(G.mouse.wy);
    if (!GROUND[z.g(tx, ty)].water) return warn('Aim at water to cast');
    if (Math.hypot(tx + 0.5 - me.x, ty + 0.5 - me.y) > 8) return warn('Too far to cast');
    me.fish = { x: tx + 0.5, y: ty + 0.5, sx: me.x, sy: me.y, state: 'fly', t: 0 };
    setTimeout(() => { if (G.me.fish) FX.ripple(tx + 0.5, ty + 0.5, true); }, 350);
    me.swing = 1; SFX.shoot(); return;
  }
  if (me.fish.state === 'bite') catchFish();
  else { me.fish = null; }
}
function biteTime() {
  const t = heldTool(), e = heldEnch();
  return rand(2.5, 7) * (1 - (e.lure || 0) * 0.1) * (1 - Math.min(60, G.stats.fishingSpeed) / 120) / (1 + (t.tier - 1) * 0.15);
}
function updateFishing(dt) {
  const me = G.me, f = me.fish; if (!f) return;
  const t = heldTool();
  if (!t || t.kind !== 'rod' || Math.hypot(f.x - me.x, f.y - me.y) > 10) { me.fish = null; return; }
  f.t += dt;
  if (f.state === 'fly' && f.t > 0.35) { f.state = 'wait'; f.t = 0; f.bite = biteTime(); burst(f.x, f.y, '#bfe8ff', 6, 1.5, 3, 3); SFX.splash(); }
  else if (f.state === 'wait' && f.t > f.bite) { f.state = 'bite'; f.t = 0; SFX.bite(); floater(f.x, f.y - 0.5, '!', '#ff4a4a', 0.9, { life: 0.8, max: 0.8 }); burst(f.x, f.y, '#fff', 10, 2, 3, 4); }
  else if (f.state === 'bite' && f.t > 1.1) { f.state = 'wait'; f.t = 0; f.bite = biteTime(); floater(f.x, f.y - 0.4, 'It got away…', '#aaa', 0.4); }
}
function catchFish() {
  const me = G.me, f = me.fish, z = G.zone, fl = lvl('fishing'), t = heldTool();
  me.fish = null; me.swing = 1; SFX.splash(); FX.ripple(f.x, f.y, true); FX.ripple(f.x, f.y, false);
  const atoll = z.base === 'fishing1', fs = fullSet(), sea = (0.05 + fl * 0.003) * (fs && (fs.id === 'angler' || fs.id === 'coral') ? 2 : 1) * (atoll ? 1.5 : 1);
  if (Math.random() < sea && z.def.cat !== 'hub') {
    let type = 'squid';
    if (atoll && fl >= 12 && Math.random() < 0.04 && !z.mobs.some(m => !m.dead && m.def.boss)) type = 'kraken';
    else if (fl >= 18 && Math.random() < 0.15) type = 'leviathan'; else if (fl >= 8 && Math.random() < 0.5) type = 'sea_guardian';
    const p = nearestFree(z, (f.x + me.x) / 2, (f.y + me.y) / 2, 4);
    const m = spawnMob(z, type, p.x, p.y, { aggro: true });
    if (!m.def.boss) UI.toast(`A ${m.def.name} rises from the water!`, '#3fc3ff');
    return;
  }
  const treasure = (3 + G.stats.treasure) / 100;
  let item, n = 1, xp;
  if (Math.random() < treasure) {
    const r = Math.random();
    if (r < 0.05) item = 'ench_book'; else if (r < 0.06) item = 'egg_common'; else if (r < 0.2 && fl >= 10) item = 'pearl'; else if (r < 0.45) item = 'sponge'; else { const c = Math.round(rand(40, 250) * (1 + fl / 8)); addCoins(c, me.x, me.y); UI.toast(`Treasure! You fished up ${fmt(c)} coins`, '#ffd23a'); gainXP('fishing', 25, me.x, me.y); return; }
    xp = 25; UI.toast('Treasure catch!', '#ffd23a');
  } else {
    const pool = [['raw_cod', atoll ? 30 : 60], ['raw_salmon', fl >= 2 ? 26 : 0], ['pufferfish', fl >= 5 ? 12 : 0], ['shrimp', (fl >= 10 || t.tier >= 3) ? 6 : 0], ['prismarine', fl >= 6 ? 4 : 0], ['coral_snapper', atoll ? 30 : 0], ['glowfish', atoll && fl >= 12 ? 5 : 0]];
    item = pickW(pool.filter(p => p[1] > 0), Math.random);
    xp = { raw_cod: 6, raw_salmon: 10, pufferfish: 15, shrimp: 22, prismarine: 18, coral_snapper: 26, glowfish: 60 }[item];
    bountyProgress('fish', item, n);
    if (Math.random() < G.stats.fishingSpeed / 400 + (heldEnch().magnet || 0) * 0.1) n = 2;
  }
  const d = item === 'ench_book' ? randomBook(0) : null;
  z.drops.push({ id: item, n, d, x: f.x, y: f.y, h: 0.5, vh: 6, vx: (me.x - f.x) * 1.2, vy: (me.y - f.y) * 1.2, t: 0, coll: true });
  gainXP('fishing', xp, f.x, f.y);
  G.P.stats.fish++; questCheck();
}

// ------------------------------------------------------------ automation
function bufCount(o) { let n = 0; for (const k in o.buf) n += o.buf[k]; return n; }
function inqCount(o) { let n = 0; for (const k in o.inq) n += o.inq[k]; return n; }
function machAccepts(o, id) {
  if (!o || o.k !== 'mach') return false;
  const M = MACHINES[o.id], it = ITEMS[id]; if (M.kind !== 'process' || !it) return false;
  if (inqCount(o) >= 64 * o.tier) return false;
  switch (o.id) {
    case 'auto_furnace': return !!it.smelt;
    case 'compactor': return !!it.compact;
    case 'auto_seller': return !it.unique;
    case 'washer': return !!it.greasyOf;
    case 'assembler': {
      const r = RECIPES[o.recipe]; if (!r) return false;
      const ing = r.in.find(([t]) => matchTag(id, t)); if (!ing) return false;
      return inqMatching(o, ing[0]) < ing[1] * 4;
    }
  }
  return false;
}
function inqMatching(o, tag) { let n = 0; for (const k in o.inq) if (matchTag(k, tag)) n += o.inq[k]; return n; }
function chestAdd(o, id, n) {
  for (const s of o.inv) if (s && s.id === id && !s.d && s.n < 999) { const a = Math.min(n, 999 - s.n); s.n += a; n -= a; if (!n) return 0; }
  for (let k = 0; k < o.inv.length && n > 0; k++) if (!o.inv[k]) { o.inv[k] = { id, n: Math.min(n, 999) }; n -= Math.min(n, 999); }
  return n;
}
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
// push one item into the tile at (tx,ty), travelling in direction fromDir
function insertInto(z, tx, ty, id, fromDir) {
  const t = z.o(tx, ty); if (!t) return false;
  if (t.k === 'conv') { if ((t.dir + 2) % 4 === fromDir) return false; if (t.items.length >= 3 || t.items.some(i => i.p < 0.34)) return false; t.items.push({ id, p: 0 }); return true; }
  if (t.k === 'sort') { if (t.item || (t.dir + 2) % 4 === fromDir) return false; t.item = { id, p: 0 }; return true; }
  if (t.k === 'block' && t.inv) return chestAdd(t, id, 1) === 0;
  if (machAccepts(t, id)) { t.inq[id] = (t.inq[id] || 0) + 1; return true; }
  return false;
}
// a placed furnace smelts on its own, timestamp-based so it also catches up after you've been away
function furnaceTick(o, now) {
  const f = o.fz || (o.fz = { inp: null, fuel: null, out: null, burn: 0, prog: 0, last: now });
  let dt = Math.min(8 * 3600, (now - f.last) / 1000); f.last = now; f.active = false;
  for (let guard = 0; guard < 4000 && dt > 0 && f.inp; guard++) {
    const outId = ITEMS[f.inp.id].smelt; if (!outId) break;
    if (f.out && (f.out.id !== outId || f.out.n >= 999)) break;
    if (f.burn < 1e-6) { f.burn = 0; if (f.fuel) { f.burn = fuelValue(f.fuel.id); if (--f.fuel.n <= 0) f.fuel = null; } else break; }
    const t = smeltTime(f.inp.id), step = Math.min(dt, (1 - f.prog) * t, f.burn * t);
    f.prog += step / t; f.burn -= step / t; dt -= step; f.active = true;
    if (f.prog >= 0.9999) { f.prog = 0; if (--f.inp.n <= 0) f.inp = null; f.out = { id: outId, n: (f.out ? f.out.n : 0) + 1 }; }
  }
  if (!f.inp) f.prog = 0;
}
// sorter: matching items go straight, the rest left/right; with no filter it splits three ways
function sorterOuts(o, id) {
  const fwd = o.dir, right = (o.dir + 1) % 4, left = (o.dir + 3) % 4;
  o.rr = (o.rr || 0) + 1;
  if (o.filter) return id === o.filter || (o.filter === '#greasy' && ITEMS[id].greasyOf) ? [fwd] : o.rr % 2 ? [right, left] : [left, right];
  const order = [fwd, right, left], s = o.rr % 3;
  return [order[s], order[(s + 1) % 3], order[(s + 2) % 3]];
}
function nearWater(z, x, y) { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (GROUND[z.g(x + i, y + j)].water) return true; return false; }
function gatherSource(M, res) { return M.res === 'mob' ? MOBS[res] : M.res === 'fish' ? (FISH_RES[res] != null ? { drops: [[res, 1, 1, 1]] } : null) : NODES[res]; }
function updateAutomation(z, dt) {
  const now = Date.now();
  for (const i of z.auto) {
    const o = z.objs[i]; if (!o) continue;
    const x = i % z.w, y = (i / z.w) | 0;
    if (o.k === 'block') { if (o.id === 'furnace') furnaceTick(o, now); continue; }
    if (o.k === 'conv') {
      o.items.sort((a, b) => b.p - a.p);
      const spd = o.fast ? 3.2 : 1.6;
      for (let k = 0; k < o.items.length; k++) { const it = o.items[k]; const lim = k === 0 ? 1 : o.items[k - 1].p - 0.34; it.p = Math.min(it.p + spd * dt, lim); }
      const f = o.items[0];
      if (f && f.p >= 1) {
        // produce riding the belts can get greasy (once per tile)
        if (!f.rolled) { f.rolled = 1; const gr = ITEMS[f.id].greasy; if (gr && Math.random() < 0.05) f.id = gr; }
        const [dx, dy] = DIRS[o.dir]; if (insertInto(z, x + dx, y + dy, f.id, o.dir)) o.items.shift();
      }
      continue;
    }
    if (o.k === 'sort') {
      const it = o.item; if (!it) continue;
      it.p = Math.min(1, it.p + 2.4 * dt);
      if (it.p >= 1) for (const d of sorterOuts(o, it.id)) { const [dx, dy] = DIRS[d]; if (insertInto(z, x + dx, y + dy, it.id, d)) { o.item = null; break; } }
      continue;
    }
    const M = MACHINES[o.id]; if (!M) continue;
    if (M.kind === 'gather') {
      if (!o.res) continue;
      const per = machinePeriod(o.id, o.tier) * 1000, cap = machineCap(o.tier);
      let n = Math.floor((now - o.last) / per);
      if (n > 0) {
        o.last += n * per; n = Math.min(n, 3000);
        o.noWater = M.res === 'fish' && !nearWater(z, x, y);
        const src = gatherSource(M, o.res);
        for (let k = 0; k < n && src && !o.noWater && bufCount(o) < cap; k++) {
          const drops = M.res === 'mob' ? rollDrops(src.drops, 0) : rollDrops(src.drops.slice(0, 1), 0);
          for (const [id, c] of drops) o.buf[id] = (o.buf[id] || 0) + c;
        }
        if (bufCount(o) >= cap) o.last = now;
        o.anim = 1;
      }
    } else {
      o.pt += dt;
      const per = machinePeriod(o.id, o.tier);
      if (o.pt >= per && inqCount(o) > 0 && bufCount(o) < 64 * o.tier) {
        o.pt = 0;
        const first = pred => Object.keys(o.inq).find(k => o.inq[k] > 0 && pred(k));
        if (o.id === 'auto_furnace') { const id = first(k => ITEMS[k].smelt); if (id) { dec(o.inq, id, 1); const s = ITEMS[id].smelt; o.buf[s] = (o.buf[s] || 0) + 1; o.anim = 1; } }
        else if (o.id === 'compactor') { const id = Object.keys(o.inq).find(k => o.inq[k] >= 32); if (id) { dec(o.inq, id, 32); const c = ITEMS[id].compact; o.buf[c] = (o.buf[c] || 0) + 1; o.anim = 1; } }
        else if (o.id === 'washer') { const id = first(k => ITEMS[k].greasyOf); if (id) { dec(o.inq, id, 1); const c = ITEMS[id].greasyOf; o.buf[c] = (o.buf[c] || 0) + 1; o.anim = 1; } }
        else if (o.id === 'assembler') {
          const r = RECIPES[o.recipe];
          if (r && r.in.every(([t, n]) => inqMatching(o, t) >= n)) {
            for (const [t, n] of r.in) { let left = n; for (const k of Object.keys(o.inq)) { if (!left) break; if (!matchTag(k, t)) continue; const a = Math.min(left, o.inq[k]); dec(o.inq, k, a); left -= a; } }
            o.buf[r.out] = (o.buf[r.out] || 0) + r.n; o.anim = 1;
          }
        }
        else if (o.id === 'auto_seller') {
          const id = first(() => true); dec(o.inq, id, 1);
          const v = Math.max(1, Math.round(ITEMS[id].price * (0.6 + o.tier * 0.06)));
          o.earned = (o.earned || 0) + v;
          if (z.key === homeKey() || !z.remote) { G.P.coins += v; G.P.stats.earned += v; if (G.zone === z && Math.random() < 0.25) floater(x + 0.5, y, '+' + v, '#ffd23a', 0.35); }
          o.anim = 1;
        }
      }
    }
    o.ot = (o.ot || 0) - dt;
    if (o.ot <= 0 && bufCount(o) > 0) {
      o.ot = 0.22; o.rr = ((o.rr || 0) + 1) % 4;
      const id = Object.keys(o.buf).find(k => o.buf[k] > 0);
      for (let k = 0; k < 4; k++) {
        const dIdx = (o.rr + k) % 4, [dx, dy] = DIRS[dIdx];
        const t = z.o(x + dx, y + dy); if (!t) continue;
        if ((t.k === 'conv' || t.k === 'sort') && (t.dir + 2) % 4 === dIdx) continue;
        if (t.k === 'mach' && t === o) continue;
        if (insertInto(z, x + dx, y + dy, id, dIdx)) { dec(o.buf, id, 1); break; }
      }
    }
  }
}
function dec(map, id, n) { map[id] -= n; if (map[id] <= 0) delete map[id]; }

// ------------------------------------------------------------- pets
function hatchEgg(slot) {
  const s = G.P.inv[slot]; if (!s || !ITEMS[s.id].egg) return;
  const e = EGGS[s.id];
  const pid = e.pool[randi(0, e.pool.length - 1)];
  let r = Math.random() * 100, rar = 0;
  for (let k = 0; k < e.rolls.length; k++) { if ((r -= e.rolls[k]) <= 0) { rar = k; break; } }
  s.n--; if (s.n <= 0) G.P.inv[slot] = null; G.invDirty = true;
  const pet = { id: pid, rar, lvl: 1, xp: 0, uid: rid() };
  G.P.pets.push(pet);
  if (G.P.petActive < 0) G.P.petActive = G.P.pets.length - 1;
  UI.hatch(s.id, pet);
  questCheck();
}

// ------------------------------------------------------------- quests
const findObj = pred => { const z = G.zone, me = G.me; let best = null, bd = 1e9; z.objs.forEach((o, i) => { if (o && pred(o)) { const x = i % z.w + 0.5, y = Math.floor(i / z.w) + 0.5, d = Math.hypot(x - me.x, y - me.y); if (d < bd) { bd = d; best = { x, y }; } } }); return best; };
const onHome = () => G.zone && G.zone.isHome && !G.zone.remote;
const TUTORIAL = [
  { t: 'Walk around with <b>W A S D</b>', c: () => G.me.walked > 4,
    say: ['Ahoy, new islander! I\'m Gale. This floating rock is <b>all yours</b>.', 'Try stretching your legs — walk around with <b>W A S D</b>.'] },
  { t: 'Hold <b>left-click</b> on a tree to chop it. Collect 3 logs.', c: () => countItem('#log') >= 3 || G.P.stats.logs >= 3, target: () => onHome() && findObj(o => o.k === 'tree'),
    say: ['See that tree I\'m pointing at? Hold <b>left-click</b> on it.', 'Bare hands are slow — that\'s exactly why we\'ll make tools soon. Grab <b>3 logs</b>.'] },
  { t: 'Press <b>C</b> and craft <b>Planks</b>', c: () => countItem('planks') >= 4 || countItem('workbench') || G.P.flags.benchPlaced,
    say: ['Nice chopping! Every tree you fell gives <b>Foraging XP</b>.', 'Press <b>C</b> to open your pocket crafting grid and turn logs into <b>Planks</b>.'] },
  { t: 'Craft a <b>Workbench</b> (needs 4 planks)', c: () => countItem('workbench') > 0 || G.P.flags.benchPlaced,
    say: ['Four planks make a <b>Workbench</b> — the heart of every island.'] },
  { t: 'Select the Workbench in your hotbar and <b>right-click</b> to place it', c: () => G.P.flags.benchPlaced,
    say: ['Pick the workbench in your hotbar (number keys) and <b>right-click</b> the ground to place it.'] },
  { t: 'Use the workbench (<b>right-click</b> it) and craft a <b>Wooden Pickaxe</b>', c: () => countAny('wood_pickaxe') > 0 || G.P.stats.mined > 0, target: () => onHome() && findObj(o => o.k === 'block' && o.id === 'workbench'),
    say: ['Right-click the workbench for the full 3×3 grid.', 'Recipes you can make right now float to the top. Make <b>Sticks</b>, then a <b>Wooden Pickaxe</b>.'] },
  { t: 'Select the pickaxe and mine a <b>Stone</b>', c: () => G.P.stats.mined > 0, target: () => onHome() && findObj(o => o.k === 'rock'),
    say: ['Rocks only crack for pickaxes. Hold left-click on a <b>Stone</b>.', 'Mining Level 3 unlocks <b>Iron</b>. Iron means better gear!'] },
  { t: 'A portal appeared on your island! Walk into it to visit the <b>SkyHub</b>', c: () => G.zone && G.zone.base === 'hub', target: () => onHome() && findObj(o => o.k === 'portal'),
    say: ['You\'re a natural. I\'ve opened a <b>portal</b> to the SkyHub — the town where islanders trade.', 'Walk into it whenever you\'re ready!'] },
  { t: 'Talk to <b>Merchant Mara</b> (press F next to her) and sell something', c: () => G.P.flags.sold, target: () => G.zone.base === 'hub' && findObj(o => o.k === 'npc' && o.id === 'merchant'),
    say: ['Welcome to the SkyHub! Shops, the Bazaar, the Auction House, portals to every island…', 'Find <b>Merchant Mara</b> and sell her something. Coins make the skies go round.'] },
];
const GOALS = [
  { id: 'f3', t: 'Reach Foraging 3', c: () => lvl('foraging') >= 3, r: 150 },
  { id: 'm3', t: 'Reach Mining 3', c: () => lvl('mining') >= 3, r: 150 },
  { id: 'till', t: 'Till land with a hoe on your island', c: () => G.P.flags.tilled, r: 100 },
  { id: 'crop25', t: 'Harvest 25 crops', c: () => G.P.stats.crops >= 25, r: 250 },
  { id: 'fish5', t: 'Catch 5 things while fishing', c: () => G.P.stats.fish >= 5, r: 250 },
  { id: 'kill25', t: 'Defeat 25 monsters', c: () => G.P.stats.kills >= 25, r: 300 },
  { id: 'mach', t: 'Place your first automation machine', c: () => G.P.flags.machPlaced, r: 500 },
  { id: 'pet', t: 'Hatch a pet', c: () => G.P.pets.length > 0, r: 500 },
  { id: 'enchant', t: 'Enchant a tool or weapon', c: () => G.P.flags.enchanted, r: 400 },
  { id: 'reforge', t: 'Reforge an item', c: () => G.P.flags.reforged, r: 400 },
  { id: 'boss', t: 'Defeat a boss', c: () => G.P.stats.bosses > 0, r: 1500 },
  { id: 'dung', t: 'Clear a dungeon', c: () => G.P.stats.dungeons > 0, r: 2500 },
  { id: 'rich', t: 'Earn 50,000 coins in total', c: () => G.P.stats.earned >= 50000, r: 5000 },
  { id: 'all10', t: 'Reach level 10 in every gathering skill', c: () => ['foraging', 'mining', 'farming', 'fishing'].every(s => lvl(s) >= 10), r: 20000 },
];
let qcPending = false;
function questCheck() {
  if (qcPending || !G.P || !G.me) return; qcPending = true;
  setTimeout(() => {
    qcPending = false; const P = G.P;
    const before = P.tut;
    while (P.tut < TUTORIAL.length && TUTORIAL[P.tut].c()) {
      P.tut++; SFX.craft();
      if (P.tut === 7) { const hz = G.zones[homeKey()]; if (hz) ensureHomePortal(hz); UI.announce('Portal unlocked!', '#7ad8ff', 'A portal to the SkyHub opened on your island.'); }
      if (P.tut === TUTORIAL.length) { addCoins(250); UI.announce('Tutorial complete!', '#5dff6a', 'You earned 250 coins. The skies are yours.'); UI.say('guide', ['That\'s the basics! From here: level your skills, grow your <b>collections</b> to unlock recipes, and automate your island.', 'Press <b>K</b> any time to see your skill roads and what each level unlocks. Good luck, islander!']); }
    }
    if (P.tut !== before && P.tut < TUTORIAL.length && TUTORIAL[P.tut].say) UI.say('guide', TUTORIAL[P.tut].say);
    for (const g of GOALS) if (!P.goals[g.id] && g.c()) { P.goals[g.id] = 1; addCoins(g.r); UI.toast(`★ Goal complete: ${g.t} (+${fmt(g.r)} coins)`, '#ffd23a'); }
    UI.quest();
  }, 50);
}

// ---------------------------------------------------------------- update
// cutscene frames: the world holds still while the camera and effects play
function updateCine(dt) {
  const tgt = FX.camTarget() || G.me;
  G.cam.x += (tgt.x - G.cam.x) * Math.min(1, dt * 6); G.cam.y += (tgt.y - G.cam.y) * Math.min(1, dt * 6);
  for (const p of G.particles) { p.life -= dt; p.vy += (p.grav || 0) * dt; p.x += p.vx * dt / 3; p.y += p.vy * dt / 3; }
  G.particles = G.particles.filter(p => p.life > 0);
  G.shake = Math.max(0, G.shake - dt);
  G.mouse.lEdge = G.mouse.rEdge = false;
}
function update(rawDt) {
  const me = G.me, z = G.zone, P = G.P;
  const dt = FX.step(rawDt); FX.update(rawDt);
  if (FX.frozen()) { updateCine(rawDt); NET.tick(rawDt); return; }
  G.t += dt;
  G.stats = computeStats();
  const maxHp = G.stats.health, maxMana = 100 + G.stats.intelligence;
  me.maxHp = maxHp; me.maxMana = maxMana;
  // movement
  let mx = 0, my = 0; const k = G.keys;
  if (!UI.typing()) { if (k.w || k.arrowup) my--; if (k.s || k.arrowdown) my++; if (k.a || k.arrowleft) mx--; if (k.d || k.arrowright) mx++; }
  const len = Math.hypot(mx, my); if (len) { mx /= len; my /= len; }
  me.mx = mx; me.my = my;
  const spd = 4.3 * G.stats.speed / 100;
  const ox = me.x, oy = me.y;
  if (me.roll) {
    // dodge roll / dash: fast burst with invulnerability, leaves afterimages
    const r = me.roll; r.t -= dt; const k2 = Math.max(0, r.t / r.dur);
    moveEnt(z, me, r.dx * r.spd * (0.35 + k2) * dt, r.dy * r.spd * (0.35 + k2) * dt, 0.28);
    me.iframes = Math.max(me.iframes, 0.06);
    (me.ghosts = me.ghosts || []).push({ x: me.x, y: me.y, life: 0.25 });
    if (r.hit) for (const m of z.mobs) if (!m.dead && !r.hit.has(m.id) && Math.hypot(m.x - me.x, m.y - me.y) < m.r + 1) { r.hit.add(m.id); damageMob(z, m, Math.round(r.dmg * hitMult(m)), r.crit, Math.atan2(r.dy, r.dx)); burst(m.x, m.y, '#fff', 8, 3, 4); }
    if (r.t <= 0) me.roll = null;
  } else moveEnt(z, me, (mx * spd + me.kx) * dt, (my * spd + me.ky) * dt, 0.28);
  if (me.ghosts) { for (const g of me.ghosts) g.life -= dt; me.ghosts = me.ghosts.filter(g => g.life > 0); }
  // jumping
  if (me.z > 0 || me.vz > 0) {
    me.vz -= 26 * dt; me.z = Math.max(0, me.z + me.vz * dt);
    if (me.z <= 0) { me.vz = 0; burst(me.x, me.y + 0.25, '#d8c8a8', 8, 2, 4, 2); SFX.place(); }
  }
  me.jumpCd -= dt; me.rollCd -= dt; me.abCd -= dt;
  me.kx *= Math.pow(0.001, dt); me.ky *= Math.pow(0.001, dt);
  const moved = Math.hypot(me.x - ox, me.y - oy);
  me.walked += moved; me.moving = moved > 0.001; if (me.moving) me.walkT += dt * 9;
  if (me.moving && me.z <= 0 && !me.roll && (me.stepT = (me.stepT || 0) - dt) <= 0) { me.stepT = 0.3; const g = GROUND[z.g(Math.floor(me.x), Math.floor(me.y))]; G.particles.push({ x: me.x + rand(-0.1, 0.1), y: me.y + 0.28, vx: rand(-0.4, 0.4), vy: -0.6, life: 0.45, max: 0.45, col: shade(g.c, 0.25), size: 5, grav: 0 }); }
  me.dir = Math.atan2(G.mouse.wy - me.y, G.mouse.wx - me.x);
  me.cd -= dt; me.swing = Math.max(0, me.swing - dt * 3.5); me.hurtT -= dt; me.iframes -= dt; me.portalCd -= dt;
  // regen
  const ooc = G.t - (me.lastHit || -99) > 4;
  const fsb = fullSet();
  me.hp = Math.min(maxHp, me.hp + maxHp * ((ooc ? 0.025 : 0.006) + (fsb && fsb.id === 'bog' ? 0.02 : 0) + armorEnch('rejuvenate') * 0.003) * dt);
  // tutorial pointer
  const ts = P.tut < TUTORIAL.length && TUTORIAL[P.tut];
  G.tutTarget = ts && ts.target ? ((G.tutT = (G.tutT || 0) - dt) <= 0 ? (G.tutT = 0.5, G.tutCache = ts.target() || null) : G.tutCache) : null;
  me.mana = Math.min(maxMana, me.mana + maxMana * 0.04 * dt);
  // actions
  const mouse = G.mouse;
  if (!mouse.overUI && !me.dead && !me.roll) {
    const t = heldTool();
    if (t && t.kind === 'rod') { if (mouse.lEdge) fishClick(); }
    else if (mouse.l && me.cd <= 0) primaryAction();
    if (mouse.rEdge || (mouse.r && me.cd <= 0 && held() && ITEMS[held().id].plant)) secondaryAction();
  }
  mouse.lEdge = mouse.rEdge = false;
  updateFishing(dt);
  // portals
  const po = z.o(Math.floor(me.x), Math.floor(me.y));
  if (po && po.k === 'portal' && me.portalCd <= 0) { me.portalCd = 1.2; if (!travel(po.to)) { const a = Math.atan2(me.y - Math.floor(me.y) - 0.5, me.x - Math.floor(me.x) - 0.5); me.kx = Math.cos(a) * 8 || 8; me.ky = Math.sin(a) * 8; } }
  // world sim
  updateMobs(z, dt); updateProjs(z, dt); updateTele(z, dt); updateDrops(z, dt);
  if (!z.remote) { updateSpawning(z, dt); z.rsT = (z.rsT || 0) - dt; if (z.rsT <= 0) { z.rsT = 0.5; updateRespawns(z); } }
  if (z.rooms) updateDungeon(z);
  const hz = G.zones[homeKey()]; if (hz) updateAutomation(hz, dt);
  if (z !== hz && z.auto.size && !z.remote) updateAutomation(z, dt);
  // fx
  for (const p of G.particles) { p.life -= dt; p.vy += (p.grav || 0) * dt; p.x += p.vx * dt / 3; p.y += p.vy * dt / 3; }
  G.particles = G.particles.filter(p => p.life > 0);
  if (G.particles.length > 900) G.particles.splice(0, G.particles.length - 900);
  for (const f of G.floaters) { f.life -= dt; f.y += f.vy * dt; f.vy *= Math.pow(0.3, dt); }
  G.floaters = G.floaters.filter(f => f.life > 0);
  for (const o of z.objs) if (o && o.shake) { o.shake = Math.max(0, o.shake - dt * 5); }
  G.shake = Math.max(0, G.shake - dt);
  // camera
  // camera leads slightly toward where you aim
  const lead = 0.6, tx = me.x + Math.cos(me.dir) * lead, ty = me.y + Math.sin(me.dir) * lead * 0.7;
  G.cam.x += (tx - G.cam.x) * Math.min(1, rawDt * 7); G.cam.y += (ty - G.cam.y) * Math.min(1, rawDt * 7);
  // bank interest: 1% per real hour, paid continuously, capped
  if (P.bank > 0) P.bank += P.bank * 0.01 * dt / 3600;
  BZ.tick(dt); AH.tick(dt);
  if (Date.now() - G.lastSave > 20000) saveGame();
  NET.tick(dt);
}
function primaryAction() {
  const me = G.me, z = G.zone, t = heldTool(), hs = held();
  if (hs && ITEMS[hs.id].tool && !usable(hs)) warn(useReqText(hs));
  if (t && t.kind === 'bow') return shootArrow();
  if (t && t.kind === 'wand') return castBolt();
  const tx = Math.floor(G.mouse.wx), ty = Math.floor(G.mouse.wy), o = z.o(tx, ty);
  const dist = Math.hypot(tx + 0.5 - me.x, ty + 0.5 - me.y);
  const mobNear = z.mobs.some(m => !m.dead && Math.hypot(m.x - G.mouse.wx, m.y - G.mouse.wy) < m.r + 0.6 && Math.hypot(m.x - me.x, m.y - me.y) < 2.6);
  if ((t && t.kind === 'sword') || mobNear) return meleeSwing();
  if (o && dist <= REACH && ['tree', 'rock', 'crop', 'block', 'mach', 'conv', 'sort', 'sapling', 'stump', 'rubble'].includes(o.k)) { me.cd = !t ? 0.45 : t.kind === 'drill' ? 0.2 : 0.3; me.swing = 1; hitTile(tx, ty); return; }
  if (t && t.kind === 'hoe' && dist <= REACH && !o) return till(tx, ty);
  meleeSwing();
}
function secondaryAction() {
  const me = G.me, z = G.zone, s = held(), d = s && ITEMS[s.id];
  const tx = Math.floor(G.mouse.wx), ty = Math.floor(G.mouse.wy), o = z.o(tx, ty);
  const dist = Math.hypot(tx + 0.5 - me.x, ty + 0.5 - me.y);
  if (o && dist <= REACH + 0.6 && interactObj(o, tx, ty)) return;
  if (d && d.tool && ['sword', 'bow', 'wand'].includes(d.tool.kind) && heldTool()) return weaponAbility(heldTool());
  if (d && (d.food || d.mana)) return eat();
  if (d && d.egg) return hatchEgg(G.sel);
  if (d && d.armor) return equipArmor(G.sel);
  if (d && d.tool && d.tool.fuel) return refuel(s);
  if (d && (d.place || d.plant) && dist <= REACH) return tryPlace(tx, ty);
}
function drillCap(s) { return ITEMS[s.id].tool.fuel * Math.pow(2, s.d.tank || 0); }
function refuel(s) {
  const cap = drillCap(s), FUELS = [['enchanted_coal', 1600], ['coal', 50], ['charcoal', 50]];
  let added = 0;
  for (const [id, v] of FUELS) while (s.d.fuel + v <= cap + v * 0.5 && countItem(id) > 0 && s.d.fuel < cap) { removeItem(id, 1); s.d.fuel = Math.min(cap, s.d.fuel + v); added += v; }
  if (added) { UI.toast(`⛽ Refueled ${esc(instName(s))}: ${fmt(s.d.fuel)} / ${fmt(cap)}`, '#ffb020'); SFX.craft(); }
  else warn(s.d.fuel >= cap ? 'Fuel tank is full' : 'You need Coal or Charcoal to refuel');
  G.me.cd = 0.3;
}
function interactObj(o, x, y) {
  const z = G.zone;
  if (o.k === 'npc') { UI.openNpc(o.id); return true; }
  if (o.k === 'mach') { UI.openMachine(z, z.idx(x, y)); return true; }
  if (o.k === 'sort') { UI.openSorter(z, z.idx(x, y)); return true; }
  if (o.k === 'rchest') { openRewardChest(z, x, y); return true; }
  if (o.k === 'block') {
    const p = ITEMS[o.id].place;
    if (p.chest) { UI.openChest(z, z.idx(x, y)); return true; }
    if (p.station === 'bench') { UI.openCraft(); return true; }
    if (p.station === 'furnace') { if (z.remote) { warn('Only the island owner can use furnaces here'); return true; } UI.openFurnace(z, z.idx(x, y)); return true; }
    if (p.station === 'enchant') { UI.openEnchant(); return true; }
    if (p.station === 'anvil') { UI.openReforge(); return true; }
  }
  if (o.k === 'door' && !o.open) { warn(`Clear more rooms to open this gate (${Math.max(0, z.rooms.filter(r => r.cleared && !r.boss).length - 1)}/${z.run.need})`); return true; }
  return false;
}
function interactNearest() {
  const z = G.zone, me = G.me; let best = null, bd = 2.3;
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
    const x = Math.floor(me.x) + i, y = Math.floor(me.y) + j, o = z.o(x, y); if (!o) continue;
    if (!['npc', 'mach', 'rchest', 'block'].includes(o.k)) continue;
    if (o.k === 'block' && !(ITEMS[o.id].place.chest || ITEMS[o.id].place.station)) continue;
    const d = Math.hypot(x + 0.5 - me.x, y + 0.5 - me.y); if (d < bd) { bd = d; best = [o, x, y]; }
  }
  if (best) interactObj(best[0], best[1], best[2]);
}
function eat() {
  const s = held(), d = ITEMS[s.id], me = G.me;
  if (d.food) { if (me.hp >= me.maxHp - 0.5 && d.food < 9999) return warn('Already at full health'); me.hp = Math.min(me.maxHp, me.hp + d.food); burst(me.x, me.y, '#ff6a6a', 10, 2, 4); }
  if (d.mana) { me.mana = me.maxMana; burst(me.x, me.y, '#6fd8ff', 10, 2, 4); }
  consumeHeld(); SFX.pop(); me.cd = 0.3;
}
function updateDrops(z, dt) {
  const me = G.me;
  for (const d of z.drops) {
    d.t += dt;
    if (d.h > 0 || d.vh > 0) { d.vh -= 18 * dt; d.h += d.vh * dt; if (d.h <= 0) { d.h = 0; d.vh = d.vh < -2 ? -d.vh * 0.35 : 0; d.vx *= 0.5; d.vy *= 0.5; } }
    const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
    if (!z.solid(Math.floor(nx), Math.floor(ny))) { d.x = nx; d.y = ny; } else { d.vx = d.vy = 0; }
    d.vx *= Math.pow(0.1, dt); d.vy *= Math.pow(0.1, dt);
    const dist = Math.hypot(me.x - d.x, me.y - d.y);
    // generous magnet: items within ~3 tiles fly to you, and you grab them from almost a tile away
    if (d.t > 0.25 && dist < 3.2 && !me.dead && (freeSlots() > 0 || canStack(d.id))) {
      const a = Math.atan2(me.y - d.y, me.x - d.x), sp = 6 + (3.2 - dist) * 5;
      d.vx = Math.cos(a) * sp; d.vy = Math.sin(a) * sp; d.mag = 1;
      if (dist < 0.85) { const want = d.n, left = d.d ? addItem(d.id, 1, d.d) : addItem(d.id, d.n); if (d.coll) addColl(d.id, want - left); SFX.pickup(); if (left) d.n = left; else d.gone = 1; }
    }
    if (d.t > 180) d.gone = 1;
  }
  z.drops = z.drops.filter(d => !d.gone);
}
function canStack(id) { return !ITEMS[id].unique && G.P.inv.some(s => s && s.id === id && !s.d && s.n < 999); }

// ------------------------------------------------------------ start game
function startGame(P) {
  G.P = migrate(P);
  G.zones = {}; G.particles = []; G.floaters = [];
  BZ.load(P.bz); AH.load(P.ah);
  SFX.enabled = P.sound !== false;
  G.me = { z: 0, vz: 0, jumpCd: 0, rollCd: 0, abCd: 0, abMax: 1, x: 0, y: 0, dir: 0, hp: 100, mana: 100, maxHp: 100, maxMana: 100, cd: 0, swing: 0, walkT: 0, walked: 0, kx: 0, ky: 0, hurtT: 0, iframes: 0, portalCd: 0, fish: null };
  const hz = getZone(homeKey());
  if (P.lastSeen && Date.now() - P.lastSeen > 60000) {
    const mins = Math.floor((Date.now() - P.lastSeen) / 60000);
    setTimeout(() => UI.toast(`Welcome back! Your machines kept working for ${mins >= 60 ? Math.floor(mins / 60) + 'h ' : ''}${mins % 60}m while you were away.`, '#7ad8ff'), 1500);
  }
  enterZone(hz, null);
  G.stats = computeStats(); G.me.hp = G.stats.health; G.me.mana = 100 + G.stats.intelligence;
  G.invDirty = true; G.running = true; bounties();
  UI.startHud(); questCheck(); saveGame();
  let introDelay = 900;
  if (G.P.tut === 0 && !G.P.flags.intro) { G.P.flags.intro = 1; FX.intro(); introDelay = 5600; }
  if (G.P.tut === 0) setTimeout(() => { if (G.P && G.P.tut === 0) UI.say('guide', TUTORIAL[0].say); }, introDelay);
}

// ----------------------------------------------------------- bounties
// three fresh tasks every real-time hour, chosen from what you've unlocked
function bountyHour() { return Math.floor(Date.now() / 3600000); }
function bountyText(b) { return b.type === 'kill' ? `Defeat ${b.n} ${MOBS[b.target].name}` : b.type === 'fish' ? `Catch ${b.n} fish` : `Gather ${b.n} ${ITEMS[b.target].name}`; }
function genBounties() {
  const rnd = mulberry(hashStr(G.P.uid) + bountyHour()), pick = a => a[Math.floor(rnd() * a.length)], ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const kill = ['zombie', 'slime'];
  for (const k of ['combat1', 'combat2', 'combat3', 'combat4']) if (!zoneReq(k)) ZONES[k].mobs.forEach(([m]) => kill.push(m));
  const gather = [...COLLECTION].filter(id => { const n = Object.values(NODES).find(nd => nd.item === id); return n && lvl(n.skill) >= n.lvl; });
  const out = [], used = new Set();
  const add = b => { if (!used.has(b.target)) { used.add(b.target); out.push(Object.assign(b, { prog: 0, done: false, claimed: false })); } };
  const km = pick(kill), kn = ri(8, 18); add({ type: 'kill', target: km, n: kn, coins: Math.round(kn * (MOBS[km].coins[1] * 3 + MOBS[km].xp * 2) + 150), skill: 'combat', xp: kn * MOBS[km].xp });
  for (let i = 0; i < 6 && out.length < 3; i++) {
    if (out.length === 2 && rnd() < 0.4) { const n = ri(8, 20); add({ type: 'fish', target: 'any', n, coins: n * 45 + 150, skill: 'fishing', xp: n * 12 }); continue; }
    const g = pick(gather), n = Math.max(16, Math.round(ri(80, 260) / Math.sqrt(1 + ITEMS[g].price / 4)));
    const node = Object.values(NODES).find(nd => nd.item === g);
    add({ type: 'gather', target: g, n, coins: Math.round(n * ITEMS[g].price * 3 + 150), skill: node.skill, xp: n * node.xp * 0.3 });
  }
  return out;
}
function bounties() { const P = G.P; if (!P.bounty || P.bounty.hour !== bountyHour()) P.bounty = { hour: bountyHour(), list: genBounties() }; return P.bounty.list; }
function bountyProgress(type, target, n = 1) {
  questProgress(type, target, n);
  if (!G.P || !G.P.bounty) return;
  for (const b of G.P.bounty.list) {
    if (b.done || b.type !== type || (b.target !== 'any' && b.target !== target)) continue;
    b.prog = Math.min(b.n, b.prog + n);
    if (b.prog >= b.n) { b.done = true; UI.toast(`📜 Bounty complete: ${esc(bountyText(b))}! Claim it at the Bounty Board.`, '#ffd23a'); SFX.level(); }
  }
}
function claimBounty(k) {
  const b = G.P.bounty.list[k]; if (!b || !b.done || b.claimed) return;
  b.claimed = true; addCoins(b.coins, G.me.x, G.me.y); gainXP(b.skill, Math.round(b.xp), G.me.x, G.me.y);
  if (Math.random() < 0.1) { addItem('egg_common', 1); UI.toast('Bonus reward: a Pet Egg!', '#ffd23a'); }
}
// ------------------------------------------------------ enchant helpers
function hitMult(m) {
  const e = heldEnch(); let k = 1;
  if (e.first_strike && m.hp >= m.mhp) k *= 1 + e.first_strike * 0.25;
  if (e.giant_killer && m.def.boss) k *= 1 + e.giant_killer * 0.06;
  return k;
}
function armorEnch(id) { let n = 0; for (const sl of ARMOR_SLOTS) { const a = G.P.armor[sl]; if (a && a.d && a.d.ench && usable(a)) n += a.d.ench[id] || 0; } return n; }

// --------------------------------------------------------------- quests
function qState(id) { const P = G.P; P.quests = P.quests || {}; return P.quests[id] || (P.quests[id] = { i: 0, active: false, prog: 0, rep: 0 }); }
// the quest this giver offers now (story first, then the repeatable job), or null while on cooldown
function qCurrent(id) {
  const g = QUESTGIVERS[id], st = qState(id);
  if (st.i < g.q.length) return { q: g.q[st.i], repeat: false };
  if (st.active || Date.now() >= st.rep) return { q: g.rep, repeat: true };
  return null;
}
function qDone(id) {
  const st = qState(id), cur = qCurrent(id); if (!cur || !st.active) return false;
  const [type, target, n] = cur.q;
  if (type === 'level') return lvl(target) >= n;
  if (type === 'deliver') return countItem(target) >= n;
  return st.prog >= n;
}
function qProgText(id) {
  const st = qState(id), cur = qCurrent(id); if (!cur) return '';
  const [type, target, n] = cur.q;
  const have = type === 'level' ? lvl(target) : type === 'deliver' ? countItem(target) : st.prog;
  return `${fmt(Math.min(have, n))} / ${fmt(n)}`;
}
function qTitle(q) {
  const [type, target, n] = q;
  const nm = t => (ITEMS[t] && ITEMS[t].name) || (MOBS[t] && MOBS[t].name) || (ZONES[t] && ZONES[t].name) || (SKILLS[t] && SKILLS[t].name) || t;
  return { kill: `Defeat ${n} ${nm(target)}`, gather: `Gather ${n} ${nm(target)}`, fish: `Catch ${n} fish`, craft: `Craft ${n > 1 ? n + ' ' : 'a '}${nm(target)}`, level: `Reach ${nm(target)} ${n}`, visit: `Travel to ${nm(target)}`, deliver: `Bring ${n} ${nm(target)}` }[type];
}
function qMark(id) {
  if (!QUESTGIVERS[id]) return null;
  const st = qState(id), cur = qCurrent(id);
  if (!cur) return null;
  if (st.active) return qDone(id) ? '?' : '…';
  return '!';
}
function acceptQuest(id) {
  const st = qState(id); st.active = true; st.prog = 0;
  const cur = qCurrent(id); if (cur && cur.q[0] === 'visit' && G.zone.base === cur.q[1]) st.prog = 1;
  SFX.craft(); UI.toast(`📜 Quest accepted: <b>${esc(qTitle(cur.q))}</b>`, '#ffd23a'); questCheck();
}
function turnInQuest(id) {
  const g = QUESTGIVERS[id], st = qState(id), cur = qCurrent(id);
  if (!cur || !qDone(id)) return false;
  const [type, target, n, , rw] = cur.q;
  if (type === 'deliver' && !removeItem(target, n)) return false;
  if (rw.c) addCoins(rw.c, G.me.x, G.me.y);
  if (rw.x) gainXP(rw.x[0], rw.x[1], G.me.x, G.me.y);
  for (const [iid, c] of (rw.i || [])) { const left = addItem(iid, c); if (left) spawnDrop(G.zone, G.me.x, G.me.y, iid, left); if (ITEMS[iid].rar >= 2) UI.rareDrop(iid); }
  st.active = false; st.prog = 0;
  if (cur.repeat) st.rep = Date.now() + g.cd * 60000; else st.i++;
  G.P.stats.quests = (G.P.stats.quests || 0) + 1;
  SFX.level(); burst(G.me.x, G.me.y - 0.5, '#ffd23a', 30, 4, 5);
  UI.announce('Quest complete!', '#ffd23a', esc(qTitle(cur.q)));
  questCheck(); return true;
}
function questProgress(type, target, n = 1) {
  if (!G.P || !G.P.quests) return;
  for (const id in QUESTGIVERS) {
    const st = G.P.quests[id]; if (!st || !st.active) continue;
    const cur = qCurrent(id); if (!cur) continue;
    const [qt, tg, need] = cur.q;
    if (qt !== type || (tg !== 'any' && tg !== target) || st.prog >= need) continue;
    st.prog = Math.min(need, st.prog + n);
    if (st.prog >= need) { UI.toast(`✔ <b>${esc(qTitle(cur.q))}</b> done! Return to ${esc(QUESTGIVERS[id].name)}.`, '#5dff6a'); SFX.pop(); }
  }
}
function activeQuests() { const out = []; for (const id in QUESTGIVERS) { const st = G.P.quests && G.P.quests[id]; if (st && st.active) { const cur = qCurrent(id); if (cur) out.push({ id, q: cur.q, done: qDone(id) }); } } return out; }

// --------------------------------------------------------- black market
// stock rotates every 20 minutes and is the same for everyone; sometimes Silas isn't around
const BM_WINDOW = 20 * 60000;
function bmStock() {
  const win = Math.floor(Date.now() / BM_WINDOW), rnd = mulberry(win * 7919 + 13);
  if (rnd() < 0.25) return { win, closed: true, offers: [] };
  const pool = BLACK_MARKET.slice(), offers = [];
  for (let k = 0; k < 4 && pool.length; k++) {
    const total = pool.reduce((a, p) => a + p[3], 0); let r = rnd() * total, idx = 0;
    for (; idx < pool.length; idx++) { if ((r -= pool[idx][3]) <= 0) break; }
    const [id, lo, hi] = pool.splice(Math.min(idx, pool.length - 1), 1)[0];
    offers.push({ id, price: Math.round((lo + rnd() * (hi - lo)) / 50) * 50, qty: ITEMS[id].unique ? 1 : 1 + Math.floor(rnd() * 3) });
  }
  return { win, closed: false, offers };
}
function bmBought(win, id) { const b = G.P.bm; return b && b.win === win ? (b.bought[id] || 0) : 0; }
function bmBuy(id) {
  const s = bmStock(), o = s.offers.find(x => x.id === id); if (!o) return 'Sold out';
  if (bmBought(s.win, id) >= o.qty) return 'Sold out';
  if (G.P.coins < o.price) return 'Not enough coins';
  if (freeSlots() < 1 && !canStack(id)) return 'Inventory full';
  G.P.coins -= o.price; addItem(id, 1);
  if (!G.P.bm || G.P.bm.win !== s.win) G.P.bm = { win: s.win, bought: {} };
  G.P.bm.bought[id] = (G.P.bm.bought[id] || 0) + 1; SFX.coin(); return null;
}
// -------------------------------------------------------- moves & abilities
function doJump() {
  const me = G.me; if (!me || me.dead || me.z > 0 || me.jumpCd > 0 || me.roll || FX.frozen()) return;
  me.vz = 7.6; me.jumpCd = 0.2; SFX.pop(); burst(me.x, me.y + 0.25, '#d8c8a8', 6, 1.5, 3, 2);
}
function doRoll() {
  const me = G.me; if (!me || me.dead || me.roll || me.rollCd > 0 || FX.frozen()) return;
  let dx = me.mx || 0, dy = me.my || 0;
  if (!dx && !dy) { dx = Math.cos(me.dir); dy = Math.sin(me.dir); }
  me.roll = { t: 0.32, dur: 0.32, dx, dy, spd: 13 }; me.rollCd = 0.9; me.iframes = 0.36; me.fish = null;
  SFX.shoot(); burst(me.x, me.y + 0.2, '#e8e0d0', 10, 2, 4, 2);
}
const ABILITY = {
  sword: { name: 'Dash Strike', cd: 4, icon: '⚔️', desc: 'Dash forward and slash everything in your path' },
  bow: { name: 'Arrow Volley', cd: 5, icon: '🏹', desc: 'Fire a fan of seven arrows' },
  wand: { name: 'Arcane Nova', cd: 6, icon: '✨', desc: 'Blast every foe around you (costs mana)' },
};
function weaponAbility(t) {
  const me = G.me, z = G.zone, A = ABILITY[t.kind]; if (!A) return;
  if (me.abCd > 0) return warn(`${A.name} ready in ${me.abCd.toFixed(1)}s`);
  if (t.kind === 'sword') {
    const { dmg, crit } = calcDamage('melee', t.dmg);
    me.roll = { t: 0.26, dur: 0.26, dx: Math.cos(me.dir), dy: Math.sin(me.dir), spd: 17, hit: new Set(), dmg: dmg * 2, crit };
    me.iframes = 0.3; me.swing = 1; FX.punch = 0.6; SFX.crit();
  } else if (t.kind === 'bow') {
    const { dmg, crit } = calcDamage('bow', t.dmg);
    for (let i = -3; i <= 3; i++) { const a = me.dir + i * 0.12; z.projs.push({ x: me.x + Math.cos(a) * 0.5, y: me.y + Math.sin(a) * 0.5, vx: Math.cos(a) * 16, vy: Math.sin(a) * 16, from: 'p', dmg: Math.round(dmg * 0.8), crit, r: 0.18, life: 1.1, kind: 'arrow', col: '#eee' }); }
    me.swing = 0.8; SFX.shoot(); SFX.shoot();
  } else if (t.kind === 'wand') {
    const cost = Math.round(Math.max(40, me.maxMana * 0.35) * (1 - Math.min(80, G.stats.manaSave) / 100));
    if (me.mana < cost) return warn('Not enough mana for Arcane Nova');
    me.mana -= cost;
    const { dmg } = calcDamage('wand', t.dmg), col = ITEMS[held().id].icon.c;
    for (const m of z.mobs) { if (m.dead) continue; const d = Math.hypot(m.x - me.x, m.y - me.y); if (d < 4 + m.r) { damageMob(z, m, Math.round(dmg * 2.5 * hitMult(m)), false, Math.atan2(m.y - me.y, m.x - me.x)); m.kx *= 2; m.ky *= 2; } }
    FX.ring(me.x, me.y, 4, col); FX.ring(me.x, me.y, 2.5, '#fff'); FX.flash = 0.25; FX.flashCol = col; G.shake = Math.max(G.shake, 0.3);
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; G.particles.push({ x: me.x, y: me.y - 0.3, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, life: 0.5, max: 0.5, col, size: 5, grav: 0 }); }
    SFX.zap(); SFX.boss();
  }
  me.abCd = A.cd; me.abMax = A.cd;
}
