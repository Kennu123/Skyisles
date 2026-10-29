'use strict';
// =====================================================================
//  Economy: Bazaar (dynamic commodity prices) and Auction House
// =====================================================================
const BZ = {
  state: null,
  products() { return Object.keys(ITEMS).filter(id => ITEMS[id].bz); },
  base(id) { return ITEMS[id].price * 1.3; },
  load(s) {
    this.state = s && s.p ? s : { p: {}, h: {} };
    for (const id of this.products()) { if (!this.state.p[id]) this.state.p[id] = this.base(id) * rand(0.9, 1.1); if (!this.state.h[id]) this.state.h[id] = [this.state.p[id]]; }
    this.t = 0; this.ht = 0;
  },
  buyPrice(id) { return this.state.p[id] * 1.06; },
  sellPrice(id) { return this.state.p[id] * 0.94; },
  buy(id, n) {
    const cost = this.buyPrice(id) * n;
    if (G.P.coins < cost) return 'Not enough coins';
    const left = addItem(id, n, null, false);
    const got = n - left; if (!got) return 'Inventory full';
    G.P.coins -= this.buyPrice(id) * got;
    this.nudge(id, got);
    SFX.coin(); return null;
  },
  sell(id, n) {
    const have = countItem(id); n = Math.min(n, have); if (!n) return 'You have none';
    removeItem(id, n); const v = this.sellPrice(id) * n;
    G.P.coins += v; G.P.stats.earned += v; this.nudge(id, -n); G.P.flags.sold = 1;
    SFX.coin(); questCheck(); return null;
  },
  nudge(id, n) { const b = this.base(id), p = this.state.p; p[id] = clamp(p[id] * (1 + 0.0012 * n), b * 0.5, b * 2.2); },
  tick(dt) {
    this.t += dt; this.ht += dt;
    if (this.t >= 6) {
      this.t = 0;
      for (const id of this.products()) { const b = this.base(id), p = this.state.p; p[id] = clamp(p[id] + (b - p[id]) * 0.02 + p[id] * rand(-0.012, 0.012), b * 0.5, b * 2.2); }
    }
    if (this.ht >= 30) {
      this.ht = 0;
      for (const id of this.products()) { const h = this.state.h[id]; h.push(this.state.p[id]); if (h.length > 40) h.shift(); }
    }
  },
};

