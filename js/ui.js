'use strict';
// =====================================================================
//  UI: HUD, panels, shops, bazaar, auction house, pets, enchanting...
// =====================================================================
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SPELL_DESC = { bolt: 'Piercing bolt that passes through 3 foes', boom: 'Fireball that explodes on impact', frost: 'Frost shard that slows foes for 3s', chain: 'Lightning that arcs between up to 4 foes', heal: 'Mending bolt that also heals you' };
const KIND_NAME = { axe: 'Axe', pickaxe: 'Pickaxe', drill: 'Drill', hoe: 'Hoe', sword: 'Sword', bow: 'Bow', wand: 'Wand', rod: 'Fishing Rod' };
const tLeft = ms => { ms = Math.max(0, ms); const s = Math.floor(ms / 1000); return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

const UI = {
  cur: null, sel: null, chest: null, mach: null, tab: {}, pick: null, feed: [], hudT: 0,
  isOpen() { return !!this.cur; },
  typing() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'); },

  // ---------------------------------------------------------- panel core
  open(title, render, wide) {
    this.cur = { title, render }; this.sel = null;
    $('panel').hidden = false; $('panelBox').className = wide ? 'wide' : '';
    $('panelTitle').innerHTML = title; this.refresh();
  },
  refresh(live) {
    if (!this.cur) return;
    if (live === 'tick' && (this.mouseDown || this.typing())) return;
    if (live === true && this.typing()) return;
    const body = $('panelBody'), st = body.scrollTop, focus = document.activeElement && document.activeElement.id;
    const html = this.cur.render();
    // only touch the DOM when something actually changed: rebuilding it under the cursor swallowed clicks
    if (html === this.cur.last) return;
    this.cur.last = html;
    const vals = {}; body.querySelectorAll('input[id],select[id]').forEach(i => vals[i.id] = i.value);
    body.innerHTML = html;
    for (const id in vals) { const i = document.getElementById(id); if (i && !i.dataset.keep) i.value = vals[id]; }
    body.scrollTop = st; if (focus && document.getElementById(focus)) document.getElementById(focus).focus();
    this.hideTip();
  },
  close() { this.cur = null; this.chest = null; this.mach = null; this.sel = null; $('panel').hidden = true; this.hideTip(); },
  act(a, v, el, ev) { const f = ACT[a]; if (f) { f(v, el, ev); } },

  // ------------------------------------------------------------- slots
  slot(s, key, cls = '') {
    if (!s) return `<div class="slot empty ${cls}" data-a="slot" data-v="${key}"></div>`;
    const r = instRar(s), gl = ITEMS[s.id].icon.glint || (s.d && s.d.ench && Object.keys(s.d.ench).length) || (s.d && s.d.book);
    return `<div class="slot r${r} ${gl ? 'glint' : ''} ${cls} ${this.sel === key ? 'sel' : ''}" data-a="slot" data-v="${key}" data-tip="${key}"><img src="${iconURL(s.id)}" alt="">${s.n > 1 ? `<b>${s.n}</b>` : ''}</div>`;
  },
  icon(id, size = 28) { return `<img class="ic" src="${iconURL(id)}" width="${size}" height="${size}" alt="">`; },
  resolve(key) {
    const [k, v] = key.split(':');
    if (k === 'inv') return G.P.inv[+v];
    if (k === 'chest') return this.chest && this.chest.o.inv[+v];
    if (k === 'id') return { id: v, n: 1 };
    if (k === 'ah') { const l = AH.state.list.find(x => x.id === v) || AH.state.mine.find(x => x.id === v); return l ? (l.pet ? { pet: l.pet } : l.item) : null; }
    if (k === 'pet') return { pet: G.P.pets[+v] };
    if (k === 'arm') return G.P.armor[v];
    return null;
  },
  tipHTML(s) {
    if (s.pet) return this.petTip(s.pet);
    const d = ITEMS[s.id]; if (!d) return '';
    const r = instRar(s), st = itemStats(s), lines = [];
    let h = `<div class="tn" style="color:${RCOL[r]}">${esc(instName(s))}</div>`;
    if (d.tool) {
      const t = d.tool;
      if (t.dmg) lines.push(`<span class="sk">Damage:</span> <span style="color:#ff6b4a">+${t.dmg}</span>`);
      if (t.power) lines.push(`<span class="sk">Breaking Power:</span> <span style="color:#ffd27a">${t.power}</span>${t.tier ? ` <span class="dim">(Tier ${t.tier})</span>` : ''}`);
      if (t.kind === 'hoe') lines.push(`<span class="sk">Tills grass into farmland</span>${t.sweep ? ' · <span style="color:#5dff6a">Harvests in an area</span>' : ''}`);
      if (t.mana) lines.push(`<span class="sk">Mana Cost:</span> <span style="color:#6fd8ff">${t.mana}</span>`);
      if (t.kind === 'rod') lines.push(`<span class="sk">Rod Tier:</span> ${t.tier}`);
      if (t.kind === 'wand') lines.push(`<span class="sk">Spell:</span> <span style="color:#b88aff">${SPELL_DESC[t.ab || 'bolt']}</span>`);
    }
    for (const k in st) if (st[k]) { const i = STAT_INFO[k]; lines.push(`<span style="color:${i[2]}">${i[0]} ${i[1]}: +${st[k]}${i[3] || ''}</span>`); }
    if (lines.length) h += `<div class="tl">${lines.join('<br>')}</div>`;
    if (s.d && s.d.ench && Object.keys(s.d.ench).length) h += `<div class="tl ench">${Object.entries(s.d.ench).map(([e, l]) => `<b>${ENCHANTS[e].name} ${ROMAN[l]}</b> <span class="dim">${ENCHANTS[e].desc(l)}</span>`).join('<br>')}</div>`;
    if (s.d && s.d.book) h += `<div class="tl ench"><b>${ENCHANTS[s.d.book].name} ${ROMAN[s.d.l]}</b><br><span class="dim">${ENCHANTS[s.d.book].desc(s.d.l)} · for ${ENCHANTS[s.d.book].on.map(k => KIND_NAME[k]).join(', ')}</span></div>`;
    if (s.d && s.d.ref && gearKind(d)) h += `<div class="tl dim">Reforge: <b style="color:#5aa8ff">${REFORGES[REFORGE_GROUP[gearKind(d)]][s.d.ref].n}</b></div>`;
    if (d.tool && d.tool.fuel && s.d) h += `<div class="tl" style="color:#ffb020">⛽ Fuel ${fmt(s.d.fuel)} / ${fmt(drillCap(s))}${s.d.eng ? ` · Engine ${ROMAN[s.d.eng]}` : ''}${s.d.tank ? ` · Tank ${ROMAN[s.d.tank]}` : ''}<br><span class="dim">Right-click to refuel with Coal or Charcoal</span></div>`;
    if (d.armor) { const set = SETS[d.armor.set]; h += `<div class="tl"><span style="color:${set.col}">Set bonus: ${set.name}</span><br><span class="dim">${set.desc} (wear all 4 pieces)</span><br><span style="color:#9aff8a">Right-click or shift-click to wear</span></div>`; }
    if (s.d && s.d.tier) h += `<div class="tl dim">${MACHINES[s.id].desc}<br>Tier ${ROMAN[s.d.tier]} · ${machinePeriod(s.id, s.d.tier).toFixed(1)}s per action</div>`;
    else if (d.desc) h += `<div class="tl dim">${d.desc}</div>`;
    if (d.food && d.food < 9999) h += `<div class="tl" style="color:#ff8a8a">Right-click to eat · heals ${d.food}</div>`;
    if (d.plant) h += `<div class="tl" style="color:#9aff8a">Right-click farmland to plant</div>`;
    if (d.place && d.place.k === 'block') h += `<div class="tl dim">Right-click to place on your island</div>`;
    const node = Object.values(NODES).find(n => n.item === s.id);
    if (node) h += `<div class="tl dim">Gathered from ${node.name} · ${SKILLS[node.skill].name} ${node.lvl}</div>`;
    h += `<div class="tl dim">Sells for <span style="color:#ffd23a">${fmt(npcPrice(s))}</span> each${s.n > 1 ? ` · stack ${fmt(npcPrice(s) * s.n)}` : ''}</div>`;
    if (d.useReq) { const ok = lvl(d.useReq[0]) >= d.useReq[1]; h += `<div class="tl" style="color:${ok ? '#9aff8a' : '#ff6a6a'}">${ok ? '✔' : '✖'} Requires ${SKILLS[d.useReq[0]].name} ${d.useReq[1]}</div>`; }
    if (COLLECTION.has(s.id)) h += `<div class="tl dim">Collection: ${fmt(G.P.coll[s.id] || 0)} gathered · tier ${ROMAN[collTier(s.id)] || '0'}</div>`;
    h += `<div class="tr" style="color:${RCOL[r]}">${s.d && s.d.rec ? '✦ ' : ''}${RARITY[r].toUpperCase()} ${(d.tool ? KIND_NAME[d.tool.kind] : d.armor ? ARMOR_PIECE[d.armor.slot][0] : d.cat).toUpperCase()}</div>`;
    return h;
  },
  petTip(p) {
    const d = PETS[p.id], st = petStats(p);
    return `<div class="tn" style="color:${RCOL[p.rar]}">${d.e} [Lv${p.lvl}] ${d.name}</div><div class="tl dim">${SKILLS[d.skill].name} pet · gains full XP from ${SKILLS[d.skill].name}</div>
      <div class="tl">${Object.entries(st).map(([k, v]) => `<span style="color:${STAT_INFO[k][2]}">${STAT_INFO[k][0]} ${STAT_INFO[k][1]}: +${v}</span>`).join('<br>')}</div>
      ${p.lvl < PET_MAX ? `<div class="bar"><i style="width:${p.xp / petXpToNext(p.lvl) * 100}%;background:${RCOL[p.rar]}"></i></div>` : '<div class="tl" style="color:#ffd23a">MAX LEVEL</div>'}
      <div class="tr" style="color:${RCOL[p.rar]}">${RARITY[p.rar].toUpperCase()} PET</div>`;
  },
  showTip(key, x, y) { const s = this.resolve(key); if (!s) return this.hideTip(); const t = $('tip'); t.innerHTML = this.tipHTML(s); t.hidden = false; this.moveTip(x, y); },
  moveTip(x, y) { const t = $('tip'); if (t.hidden) return; const w = t.offsetWidth, h = t.offsetHeight; t.style.left = Math.min(x + 16, innerWidth - w - 8) + 'px'; t.style.top = Math.max(8, Math.min(y + 12, innerHeight - h - 8)) + 'px'; },
  hideTip() { $('tip').hidden = true; },

  // -------------------------------------------------------------- HUD
  startHud() { $('title').hidden = true; $('hud').hidden = false; this.renderHotbar(); this.quest(); this.hudTick(true); },
  hudTick(force) {
    const me = G.me, P = G.P, z = G.zone; if (!me || !z) return;
    $('hpFill').style.width = clamp(me.hp / me.maxHp, 0, 1) * 100 + '%'; $('hpTxt').textContent = `${Math.ceil(me.hp)} / ${Math.round(me.maxHp)} ❤`;
    $('mpFill').style.width = clamp(me.mana / me.maxMana, 0, 1) * 100 + '%'; $('mpTxt').textContent = `${Math.floor(me.mana)} / ${me.maxMana} ✎`;
    $('defTxt').textContent = `🛡 ${Math.round(G.stats.defense)}  ❁ ${Math.round(G.stats.strength)}  ✦ ${Math.round(G.stats.speed)}`;
    $('coins').textContent = fmt(P.coins); $('bankAmt').textContent = P.bank >= 1 ? `Bank ${fmt(P.bank)}` : '';
    $('zoneName').textContent = z.def.name + (z.remote ? ` · ${NET.hostName || 'Friend'}'s Island` : '');
    $('zoneName').style.color = CAT_COL[z.def.cat] || '#fff';
    const ev = currentEvent();
    $('eventTxt').innerHTML = ev.active ? `<b style="color:${ev.ev.col}">${ev.ev.name}</b> · ${tLeft(ev.left)} left <span class="dim">— ${ev.ev.desc}</span>` : `<span class="dim">Next event:</span> <b style="color:${ev.next.col}">${ev.next.name}</b> <span class="dim">in ${tLeft(ev.left)}</span>`;
    // boss bar
    const boss = z.mobs.find(m => !m.dead && m.def.boss);
    if (boss) { $('bossbar').hidden = false; $('bossName').textContent = `${boss.def.name}${boss.phase ? ' · ENRAGED' : ''}`; $('bossFill').style.width = clamp(boss.hp / boss.mhp, 0, 1) * 100 + '%'; $('bossHp').textContent = `${fmt(Math.max(0, boss.hp))} / ${fmt(boss.mhp)}`; }
    else $('bossbar').hidden = true;
    let info = '';
    if (z.def.cat === 'combat' && z.def.boss && !boss) info = `☠ ${MOBS[z.def.boss].name} awakens in ${tLeft(z.bossTimer * 1000)}`;
    if (z.rooms) { const c = z.rooms.filter(r => r.cleared && !r.boss).length - 1; info = `Rooms ${c}/${z.run.need} · ⏱ ${tLeft(Date.now() - z.run.start)} · ☠ ${z.run.deaths}/3${z.run.open ? ' · <b style="color:#c38bff">Boss gate open</b>' : ''}`; }
    $('zoneInfo').innerHTML = info;
    const pet = activePet(); $('petHud').innerHTML = pet ? `<span style="color:${RCOL[pet.rar]}">${PETS[pet.id].e} Lv${pet.lvl} ${PETS[pet.id].name}</span>` : '';
    if (G.invDirty) { G.invDirty = false; this.renderHotbar(); if (this.cur && this.cur.inv) this.refresh(true); }
    if (this.cur && this.cur.live && (this.liveT = (this.liveT || 0) + 1) % 4 === 0) this.refresh('tick');
    $('mpBtn').classList.toggle('on', NET.connected);
  },
  renderHotbar() {
    let h = '';
    for (let k = 0; k < 9; k++) h += `<div class="hs ${k === G.sel ? 'on' : ''}" data-hs="${k}">${this.slot(G.P.inv[k], 'inv:' + k)}<i>${k + 1}</i></div>`;
    $('hotbar').innerHTML = h;
    const s = held(); $('heldName').innerHTML = s ? `<span style="color:${RCOL[instRar(s)]}">${esc(instName(s))}</span>` : '';
  },
  selectHot(k) { G.sel = (k + 9) % 9; G.invDirty = true; const hn = $('heldName'); hn.classList.remove('flash'); void hn.offsetWidth; hn.classList.add('flash'); if (G.me) G.me.fish = null; },
  quest() {
    const P = G.P; if (!P) return;
    let h = '';
    if (P.tut < TUTORIAL.length) h = `<div class="qh">Tutorial · ${P.tut + 1}/${TUTORIAL.length}</div><div class="qt">${TUTORIAL[P.tut].t}</div>`;
    else { const g = GOALS.filter(g => !P.goals[g.id]).slice(0, 3); h = `<div class="qh">Goals</div>` + g.map(x => `<div class="qt">☆ ${x.t} <span class="dim">+${fmt(x.r)}</span></div>`).join('') || '<div class="qt">All goals complete! 🎉</div>'; }
    $('quest').innerHTML = h;
  },
  toast(msg, col = '#fff') {
    const d = document.createElement('div'); d.className = 'toast'; d.style.borderColor = col; d.innerHTML = msg;
    $('toasts').prepend(d); setTimeout(() => d.classList.add('out'), 4200); setTimeout(() => d.remove(), 4800);
    while ($('toasts').children.length > 6) $('toasts').lastChild.remove();
  },
  pickup(id, n) {
    const now = Date.now(); let f = this.feed.find(x => x.id === id && now - x.t < 2500);
    if (f) { f.n += n; f.t = now; } else { f = { id, n, t: now, el: document.createElement('div') }; f.el.className = 'pk'; $('feed').prepend(f.el); this.feed.unshift(f); }
    f.el.innerHTML = `${this.icon(id, 20)} <b>+${n}</b> <span style="color:${RCOL[ITEMS[id].rar]}">${esc(ITEMS[id].name)}</span> <span class="dim">(${fmt(countAny(id))})</span>`;
    f.el.classList.remove('out'); clearTimeout(f.to); f.to = setTimeout(() => { f.el.classList.add('out'); setTimeout(() => { f.el.remove(); this.feed = this.feed.filter(x => x !== f); }, 400); }, 2600);
    while (this.feed.length > 6) { const x = this.feed.pop(); x.el.remove(); }
  },
  skillBar(skill, amt) {
    const sk = G.P.skills[skill], el = $('skillbar');
    const need = xpToNext(sk.lvl);
    el.innerHTML = `<span style="color:${SKILLS[skill].col}">+${amt} ${SKILLS[skill].name}</span> <span class="dim">${sk.lvl >= MAX_SKILL ? 'MAX' : `${fmt(sk.xp)} / ${fmt(need)}`}</span><div class="bar"><i style="width:${sk.lvl >= MAX_SKILL ? 100 : sk.xp / need * 100}%;background:${SKILLS[skill].col}"></i></div>`;
    el.classList.add('show'); clearTimeout(this.sbT); this.sbT = setTimeout(() => el.classList.remove('show'), 2600);
  },
  banner(html, ms = 3200, cls = '') {
    const b = document.createElement('div'); b.className = 'banner ' + cls; b.innerHTML = html; $('banners').appendChild(b);
    setTimeout(() => b.classList.add('out'), ms); setTimeout(() => b.remove(), ms + 600);
  },
  announce(title, col, sub) { this.banner(`<div class="bt" style="color:${col}">${title}</div>${sub ? `<div class="bs">${sub}</div>` : ''}`); },
  levelUp(skill, l, unlocks) {
    const S = SKILLS[skill];
    this.banner(`<div class="bk">SKILL LEVEL UP</div><div class="bt" style="color:${S.col}">${S.icon} ${S.name} ${l}</div><div class="bs">${S.perk(1).replace(/\+(\d+(\.\d)?)/g, (m, n) => '+' + n)} per level · now ${S.perk(l)}</div>${unlocks.length ? `<div class="bu">Unlocked: ${unlocks.map(esc).join(' · ')}</div>` : ''}`, 4500, 'lvl');
  },
  zoneBanner(z) { this.banner(`<div class="bk">${z.remote ? 'CO-OP ISLAND' : (z.def.cat || '').toUpperCase()}</div><div class="bt" style="color:${CAT_COL[z.def.cat] || '#fff'}">${esc(z.def.name)}</div>`, 2200, 'zone'); },
  rareDrop(id, d) { const r = ITEMS[id].rar; this.banner(`<div class="bk" style="color:${RCOL[r]}">${r >= 4 ? 'CRAZY RARE DROP!' : 'RARE DROP!'}</div><div class="bt">${this.icon(id, 34)} <span style="color:${RCOL[r]}">${esc(d && d.book ? instName({ id, d }) : ITEMS[id].name)}</span></div>`, 3500, 'rare'); SFX.hatch(); },
  overlay(html) { $('overlay').innerHTML = `<div class="ov">${html}<button class="btn" data-a="closeOv">Continue</button></div>`; $('overlay').hidden = false; },
  hatch(eggId, pet) {
    $('overlay').innerHTML = `<div class="ov hatch"><div class="egg"><img src="${iconURL(eggId)}" width="120" height="120" alt=""></div><div class="hatched" hidden><div class="pe">${PETS[pet.id].e}</div><div class="bt" style="color:${RCOL[pet.rar]}">${RARITY[pet.rar]} ${PETS[pet.id].name}!</div><div class="bs">${SKILLS[PETS[pet.id].skill].name} pet · ${Object.entries(petStats(pet)).map(([k, v]) => `${STAT_INFO[k][1]} +${v}`).join(' · ')}</div><button class="btn" data-a="closeOv">Nice!</button></div></div>`;
    $('overlay').hidden = false;
    setTimeout(() => { const ov = $('overlay').querySelector('.hatch'); if (!ov) return; ov.querySelector('.egg').hidden = true; ov.querySelector('.hatched').hidden = false; SFX.hatch(); for (let i = 0; i < 60; i++) G.particles.push({ x: G.me.x, y: G.me.y - 0.5, vx: rand(-5, 5), vy: rand(-8, -2), life: rand(1, 2), max: 2, col: RCOL[pet.rar], size: rand(3, 7), grav: 9, sq: 1 }); }, 1700);
  },
  dungeonReward(run, got, coins) {
    this.overlay(`<div class="bk">DUNGEON CLEARED</div><div class="grade g${run.grade}">${run.grade}</div><div class="bs">Score ${run.score} · ${tLeft(Date.now() - run.start)} · ${run.deaths} deaths</div>
      <div class="loot">${got.map(([id, n]) => `<div class="li">${this.icon(id, 32)}<span style="color:${RCOL[ITEMS[id].rar]}">${n > 1 ? n + '× ' : ''}${esc(ITEMS[id].name)}</span></div>`).join('')}<div class="li">🪙 <span style="color:#ffd23a">${fmt(coins)} coins</span></div></div>`);
  },

  // ---------------------------------------------------------- inventory
  openInventory() {
    this.open('Inventory', () => {
      const P = G.P, st = G.stats, set = fullSet();
      let g = '<div class="invwrap"><div class="armorcol"><div class="lbl">Armor</div>';
      for (const sl of ARMOR_SLOTS) g += P.armor[sl] ? this.slot(P.armor[sl], 'arm:' + sl) : `<div class="slot empty" data-a="slot" data-v="arm:${sl}" title="${ARMOR_PIECE[sl][0]}"><img class="ph" src="${iconURL('iron_' + sl)}" alt=""></div>`;
      g += `${set ? `<div class="setb" style="border-color:${set.col}"><b style="color:${set.col}">${set.name}</b><br>${set.desc}</div>` : '<div class="small dim">Wear 4 pieces of one set for a bonus</div>'}</div>`;
      g += '<div><div class="lbl">Hotbar</div><div class="grid g9">';
      for (let k = 0; k < 9; k++) g += this.slot(P.inv[k], 'inv:' + k, k === G.sel ? 'hot' : '');
      g += '</div><div class="lbl">Backpack</div><div class="grid g9">';
      for (let k = 9; k < 36; k++) g += this.slot(P.inv[k], 'inv:' + k);
      g += `</div><div class="row gap wrap"><button class="btn sm" data-a="sortInv">Sort</button><div class="slot trash" data-a="trash" title="Destroy selected item">🗑</div><span class="dim small">Click two slots to swap · Shift-click armor to wear it · Shift-click to move between hotbar and backpack</span></div></div>`;
      g += `<div class="statcol"><div class="lbl">Stats</div>${Object.keys(STAT_INFO).filter(k => st[k]).map(k => `<div class="st"><span style="color:${STAT_INFO[k][2]}">${STAT_INFO[k][0]} ${STAT_INFO[k][1]}</span><b>${Math.round(st[k] * 10) / 10}${STAT_INFO[k][3] || ''}</b></div>`).join('')}</div></div>`;
      return g;
    }, true);
    this.cur.inv = true;
  },
  clickSlot(key, ev) {
    const [k, v] = key.split(':'), i = +v;
    if (k === 'arm') { unequipArmor(v); this.refresh(); return; }
    if (k === 'fz') return this.furnaceClick(v);
    if (k === 'inv' && this.cur && this.cur.furnace) return this.furnaceInv(i, ev.shiftKey);
    if (k === 'inv' && this.cur && this.cur.pickInv) { this.cur.pickInv(i); return; }
    if (k === 'chest' || (k === 'inv' && this.chest)) return this.chestClick(k, i);
    if (k !== 'inv') return;
    const inv = G.P.inv;
    if (ev.shiftKey && inv[i] && ITEMS[inv[i].id].armor) { equipArmor(i); this.refresh(); return; }
    if (ev.shiftKey && inv[i]) { const range = i < 9 ? [9, 36] : [0, 9]; for (let j = range[0]; j < range[1]; j++) if (!inv[j]) { inv[j] = inv[i]; inv[i] = null; break; } G.invDirty = true; this.refresh(); return; }
    if (this.sel == null) { if (inv[i]) this.sel = key; this.refresh(); return; }
    const j = +this.sel.split(':')[1]; this.sel = null;
    if (j !== i) {
      const a = inv[j], b = inv[i];
      if (a && b && a.id === b.id && !a.d && !b.d && !ITEMS[a.id].unique) { const m = Math.min(a.n, 999 - b.n); b.n += m; a.n -= m; if (a.n <= 0) inv[j] = null; }
      else { inv[j] = b; inv[i] = a; }
    }
    G.invDirty = true; this.refresh();
  },

  // ------------------------------------------------------------ crafting
  openCraft() {
    this.tab.craft = this.tab.craft || 'all';
    const bt = benchTier();
    this.open(bt ? `🛠️ ${BENCH_NAMES[bt]}` : '✋ Pocket Crafting', () => {
      const bt = benchTier(), q = (($('craftQ') && $('craftQ').value) || '').toLowerCase();
      const tabs = ['all', 'materials', 'tools', 'weapons', 'armor', 'blocks', 'machines', 'food'];
      const list = RECIPES.map((r, ri) => ({ r, ri, s: recipeStatus(r, bt) })).filter(({ r }) => (this.tab.craft === 'all' || r.cat === this.tab.craft) && (!q || ITEMS[r.out].name.toLowerCase().includes(q)));
      const rank = s => s.ok ? 0 : s.lock ? 3 : s.station ? 2 : 1;
      list.sort((a, b) => rank(a.s) - rank(b.s) || (ITEMS[a.r.out].rar - ITEMS[b.r.out].rar) || ITEMS[a.r.out].name.localeCompare(ITEMS[b.r.out].name));
      if (this.craftSel == null || !list.some(x => x.ri === this.craftSel)) this.craftSel = list.length ? list[0].ri : null;
      const heads = ['Ready to craft', 'Missing materials', 'Needs a better workbench', 'Locked'];
      let book = '', lastRank = -1;
      for (const { r, ri, s } of list) {
        const rk = rank(s); if (rk !== lastRank) { book += `<div class="bookh">${heads[rk]}</div>`; lastRank = rk; }
        const it = ITEMS[r.out];
        book += `<div class="bk2 ${ri === this.craftSel ? 'on' : ''} ${s.ok ? 'ok' : ''}" data-a="csel" data-v="${ri}"><img src="${iconURL(r.out)}" alt=""><span style="color:${s.lock ? '#8890a8' : RCOL[it.rar]}">${esc(it.name)}${r.n > 1 ? ` <i class="dim">×${r.n}</i>` : ''}</span>${s.lock ? '<i class="lk">🔒</i>' : ''}</div>`;
      }
      let h = `<div class="tabs">${tabs.map(t => `<button class="tab ${this.tab.craft === t ? 'on' : ''}" data-a="ctab" data-v="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}<input id="craftQ" placeholder="Search…"></div>`;
      h += `<div class="craftwrap"><div class="book">${book || '<div class="empty">No recipes match.</div>'}</div><div class="table">`;
      if (this.craftSel != null) {
        const r = RECIPES[this.craftSel], s = recipeStatus(r, bt), it = ITEMS[r.out];
        const size = bt ? 3 : 2, cells = recipeGrid(r, size);
        h += `<div class="cgridwrap"><div class="cgrid g${size}">${cells.map(c => c ? `<div class="cc ${countItem(c.id) >= c.need ? '' : 'miss'}" data-tip="id:${c.show}"><img src="${iconURL(c.show)}" alt="">${c.n > 1 ? `<b>${c.n}</b>` : ''}</div>` : '<div class="cc"></div>').join('')}</div>
          <div class="carrow">➜</div><div class="slot big r${it.rar} ${s.ok ? 'glow' : ''}" data-tip="id:${r.out}"><img src="${iconURL(r.out)}" alt="">${r.n > 1 ? `<b>${r.n}</b>` : ''}</div></div>`;
        h += `<div class="cname" style="color:${RCOL[it.rar]}">${esc(it.name)}</div>`;
        h += `<div class="ings">${r.in.map(([id, n]) => { const c = countItem(id), nm = id === '#log' ? 'Any Log' : id === '#fuel' ? 'Any Fuel' : ITEMS[id].name; return `<span class="ing ${c >= n ? 'ok' : 'no'}">${this.icon(cycleId(id), 18)} ${fmt(c)}/${n} ${esc(nm)}</span>`; }).join('')}</div>`;
        if (s.lock) h += `<div class="lockmsg">🔒 Unlock with <b>${esc(s.lock)}</b></div>`;
        else if (s.station) h += `<div class="lockmsg">🛠️ ${esc(s.station)} — ${bt ? 'upgrade your workbench' : 'place a workbench and right-click it'}</div>`;
        h += `<div class="row gap"><button class="btn" data-a="craft" data-v="${this.craftSel}|1" ${s.ok ? '' : 'disabled'}>Craft</button>${!it.unique ? `<button class="btn ghost" data-a="craft" data-v="${this.craftSel}|8" ${s.ok ? '' : 'disabled'}>×8</button><button class="btn ghost" data-a="craft" data-v="${this.craftSel}|999" ${s.ok ? '' : 'disabled'}>All</button>` : ''}</div>`;
        if (it.desc) h += `<div class="small dim">${it.desc}</div>`;
      }
      h += `<div class="small dim">${bt ? `Workbench tier ${ROMAN[bt]}. Higher tiers unlock better recipes.` : 'Pocket crafting only fits small 2×2 recipes. Use a workbench for everything else.'}</div></div></div>`;
      return h;
    }, true);
    this.cur.inv = true; this.cur.live = true;
  },

  // ------------------------------------------------------------- furnace
  openFurnace(z, i) {
    this.furn = { z, i };
    this.open('🔥 Furnace', () => {
      const o = z.objs[i]; if (!o) return '';
      furnaceTick(o, Date.now()); const f = o.fz;
      const t = f.inp ? smeltTime(f.inp.id) : 0, fuelLeft = Math.round(f.burn * 10) / 10 + (f.fuel ? f.fuel.n * fuelValue(f.fuel.id) : 0);
      const stack = (s, key, ph) => s ? `<div class="slot big r${ITEMS[s.id].rar}" data-a="slot" data-v="fz:${key}" data-tip="id:${s.id}"><img src="${iconURL(s.id)}" alt=""><b>${s.n}</b></div>` : `<div class="slot big empty" data-a="slot" data-v="fz:${key}"><span class="phl">${ph}</span></div>`;
      let h = `<div class="furnace"><div class="fcol">${stack(f.inp, 'inp', 'Ore')}<div class="flame ${f.burn > 0 ? 'on' : ''}"><i style="height:${clamp(f.burn % 1 || (f.burn > 0 ? 1 : 0), 0, 1) * 100}%"></i></div>${stack(f.fuel, 'fuel', 'Fuel')}</div>
        <div class="farrow"><div class="fbar"><i style="width:${f.prog * 100}%"></i></div><div class="small dim">${f.inp && ITEMS[f.inp.id].smelt ? `${t}s per item` : 'idle'}</div></div>${stack(f.out, 'out', 'Result')}</div>`;
      h += `<div class="small center">Fuel left: <b>${fuelLeft.toFixed(1)}</b> items worth${f.inp && !f.burn && !f.fuel ? ' · <span style="color:#ff8a8a">add fuel to start</span>' : ''} · Smelting keeps going while you're away.</div>`;
      h += `<div class="small dim center">Click an item below to load it. Ores go on top, fuel (coal, charcoal, logs, planks) goes below. Shift-click forces fuel.</div><div class="grid g9">`;
      for (let k = 0; k < 36; k++) { const s = G.P.inv[k]; h += this.slot(s, 'inv:' + k, s && !ITEMS[s.id].smelt && !fuelValue(s.id) ? 'faded' : ''); }
      h += `</div><div class="small dim">Recipes: ${Object.keys(ITEMS).filter(id => ITEMS[id].smelt && !ITEMS[id].tags).map(id => `${esc(ITEMS[id].name)} → ${esc(ITEMS[ITEMS[id].smelt].name)} (${smeltTime(id)}s)`).join(' · ')} · Any Log → Charcoal (2s)</div>`;
      return h;
    }, true);
    this.cur.inv = true; this.cur.live = true; this.cur.furnace = true;
  },
  furnaceInv(i, forceFuel) {
    const o = this.furn.z.objs[this.furn.i], f = o.fz, s = G.P.inv[i]; if (!s || s.d) return;
    furnaceTick(o, Date.now());
    const asInput = !forceFuel && ITEMS[s.id].smelt && (!f.inp || f.inp.id === s.id);
    const target = asInput ? 'inp' : fuelValue(s.id) ? 'fuel' : null;
    if (!target) return UI.toast(ITEMS[s.id].smelt ? 'The input slot holds something else' : 'That can\'t be smelted or burned', '#aaa');
    const cur = f[target]; if (cur && cur.id !== s.id) return UI.toast('That slot holds something else — click it to take it out', '#aaa');
    const room = 999 - (cur ? cur.n : 0), n = Math.min(room, s.n);
    f[target] = { id: s.id, n: (cur ? cur.n : 0) + n }; s.n -= n; if (s.n <= 0) G.P.inv[i] = null;
    G.invDirty = true; SFX.place(); this.refresh();
  },
  furnaceClick(key) {
    const o = this.furn.z.objs[this.furn.i], f = o.fz; furnaceTick(o, Date.now());
    const s = f[key]; if (!s) return;
    const left = addItem(s.id, s.n); if (left) s.n = left; else f[key] = null;
    if (key === 'inp' && !f.inp) f.prog = 0;
    this.refresh();
  },

  // -------------------------------------------------------------- skills
  openSkills(tab) {
    if (tab) this.tab.sk = tab; this.tab.sk = this.tab.sk || 'skills';
    this.open('Skills & Collections', () => {
      let h = `<div class="tabs"><button class="tab ${this.tab.sk === 'skills' ? 'on' : ''}" data-a="sktab" data-v="skills">Skills</button><button class="tab ${this.tab.sk === 'coll' ? 'on' : ''}" data-a="sktab" data-v="coll">Collections</button></div>`;
      if (this.tab.sk === 'coll') return h + this.collectionsHTML();
      if (this.tab.road) return h + this.roadHTML(this.tab.road);
      h += '<p class="dim small">Click a skill to see its road: every level, its rewards and what it unlocks.</p>';
      return h + SKILL_IDS.map(s => {
        const sk = G.P.skills[s], S = SKILLS[s], need = xpToNext(sk.lvl), next = sk.lvl < MAX_SKILL ? unlocksAt(s, sk.lvl + 1) : [];
        return `<div class="skill click" data-a="road" data-v="${s}"><div class="si" style="background:${S.col}22;border-color:${S.col}">${S.icon}</div><div class="sm2"><div><b style="color:${S.col}">${S.name}</b> <span class="lvl">${sk.lvl}</span><span class="dim small"> / ${MAX_SKILL}</span></div>
          <div class="bar big"><i style="width:${sk.lvl >= MAX_SKILL ? 100 : sk.xp / need * 100}%;background:${S.col}"></i><span>${sk.lvl >= MAX_SKILL ? 'MAXED' : `${fmt(sk.xp)} / ${fmt(need)} XP`}</span></div>
          <div class="small">${S.perk(sk.lvl)}</div>${next.length ? `<div class="small dim">Next level: ${next.map(esc).join(' · ')}</div>` : ''}</div><div class="go">›</div></div>`;
      }).join('');
    }, true);
  },
  roadHTML(s) {
    const sk = G.P.skills[s], S = SKILLS[s];
    let h = `<div class="row gap"><button class="btn sm ghost" data-a="road" data-v="">‹ All skills</button><b style="color:${S.col};font-size:18px">${S.icon} ${S.name} road</b><span class="dim small">Level ${sk.lvl} / ${MAX_SKILL}</span></div><div class="road" id="road">`;
    for (let l = 1; l <= MAX_SKILL; l++) {
      const done = sk.lvl >= l, cur = sk.lvl + 1 === l, un = unlocksAt(s, l);
      const prog = cur ? sk.xp / xpToNext(sk.lvl) : done ? 1 : 0;
      h += `<div class="rnode ${done ? 'done' : ''} ${cur ? 'cur' : ''} ${un.length ? 'big' : ''}" style="--c:${S.col}"><div class="rline"><i style="width:${prog * 100}%"></i></div><div class="rcirc">${done ? '✔' : l}</div>
        <div class="rcard"><div class="rlv">Level ${l}</div><div class="small">${S.perk(1)}</div><div class="small" style="color:#ffd23a">+${fmt(levelCoins(l))} coins</div>${un.map(u => `<div class="run">🔓 ${esc(u)}</div>`).join('')}<div class="small dim">${fmt(xpToNext(l - 1))} XP</div></div></div>`;
    }
    h += '</div>';
    setTimeout(() => { const r = $('road'), c = r && r.querySelector('.cur'); if (c && !this.roadScrolled) { this.roadScrolled = 1; r.scrollLeft = c.offsetLeft - 120; } }, 0);
    return h;
  },
  collectionsHTML() {
    let h = `<p class="dim small">Gathering a resource (not crafting or buying it) grows its collection. Each tier pays coins and unlocks recipes. Tiers at ${COLL_TIERS.map(fmt).join(' / ')}.</p>`;
    for (const [grp, ids] of Object.entries(COLL_GROUPS)) {
      h += `<div class="lbl">${SKILLS[grp].icon} ${SKILLS[grp].name}</div><div class="colls">`;
      for (const id of ids) {
        const n = G.P.coll[id] || 0, t = collTier(id), next = COLL_TIERS[t], prev = t ? COLL_TIERS[t - 1] : 0;
        const unl = RECIPES.filter(r => r.coll && r.coll[0] === id).map(r => `${ROMAN[r.coll[1]]}: ${ITEMS[r.out].name}`);
        h += `<div class="coll ${n ? '' : 'unseen'}" title="${esc(unl.join('\n') || 'No recipe unlocks')}"><img src="${iconURL(id)}" alt=""><div class="grow"><div><b>${n ? esc(ITEMS[id].name) : '???'}</b> <span class="tag2">${t ? ROMAN[t] : '—'}</span></div><div class="bar"><i style="width:${next ? (n - prev) / (next - prev) * 100 : 100}%;background:#ffd23a"></i></div><div class="small dim">${fmt(n)}${next ? ' / ' + fmt(next) : ' · MAX'}${unl.length ? ` · ${unl.length} unlock${unl.length > 1 ? 's' : ''}` : ''}</div></div></div>`;
      }
      h += '</div>';
    }
    return h;
  },

  // ------------------------------------------------------------ dialogue
  say(npc, lines, actions) {
    this.dlg = { npc, lines: Array.isArray(lines) ? lines : [lines], i: 0, actions: actions || null };
    this.renderDialog(); SFX.pop();
  },
  renderDialog() {
    const d = this.dlg, el = $('dialog');
    if (!d) { el.hidden = true; return; }
    const n = NPCS[d.npc], last = d.i >= d.lines.length - 1;
    d.full = d.lines[d.i]; d.shown = 0;
    el.hidden = false;
    el.innerHTML = `<div class="dportrait" style="background:linear-gradient(${n.shirt},${shade(n.shirt, -0.4)})"><span>${n.e}</span></div><div class="dbody"><div class="dname">${esc(n.name)} <span class="dim small">· ${esc(n.role)}</span></div><div class="dtext" id="dtext"></div>
      <div class="dbtns">${last && d.actions ? d.actions.map((a, k) => `<button class="btn sm ${k ? 'ghost' : ''}" data-a="dlgAct" data-v="${k}">${a[0]}</button>`).join('') : `<button class="btn sm" data-a="dlgNext">${last ? 'Got it' : 'Next ▸'}</button>`}<span class="dim small">Space / F · ${d.i + 1}/${d.lines.length}</span></div></div>`;
  },
  dialogTick(dt) {
    const d = this.dlg; if (!d || d.shown >= d.full.length) return;
    d.shown = Math.min(d.full.length, d.shown + dt * 55);
    let out = '', c = 0; const s = d.full;
    for (let k = 0; k < s.length && c < d.shown; k++) { if (s[k] === '<') { const e = s.indexOf('>', k); out += s.slice(k, e + 1); k = e; } else { out += s[k]; c++; } }
    const t = $('dtext'); if (t) t.innerHTML = out;
    if ((d.blip = (d.blip || 0) + dt) > 0.07) { d.blip = 0; SFX.blip && SFX.blip(); }
  },
  dialogNext() {
    const d = this.dlg; if (!d) return;
    if (d.shown < d.full.length) { d.shown = d.full.length - 0.01; this.dialogTick(1); return; }
    if (d.i < d.lines.length - 1) { d.i++; this.renderDialog(); }
    else if (d.actions) this.dialogAct(0);
    else { this.dlg = null; this.renderDialog(); }
  },
  dialogAct(k) { const a = this.dlg && this.dlg.actions && this.dlg.actions[k]; this.dlg = null; this.renderDialog(); if (a && a[1]) a[1](); },

  // ---------------------------------------------------------------- pets
  openPets() {
    this.open('Pets', () => {
      const P = G.P, eggs = P.inv.map((s, k) => s && ITEMS[s.id].egg ? k : -1).filter(k => k >= 0);
      let h = eggs.length ? `<div class="lbl">Eggs in your inventory</div><div class="row gap wrap">${eggs.map(k => `<div class="egbox">${this.slot(P.inv[k], 'inv:' + k)}<button class="btn sm" data-a="hatch" data-v="${k}">Hatch</button></div>`).join('')}</div>` : '';
      h += `<div class="lbl">Your pets (${P.pets.length}) — click to summon</div>`;
      if (!P.pets.length) h += `<div class="empty">No pets yet. Buy an egg from <b>Pet Seller Pip</b> in the SkyHub, or find eggs from bosses and fishing.</div>`;
      h += '<div class="pets">' + P.pets.map((p, k) => `<div class="pet r${p.rar} ${P.petActive === k ? 'on' : ''}" data-a="pet" data-v="${k}" data-tip="pet:${k}"><div class="pe">${PETS[p.id].e}</div><div style="color:${RCOL[p.rar]}">${PETS[p.id].name}</div><div class="small">Lv ${p.lvl} · ${RARITY[p.rar]}</div>${P.petActive === k ? '<div class="tag">ACTIVE</div>' : ''}</div>`).join('') + '</div>';
      return h;
    }, true);
    this.cur.inv = true;
  },

  // ------------------------------------------------------------ warp map
  openMap() {
    this.open('Warp Map', () => {
      const cats = [['Home', ['home', 'hub']], ['Farming', ['farm1', 'farm2', 'farm3']], ['Mining', ['mine1', 'mine2', 'mine3']], ['Foraging', ['forest1', 'forest2', 'forest3']], ['Combat', ['combat1', 'combat2', 'combat3']], ['Dungeons', ['dungeon1', 'dungeon2', 'dungeon3']]];
      let h = `<p class="dim small">Warp to any island you've visited by walking through its portal in the SkyHub once. Dungeons always start from their portal.</p><div class="mapgrid">`;
      for (const [cn, keys] of cats) {
        h += `<div class="mapcol"><div class="lbl">${cn}</div>`;
        for (const k of keys) {
          const d = ZONES[k], req = zoneReq(k), visited = k === 'home' || k === 'hub' || G.P.visited[k];
          const can = !req && visited && d.cat !== 'dungeon';
          h += `<button class="warp" data-a="warp" data-v="${k}" ${can ? '' : 'disabled'} style="border-color:${CAT_COL[d.cat]}"><b style="color:${CAT_COL[d.cat]}">${esc(d.name)}</b><span class="small dim">${req ? '🔒 ' + req : !visited ? 'Visit via the SkyHub portal first' : d.boss ? 'Boss: ' + MOBS[d.boss].name : d.cat === 'home' ? 'Your own island' : 'Tier ' + (d.tier || '-')}</span></button>`;
        }
        h += '</div>';
      }
      h += '</div>';
      if (NET.connected && !NET.isHost) h += `<button class="btn" data-a="warpCoop">🏝 Visit ${esc(NET.hostName || 'host')}'s island (co-op)</button>`;
      const ev = currentEvent(); h += `<div class="lbl">Event schedule</div><div class="small">${[0, 1, 2, 3].map(i => { const e = currentEvent(Date.now() + i * EVENT_CYCLE); return `<span style="color:${e.ev.col}">${e.ev.name}</span>${i === 0 ? (ev.active ? ' (now!)' : ` in ${tLeft(ev.left)}`) : ''}`; }).join(' → ')}</div>`;
      return h;
    }, true);
  },

  // ------------------------------------------------------------------ menu
  openMenu() {
    this.open('Menu', () => `
      <div class="menu">
        <button class="btn" data-a="close">▶ Resume</button>
        <button class="btn" data-a="save">💾 Save now</button>
        <button class="btn" data-a="coop">🤝 Play with friends</button>
        <button class="btn" data-a="help">❔ Controls & tips</button>
        <button class="btn" data-a="sound">${SFX.enabled ? '🔊 Sound: on' : '🔇 Sound: off'}</button>
        <button class="btn" data-a="exportSave">📤 Export save code</button>
        <button class="btn" data-a="importSave">📥 Import save code</button>
        <button class="btn ghost" data-a="quit">⏏ Save & quit to title</button>
      </div><div class="small dim center">Profile: ${esc(G.P.name)} · progress autosaves every 20 seconds in this browser.</div>`);
  },
  openHelp() {
    this.open('Controls & Tips', () => `<div class="help">
      <div><b>Move</b> W A S D · <b>Aim</b> mouse</div><div><b>Use / break / attack</b> hold left-click</div><div><b>Place / plant / eat / open</b> right-click</div>
      <div><b>Talk / use station</b> F · <b>Rotate conveyor</b> R</div><div><b>Hotbar</b> 1–9 or mouse wheel</div>
      <div><b>Inventory</b> E · <b>Craft</b> C · <b>Skills</b> K · <b>Pets</b> P · <b>Warp map</b> M · <b>Chat</b> T or Enter · <b>Menu</b> Esc</div>
      <hr><div>🪓 Every tool is best at its own job: axes chop trees, pickaxes and drills mine ore, hoes till and harvest, swords/bows/wands fight. Better tools hit harder and add Fortune (more drops).</div>
      <div>📈 Breaking natural resources gives skill XP. Blocks you placed yourself never do. Skill levels unlock new trees, ores, crops, islands and recipes.</div>
      <div>⚙️ On your island: place machines (Lumber Bot, Auto Drill, Auto Grower, Mob Grinder), point conveyors away from them into a Chest, Auto Furnace, Compactor or Auto Seller. Machines keep working while you're offline.</div>
      <div>🎉 Events rotate every 6 minutes for everyone: double drops, pests, Golden Goblins and boss spawns.</div>
      <div>💀 Dungeons: clear rooms to open the boss gate, beat the boss, and open the reward chest. Three deaths ends the run.</div></div>`);
  },

  // ------------------------------------------------------------------ npcs
  openNpc(id) {
    const n = NPCS[id], f = NPC_PANELS[id], L = NPC_LINES[id];
    if (!L) return f && f(n);
    const first = !G.P.met[id]; G.P.met[id] = 1;
    if (id === 'guide') {
      const step = G.P.tut < TUTORIAL.length ? TUTORIAL[G.P.tut] : null;
      const tips = L.tips.slice().sort(() => Math.random() - 0.5).slice(0, 2);
      return this.say('guide', step && step.say ? step.say : [L.hi[randi(0, L.hi.length - 1)], ...tips], [['All tips', () => f(n)], ['Thanks!', null]]);
    }
    this.say(id, first ? L.intro : [L.hi[randi(0, L.hi.length - 1)]], [[L.btn, () => f(n)], ['Bye', null]]);
  },

  // ----------------------------------------------------------- machines
  openMachine(z, i) {
    this.mach = { z, i };
    this.open('Machine', () => {
      const o = z.objs[i]; if (!o || o.k !== 'mach') { setTimeout(() => this.close(), 0); return ''; }
      const M = MACHINES[o.id], cap = M.kind === 'gather' ? machineCap(o.tier) : 64 * o.tier;
      $('panelTitle').innerHTML = `${M.e} ${M.name} <span style="color:#ffd23a">${ROMAN[o.tier]}</span>`;
      let h = `<p class="dim">${M.desc} ${M.kind === 'gather' ? 'Items pile up inside until collected — or push them out with a conveyor next to it.' : 'Feed it with a conveyor pointing into it, or insert items by hand.'}</p>`;
      h += `<div class="row gap small"><span>⏱ ${machinePeriod(o.id, o.tier).toFixed(1)}s per ${M.kind === 'gather' ? 'harvest' : 'item'}</span><span>📦 Capacity ${cap}</span>${o.earned ? `<span>💰 Earned ${fmt(o.earned)}</span>` : ''}</div>`;
      if (M.kind === 'gather') {
        const res = machineResources(o.id);
        h += `<div class="lbl">Resource</div><div class="small dim">Switching costs coins plus a starter batch of the new resource. Unlock options with ${SKILLS[M.skill].name} levels and collections.</div><div class="resgrid">${res.map(r => {
          const ic = M.res === 'mob' ? MOBS[r].drops[0][0] : M.res === 'fish' ? r : NODES[r].item, nm = M.res === 'mob' ? MOBS[r].name : M.res === 'fish' ? ITEMS[r].name : NODES[r].name, lock = machineResLock(o.id, r), c = machineSwitchCost(o.id, r);
          const afford = G.P.coins >= c.coins && hasItems(c.items);
          return `<button class="resb ${o.res === r ? 'on' : ''}" data-a="mres" data-v="${r}" ${o.res === r || lock || !afford ? 'disabled' : ''}>${this.icon(ic, 22)}<b>${esc(nm)}</b><span class="small">${o.res === r ? '✔ Active' : lock ? '🔒 ' + esc(lock) : `🪙 ${fmt(c.coins)} + ${c.items[0][1]}× ${esc(ITEMS[c.items[0][0]].name)}`}</span></button>`;
        }).join('')}</div>`;
        if (o.noWater) h += '<div class="lockmsg">💧 This Auto Fisher needs water right next to it.</div>';
      } else {
        if (o.id === 'assembler') {
          const r = RECIPES[o.recipe];
          h += `<div class="lbl">Recipe</div>${r ? `<div class="row gap">${this.icon(r.out, 26)} <b>${esc(ITEMS[r.out].name)} ×${r.n}</b> <span class="small dim">needs ${r.in.map(([id, n]) => `${n}× ${id[0] === '#' ? (id === '#log' ? 'any log' : 'any fuel') : esc(ITEMS[id].name)}`).join(', ')}</span></div>` : '<div class="small dim">Pick what this assembler should make.</div>'}
            <select id="asmPick"><option value="">Choose a recipe…</option>${assemblerRecipes().map(ri => `<option value="${ri}" ${o.recipe === ri ? 'selected' : ''}>${esc(ITEMS[RECIPES[ri].out].name)}</option>`).join('')}</select><button class="btn sm" data-a="masm">Set recipe</button>`;
        }
        h += `<div class="lbl">Input queue (${inqCount(o)})</div><div class="row gap wrap">${Object.entries(o.inq).map(([id, n]) => `<span class="chip">${this.icon(id, 18)} ${n}</span>`).join('') || '<span class="dim small">empty</span>'}</div><div class="row gap"><button class="btn sm" data-a="minsert">Insert matching items from inventory</button><button class="btn sm ghost" data-a="mtakein" ${inqCount(o) ? '' : 'disabled'}>Take inputs back</button></div>`;
      }
      h += `<div class="lbl">Output (${bufCount(o)}/${cap})</div><div class="row gap wrap">${Object.entries(o.buf).map(([id, n]) => `<span class="chip" data-tip="id:${id}">${this.icon(id, 18)} ${n}</span>`).join('') || '<span class="dim small">empty</span>'}</div><button class="btn" data-a="mcollect" ${bufCount(o) ? '' : 'disabled'}>Collect all</button>`;
      if (o.tier < MACHINE_MAX_TIER) {
        const up = MACHINE_UPGRADES[o.tier + 1], ok = G.P.coins >= up.coins && hasItems(up.items);
        h += `<div class="lbl">Upgrade to tier ${ROMAN[o.tier + 1]} — ${machinePeriod(o.id, o.tier + 1).toFixed(1)}s, capacity ${M.kind === 'gather' ? machineCap(o.tier + 1) : 64 * (o.tier + 1)}</div><div class="row gap wrap"><span class="ing ${G.P.coins >= up.coins ? 'ok' : 'no'}">🪙 ${fmt(up.coins)}</span>${up.items.map(([id, n]) => `<span class="ing ${countItem(id) >= n ? 'ok' : 'no'}" data-tip="id:${id}">${this.icon(id, 18)} ${countItem(id)}/${n} ${esc(ITEMS[id].name)}</span>`).join('')}</div><button class="btn" data-a="mupgrade" ${ok ? '' : 'disabled'}>Upgrade</button>`;
      } else h += `<div class="lbl" style="color:#ffd23a">Max tier reached</div>`;
      h += `<div class="row gap"><button class="btn ghost sm" data-a="mpickup">Pick up machine</button></div>`;
      return h;
    });
    this.cur.live = true;
  },
  openChest(z, i) {
    this.chest = { z, i, o: z.objs[i] };
    this.open('Chest', () => {
      const o = z.objs[i]; if (!o) return '';
      this.chest.o = o;
      let h = '<div class="lbl">Chest — click an item to move its whole stack</div><div class="grid g9">';
      for (let k = 0; k < 27; k++) h += this.slot(o.inv[k], 'chest:' + k);
      h += '</div><div class="row gap"><button class="btn sm" data-a="chestAll">Take all</button><button class="btn sm ghost" data-a="chestStore">Store all materials</button></div><div class="lbl">Inventory</div><div class="grid g9">';
      for (let k = 0; k < 36; k++) h += this.slot(G.P.inv[k], 'inv:' + k);
      return h + '</div>';
    }, true);
    this.cur.inv = true; this.cur.live = z.remote;
  },
  chestClick(k, i) {
    const c = this.chest; if (!c) return;
    if (c.z.remote) { NET.send({ t: 'chest', i: c.i, op: k === 'chest' ? 'take' : 'put', slot: i, item: k === 'inv' ? G.P.inv[i] : null }); if (k === 'inv') { G.P.inv[i] = null; G.invDirty = true; } return; }
    const o = c.o;
    if (k === 'chest') { const s = o.inv[i]; if (!s) return; const left = s.d ? addItem(s.id, 1, s.d, false) : addItem(s.id, s.n, null, false); if (left) s.n = left; else o.inv[i] = null; }
    else { const s = G.P.inv[i]; if (!s) return; if (s.d) { const k2 = o.inv.indexOf(null); if (k2 < 0) return; o.inv[k2] = s; G.P.inv[i] = null; } else { const left = chestAdd(o, s.id, s.n); if (left) s.n = left; else G.P.inv[i] = null; } }
    G.invDirty = true; this.refresh();
  },
};

function npcPrice(s) { const d = ITEMS[s.id]; return d.unique || s.d ? Math.round(instValue(s) * 0.5) : d.price; }
function nearStation(st) { return benchTier(st) > 0; }
// best workbench tier within reach (0 = none, pocket crafting only)
function benchTier(st = 'bench') {
  const z = G.zone, me = G.me; let best = 0;
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const o = z.o(Math.floor(me.x) + i, Math.floor(me.y) + j); if (o && o.k === 'block' && ITEMS[o.id].place.station === st) best = Math.max(best, ITEMS[o.id].place.bt || 1); }
  return best;
}
function recipeStatus(r, bt) {
  if (r.req && lvl(r.req[0]) < r.req[1]) return { lock: `${SKILLS[r.req[0]].name} ${r.req[1]}` };
  if (r.coll && collTier(r.coll[0]) < r.coll[1]) return { lock: `${ITEMS[r.coll[0]].name} Collection ${ROMAN[r.coll[1]]}` };
  if (r.st !== 'hand' && bt < (r.bt || 1)) return { station: `Needs a ${BENCH_NAMES[r.bt || 1]}` };
  if (r.st === 'hand' && r.in.length > 2 && !bt) return { station: 'Needs a Workbench' };
  return hasItems(r.in) ? { ok: true } : {};
}
// which concrete item to show for a tag ingredient; rotates through the options, preferring ones you own
function cycleId(tag) {
  if (tag[0] !== '#') return tag;
  const all = matchingIds(tag), own = all.filter(id => countItem(id) > 0), list = own.length ? own : all;
  return list[Math.floor(Date.now() / 1100) % list.length];
}
const SHAPES = { axe: 'mm.ms..s.', pickaxe: 'mmm.s..s.', hoe: 'mm..s..s.', sword: '.m..m..s.', helmet: 'mmmm.m...', chest: 'm.mmmmmmm', legs: 'mmmm.mm.m', boots: '...m.mm.m' };
function recipeGrid(r, size) {
  const cells = Array(size * size).fill(null);
  if (size === 3 && r.shape && SHAPES[r.shape] && (r.in.length <= 2)) {
    const mat = r.in[0], stick = r.in.find(x => x[0] === 'stick');
    SHAPES[r.shape].split('').forEach((ch, k) => { const ing = ch === 'm' ? mat : ch === 's' ? stick : null; if (ing) cells[k] = { id: ing[0], show: cycleId(ing[0]), n: 1, need: ing[1] }; });
    return cells;
  }
  r.in.forEach(([id, n], k) => { if (k < cells.length) cells[size === 3 ? [4, 3, 5, 1, 7, 0, 2, 6, 8][k] : k] = { id, show: cycleId(id), n, need: n }; });
  return cells;
}
function craft(ri, times) {
  const r = RECIPES[ri]; let made = 0;
  for (let k = 0; k < times; k++) {
    if (!recipeStatus(r, benchTier()).ok) break;
    if (!takeItems(r.in)) break;
    const left = addItem(r.out, r.n, null, false);
    if (left) spawnDrop(G.zone, G.me.x, G.me.y, r.out, left);
    made += r.n;
  }
  if (made) { SFX.craft(); UI.pickup(r.out, made); burst(G.me.x, G.me.y - 0.5, '#ffe9a8', 10, 2, 4); questCheck(); }
}

