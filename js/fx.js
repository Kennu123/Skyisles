'use strict';
// =====================================================================
//  Cinematic layer: cutscenes, letterbox, slow motion, hit-stop, sky,
//  weather, water ripples, decals and screen-space grading
// =====================================================================
const BOSS_TITLES = {
  bog_king: 'Tyrant of the Rotting Marsh', broodmother: 'Queen of the Nest', void_wyrm: 'Devourer of Skies', rock_golem: 'Heart of the Mountain',
  elder_treant: 'The Oldest Root', scarecrow: 'Lord of the Fields', bonelord: 'Master of the Catacombs', necromancer: 'Keeper of the Dead',
  lich_king: 'The Undying Crown', leviathan: 'Terror of the Deep', rat_king: 'Gnawer of Granaries', pebble_golem: 'Rumbling Rubble',
  mossback: 'The Walking Stump', kraken: 'Abyssal Titan', inferno_titan: 'Fury of the Caldera', glacier_colossus: 'The Frozen Giant',
  hollow_king: 'Crown of Thorns', harvest_wraith: 'Reaper of Moonlit Fields',
};
const WEATHER = {
  hub: 'leaves', home: 'leaves', farm1: 'pollen', farm2: 'pollen', farm3: 'spores', farm4: 'motes', forest1: 'leaves', forest2: 'fireflies',
  forest3: 'petals', forest4: 'spores', mine1: 'dust', mine2: 'dust', mine3: 'motes', mine4: 'snow', combat1: 'fireflies', combat2: 'dust',
  combat3: 'motes', combat4: 'embers', fishing1: 'bubbles', dungeon1: 'dust', dungeon2: 'dust', dungeon3: 'motes',
};
// zone colour grading: [tint colour, strength]
const GRADE = { combat4: ['#ff5a1a', 0.08], mine4: ['#7ad8ff', 0.07], combat3: ['#7a3aff', 0.08], forest4: ['#9a5aff', 0.07], farm3: ['#9a6aff', 0.05], combat1: ['#3a8a3a', 0.05], dungeon1: ['#3a2a5a', 0.06], dungeon2: ['#3a2a5a', 0.06], dungeon3: ['#2a3a6a', 0.07] };