const NPC_SELLERS = ['Marigold', 'Tobias', 'Wren', 'Quill', 'Saffron', 'Ike', 'Juniper', 'Bram', 'Odessa', 'Pike', 'Lumen', 'Hazel'];
const AH = {
  state: null,
  load(s) { this.state = s && s.list ? s : { list: [], mine: [] }; this.t = 0; while (this.state.list.length < 18) this.state.list.push(this.gen()); },
  petValue(p) { return Math.round([2000, 6000, 20000, 60000, 200000, 500000][p.rar] * (1 + p.lvl / 40) * (['golem', 'sprout', 'crow', 'phoenix', 'dragon'].includes(p.id) ? 3 : 1)); },
  value(l) { return l.pet ? this.petValue(l.pet) : instValue(l.item); },
  gen() {
    const prog = Math.max(...SKILL_IDS.map(s => G.P ? G.P.skills[s].lvl : 0));
    const maxTier = clamp(1 + Math.floor(prog / 4), 2, 7);
    const r = Math.random();
    let l = { id: rid(), seller: NPC_SELLERS[randi(0, NPC_SELLERS.length - 1)], ends: Date.now() + randi(10, 120) * 60000 };
    if (r < 0.45) {
      const kinds = ['axe', 'pickaxe', 'hoe', 'sword'], m = MATS[randi(0, maxTier - 1)];
      const pool = [...kinds.map(k => m.k + '_' + k), 'bow', 'iron_bow', 'apprentice_wand', 'redstone_wand', 'fishing_rod', 'iron_rod'];
      if (maxTier >= 5) pool.push('diamond_bow', 'diamond_staff', 'diamond_rod');
      if (maxTier >= 6 && Math.random() < 0.3) pool.push('mithril_drill', 'bog_cleaver');
      if (Math.random() < 0.05) pool.push('venom_fang', 'treecapitator', 'golem_pickaxe', 'harvest_scythe', 'bone_reaver');
      const id = pool[randi(0, pool.length - 1)], d = newItemData(id), t = ITEMS[id].tool;
      const ench = Object.keys(ENCHANTS).filter(e => ENCHANTS[e].on.includes(t.kind));
      for (let i = randi(0, 3); i > 0; i--) { const e = ench[randi(0, ench.length - 1)]; d.ench[e] = randi(1, ENCHANTS[e].max); }
      if (Math.random() < 0.5) { const g = Object.keys(REFORGES[REFORGE_GROUP[t.kind]]); d.ref = g[randi(0, g.length - 1)]; }
      if (Math.random() < 0.03) d.rec = 1;
      l.item = { id, n: 1, d };
    } else if (r < 0.62) { l.item = { id: 'ench_book', n: 1, d: randomBook(Math.random() < 0.15 ? 1 : 0) }; }
    else if (r < 0.75) { const pets = Object.keys(PETS).filter(p => !['dragon', 'phoenix'].includes(p) || Math.random() < 0.1); const rar = Math.random() < 0.6 ? randi(0, 1) : randi(2, 4); l.pet = { id: pets[randi(0, pets.length - 1)], rar, lvl: randi(1, 40), xp: 0, uid: rid() }; }
    else if (r < 0.85) { const eggs = ['egg_common', 'egg_common', 'egg_rare', 'egg_golem', 'egg_sprout', 'egg_scarecrow']; l.item = { id: eggs[randi(0, eggs.length - 1)], n: 1 }; }
    else if (r < 0.92) { const ms = Object.keys(MACHINES); const id = ms[randi(0, ms.length - 1)]; l.item = { id, n: 1, d: { tier: randi(1, 3) } }; }
    else { const mats = COMPACT.map(c => 'enchanted_' + c); l.item = { id: mats[randi(0, mats.length - 1)], n: randi(1, 8) }; if (Math.random() < 0.15) l.item = { id: 'recombobulator', n: 1 }; }
    l.price = Math.max(10, Math.round(this.value(l) * rand(0.75, 1.5) / 10) * 10);
    return l;
  },
  tick(dt) {
    this.t += dt; if (this.t < 5) return; this.t = 0;
    const now = Date.now(), s = this.state;
    s.list = s.list.filter(l => l.ends > now);
    if (Math.random() < 0.05 && s.list.length) s.list.splice(randi(0, s.list.length - 1), 1);
    while (s.list.length < 22) s.list.push(this.gen());
    for (const m of s.mine) {
      if (m.sold || m.ends < now) continue;
      const ratio = this.value(m) / m.price;
      if (Math.random() < clamp(0.035 * Math.pow(ratio, 3), 0.001, 0.6)) { m.sold = true; UI.toast(`💰 Your ${m.pet ? PETS[m.pet.id].name : instName(m.item)} sold for ${fmt(m.price)} coins! Claim it at the Auction House.`, '#ffd23a'); SFX.coin(); }
    }
  },
  buy(id) {
    const s = this.state, l = s.list.find(x => x.id === id); if (!l) return 'Listing is gone';
    if (G.P.coins < l.price) return 'Not enough coins';
    if (l.item && freeSlots() < 1 && !canStack(l.item.id)) return 'Inventory full';
    G.P.coins -= l.price;
    if (l.pet) G.P.pets.push(l.pet); else addStack(l.item);
    s.list = s.list.filter(x => x !== l);
    SFX.coin(); questCheck(); return null;
  },
  createItem(slot, price, hours) {
    const it = G.P.inv[slot]; if (!it) return 'Pick an item';
    if (!(price >= 1)) return 'Set a price';
    G.P.inv[slot] = null; G.invDirty = true;
    this.state.mine.push({ id: rid(), item: it, price: Math.round(price), ends: Date.now() + hours * 3600000, sold: false });
    return null;
  },
  createPet(idx, price, hours) {
    const p = G.P.pets[idx]; if (!p) return 'Pick a pet'; if (!(price >= 1)) return 'Set a price';
    G.P.pets.splice(idx, 1);
    if (G.P.petActive === idx) G.P.petActive = -1; else if (G.P.petActive > idx) G.P.petActive--;
    this.state.mine.push({ id: rid(), pet: p, price: Math.round(price), ends: Date.now() + hours * 3600000, sold: false });
    return null;
  },
  claim(id) {
    const s = this.state, m = s.mine.find(x => x.id === id); if (!m) return;
    if (m.sold) { const v = m.price * 0.98; G.P.coins += v; G.P.stats.earned += v; SFX.coin(); }
    else { if (m.pet) G.P.pets.push(m.pet); else if (addStack(m.item)) return 'Inventory full'; }
    s.mine = s.mine.filter(x => x !== m); questCheck(); return null;
  },
};