// ------------------------------------------------------------- NPC panels
function shopRows(stock, kind) {
  return stock.map(([id, price]) => `<div class="shoprow"><div class="slot r${ITEMS[id].rar}" data-tip="id:${id}"><img src="${iconURL(id)}" alt=""></div><div class="grow"><span style="color:${RCOL[ITEMS[id].rar]}">${esc(ITEMS[id].name)}</span><div class="small dim">🪙 ${fmt(price)}</div></div><button class="btn sm" data-a="${kind}" data-v="${id}|${price}|1" ${G.P.coins >= price ? '' : 'disabled'}>Buy</button>${ITEMS[id].unique ? '' : `<button class="btn sm ghost" data-a="${kind}" data-v="${id}|${price}|16" ${G.P.coins >= price * 16 ? '' : 'disabled'}>×16</button>`}</div>`).join('');
}
const NPC_LINES = {
  merchant: { btn: '🛒 Trade', intro: ['Well hello there, fresh face! Mara\'s the name, General Store\'s the game.', 'I\'ll buy <b>anything</b> you haul back from the islands, and I sell seeds and starter tools.', 'Psst — the <b>Bazaar</b> next door usually pays a bit more for raw materials.'], hi: ['Back with full pockets? Let\'s see what you\'ve got!', 'Fresh seeds in today. Well… same seeds. Still fresh!', 'Sold anything shiny lately?'] },
  bazaar: { btn: '📈 Open Bazaar', intro: ['Welcome to the <b>Bazaar</b>, where every material has a live price.', 'Buy and sell in bulk instantly. When everyone sells, prices drop. When everyone buys… you get the idea.', 'Watch the little trend lines. Sell high, islander!'], hi: ['Markets are moving! Care to trade?', 'Iron\'s been jumpy today…', 'Buy low, sell high. Easy, right?'] },
  auction: { btn: '🔨 Browse auctions', intro: ['Order, order! This is the <b>Auction House</b>.', 'Islanders list rare gear, pets and enchanted books here. Bid on what you need, or list your own finds.', 'Price fairly and your items sell faster. There\'s a small 2% house fee.'], hi: ['New listings just came in!', 'Looking for something rare today?', 'A fine pickaxe sold for a fortune this morning…'] },
  petshop: { btn: '🥚 See eggs', intro: ['Aww, you look like someone who needs a <b>pet</b>!', 'Every egg hatches into a buddy that follows you around and boosts your stats.', 'Pets level up alongside your skills. A mining pet loves when you mine!'], hi: ['The eggs are extra wobbly today!', 'Who\'s a good islander? You are!', 'Have you met my Owl? He\'s very wise. And sleepy.'] },
  petsitter: { btn: '✨ Upgrade pets', intro: ['I\'m Kai. I take pets and make them… <b>rarer</b>.', 'Higher rarity means every stat your pet gives is stronger. It costs coins and some compacted materials.'], hi: ['How\'s your little companion doing?', 'Legendary pets are a sight to behold.'] },
  enchanter: { btn: '📖 Enchant', intro: ['The air hums with magic here, can you feel it?', 'Bring me a tool, weapon or armor plus some <b>Lapis Lazuli</b> and I\'ll weave enchantments into it.', 'Enchanted Books from bosses can push an enchant beyond its usual limit.'], hi: ['The runes whisper your name…', 'Lapis, coins, and a little patience.', 'Sharpness for swords, Fortune for picks. Simple!'] },
  blacksmith: { btn: '⚒️ Reforge', intro: ['HAH! A new customer! Brom\'s the name, hammering\'s the game.', '<b>Reforging</b> rolls a random modifier onto your gear. Rarer gear gets bigger bonuses!', 'Got a <b>Rarity Prism</b>? I can use it to make an item one rarity tier higher.'], hi: ['Hot forge, hot deals!', 'That axe has seen better days. Let me look!', 'Sparks fly when Brom works!'] },
  banker: { btn: '🏦 Banking', intro: ['Good day. Coins in the <b>bank</b> are safe even when you faint in battle.', 'And they quietly earn interest while you play.'], hi: ['Your savings are in good hands.', 'Deposit early, deposit often.'] },
  engineer: { btn: '⚙️ Workshop', intro: ['Gears! Belts! Automation! You\'ve come to the right place.', 'Machines on your island gather resources on their own, even while you\'re offline.', 'Point <b>conveyors</b> out of them into chests, furnaces or sellers. I also tune up drills with engines and fuel tanks!'], hi: ['Got any new contraptions running?', 'Belts should flow like rivers!', 'A drill with a fresh engine purrs like a kitten.'] },
  guide: { btn: '💡 Tips', hi: ['Need a hand, islander?', 'The skies are big. Let me help!'], tips: ['Bare hands are slow. An <b>axe</b> chops trees much faster, and a <b>pickaxe</b> is the only way to crack rocks.', '<b>Fortune</b> means extra drops. You get it from better tools, enchants, reforges, skill levels, armor and pets.', 'Gathering grows your <b>collections</b> (K → Collections). Collection tiers unlock recipes like machines and compacted materials.', 'Better recipes need a better <b>workbench</b>. Upgrade it Reinforced → Arcane → Starforge.', 'The <b>furnace</b> smelts over time. Load ore on top and coal below, then go do something else.', 'Machines keep working while you\'re offline. Upgrade them for speed and storage.', 'Combat islands spawn a <b>boss</b> every few minutes. During a Blood Moon they appear instantly.', 'Put your coins in the <b>bank</b>. Dying costs 10% of the coins in your purse.', 'Press <b>N</b> for the big map and <b>+ / −</b> (or Ctrl + scroll) to zoom.', 'Wear 4 pieces of the same <b>armor set</b> for a powerful set bonus.'] },
};
NPC_LINES.bounty = { btn: '📜 See bounties', intro: ['Name\'s Rook. I post <b>bounties</b> for islanders who want quick coin.', 'Three new jobs every hour: hunt monsters, gather resources or catch fish.', 'Finish one and come back here to collect your reward.'], hi: ['Fresh bounties on the board!', 'Got a job for you, islander.', 'Rewards are waiting for those who finish the job.'] };
const NPC_PANELS = {
  bounty(n) {
    UI.open(`${n.e} Bounty Board`, () => {
      const list = bounties(), left = 3600000 - Date.now() % 3600000;
      return `<p class="dim small">New bounties in ${tLeft(left)}. Only gathering by hand counts, not machines.</p>` + list.map((b, k) => {
        const icon = b.type === 'kill' ? (MOBS[b.target].drops[0] ? MOBS[b.target].drops[0][0] : 'bone') : b.type === 'fish' ? 'raw_cod' : b.target;
        return `<div class="shoprow ${b.claimed ? 'dimmed' : ''}"><div class="slot">${UI.icon(icon, 34)}</div><div class="grow"><b>${esc(bountyText(b))}</b><div class="bar"><i style="width:${b.prog / b.n * 100}%;background:#ffd23a"></i></div><div class="small dim">${fmt(b.prog)} / ${fmt(b.n)} · reward 🪙 ${fmt(b.coins)} + ${fmt(b.xp)} ${SKILLS[b.skill].name} XP</div></div>
          <button class="btn sm" data-a="bclaim" data-v="${k}" ${b.done && !b.claimed ? '' : 'disabled'}>${b.claimed ? 'Claimed' : b.done ? 'Claim' : 'In progress'}</button></div>`;
      }).join('');
    }, true);
    UI.cur.live = true;
  },
  merchant(n) {
    UI.tab.merch = UI.tab.merch || 'sell';
    UI.open(`${n.e} ${n.name}`, () => {
      let h = `<div class="tabs"><button class="tab ${UI.tab.merch === 'sell' ? 'on' : ''}" data-a="mtab" data-v="sell">Sell</button><button class="tab ${UI.tab.merch === 'buy' ? 'on' : ''}" data-a="mtab" data-v="buy">Buy</button></div>`;
      if (UI.tab.merch === 'buy') return h + `<p class="dim small">Starter supplies. Resources sell for more at the Bazaar!</p>` + shopRows(MERCHANT_STOCK, 'buy');
      const groups = {};
      G.P.inv.forEach((s, k) => { if (!s) return; const key = s.d ? 'u' + k : s.id; (groups[key] = groups[key] || { s, k, n: 0 }).n += s.n; });
      const rows = Object.entries(groups);
      h += `<p class="dim small">Click Sell to sell instantly. Tools and special items sell for half their value.</p><button class="btn" data-a="sellJunk">Sell all resources (${fmt(junkValue())} coins)</button>`;
      if (!rows.length) h += '<div class="empty">Your inventory is empty.</div>';
      h += rows.map(([key, g]) => `<div class="shoprow">${UI.slot(g.s, 'inv:' + g.k)}<div class="grow"><span style="color:${RCOL[instRar(g.s)]}">${esc(instName(g.s))}</span><div class="small dim">${g.n} × 🪙 ${fmt(npcPrice(g.s))} = ${fmt(npcPrice(g.s) * g.n)}</div></div><button class="btn sm" data-a="sell" data-v="${key}|1">Sell 1</button>${g.n > 1 ? `<button class="btn sm ghost" data-a="sell" data-v="${key}|all">All</button>` : ''}</div>`).join('');
      return h;
    }, true);
    UI.cur.inv = true;
  },
  bazaar(n) {
    UI.tab.bz = UI.tab.bz || 'farming';
    UI.open(`${n.e} Bazaar`, () => {
      const tabs = [['farming', 'Farming'], ['mining', 'Mining'], ['foraging', 'Foraging'], ['combat', 'Combat'], ['fishing', 'Fishing'], ['ench', 'Enchanted']];
      let h = `<div class="tabs">${tabs.map(([k, t]) => `<button class="tab ${UI.tab.bz === k ? 'on' : ''}" data-a="bztab" data-v="${k}">${t}</button>`).join('')}</div><p class="dim small">Prices move with supply and demand. Buying pushes prices up; selling pushes them down.</p><div class="bzhead"><span></span><span>Item</span><span>Buy</span><span>Sell</span><span>Trend</span><span></span></div>`;
      const ids = BZ.products().filter(id => UI.tab.bz === 'ench' ? id.startsWith('enchanted_') : (!id.startsWith('enchanted_') && ITEMS[id].cat === UI.tab.bz));
      h += ids.map(id => {
        const it = ITEMS[id], have = countItem(id), hist = BZ.state.h[id], b = BZ.buyPrice(id), s = BZ.sellPrice(id);
        const mn = Math.min(...hist), mx = Math.max(...hist), pts = hist.map((v, i) => `${(i / Math.max(1, hist.length - 1) * 60).toFixed(1)},${(18 - (mx > mn ? (v - mn) / (mx - mn) : 0.5) * 16).toFixed(1)}`).join(' ');
        const up = hist.length > 1 && hist[hist.length - 1] >= hist[0];
        return `<div class="bzrow"><div class="slot r${it.rar}" data-tip="id:${id}"><img src="${iconURL(id)}" alt=""></div><div><span style="color:${RCOL[it.rar]}">${esc(it.name)}</span><div class="small dim">You have ${fmt(have)}</div></div><b class="num">${b < 100 ? b.toFixed(1) : fmt(b)}</b><b class="num" style="color:#9aff8a">${s < 100 ? s.toFixed(1) : fmt(s)}</b>
          <svg width="60" height="20" viewBox="0 0 60 20"><polyline points="${pts}" fill="none" stroke="${up ? '#5dff6a' : '#ff6a6a'}" stroke-width="1.6"/></svg>
          <div class="bzb"><button class="btn xs" data-a="bzbuy" data-v="${id}|1">Buy 1</button><button class="btn xs" data-a="bzbuy" data-v="${id}|64">64</button><button class="btn xs ghost" data-a="bzsell" data-v="${id}|1" ${have ? '' : 'disabled'}>Sell 1</button><button class="btn xs ghost" data-a="bzsell" data-v="${id}|all" ${have ? '' : 'disabled'}>All</button></div></div>`;
      }).join('');
      return h;
    }, true);
    UI.cur.inv = true;
  },
  auction(n) {
    UI.tab.ah = UI.tab.ah || 'browse'; UI.tab.ahf = UI.tab.ahf || 'all';
    UI.open(`${n.e} Auction House`, () => {
      const t = UI.tab.ah;
      let h = `<div class="tabs"><button class="tab ${t === 'browse' ? 'on' : ''}" data-a="ahtab" data-v="browse">Browse</button><button class="tab ${t === 'mine' ? 'on' : ''}" data-a="ahtab" data-v="mine">My listings (${AH.state.mine.length})</button><button class="tab ${t === 'create' ? 'on' : ''}" data-a="ahtab" data-v="create">Create listing</button></div>`;
      if (t === 'browse') {
        const fs = [['all', 'All'], ['tool', 'Tools'], ['weapon', 'Weapons'], ['pet', 'Pets & Eggs'], ['book', 'Books'], ['other', 'Other']];
        h += `<div class="row gap wrap">${fs.map(([k, v]) => `<button class="chip ${UI.tab.ahf === k ? 'on' : ''}" data-a="ahf" data-v="${k}">${v}</button>`).join('')}</div><div class="ahgrid">`;
        const list = AH.state.list.filter(l => { const f = UI.tab.ahf; if (f === 'all') return true; if (l.pet) return f === 'pet'; const d = ITEMS[l.item.id]; if (f === 'pet') return d.egg; if (f === 'book') return l.item.id === 'ench_book'; if (f === 'tool' || f === 'weapon') return d.cat === f; return !d.egg && l.item.id !== 'ench_book' && d.cat !== 'tool' && d.cat !== 'weapon'; }).sort((a, b) => a.price - b.price);
        h += list.map(l => ahCard(l, `<button class="btn sm" data-a="ahbuy" data-v="${l.id}" ${G.P.coins >= l.price ? '' : 'disabled'}>Buy now</button>`)).join('') + '</div>';
      } else if (t === 'mine') {
        if (!AH.state.mine.length) h += '<div class="empty">You have no listings. Create one to sell gear and pets to other islanders.</div>';
        h += '<div class="ahgrid">' + AH.state.mine.map(l => ahCard(l, l.sold ? `<button class="btn sm" data-a="ahclaim" data-v="${l.id}">Claim ${fmt(l.price * 0.98)}</button>` : `<span class="small dim">${l.ends < Date.now() ? 'Expired' : 'Ends in ' + tLeft(l.ends - Date.now())}</span><button class="btn sm ghost" data-a="ahclaim" data-v="${l.id}">${l.ends < Date.now() ? 'Take back' : 'Cancel'}</button>`)).join('') + '</div>';
      } else {
        const pick = UI.pick;
        h += `<p class="dim small">Pick an item from your inventory (or a pet), set a price and a duration. Buyers pay more readily for fair prices. 2% tax on sales.</p><div class="grid g9">`;
        for (let k = 0; k < 36; k++) h += UI.slot(G.P.inv[k], 'inv:' + k, pick && pick.kind === 'inv' && pick.i === k ? 'sel' : '');
        h += '</div>';
        if (G.P.pets.length) h += `<div class="lbl">Pets</div><div class="pets">${G.P.pets.map((p, k) => `<div class="pet r${p.rar} ${pick && pick.kind === 'pet' && pick.i === k ? 'on' : ''}" data-a="ahpickpet" data-v="${k}" data-tip="pet:${k}"><div class="pe">${PETS[p.id].e}</div><div class="small">Lv${p.lvl} ${PETS[p.id].name}</div></div>`).join('')}</div>`;
        if (pick) {
          const est = pick.kind === 'pet' ? AH.petValue(G.P.pets[pick.i]) : (G.P.inv[pick.i] ? instValue(G.P.inv[pick.i]) : 0);
          h += `<div class="createbox"><div>Estimated value: <b style="color:#ffd23a">${fmt(est)}</b></div><label>Price <input id="ahPrice" type="number" min="1" value="${Math.round(est * 1.1)}" data-keep="1"></label><label>Duration <select id="ahDur"><option value="1">1 hour</option><option value="6" selected>6 hours</option><option value="24">24 hours</option></select></label><button class="btn" data-a="ahcreate">List it</button></div>`;
        }
      }
      return h;
    }, true);
    UI.cur.inv = true; UI.cur.pickInv = i => { if (UI.tab.ah !== 'create') return; UI.pick = G.P.inv[i] ? { kind: 'inv', i } : null; UI.refresh(); };
  },
  petshop(n) {
    UI.open(`${n.e} ${n.name}`, () => `<p class="dim">Eggs hatch into a random pet. Pets follow you, gain XP from skills and boost your stats.</p>` + shopRows(PETSHOP_STOCK, 'buy') +
      `<div class="lbl">Sell a pet</div>${G.P.pets.length ? `<div class="pets">${G.P.pets.map((p, k) => `<div class="pet r${p.rar}" data-tip="pet:${k}"><div class="pe">${PETS[p.id].e}</div><div class="small">Lv${p.lvl} ${PETS[p.id].name}</div><button class="btn xs ghost" data-a="sellpet" data-v="${k}">Sell ${fmt(AH.petValue(p) * 0.3)}</button></div>`).join('')}</div>` : '<div class="empty small">No pets.</div>'}`, true);
  },
  petsitter(n) {
    UI.open(`${n.e} ${n.name}`, () => {
      if (!G.P.pets.length) return '<div class="empty">Come back when you have a pet! I can raise its rarity, which multiplies all of its stats.</div>';
      let h = '<p class="dim">Raising rarity boosts every pet stat by 25% per tier. Level is kept.</p><div class="pets">';
      h += G.P.pets.map((p, k) => {
        const up = PET_UPGRADE[p.rar];
        return `<div class="pet r${p.rar}" data-tip="pet:${k}"><div class="pe">${PETS[p.id].e}</div><div style="color:${RCOL[p.rar]}">${RARITY[p.rar]} ${PETS[p.id].name}</div><div class="small">Lv ${p.lvl}</div>${up ? `<div class="small">→ <span style="color:${RCOL[p.rar + 1]}">${RARITY[p.rar + 1]}</span><br>🪙 ${fmt(up.coins)} + ${up.items.map(([id, c]) => `${c}× ${esc(ITEMS[id].name)}`).join(', ')}</div><button class="btn xs" data-a="petup" data-v="${k}" ${G.P.coins >= up.coins && hasItems(up.items) ? '' : 'disabled'}>Upgrade</button>` : '<div class="small" style="color:#ffd23a">Max rarity</div>'}</div>`;
      }).join('');
      return h + '</div>';
    }, true);
    UI.cur.inv = true;
  },
  enchanter(n) { UI.openEnchant(n); },
  blacksmith(n) { UI.openReforge(n); },
  banker(n) {
    UI.open(`${n.e} ${n.name}`, () => `<p class="dim">Coins in the bank are safe when you die and earn 1% interest per hour (while you play).</p>
      <div class="bankbox"><div>Purse<br><b style="color:#ffd23a">🪙 ${fmt(G.P.coins)}</b></div><div>Bank<br><b style="color:#ffd23a">🏦 ${fmt(G.P.bank)}</b></div></div>
      <div class="row gap wrap"><button class="btn" data-a="bank" data-v="dep|all">Deposit all</button><button class="btn" data-a="bank" data-v="dep|half">Deposit half</button><button class="btn ghost" data-a="bank" data-v="wd|all">Withdraw all</button><button class="btn ghost" data-a="bank" data-v="wd|half">Withdraw half</button></div>
      <div class="row gap"><input id="bankAmt2" type="number" min="1" placeholder="Amount"><button class="btn sm" data-a="bank" data-v="dep|custom">Deposit</button><button class="btn sm ghost" data-a="bank" data-v="wd|custom">Withdraw</button></div>`);
  },
  engineer(n) {
    UI.open(`${n.e} ${n.name}`, () => {
      const next = ISLAND_SIZES[G.P.islandR + 1];
      return `<p class="dim">Automate your island! Gatherers produce resources on their own (even offline). Conveyors carry items into chests, furnaces, compactors or sellers.</p>` + shopRows(ENGINEER_STOCK, 'buy') +
        `<div class="lbl">Drill tune-up</div>${(() => { const drills = G.P.inv.map((s, k) => s && ITEMS[s.id].tool && ITEMS[s.id].tool.fuel ? k : -1).filter(k => k >= 0); if (!drills.length) return '<div class="small dim">Bring a drill to install Drill Engines (+20% break speed each, max 3) and Fuel Tanks (2× fuel each, max 2). Both are crafted at an Arcane Workbench.</div>'; return drills.map(k => { const s = G.P.inv[k]; return `<div class="shoprow">${UI.slot(s, 'inv:' + k)}<div class="grow">${esc(instName(s))}<div class="small dim">Engine ${s.d.eng || 0}/3 · Tank ${s.d.tank || 0}/2 · Fuel ${fmt(s.d.fuel)}/${fmt(drillCap(s))}</div></div><button class="btn xs" data-a="drillPart" data-v="${k}|eng" ${(s.d.eng || 0) < 3 && countItem('drill_engine') ? '' : 'disabled'}>Engine (${countItem('drill_engine')})</button><button class="btn xs" data-a="drillPart" data-v="${k}|tank" ${(s.d.tank || 0) < 2 && countItem('fuel_tank') ? '' : 'disabled'}>Tank (${countItem('fuel_tank')})</button></div>`; }).join(''); })()}` +
        `<div class="lbl">Island expansion</div>${next ? `<div class="shoprow"><div class="slot">🏝</div><div class="grow">Expand your island to radius ${next.r}<div class="small dim">🪙 ${fmt(next.cost)}</div></div><button class="btn sm" data-a="expand" ${G.P.coins >= next.cost ? '' : 'disabled'}>Expand</button></div>` : '<div class="small" style="color:#ffd23a">Your island is fully expanded.</div>'}`;
    }, true);
  },
  guide(n) {
    UI.open(`${n.e} ${n.name}`, () => {
      return `<div class="help">${NPC_LINES.guide.tips.map(t => `<div>💡 ${t}</div>`).join('')}</div>`;
    });
  },
};
function ahCard(l, btn) {
  const isPet = !!l.pet, nm = isPet ? `[Lv${l.pet.lvl}] ${PETS[l.pet.id].name}` : instName(l.item), r = isPet ? l.pet.rar : instRar(l.item);
  const ic = isPet ? `<div class="slot r${r}" data-tip="ah:${l.id}"><span class="pe2">${PETS[l.pet.id].e}</span></div>` : UI.slot(l.item, 'ah:' + l.id);
  return `<div class="ahc">${ic}<div class="grow"><div style="color:${RCOL[r]}">${esc(nm)}</div><div class="small dim">by ${esc(l.seller || G.P.name)} · ${l.sold ? '<b style="color:#5dff6a">SOLD</b>' : tLeft(l.ends - Date.now())}</div><div style="color:#ffd23a">🪙 ${fmt(l.price)}</div></div>${btn}</div>`;
}
function junkValue() { let v = 0; for (const s of G.P.inv) if (s && !s.d && !ITEMS[s.id].unique && ['foraging', 'mining', 'farming', 'fishing', 'combat'].includes(ITEMS[s.id].cat) && !ITEMS[s.id].place) v += ITEMS[s.id].price * s.n; return v; }