const FX = {
  cine: null, letter: 0, slow: 1, slowT: 0, hitstop: 0, flash: 0, flashCol: '#fff', fade: 0, punch: 0,
  ripples: [], wx: [], decals: [], ripT: 0, clouds: null, vig: null, vigKey: '', hints: {},

  // ------------------------------------------------------------ timing
  step(dt) {
    this.letter += ((this.cine ? 1 : 0) - this.letter) * Math.min(1, dt * 5);
    this.flash = Math.max(0, this.flash - dt * 2.2); this.fade = Math.max(0, this.fade - dt * 1.5); this.punch = Math.max(0, this.punch - dt * 3);
    if (this.cine) { this.cine.t += dt; if (this.cine.t >= this.cine.dur) { const c = this.cine; this.cine = null; if (c.onEnd) c.onEnd(); } }
    if (this.hitstop > 0) { this.hitstop -= dt; return 0; }
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slow = 1; }
    return dt * this.slow;
  },
  slowmo(f, dur) { this.slow = f; this.slowT = dur; },
  stop(sec) { this.hitstop = Math.max(this.hitstop, sec); },
  frozen() { return !!(this.cine && this.cine.freeze); },
  hint(key, text) { if (this.hints[key] >= 3) return; this.hints[key] = (this.hints[key] || 0) + 1; floater(G.me.x, G.me.y - 1.6, text, '#ffd23a', 0.6, { life: 1.6, max: 1.6 }); },

  // --------------------------------------------------------- cutscenes
  bossIntro(m) {
    if (this.cine || !G.zone || !G.me) return;
    this.cine = { type: 'boss', t: 0, dur: 2.7, m, title: m.def.name, sub: BOSS_TITLES[m.type] || '', freeze: true };
    G.shake = 0.5; SFX.boss();
  },
  bossDeath(m) {
    this.slowmo(0.2, 1.2); this.flash = 1; this.flashCol = '#fff'; this.punch = 1; G.shake = 0.8;
    for (let i = 0; i < 70; i++) { const a = i / 70 * Math.PI * 2, s = rand(3, 9); G.particles.push({ x: m.x, y: m.y - 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.8, 1.6), max: 1.6, col: i % 3 ? (m.def.col2 || '#ffd23a') : '#fff', size: rand(4, 9), grav: 0, sq: 1 }); }
    this.ring(m.x, m.y, 6, m.def.col2 || '#ffd23a');
  },
  intro() {
    this.cine = { type: 'intro', t: 0, dur: 5.2, freeze: true, lines: ['High above the clouds…', '…a lonely island waits for its islander.'] };
    this.fade = 1;
  },
  skip() { if (this.cine && this.cine.t > 0.4) this.cine.t = this.cine.dur; },
  camTarget() {
    const c = this.cine; if (!c) return null;
    if (c.type === 'boss') { const k = c.t < 0.6 ? c.t / 0.6 : c.t > c.dur - 0.5 ? (c.dur - c.t) / 0.5 : 1, e = k * k * (3 - 2 * k); return { x: G.me.x + (c.m.x - G.me.x) * e, y: G.me.y + (c.m.y - G.me.y) * e }; }
    if (c.type === 'intro') { const k = Math.min(1, c.t / (c.dur - 0.8)), e = k * k * (3 - 2 * k); return { x: G.me.x + 6 * (1 - e), y: G.me.y - 9 * (1 - e) }; }
    return null;
  },
  zoomMul() {
    const c = this.cine; let z = 1 + this.punch * 0.07;
    if (c && c.type === 'intro') { const k = Math.min(1, c.t / (c.dur - 0.8)); z *= 0.5 + 0.5 * k * k * (3 - 2 * k); }
    if (c && c.type === 'boss') z *= 1 + 0.14 * Math.sin(Math.min(1, c.t / c.dur) * Math.PI);
    return z;
  },

  // ------------------------------------------------------ world effects
  ripple(x, y, big) { this.ripples.push({ x, y, t: 0, max: big ? 1.3 : 0.9, r: big ? 1.3 : 0.55 }); if (this.ripples.length > 80) this.ripples.shift(); },
  ring(x, y, r, col) { this.decals.push({ type: 'ring', x, y, r, col, t: 0, max: 0.6 }); },
  crater(x, y, r) { this.decals.push({ type: 'crater', x, y, r, t: 0, max: 6 }); if (this.decals.length > 40) this.decals.shift(); },
  update(dt) {
    const z = G.zone; if (!z) return;
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter(r => r.t < r.max);
    for (const d of this.decals) d.t += dt;
    this.decals = this.decals.filter(d => d.t < d.max);
    // ambient ripples on visible water
    this.ripT -= dt;
    if (this.ripT <= 0) {
      this.ripT = 0.12;
      const vw = RD.W / RD.S, vh = RD.H / RD.S;
      for (let k = 0; k < 2; k++) { const x = G.cam.x + rand(-vw / 2, vw / 2), y = G.cam.y + rand(-vh / 2, vh / 2); if (GROUND[z.g(Math.floor(x), Math.floor(y))].water) this.ripple(x, y, false); }
    }
    // weather
    const type = WEATHER[z.base] || 'motes', cfg = WX[type];
    if (this.wx.length < cfg.n && Math.random() < dt * cfg.rate) {
      const vw = RD.W / RD.S, vh = RD.H / RD.S;
      this.wx.push({ type, x: G.cam.x + rand(-vw / 2 - 2, vw / 2 + 2), y: G.cam.y + (cfg.fall ? -vh / 2 - 1 : rand(-vh / 2, vh / 2)), vx: rand(cfg.vx[0], cfg.vx[1]), vy: rand(cfg.vy[0], cfg.vy[1]), life: rand(4, 9), max: 9, ph: Math.random() * 7, s: rand(0.7, 1.3) });
    }
    for (const p of this.wx) { p.life -= dt; p.ph += dt; p.x += (p.vx + Math.sin(p.ph * 1.7) * 0.4) * dt; p.y += p.vy * dt; }
    this.wx = this.wx.filter(p => p.life > 0 && p.type === type);
  },

  // ---------------------------------------------------------- drawing
  drawSky(ctx, z) {
    const W = RD.W, H = RD.H, base = z.def.sky || '#2a7fb8', dark = (z.dark || 0) > 0.3 || ['void', 'ash'].includes(z.def.ground);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, shade(base, dark ? -0.5 : -0.25)); g.addColorStop(0.55, base); g.addColorStop(1, shade(base, dark ? -0.2 : 0.35));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (dark) { ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 70; i++) { const x = (thash(i, 3) * W * 1.3 - G.cam.x * 2) % W, y = thash(7, i) * H; ctx.globalAlpha = 0.3 + Math.sin(G.t * 2 + i) * 0.3; ctx.fillRect((x + W) % W, y, 2, 2); } ctx.globalAlpha = 1; return; }
    if (!this.clouds) this.clouds = Array.from({ length: 14 }, (_, i) => ({ x: thash(i, 1) * 3000, y: thash(1, i) * 1600, s: 0.6 + thash(i, i) * 1.2, d: 0.15 + thash(i, 9) * 0.35 }));
    for (const c of this.clouds) {
      const px = ((c.x - G.cam.x * RD.S * c.d + G.t * 12 * c.d) % 3000 + 3000) % 3000 - 500, py = ((c.y - G.cam.y * RD.S * c.d) % 1600 + 1600) % 1600 - 300;
      ctx.globalAlpha = 0.18 + c.d * 0.5; ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(px + k * 38 * c.s, py + Math.sin(k * 1.7) * 10 * c.s, 46 * c.s, 22 * c.s, 0, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  },
  drawGround(ctx) {
    for (const d of this.decals) {
      const X = sx(d.x), Y = sy(d.y), k = d.t / d.max;
      if (d.type === 'crater') { ctx.globalAlpha = (1 - k) * 0.5; ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(X, Y, d.r * RD.S, d.r * RD.S * 0.6, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#ff8a3a'; ctx.globalAlpha = (1 - k) * 0.4; ctx.lineWidth = 2; ctx.stroke(); }
      else if (d.type === 'ring') { ctx.globalAlpha = 1 - k; ctx.strokeStyle = d.col; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.ellipse(X, Y, d.r * RD.S * k, d.r * RD.S * k * 0.65, 0, 0, 7); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    for (const r of this.ripples) {
      const k = r.t / r.max, X = sx(r.x), Y = sy(r.y), rad = (0.15 + k * r.r) * RD.S;
      ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.45})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(X, Y, rad, rad * 0.45, 0, 0, 7); ctx.stroke();
      if (r.r > 1) { ctx.beginPath(); ctx.ellipse(X, Y, rad * 0.6, rad * 0.27, 0, 0, 7); ctx.stroke(); }
    }
  },
  drawWeather(ctx) {
    for (const p of this.wx) {
      const X = sx(p.x), Y = sy(p.y), a = clamp(Math.min(p.life, p.max - p.life) / 1.2, 0, 1), s = p.s * RD.S / 48;
      ctx.globalAlpha = a;
      switch (p.type) {
        case 'leaves': case 'petals': ctx.save(); ctx.translate(X, Y); ctx.rotate(p.ph * 2); ctx.fillStyle = p.type === 'petals' ? '#ffc0dc' : (p.s > 1 ? '#7ab84a' : '#c8b04a'); ctx.beginPath(); ctx.ellipse(0, 0, 5 * s, 2.5 * s, 0, 0, 7); ctx.fill(); ctx.restore(); break;
        case 'snow': ctx.fillStyle = '#fff'; circ(ctx, X, Y, 2.2 * s); break;
        case 'embers': ctx.fillStyle = Math.sin(p.ph * 9) > 0 ? '#ffb02a' : '#ff5a1a'; ctx.fillRect(X, Y, 3 * s, 3 * s); break;
        case 'fireflies': case 'motes': { const glow = 0.5 + Math.sin(p.ph * 3) * 0.5; ctx.globalAlpha = a * glow; ctx.fillStyle = p.type === 'fireflies' ? '#e8ff8a' : '#c8b8ff'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; circ(ctx, X, Y, 2.2 * s); ctx.shadowBlur = 0; break; }
        case 'spores': ctx.fillStyle = '#d8a8ff'; circ(ctx, X, Y, 2 * s); break;
        case 'pollen': ctx.fillStyle = '#fff6b0'; circ(ctx, X, Y, 1.6 * s); break;
        case 'dust': ctx.fillStyle = '#c8b8a0'; ctx.globalAlpha = a * 0.5; circ(ctx, X, Y, 1.5 * s); break;
        case 'bubbles': ctx.strokeStyle = 'rgba(220,250,255,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X, Y, 3 * s, 0, 7); ctx.stroke(); break;
      }
    }
    ctx.globalAlpha = 1;
  },
  drawOverlay(ctx) {
    const W = RD.W, H = RD.H, z = G.zone;
    // sun shafts in open daylight zones
    if (!z.dark && !['void', 'ash'].includes(z.def.ground) && z.def.cat !== 'dungeon') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const x = ((i * 0.37 + G.t * 0.006) % 1.4 - 0.2) * W, g = ctx.createLinearGradient(x, 0, x + W * 0.25, H);
        g.addColorStop(0, 'rgba(255,240,200,0.07)'); g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70 + i * 30, 0); ctx.lineTo(x + W * 0.25 + 160, H); ctx.lineTo(x + W * 0.25, H); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    const gr = GRADE[z.base]; if (gr) { ctx.globalAlpha = gr[1]; ctx.fillStyle = gr[0]; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // vignette (cached)
    const key = W + 'x' + H;
    if (this.vigKey !== key) {
      this.vigKey = key; this.vig = document.createElement('canvas'); this.vig.width = W; this.vig.height = H;
      const v = this.vig.getContext('2d'), g = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.42)'); v.fillStyle = g; v.fillRect(0, 0, W, H);
    }
    ctx.drawImage(this.vig, 0, 0);
    // low health pulse
    const me = G.me;
    if (me && me.hp < me.maxHp * 0.3) { const k = (1 - me.hp / (me.maxHp * 0.3)) * (0.5 + Math.sin(G.t * 6) * 0.25); const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, 'rgba(180,0,0,0)'); g.addColorStop(1, `rgba(180,0,0,${0.45 * k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (this.flash > 0) { ctx.globalAlpha = this.flash * 0.7; ctx.fillStyle = this.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // letterbox + cutscene text
    if (this.letter > 0.01) {
      const bh = H * 0.12 * this.letter; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
      const c = this.cine;
      if (c && c.type === 'boss') {
        const k = clamp((c.t - 0.5) / 0.4, 0, 1) * clamp((c.dur - c.t) / 0.35, 0, 1), slide = (1 - k) * 60;
        ctx.save(); ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `${Math.min(64, W / 12)}px ${FONT}`; ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.fillStyle = c.m.def.col2 || '#ffd23a';
        ctx.strokeText(c.title.toUpperCase(), W / 2 + slide, H * 0.72); ctx.fillText(c.title.toUpperCase(), W / 2 + slide, H * 0.72);
        ctx.font = `${Math.min(22, W / 30)}px ${FONT}`; ctx.fillStyle = '#e8e0ff'; ctx.fillText(c.sub, W / 2 - slide, H * 0.72 + Math.min(46, W / 17));
        ctx.fillStyle = c.m.def.col2 || '#ffd23a'; ctx.fillRect(W / 2 - 160 * k, H * 0.72 + Math.min(24, W / 32), 320 * k, 3);
        ctx.restore();
      }
      if (c && c.type === 'intro') {
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.min(30, W / 24)}px ${FONT}`;
        c.lines.forEach((l, i) => { const a = clamp((c.t - 0.6 - i * 1.6) / 0.6, 0, 1) * clamp((c.dur - 0.6 - c.t) / 0.5, 0, 1); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(l, W / 2, H * 0.78 + i * 40); ctx.fillText(l, W / 2, H * 0.78 + i * 40); });
        ctx.globalAlpha = 0.6; ctx.font = `14px ${FONT}`; ctx.fillStyle = '#aaa'; ctx.fillText('Space to skip', W - 80, H - 20);
        ctx.restore();
      }
    }
    if (this.fade > 0) { ctx.globalAlpha = Math.min(1, this.fade); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  },
};
const WX = {
  leaves: { n: 26, rate: 6, vx: [0.6, 1.4], vy: [0.4, 0.9], fall: 0 }, petals: { n: 40, rate: 9, vx: [0.6, 1.4], vy: [0.4, 0.9], fall: 0 },
  snow: { n: 90, rate: 30, vx: [-0.3, 0.3], vy: [1.2, 2.2], fall: 1 }, embers: { n: 60, rate: 20, vx: [-0.4, 0.4], vy: [-1.6, -0.6], fall: 0 },
  fireflies: { n: 30, rate: 8, vx: [-0.3, 0.3], vy: [-0.3, 0.3], fall: 0 }, motes: { n: 30, rate: 8, vx: [-0.2, 0.2], vy: [-0.5, -0.1], fall: 0 },
  spores: { n: 40, rate: 10, vx: [-0.3, 0.3], vy: [-0.6, -0.2], fall: 0 }, pollen: { n: 30, rate: 8, vx: [0.2, 0.8], vy: [-0.2, 0.2], fall: 0 },
  dust: { n: 30, rate: 8, vx: [0.1, 0.4], vy: [-0.1, 0.1], fall: 0 }, bubbles: { n: 20, rate: 5, vx: [-0.1, 0.1], vy: [-0.6, -0.3], fall: 0 },
};
