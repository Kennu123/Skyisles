'use strict';
// =====================================================================
//  Co-op multiplayer. Two transports with one protocol:
//   • "room"  – the Claude artifact room capability (when published)
//   • "peer"  – PeerJS / WebRTC (when the game is hosted anywhere else)
//  The host's island is authoritative: guests send actions, the host
//  applies them and broadcasts tile changes.
// =====================================================================
const NET = {
  connected: false, isHost: false, mode: null, code: null, players: new Map(), hostName: '', hostUid: '', hostPeer: null, myPeer: null,
  roomApi: null, room: null, peer: null, conns: new Map(), hostConn: null, stT: 0, dynT: 0, tileT: 0, chunks: {}, chatLog: [],

  async init() {
    try { if (window.claude && typeof window.claude.use === 'function') { const r = await window.claude.use('room'); if (r) this.roomApi = r; } } catch (e) { }
  },
  transport() { return this.roomApi ? 'room' : 'peer'; },
  genCode() { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < 5; i++) s += a[randi(0, a.length - 1)]; return s; },

  // ----------------------------------------------------------- connect
  async host() {
    if (this.connected) return;
    this.code = this.genCode(); this.isHost = true; this.hostUid = G.P.uid; this.hostName = G.P.name;
    try { await this.open(this.code, true); } catch (e) { this.fail(e); return; }
    this.connected = true; this.sys(`Hosting co-op · code <b>${this.code}</b>. Friends join with this code and can build on your island.`);
    const hz = G.zones[homeKey()]; if (hz) hz.dirty = new Set();
    UI.refresh();
  },
  async join(code) {
    if (this.connected) return;
    code = String(code || '').trim().toLowerCase(); if (!/^[a-z0-9]{4,8}$/.test(code)) return UI.toast('Enter the code your friend sees on their screen', '#ff6a6a');
    this.code = code; this.isHost = false;
    try { await this.open(code, false); } catch (e) { this.fail(e); return; }
    this.connected = true; this.sys(`Joined session <b>${code}</b>. Open the map (M) to visit the host's island.`);
    this.send({ t: 'join', name: G.P.name });
    UI.refresh();
  },
  fail(e) { this.connected = false; this.isHost = false; UI.toast('Could not connect: ' + esc(e && e.message ? e.message : e), '#ff6a6a'); },
  async open(code, asHost) {
    if (this.roomApi) {
      this.mode = 'room';
      this.room = await this.roomApi.join('skyisles-' + code);
      this.room.on('mp', m => { if (!m.sameTab) this.recv(m.data, m.peer); });
      this.room.onPeers(ch => {
        for (const p of ch.peers) { if (p.sameTab) this.myPeer = p.peer; }
        for (const p of ch.left) { this.players.delete(p.peer); if (p.peer === this.hostPeer) this.hostGone(); }
        for (const p of [...ch.joined, ...ch.updated]) { if (p.sameTab) continue; const st = p.presence && p.presence.st; if (st) this.applyState(p.peer, st); if (p.presence && p.presence.host) { this.hostPeer = p.peer; this.hostUid = p.presence.host; this.hostName = p.presence.hn || 'Host'; } }
      });
      if (asHost) this.room.presence({ host: G.P.uid, hn: G.P.name });
      return;
    }
    this.mode = 'peer';
    if (!window.Peer) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'; s.onload = res; s.onerror = () => rej(new Error('PeerJS failed to load')); document.head.appendChild(s); });
    await new Promise((res, rej) => {
      const id = asHost ? 'skyisles-' + code : undefined;
      this.peer = id ? new window.Peer(id) : new window.Peer();
      const to = setTimeout(() => rej(new Error('timed out')), 12000);
      this.peer.on('error', e => { clearTimeout(to); rej(e); });
      this.peer.on('open', pid => {
        this.myPeer = pid;
        if (asHost) { clearTimeout(to); this.peer.on('connection', c => this.wire(c)); res(); }
        else {
          const c = this.peer.connect('skyisles-' + code, { reliable: true });
          c.on('open', () => { clearTimeout(to); this.hostConn = c; this.hostPeer = c.peer; this.wire(c); res(); });
          c.on('error', e => { clearTimeout(to); rej(e); });
        }
      });
    });
  },
  wire(c) {
    this.conns.set(c.peer, c);
    c.on('data', d => { try { this.recv(typeof d === 'string' ? JSON.parse(d) : d, c.peer); } catch (e) { } });
    c.on('close', () => { this.conns.delete(c.peer); this.players.delete(c.peer); if (c.peer === this.hostPeer) this.hostGone(); else if (this.isHost) this.sys('A friend left.'); });
  },
  leave() {
    if (!this.connected) return;
    try { if (this.room) this.room.leave(); } catch (e) { }
    try { if (this.peer) this.peer.destroy(); } catch (e) { }
    if (G.zone && G.zone.remote) { travel(homeKey(), { force: true }); }
    this.room = null; this.peer = null; this.conns.clear(); this.hostConn = null; this.players.clear();
    this.connected = false; this.isHost = false; this.hostPeer = null; this.code = null;
    const hz = G.zones[homeKey()]; if (hz) hz.dirty = null;
    UI.refresh();
  },
  hostGone() { this.sys('The host left the session.'); if (G.zone && G.zone.remote) travel(homeKey(), { force: true }); },

  // ------------------------------------------------------------ sending
  send(msg, to) {
    if (!this.connected) return;
    if (to) msg.to = to; else if (!this.isHost && ['join', 'isreq', 'hit', 'place', 'till', 'mact', 'chest', 'sortf'].includes(msg.t)) msg.to = this.hostPeer || 'host';
    const s = JSON.stringify(msg);
    if (s.length > 3000) { const id = rid(), n = Math.ceil(s.length / 3000); for (let k = 0; k < n; k++) this.raw({ t: 'ck', id, k, n, d: s.slice(k * 3000, (k + 1) * 3000), to: msg.to }); return; }
    this.raw(msg);
  },
  raw(msg) {
    if (this.mode === 'room') { this.room.emit('mp', msg).catch(() => { }); return; }
    if (this.isHost) { for (const [pid, c] of this.conns) if (!msg.to || msg.to === pid) try { c.send(msg); } catch (e) { } }
    else if (this.hostConn) try { this.hostConn.send(msg); } catch (e) { }
  },
  recv(m, from) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'ck') { const c = this.chunks[m.id] = this.chunks[m.id] || { n: m.n, parts: [] }; c.parts[m.k] = m.d; if (c.parts.filter(x => x != null).length === c.n) { delete this.chunks[m.id]; try { this.recv(Object.assign(JSON.parse(c.parts.join('')), { _relay: m._relay }), from); } catch (e) { } } if (this.mode === 'peer' && this.isHost && m.to && m.to !== this.myPeer && m.to !== 'host') this.relay(m, from); return; }
    // the PeerJS host relays guest traffic meant for others
    if (this.mode === 'peer' && this.isHost && (!m.to || (m.to !== 'host' && m.to !== this.myPeer))) this.relay(m, from);
    if (m.to && m.to !== this.myPeer && !(m.to === 'host' && this.isHost)) return;
    const origin = m._from || from;
    const H = NET_HANDLERS[m.t]; if (H) try { H(m, origin); } catch (e) { console.warn('net', m.t, e); }
  },
  relay(m, from) { const c = Object.assign({}, m, { _from: m._from || from }); for (const [pid, conn] of this.conns) if (pid !== from && (!m.to || m.to === pid)) try { conn.send(c); } catch (e) { } },

  // --------------------------------------------------------------- tick
  myState() {
    const me = G.me, s = held(), p = activePet();
    return { n: G.P.name, s: G.P.shirt, z: G.zone.key, x: +me.x.toFixed(2), y: +me.y.toFixed(2), d: +me.dir.toFixed(2), m: me.moving ? 1 : 0, w: +me.walkT.toFixed(1), sw: +me.swing.toFixed(2), h: s ? s.id : null, p: p ? p.id : null };
  },
  applyState(peer, st) {
    let p = this.players.get(peer);
    if (!p) { p = { rx: st.x, ry: st.y }; this.players.set(peer, p); if (st.n) this.sys(`<b>${esc(st.n)}</b> is here.`); }
    Object.assign(p, { name: String(st.n || 'Friend').slice(0, 16), shirt: /^#[0-9a-f]{6}$/i.test(st.s) ? st.s : '#888', zone: st.z, x: +st.x || 0, y: +st.y || 0, dir: +st.d || 0, moving: !!st.m, walkT: +st.w || 0, swing: +st.sw || 0, held: st.h, pet: st.p, seen: Date.now() });
    if (p.zone !== (G.zone && G.zone.key)) { p.rx = p.x; p.ry = p.y; }
  },
  tick(dt) {
    if (!this.connected) return;
    for (const [, p] of this.players) { if (p.rx == null) { p.rx = p.x; p.ry = p.y; } p.rx += (p.x - p.rx) * Math.min(1, dt * 12); p.ry += (p.y - p.ry) * Math.min(1, dt * 12); }
    this.stT -= dt;
    if (this.stT <= 0) {
      this.stT = 0.1;
      if (this.mode === 'room') { const pr = { st: this.myState() }; if (this.isHost) { pr.host = G.P.uid; pr.hn = G.P.name; } this.room.presence(pr).catch(() => { }); }
      else this.send({ t: 'st', st: this.myState() });
    }
    if (!this.isHost) return;
    const hz = G.zones[homeKey()]; if (!hz) return;
    this.tileT -= dt;
    if (this.tileT <= 0 && hz.dirty && hz.dirty.size) {
      this.tileT = 0.12;
      const list = [...hz.dirty].slice(0, 120).map(i => { hz.dirty.delete(i); return [i, hz.ground[i], hz.objs[i] ? strip(hz.objs[i]) : null]; });
      this.send({ t: 'tiles', z: hz.key, list });
    }
    this.dynT -= dt;
    const guestsHere = [...this.players.values()].some(p => p.zone === hz.key);
    if (this.dynT <= 0 && guestsHere && hz.auto.size) {
      this.dynT = 1.5;
      this.send({ t: 'dyn', z: hz.key, list: [...hz.auto].map(i => [i, strip(hz.objs[i])]) });
    }
  },
  onZone() { if (this.connected && this.mode === 'peer') this.send({ t: 'st', st: this.myState() }); },

  // ------------------------------------------------------- co-op actions
  visitHost() {
    if (!this.connected || this.isHost) return UI.toast('Join a friend\'s session first (Esc → Play with friends)', '#ff6a6a');
    UI.toast('Requesting island from host…', '#7ad8ff');
    this.send({ t: 'isreq' });
  },
  chat(text) {
    text = String(text).slice(0, 160).trim(); if (!text) return;
    this.addChat(G.P.name, text, true);
    if (this.connected) this.send({ t: 'chat', n: G.P.name, x: text });
  },
  addChat(name, text, me) {
    const d = document.createElement('div'); d.className = 'cl' + (me ? ' me' : ''); d.innerHTML = name ? `<b>${esc(name)}:</b> ${esc(text)}` : text;
    $('chatlog').appendChild(d); setTimeout(() => d.classList.add('old'), 12000);
    while ($('chatlog').children.length > 40) $('chatlog').firstChild.remove();
    $('chatlog').scrollTop = 1e9;
  },
  sys(html) { this.addChat(null, `<span class="sys">${html}</span>`); },
  gift(peer) {
    const s = held(); if (!s) return UI.toast('Hold the item you want to gift in your hotbar', '#ff6a6a');
    G.P.inv[G.sel] = null; G.invDirty = true;
    this.send({ t: 'gift', item: s, from: G.P.name }, peer);
    UI.toast(`Sent ${esc(instName(s))} to ${esc(this.players.get(peer).name)}`, '#5dff6a'); UI.refresh();
  },
  giftCoins(peer, n) {
    n = Math.floor(+n); if (!(n > 0) || n > G.P.coins) return UI.toast('Enter an amount you can afford', '#ff6a6a');
    G.P.coins -= n; this.send({ t: 'gift', coins: n, from: G.P.name }, peer); UI.toast(`Sent ${fmt(n)} coins`, '#5dff6a'); UI.refresh();
  },

  // --------------------------------------------------------------- panel
  openPanel() {
    UI.open('🤝 Play with friends', () => {
      const tr = this.transport();
      let h = `<p class="dim">Host a session and share the code. Friends who join can see you, chat, trade gifts and help build and automate <b>your</b> island. Everyone keeps their own skills, coins and inventory.</p>`;
      h += `<div class="small dim">Connection: ${tr === 'room' ? 'Claude artifact room — friends need to open this same artifact with permission to interact.' : 'peer-to-peer (WebRTC). Works when the game page is hosted online and opened by both players.'}</div>`;
      if (!this.connected) {
        h += `<div class="coop"><div><div class="lbl">Host</div><button class="btn" data-a="nhost">Host my island</button></div><div><div class="lbl">Join</div><div class="row gap"><input id="joinCode" placeholder="code" maxlength="8"><button class="btn" data-a="njoin">Join</button></div></div></div>`;
      } else {
        h += `<div class="codebox">Session code <b>${this.code}</b> <button class="btn xs" data-a="ncopy">Copy</button> ${this.isHost ? '<span class="tag">HOST</span>' : ''}</div>`;
        if (!this.isHost) h += `<button class="btn" data-a="warpCoop">🏝 Visit ${esc(this.hostName || 'host')}'s island</button>`;
        h += `<div class="lbl">Players</div><div class="plist"><div class="pl"><b>${esc(G.P.name)}</b> <span class="dim">(you)</span></div>`;
        for (const [pid, p] of this.players) h += `<div class="pl"><b style="color:#7ad8ff">${esc(p.name)}</b> <span class="dim small">${esc(ZONES[(p.zone || 'hub').split('@')[0]] ? ZONES[(p.zone || 'hub').split('@')[0]].name : '')}</span><span class="grow"></span><button class="btn xs" data-a="ngift" data-v="${pid}">Gift held item</button><input id="gc_${pid}" type="number" placeholder="coins" class="xsin"><button class="btn xs ghost" data-a="ngiftc" data-v="${pid}">Send coins</button></div>`;
        h += `</div><button class="btn ghost" data-a="nleave">Leave session</button>`;
      }
      return h;
    }, true);
    UI.cur.live = true;
  },
};
function strip(o) { const c = Object.assign({}, o); delete c.shake; delete c.anim; return c; }
Object.assign(ACT, {
  nhost() { NET.host(); },
  njoin() { NET.join($('joinCode').value); },
  nleave() { NET.leave(); },
  ncopy() { try { navigator.clipboard.writeText(NET.code).then(() => UI.toast('Code copied', '#5dff6a'), () => { }); } catch (e) { } },
  ngift(v) { NET.gift(v); },
  ngiftc(v) { NET.giftCoins(v, $('gc_' + v).value); },
});

// ------------------------------------------------------------- handlers
const NET_HANDLERS = {
  st(m, from) { if (m.st) NET.applyState(from, m.st); },
  chat(m) { NET.addChat(String(m.n || 'Friend').slice(0, 16), String(m.x || '').slice(0, 160)); },
  join(m, from) { if (NET.isHost) { NET.sys(`<b>${esc(String(m.name).slice(0, 16))}</b> joined your session.`); NET.send({ t: 'welcome', hu: G.P.uid, hn: G.P.name }, from); } },
  welcome(m, from) { NET.hostUid = String(m.hu); NET.hostName = String(m.hn).slice(0, 16); NET.hostPeer = from; },
  gift(m) {
    if (m.coins) { const n = Math.min(1e9, Math.max(0, Math.floor(+m.coins))); G.P.coins += n; UI.toast(`🎁 ${esc(m.from)} sent you ${fmt(n)} coins!`, '#ffd23a'); SFX.coin(); }
    if (m.item && ITEMS[m.item.id]) { const it = m.item; const left = it.d ? addItem(it.id, 1, it.d) : addItem(it.id, clamp(+it.n || 1, 1, 999)); if (left) spawnDrop(G.zone, G.me.x, G.me.y, it.id, left, it.d); UI.toast(`🎁 ${esc(m.from)} sent you ${esc(instName(it))}!`, '#ffd23a'); SFX.hatch(); }
  },
  // host side
  isreq(m, from) { if (!NET.isHost) return; const hz = getZone(homeKey()); NET.send({ t: 'isl', hu: G.P.uid, hn: G.P.name, data: serializeZone(hz) }, from); },
  hit(m, from) {
    if (!NET.isHost) return; const z = G.zones[homeKey()]; if (!z) return;
    const o = z.o(m.x | 0, m.y | 0); if (!o) return;
    if ((o.k === 'mach') && !m.a.pickup && false) return;
    const a = m.a || {}; a.fort = a.fort || { foraging: 0, mining: 0, farming: 0 };
    const r = applyHit(z, m.x | 0, m.y | 0, a, false);
    if (r && r.res === 'broken') NET.send({ t: 'rew', items: r.items, xp: r.xp, k: r.k, id: r.id, x: m.x, y: m.y }, from);
    if (r && G.zone === z) hitFx(m.x | 0, m.y | 0, r.k, r.id);
  },
  place(m, from) {
    if (!NET.isHost) return; const z = G.zones[homeKey()];
    const ok = z && !canPlaceAt(z, m.x | 0, m.y | 0) && m.ob && typeof m.ob.k === 'string' && (m.ob.k !== 'crop' || z.g(m.x | 0, m.y | 0) === GT.FARM);
    if (ok) { const ob = m.ob; if (ob.k === 'mach') { ob.buf = {}; ob.inq = {}; ob.last = Date.now(); ob.tier = clamp(ob.tier | 0, 1, MACHINE_MAX_TIER); } z.set(m.x | 0, m.y | 0, ob); }
    else if (m.ob && m.ob.k === 'crop' && z && !z.o(m.x | 0, m.y | 0) && z.g(m.x | 0, m.y | 0) === GT.FARM) z.set(m.x | 0, m.y | 0, m.ob);
    else NET.send({ t: 'rew', items: [m.item] }, from);
  },
  sortf(m) { if (!NET.isHost) return; const z = G.zones[homeKey()], o = z.objs[m.i]; if (o && o.k === 'sort') { o.filter = m.v && (ITEMS[m.v] || m.v === '#greasy') ? m.v : null; z.dirty.add(m.i); } },
  till(m) { if (!NET.isHost) return; const z = G.zones[homeKey()]; const g = z.g(m.x | 0, m.y | 0); if ((GROUND[g].grassy || g === GT.DIRT) && !z.o(m.x | 0, m.y | 0)) z.setG(m.x | 0, m.y | 0, GT.FARM); },
  mact(m, from) {
    if (!NET.isHost) return; const z = G.zones[homeKey()], o = z.objs[m.i]; if (!o || o.k !== 'mach') return;
    if (m.op === 'res' && machineResources(o.id).includes(m.v) || (m.op === 'res' && MACHINES[o.id].kind === 'gather')) { o.res = String(m.v); o.last = Date.now(); }
    if (m.op === 'collect') { const items = Object.entries(o.buf).map(([id, n]) => [id, n]); o.buf = {}; NET.send({ t: 'rew', items }, from); }
    if (m.op === 'upgrade' && o.tier < MACHINE_MAX_TIER) o.tier++;
    if (m.op === 'recipe' && RECIPES[m.v]) o.recipe = m.v | 0;
    if (m.op === 'takein') { const items = Object.entries(o.inq).map(([id, n]) => [id, n]); o.inq = {}; NET.send({ t: 'rew', items }, from); }
    if (m.op === 'insert' && Array.isArray(m.v)) { const [id, n] = m.v; let left = n | 0; while (left > 0 && ITEMS[id] && machAccepts(o, id)) { o.inq[id] = (o.inq[id] || 0) + 1; left--; } if (left > 0) NET.send({ t: 'rew', items: [[id, left]] }, from); }
    z.dirty && z.dirty.add(m.i);
  },
  chest(m, from) {
    if (!NET.isHost) return; const z = G.zones[homeKey()], o = z.objs[m.i]; if (!o || !o.inv) return;
    if (m.op === 'take') { const s = o.inv[m.slot]; if (!s) return; o.inv[m.slot] = null; NET.send({ t: 'rew', items: [[s.id, s.n, s.d]] }, from); }
    else if (m.op === 'put' && m.item && ITEMS[m.item.id]) { const it = m.item; let left = 0; if (it.d) { const k = o.inv.indexOf(null); if (k < 0) left = 1; else o.inv[k] = it; } else left = chestAdd(o, it.id, it.n); if (left) NET.send({ t: 'rew', items: [[it.id, left, it.d]] }, from); }
    z.dirty.add(m.i);
  },
  // guest side
  isl(m) {
    if (NET.isHost) return;
    NET.hostUid = String(m.hu); NET.hostName = String(m.hn).slice(0, 16);
    const key = 'home@' + NET.hostUid, z = deserializeZone(key, m.data); z.remote = true;
    G.zones[key] = z; const from = G.zone ? G.zone.base : null; enterZone(z, from);
  },
  tiles(m) {
    const z = G.zones[m.z]; if (!z || !z.remote) return;
    for (const [i, g, o] of m.list) { if (i < 0 || i >= z.ground.length) continue; z.ground[i] = g; z.set(i % z.w, Math.floor(i / z.w), o); }
    if (UI.chest && UI.chest.z === z) UI.refresh();
  },
  dyn(m) { const z = G.zones[m.z]; if (!z || !z.remote) return; for (const [i, o] of m.list) if (o) z.set(i % z.w, Math.floor(i / z.w), o); },
  rew(m) {
    const items = (m.items || []).filter(it => Array.isArray(it) && ITEMS[it[0]]);
    if (m.k) breakFx(m.x | 0, m.y | 0, m.k, m.id);
    grantReward({ items, xp: (m.xp || []).filter(x => SKILLS[x[0]]) }, m.x != null ? (m.x | 0) + 0.5 : G.me.x, m.y != null ? (m.y | 0) + 0.5 : G.me.y, true);
    if (m.k) onBroken({ k: m.k });
  },
};