// enchanting & reforging
UI.openEnchant = function (n) {
  this.pick = this.pick && this.pick.kind === 'inv' && G.P.inv[this.pick.i] && gearKind(ITEMS[G.P.inv[this.pick.i].id]) ? this.pick : null;
  this.open(`📖 ${n ? n.name : 'Enchanting Table'}`, () => {
    let h = '<p class="dim small">Pick a tool, weapon or armor piece from your inventory. Enchants cost coins and Lapis Lazuli. Books can push an enchant one level past its limit.</p><div class="grid g9">';
    for (let k = 0; k < 36; k++) { const s = G.P.inv[k]; h += this.slot(s, 'inv:' + k, (s && gearKind(ITEMS[s.id]) ? '' : 'faded ') + (this.pick && this.pick.i === k ? 'sel' : '')); }
    h += '</div>';
    const s = this.pick && G.P.inv[this.pick.i];
    if (!s) return h;
    const kind = gearKind(ITEMS[s.id]), cur = s.d.ench;
    h += `<div class="lbl">Enchants for <span style="color:${RCOL[instRar(s)]}">${esc(instName(s))}</span> · you have ${countItem('lapis')} Lapis</div><div class="enchs">`;
    for (const [id, e] of Object.entries(ENCHANTS)) {
      if (!e.on.includes(kind)) continue;
      h += `<div class="ench"><div><b>${e.name}</b> ${cur[id] ? `<span class="tag">${ROMAN[cur[id]]}</span>` : ''}<div class="small dim">${e.desc(Math.max(1, cur[id] || 1))}</div></div><div class="row gap wrap">`;
      for (let l = 1; l <= e.max; l++) { const c = enchantCost(id, l), ok = (cur[id] || 0) < l && G.P.coins >= c.coins && countItem('lapis') >= c.lapis; h += `<button class="btn xs ${(cur[id] || 0) >= l ? 'ghost' : ''}" data-a="enchant" data-v="${id}|${l}" ${ok ? '' : 'disabled'} title="${fmt(c.coins)} coins + ${c.lapis} lapis">${ROMAN[l]} · ${fmt(c.coins)}</button>`; }
      h += '</div></div>';
    }
    h += '</div>';
    const books = G.P.inv.map((b, k) => b && b.id === 'ench_book' && ENCHANTS[b.d.book].on.includes(kind) ? k : -1).filter(k => k >= 0);
    if (books.length) h += `<div class="lbl">Apply a book</div><div class="row gap wrap">${books.map(k => `<div class="egbox">${this.slot(G.P.inv[k], 'inv:' + k)}<button class="btn xs" data-a="applyBook" data-v="${k}">Apply (${fmt(100 * G.P.inv[k].d.l)})</button></div>`).join('')}</div>`;
    return h;
  }, true);
  this.cur.inv = true; this.cur.pickInv = i => { const s = G.P.inv[i]; if (s && gearKind(ITEMS[s.id])) { this.pick = { kind: 'inv', i }; this.refresh(); } };
};
UI.openReforge = function (n) {
  this.pick = this.pick && this.pick.kind === 'inv' && G.P.inv[this.pick.i] && gearKind(ITEMS[G.P.inv[this.pick.i].id]) ? this.pick : null;
  this.open(`⚒️ ${n ? n.name : 'Anvil'}`, () => {
    let h = '<p class="dim small">Reforging rolls a random modifier that adds stats. Rarer items get bigger bonuses. A Recombobulator raises an item\'s rarity by one tier.</p><div class="grid g9">';
    for (let k = 0; k < 36; k++) { const s = G.P.inv[k]; h += this.slot(s, 'inv:' + k, (s && gearKind(ITEMS[s.id]) ? '' : 'faded ') + (this.pick && this.pick.i === k ? 'sel' : '')); }
    h += '</div>';
    const s = this.pick && G.P.inv[this.pick.i];
    if (!s) return h;
    const r = instRar(s), cost = REFORGE_COST[r], grp = REFORGE_GROUP[gearKind(ITEMS[s.id])];
    h += `<div class="reforge"><div class="big slot r${r} glint">${'<img src="' + iconURL(s.id) + '" alt="">'}</div><div class="grow"><div style="color:${RCOL[r]};font-size:1.2em">${esc(instName(s))}</div><div class="small dim">Possible: ${Object.values(REFORGES[grp]).map(x => x.n).join(', ')}</div>
      <div class="row gap"><button class="btn" data-a="reforge" ${G.P.coins >= cost ? '' : 'disabled'}>Reforge · 🪙 ${fmt(cost)}</button><button class="btn ghost" data-a="recomb" ${countItem('recombobulator') && !s.d.rec ? '' : 'disabled'}>Recombobulate${s.d.rec ? ' (done)' : ` (${countItem('recombobulator')})`}</button></div></div></div>`;
    return h;
  }, true);
  this.cur.inv = true; this.cur.pickInv = i => { const s = G.P.inv[i]; if (s && gearKind(ITEMS[s.id])) { this.pick = { kind: 'inv', i }; this.refresh(); } };
};

// ------------------------------------------------------------- actions
const ACT = {
  none() { },
  close() { UI.close(); },
  closeOv() { $('overlay').hidden = true; $('overlay').innerHTML = ''; },
  slot(v, el, ev) { UI.clickSlot(v, ev); },
  sortInv() {
    const inv = G.P.inv, hot = inv.slice(0, 9), rest = inv.slice(9).filter(Boolean);
    const merged = []; for (const s of rest) { const m = !s.d && merged.find(x => x.id === s.id && !x.d && x.n < 999); if (m) { const a = Math.min(s.n, 999 - m.n); m.n += a; s.n -= a; if (s.n > 0) merged.push(s); } else merged.push(s); }
    const order = { weapon: 0, tool: 1, machine: 2, station: 3, block: 4 };
    merged.sort((a, b) => (order[ITEMS[a.id].cat] ?? 9) - (order[ITEMS[b.id].cat] ?? 9) || ITEMS[a.id].name.localeCompare(ITEMS[b.id].name));
    G.P.inv = hot.concat(merged, Array(27 - merged.length).fill(null)); G.invDirty = true; UI.refresh();
  },
  trash() { if (UI.sel == null) return UI.toast('Select an item first, then click the bin', '#aaa'); const i = +UI.sel.split(':')[1]; const s = G.P.inv[i]; G.P.inv[i] = null; UI.sel = null; G.invDirty = true; UI.toast(`Destroyed ${s ? esc(instName(s)) : 'item'}`, '#ff8a8a'); UI.refresh(); },
  ctab(v) { UI.tab.craft = v; UI.craftSel = null; UI.refresh(); },
  csel(v) { UI.craftSel = +v; UI.refresh(); },
  craft(v) { const [ri, n] = v.split('|'); craft(+ri, +n || 1); UI.refresh(); },
  sktab(v) { UI.tab.sk = v; UI.refresh(); },
  road(v) { UI.tab.road = v || null; UI.roadScrolled = 0; UI.refresh(); },
  dlgNext() { UI.dialogNext(); },
  dlgAct(v) { UI.dialogAct(+v); },
  hatch(v) { UI.close(); hatchEgg(+v); },
  pet(v) { const k = +v; G.P.petActive = G.P.petActive === k ? -1 : k; SFX.pop(); UI.refresh(); },
  warp(v) { UI.close(); travel(v === 'home' ? homeKey() : v); },
  warpCoop() { UI.close(); NET.visitHost(); },
  save() { saveGame(false); },
  coop() { NET.openPanel(); },
  help() { UI.openHelp(); },
  sound() { SFX.enabled = !SFX.enabled; G.P.sound = SFX.enabled; UI.refresh(); },
  exportSave() {
    saveGame(); const code = btoa(unescape(encodeURIComponent(JSON.stringify(G.P))));
    UI.open('Export save', () => `<p class="dim">Copy this code somewhere safe. Paste it into Import on any device to continue.</p><textarea id="saveCode" readonly rows="8">${code}</textarea><button class="btn" data-a="copySave">Copy to clipboard</button>`);
  },
  copySave() { const t = $('saveCode'); t.select(); try { navigator.clipboard.writeText(t.value).then(() => UI.toast('Copied!', '#5dff6a'), () => document.execCommand('copy')); } catch (e) { document.execCommand('copy'); } },
  importSave() { UI.open('Import save', () => `<p class="dim">Paste a save code. This replaces the current profile with the one in the code.</p><textarea id="importCode" rows="8"></textarea><button class="btn" data-a="doImport">Load save</button>`); },
  doImport() { try { const P = JSON.parse(decodeURIComponent(escape(atob($('importCode').value.trim())))); if (!P.uid || !P.inv) throw 0; saveGame(); NET.leave(); UI.close(); startGame(P); UI.toast('Save loaded', '#5dff6a'); } catch (e) { UI.toast('That code is not a valid save', '#ff6a6a'); } },
  quit() { saveGame(); NET.leave(); UI.close(); G.running = false; $('hud').hidden = true; Title.show(); },
  mtab(v) { UI.tab.merch = v; UI.refresh(); },
  buy(v) {
    const [id, p, nn] = v.split('|'), price = +p, n = +nn;
    if (G.P.coins < price * n) return UI.toast('Not enough coins', '#ff6a6a');
    const left = addItem(id, n, null, false); const got = n - left; if (!got) return UI.toast('Inventory full', '#ff6a6a');
    G.P.coins -= price * got; SFX.coin(); UI.pickup(id, got); UI.refresh();
  },
  sell(v) {
    const [key, amt] = v.split('|');
    if (key[0] === 'u' && /^u\d+$/.test(key)) { const k = +key.slice(1), s = G.P.inv[k]; if (!s) return; const val = npcPrice(s); G.P.inv[k] = null; addCoins(val); }
    else { const have = countItem(key), n = amt === 'all' ? have : Math.min(1, have); if (!n) return; removeItem(key, n); addCoins(ITEMS[key].price * n); }
    G.P.flags.sold = 1; G.invDirty = true; questCheck(); UI.refresh();
  },
  sellJunk() {
    let v = 0; G.P.inv.forEach((s, k) => { if (s && !s.d && !ITEMS[s.id].unique && ['foraging', 'mining', 'farming', 'fishing', 'combat'].includes(ITEMS[s.id].cat) && !ITEMS[s.id].place) { v += ITEMS[s.id].price * s.n; G.P.inv[k] = null; } });
    if (v) { addCoins(v); G.P.flags.sold = 1; questCheck(); } G.invDirty = true; UI.refresh();
  },
  bztab(v) { UI.tab.bz = v; UI.refresh(); },
  bzbuy(v) { const [id, n] = v.split('|'); const e = BZ.buy(id, +n); if (e) UI.toast(e, '#ff6a6a'); else UI.pickup(id, +n); UI.refresh(); },
  bzsell(v) { const [id, n] = v.split('|'); const e = BZ.sell(id, n === 'all' ? 1e9 : +n); if (e) UI.toast(e, '#ff6a6a'); G.invDirty = true; UI.refresh(); },
  ahtab(v) { UI.tab.ah = v; UI.pick = null; UI.refresh(); },
  ahf(v) { UI.tab.ahf = v; UI.refresh(); },
  ahbuy(v) { const e = AH.buy(v); UI.toast(e || 'Purchased!', e ? '#ff6a6a' : '#5dff6a'); UI.refresh(); },
  ahclaim(v) { const e = AH.claim(v); if (e) UI.toast(e, '#ff6a6a'); UI.refresh(); },
  ahpickpet(v) { UI.pick = { kind: 'pet', i: +v }; UI.refresh(); },
  ahcreate() {
    const p = +$('ahPrice').value, hrs = +$('ahDur').value, pick = UI.pick; if (!pick) return;
    const e = pick.kind === 'pet' ? AH.createPet(pick.i, p, hrs) : AH.createItem(pick.i, p, hrs);
    if (e) return UI.toast(e, '#ff6a6a');
    UI.pick = null; UI.tab.ah = 'mine'; UI.toast('Listing created', '#5dff6a'); UI.refresh();
  },
  sellpet(v) { const k = +v, p = G.P.pets[k]; if (!p) return; addCoins(AH.petValue(p) * 0.3); G.P.pets.splice(k, 1); if (G.P.petActive === k) G.P.petActive = -1; else if (G.P.petActive > k) G.P.petActive--; UI.refresh(); },
  petup(v) { const p = G.P.pets[+v], up = PET_UPGRADE[p.rar]; if (!up || G.P.coins < up.coins || !takeItems(up.items)) return; G.P.coins -= up.coins; p.rar++; SFX.hatch(); UI.announce(`${PETS[p.id].e} ${PETS[p.id].name} is now ${RARITY[p.rar]}!`, RCOL[p.rar]); UI.refresh(); },
  bank(v) {
    const [op, amt] = v.split('|'), P = G.P;
    let n = amt === 'all' ? (op === 'dep' ? P.coins : P.bank) : amt === 'half' ? (op === 'dep' ? P.coins : P.bank) / 2 : +($('bankAmt2').value || 0);
    if (op === 'dep') { n = Math.min(n, P.coins); P.coins -= n; P.bank += n; } else { n = Math.min(n, P.bank); P.bank -= n; P.coins += n; }
    if (n > 0) SFX.coin(); UI.refresh();
  },
  expand() { const next = ISLAND_SIZES[G.P.islandR + 1]; if (!next || G.P.coins < next.cost) return; G.P.coins -= next.cost; G.P.islandR++; const hz = getZone(homeKey()); expandHome(hz, next.r, G.P.uid); UI.announce('Island expanded!', '#7ad8ff', `Your island now has radius ${next.r}.`); SFX.level(); UI.refresh(); },
  enchant(v) {
    const [id, l] = v.split('|'), s = G.P.inv[UI.pick.i], c = enchantCost(id, +l);
    if (G.P.coins < c.coins || !removeItem('lapis', c.lapis)) return;
    G.P.coins -= c.coins; s.d.ench[id] = +l; G.P.flags.enchanted = 1; SFX.hatch(); burst(G.me.x, G.me.y - 0.5, '#c46bff', 30, 3, 5); questCheck(); G.invDirty = true; UI.refresh();
  },
  applyBook(v) {
    const b = G.P.inv[+v], s = G.P.inv[UI.pick.i], cost = 100 * b.d.l;
    if (G.P.coins < cost) return UI.toast('Not enough coins', '#ff6a6a');
    G.P.coins -= cost; s.d.ench[b.d.book] = Math.max(s.d.ench[b.d.book] || 0, b.d.l); G.P.inv[+v] = null; G.P.flags.enchanted = 1; SFX.hatch(); questCheck(); G.invDirty = true; UI.refresh();
  },
  reforge() {
    const s = G.P.inv[UI.pick.i], r = instRar(s), cost = REFORGE_COST[r], grp = REFORGE_GROUP[gearKind(ITEMS[s.id])];
    if (G.P.coins < cost) return;
    const opts = Object.keys(REFORGES[grp]).filter(k => k !== s.d.ref);
    G.P.coins -= cost; s.d.ref = opts[randi(0, opts.length - 1)]; G.P.flags.reforged = 1;
    SFX.craft(); UI.toast(`Reforged into <b>${esc(instName(s))}</b>`, '#5aa8ff'); burst(G.me.x, G.me.y - 0.5, '#ffd27a', 20, 3, 4); questCheck(); G.invDirty = true; UI.refresh();
  },
  recomb() { const s = G.P.inv[UI.pick.i]; if (!s || s.d.rec || !removeItem('recombobulator', 1)) return; s.d.rec = 1; SFX.hatch(); UI.announce('Recombobulated!', RCOL[instRar(s)], `${esc(instName(s))} is now ${RARITY[instRar(s)]}`); G.invDirty = true; UI.refresh(); },
  mres(v) {
    const m = UI.mach, o = m.z.objs[m.i]; if (!o || o.res === v || machineResLock(o.id, v)) return;
    const c = machineSwitchCost(o.id, v); if (G.P.coins < c.coins || !takeItems(c.items)) return UI.toast('You can\'t afford that switch yet', '#ff6a6a');
    G.P.coins -= c.coins; SFX.craft();
    if (m.z.remote) return NET.send({ t: 'mact', i: m.i, op: 'res', v });
    o.res = v; o.last = Date.now(); UI.toast(`Machine now produces ${esc(ITEMS[c.item].name)}`, '#5dff6a'); UI.refresh();
  },
  mcollect() {
    const m = UI.mach; if (m.z.remote) return NET.send({ t: 'mact', i: m.i, op: 'collect' });
    const o = m.z.objs[m.i]; for (const id of Object.keys(o.buf)) { const left = addItem(id, o.buf[id]); if (left) o.buf[id] = left; else delete o.buf[id]; } UI.refresh();
  },
  minsert() {
    const m = UI.mach, o = m.z.objs[m.i]; let n = 0;
    G.P.inv.forEach((s, k) => { if (!s || s.d) return; while (s.n > 0 && machAccepts(o, s.id)) { if (m.z.remote) { NET.send({ t: 'mact', i: m.i, op: 'insert', v: [s.id, s.n] }); n += s.n; s.n = 0; break; } o.inq[s.id] = (o.inq[s.id] || 0) + 1; s.n--; n++; } if (s.n <= 0) G.P.inv[k] = null; });
    G.invDirty = true; UI.toast(n ? `Inserted ${n} items` : 'Nothing in your inventory fits this machine', n ? '#5dff6a' : '#aaa'); UI.refresh();
  },
  mupgrade() {
    const m = UI.mach, o = m.z.objs[m.i], up = MACHINE_UPGRADES[o.tier + 1];
    if (!up || G.P.coins < up.coins || !takeItems(up.items)) return;
    G.P.coins -= up.coins;
    if (m.z.remote) NET.send({ t: 'mact', i: m.i, op: 'upgrade' }); else o.tier++;
    SFX.level(); burst(m.i % m.z.w + 0.5, Math.floor(m.i / m.z.w) + 0.5, '#ffd23a', 30, 4, 5); UI.refresh();
  },
  mpickup() {
    const m = UI.mach, x = m.i % m.z.w, y = Math.floor(m.i / m.z.w);
    UI.close();
    if (m.z.remote) return NET.send({ t: 'hit', x, y, a: Object.assign(actorInfo(), { pickup: 1 }) });
    const r = applyHit(m.z, x, y, actorInfo(), true); if (r) grantReward(r, x + 0.5, y + 0.5, true);
  },
  drillPart(v) {
    const [k, part] = v.split('|'), s = G.P.inv[+k]; if (!s) return;
    const item = part === 'eng' ? 'drill_engine' : 'fuel_tank', max = part === 'eng' ? 3 : 2;
    if ((s.d[part] || 0) >= max || !removeItem(item, 1)) return;
    s.d[part] = (s.d[part] || 0) + 1; SFX.level(); UI.toast(`Installed ${ITEMS[item].name} on ${esc(instName(s))}`, '#ffb020'); G.invDirty = true; UI.refresh();
  },
  chestAll() { const c = UI.chest; for (let k = 0; k < 27; k++) if (c.o.inv[k]) UI.chestClick('chest', k); },
  chestStore() { const c = UI.chest; G.P.inv.forEach((s, k) => { if (k >= 9 && s && !s.d && !ITEMS[s.id].unique) UI.chestClick('inv', k); }); },
};

// ---------------------------------------------------------- factory UIs
function assemblerRecipes() { return RECIPES.map((r, i) => i).filter(i => { const r = RECIPES[i], it = ITEMS[r.out]; return !it.unique && !it.place && r.in.length <= 3 && (r.cat === 'materials' || r.cat === 'food'); }); }
UI.openSorter = function (z, i) {
  this.sorter = { z, i };
  this.open('🔀 Sorter', () => {
    const o = z.objs[i]; if (!o || o.k !== 'sort') return '';
    const f = o.filter;
    let h = `<p class="dim">Items that match the filter go <b>straight through</b>. Everything else goes out the <b>left or right</b> side. With no filter, items are split evenly three ways. Press R before placing to choose its direction.</p>`;
    h += `<div class="row gap"><b>Filter:</b> ${f ? (f === '#greasy' ? '🫧 Any greasy produce' : `${this.icon(f, 24)} ${esc(ITEMS[f].name)}`) : '<span class="dim">none (splitter)</span>'} <button class="btn sm ghost" data-a="sortf" data-v="">Clear</button><button class="btn sm ghost" data-a="sortf" data-v="#greasy">Greasy produce</button></div>`;
    h += '<div class="lbl">Click an item to use it as the filter</div><div class="grid g9">';
    for (let k = 0; k < 36; k++) h += this.slot(G.P.inv[k], 'inv:' + k);
    return h + '</div>';
  });
  this.cur.inv = true; this.cur.pickInv = k => { const s = G.P.inv[k]; if (s) ACT.sortf(s.id); };
};
Object.assign(ACT, {
  bclaim(v) { claimBounty(+v); UI.refresh(); },
  sortf(v) { const s = UI.sorter, o = s.z.objs[s.i]; if (!o) return; if (s.z.remote) NET.send({ t: 'sortf', i: s.i, v: v || null }); o.filter = v || null; SFX.pop(); UI.refresh(); },
  masm() { const m = UI.mach, o = m.z.objs[m.i], v = $('asmPick').value; if (v === '') return; if (m.z.remote) NET.send({ t: 'mact', i: m.i, op: 'recipe', v: +v }); o.recipe = +v; UI.toast(`Assembler set to ${esc(ITEMS[RECIPES[+v].out].name)}`, '#5dff6a'); UI.refresh(); },
  mtakein() {
    const m = UI.mach, o = m.z.objs[m.i];
    if (m.z.remote) { NET.send({ t: 'mact', i: m.i, op: 'takein' }); return; }
    for (const id of Object.keys(o.inq)) { const left = addItem(id, o.inq[id]); if (left) o.inq[id] = left; else delete o.inq[id]; }
    UI.refresh();
  },
});