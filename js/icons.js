'use strict';
// =====================================================================
//  Procedural item icons + tiny synthesized sound effects
// =====================================================================
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
const ICONS = {};
function shade(hex, f) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  let r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function drawHandle(ctx, x1, y1, x2, y2, w = 6) {
  ctx.lineCap = 'round'; ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = w + 3; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = '#a8743c'; ctx.lineWidth = w; ctx.stroke();
}
function drawIconSpec(ctx, sp, S = 64) {
  const c = sp.c || '#ccc';
  ctx.save();
  ctx.lineJoin = 'round';
  switch (sp.s) {
    case 'e':
      ctx.font = `${S * 0.7}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sp.e, S / 2, S / 2 + S * 0.04); break;
    case 'log': {
      ctx.fillStyle = shade(sp.c1, -0.35); rr(ctx, 8, 20, 48, 26, 8); ctx.fill();
      ctx.fillStyle = sp.c1; rr(ctx, 8, 18, 46, 24, 8); ctx.fill();
      ctx.strokeStyle = shade(sp.c1, -0.25); ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(14 + i * 10, 22); ctx.lineTo(20 + i * 10, 38); ctx.stroke(); }
      ctx.fillStyle = sp.c2; ctx.beginPath(); ctx.ellipse(50, 31, 8, 12, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = shade(sp.c2, -0.3); ctx.beginPath(); ctx.ellipse(50, 31, 4, 6, 0, 0, 7); ctx.stroke(); break;
    }
    case 'stick': drawHandle(ctx, 16, 50, 48, 14, 6); break;
    case 'block': {
      const p = sp.pat;
      ctx.fillStyle = shade(c, -0.35); rr(ctx, 10, 12, 44, 44, 6); ctx.fill();
      ctx.fillStyle = c; rr(ctx, 10, 9, 44, 42, 6); ctx.fill();
      ctx.strokeStyle = shade(c, -0.25); ctx.lineWidth = 2;
      if (p === 'planks') { for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(10, 9 + i * 10.5); ctx.lineTo(54, 9 + i * 10.5); ctx.stroke(); } }
      else if (p === 'cobble') { ctx.fillStyle = shade(c, -0.2); [[18, 18], [34, 16], [46, 26], [22, 34], [38, 40], [16, 44]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); }); }
      else if (p === 'bricks') { for (let r = 0; r < 4; r++) { ctx.beginPath(); ctx.moveTo(10, 9 + r * 10.5); ctx.lineTo(54, 9 + r * 10.5); ctx.stroke(); for (let k = 0; k < 3; k++) { const x = 10 + ((r % 2) * 7) + k * 15; ctx.beginPath(); ctx.moveTo(x, 9 + r * 10.5); ctx.lineTo(x, 19.5 + r * 10.5); ctx.stroke(); } } }
      else if (p === 'smooth') { ctx.strokeRect(16, 15, 32, 30); }
      else if (p === 'fence') { ctx.clearRect(0, 0, S, S); ctx.fillStyle = c; [14, 30, 46].forEach(x => { rr(ctx, x - 3, 12, 7, 40, 2); ctx.fill(); }); ctx.fillRect(10, 22, 44, 5); ctx.fillRect(10, 36, 44, 5); }
      else if (p === 'lamp') { ctx.fillStyle = '#fff6c8'; ctx.shadowColor = '#ffd23a'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(32, 30, 12, 0, 7); ctx.fill(); }
      else if (p === 'path') { ctx.fillStyle = shade(c, -0.15); [[18, 18], [36, 20], [26, 36], [44, 40]].forEach(([x, y]) => { rr(ctx, x - 6, y - 5, 12, 10, 3); ctx.fill(); }); }
      else if (p === 'hedge') { ctx.fillStyle = shade(c, 0.2); [[20, 20], [40, 22], [28, 38], [44, 40]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); }); }
      else if (p === 'bench') { ctx.fillStyle = shade(c, 0.25); ctx.fillRect(10, 9, 44, 12); ctx.fillStyle = '#ddd'; ctx.fillRect(18, 26, 4, 18); ctx.fillStyle = '#777'; ctx.fillRect(14, 24, 12, 5); ctx.fillStyle = '#a8743c'; ctx.fillRect(36, 26, 4, 18); ctx.fillStyle = '#999'; ctx.fillRect(32, 26, 12, 6); }
      else if (p === 'furnace') { ctx.fillStyle = '#2a2a2a'; rr(ctx, 20, 28, 24, 16, 3); ctx.fill(); ctx.fillStyle = '#ff8a2a'; ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 10; rr(ctx, 23, 33, 18, 9, 2); ctx.fill(); }
      else if (p === 'chest') { ctx.fillStyle = shade(c, -0.2); ctx.fillRect(10, 26, 44, 3); ctx.fillStyle = '#ffd23a'; rr(ctx, 28, 22, 8, 10, 2); ctx.fill(); }
      else if (p === 'etable') { ctx.fillStyle = '#c03a3a'; rr(ctx, 18, 6, 28, 16, 3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(31, 7, 2, 14); ctx.fillStyle = '#5ff2ea'; [[16, 34], [46, 38], [30, 44]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }); }
      else if (p === 'anvil') { ctx.clearRect(0, 0, S, S); ctx.fillStyle = '#4a4a52'; ctx.beginPath(); ctx.moveTo(8, 18); ctx.lineTo(56, 18); ctx.lineTo(48, 30); ctx.lineTo(16, 30); ctx.closePath(); ctx.fill(); ctx.fillRect(26, 30, 12, 12); ctx.fillRect(16, 42, 32, 10); ctx.fillStyle = '#7a7a84'; ctx.fillRect(10, 18, 44, 4); }
      else if (p === 'sponge') { ctx.fillStyle = shade(c, -0.25); [[18, 18], [34, 22], [44, 36], [22, 38], [32, 44]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }); }
      break;
    }
    case 'ore': {
      ctx.fillStyle = shade(sp.c1, -0.3); ctx.beginPath(); ctx.moveTo(10, 40); ctx.lineTo(18, 16); ctx.lineTo(40, 10); ctx.lineTo(56, 26); ctx.lineTo(52, 50); ctx.lineTo(24, 54); ctx.closePath(); ctx.fill();
      ctx.fillStyle = sp.c1; ctx.beginPath(); ctx.moveTo(12, 38); ctx.lineTo(19, 17); ctx.lineTo(39, 12); ctx.lineTo(53, 26); ctx.lineTo(49, 46); ctx.lineTo(25, 50); ctx.closePath(); ctx.fill();
      ctx.fillStyle = sp.c2; [[24, 26], [38, 22], [34, 38], [44, 34], [22, 40]].forEach(([x, y], i) => { ctx.beginPath(); ctx.arc(x, y, i % 2 ? 3.5 : 5, 0, 7); ctx.fill(); }); break;
    }
    case 'gem': {
      ctx.fillStyle = shade(c, -0.35); ctx.beginPath(); ctx.moveTo(32, 56); ctx.lineTo(8, 26); ctx.lineTo(18, 12); ctx.lineTo(46, 12); ctx.lineTo(56, 26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(32, 52); ctx.lineTo(12, 26); ctx.lineTo(20, 15); ctx.lineTo(44, 15); ctx.lineTo(52, 26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(c, 0.5); ctx.beginPath(); ctx.moveTo(20, 15); ctx.lineTo(32, 26); ctx.lineTo(12, 26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(24, 21, 3, 0, 7); ctx.fill(); break;
    }
    case 'ingot': {
      ctx.fillStyle = shade(c, -0.4); ctx.beginPath(); ctx.moveTo(6, 44); ctx.lineTo(16, 24); ctx.lineTo(52, 24); ctx.lineTo(58, 44); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(10, 40); ctx.lineTo(18, 26); ctx.lineTo(50, 26); ctx.lineTo(54, 40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(c, 0.5); ctx.fillRect(20, 28, 26, 3); break;
    }
    case 'dust': ctx.fillStyle = c; for (let i = 0; i < 14; i++) { const a = i * 2.4, r = (i % 5) * 4; ctx.beginPath(); ctx.arc(32 + Math.cos(a) * r, 38 + Math.sin(a) * r * 0.5 - (5 - (i % 5)) * 2, 5, 0, 7); ctx.fill(); } break;
    case 'blob': {
      const g = ctx.createRadialGradient(26, 24, 2, 32, 32, 24); g.addColorStop(0, shade(c, 0.6)); g.addColorStop(1, shade(c, -0.3));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(32, 34, 20, 0, 7); ctx.fill(); break;
    }
    case 'seed': ctx.fillStyle = shade(c, -0.2); [[24, 30, 0.5], [38, 26, -0.4], [32, 42, 0.2]].forEach(([x, y, a]) => { ctx.beginPath(); ctx.ellipse(x, y, 6, 9, a, 0, 7); ctx.fill(); }); ctx.fillStyle = shade(c, 0.4); [[22, 27], [36, 23], [30, 39]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); }); break;
    case 'sapling': ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(32, 56); ctx.lineTo(32, 28); ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(22, 28, 10, 6, -0.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(42, 24, 10, 6, 0.5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(32, 16, 6, 9, 0, 0, 7); ctx.fill(); break;
    case 'axe': drawHandle(ctx, 14, 54, 42, 14); ctx.fillStyle = c; ctx.strokeStyle = shade(c, -0.45); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(36, 8); ctx.quadraticCurveTo(58, 10, 56, 32); ctx.lineTo(42, 24); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'pickaxe': drawHandle(ctx, 16, 54, 44, 18); ctx.strokeStyle = shade(c, -0.45); ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(18, 12); ctx.quadraticCurveTo(44, 6, 56, 32); ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = 7; ctx.stroke(); break;
    case 'hoe': drawHandle(ctx, 16, 56, 42, 12); ctx.fillStyle = c; ctx.strokeStyle = shade(c, -0.45); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(36, 10); ctx.lineTo(58, 12); ctx.lineTo(56, 22); ctx.lineTo(42, 18); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'sword': {
      ctx.fillStyle = c; ctx.strokeStyle = shade(c, -0.5); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(52, 8); ctx.lineTo(56, 12); ctx.lineTo(26, 44); ctx.lineTo(20, 38); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(c, 0.5); ctx.beginPath(); ctx.moveTo(52, 9); ctx.lineTo(54, 11); ctx.lineTo(25, 41); ctx.lineTo(23, 39); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(14, 36); ctx.lineTo(28, 50); ctx.stroke();
      drawHandle(ctx, 12, 54, 22, 44, 5); break;
    }
    case 'bow': ctx.strokeStyle = shade(c, -0.4); ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(20, 44, 32, -1.45, -0.12); ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#eee'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(22, 12); ctx.lineTo(52, 42); ctx.stroke(); break;
    case 'wand': drawHandle(ctx, 14, 54, 42, 22, 5); ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(46, 17, 8, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(43, 14, 3, 0, 7); ctx.fill(); break;
    case 'rod': drawHandle(ctx, 12, 56, 50, 8, 4); ctx.strokeStyle = c; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(12, 56); ctx.lineTo(20, 46); ctx.stroke(); ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(50, 8); ctx.quadraticCurveTo(56, 30, 48, 46); ctx.stroke(); ctx.fillStyle = '#ff4a4a'; ctx.beginPath(); ctx.arc(48, 46, 4, 0, 7); ctx.fill(); break;
    case 'drill': drawHandle(ctx, 12, 54, 26, 40, 7); ctx.fillStyle = '#4a4a52'; rr(ctx, 18, 26, 22, 20, 5); ctx.fill(); ctx.fillStyle = c; ctx.strokeStyle = shade(c, -0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(34, 26); ctx.lineTo(58, 8); ctx.lineTo(40, 40); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = shade(c, -0.3); ctx.beginPath(); ctx.moveTo(42, 22); ctx.lineTo(46, 26); ctx.moveTo(48, 16); ctx.lineTo(51, 19); ctx.stroke(); break;
    case 'machine': {
      ctx.fillStyle = '#2a2d36'; rr(ctx, 6, 8, 52, 50, 9); ctx.fill();
      ctx.fillStyle = c; rr(ctx, 9, 8, 46, 44, 8); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.25)'; rr(ctx, 14, 13, 36, 34, 6); ctx.fill();
      ctx.font = `${S * 0.42}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sp.e, 32, 31); break;
    }
    case 'conveyor': ctx.fillStyle = '#22252c'; rr(ctx, 8, 14, 48, 36, 6); ctx.fill(); ctx.fillStyle = '#3a3f4a'; rr(ctx, 11, 17, 42, 30, 4); ctx.fill(); ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 4; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(16 + i * 12, 22); ctx.lineTo(24 + i * 12, 32); ctx.lineTo(16 + i * 12, 42); ctx.stroke(); } break;
    case 'armor': {
      ctx.fillStyle = shade(c, -0.35); ctx.strokeStyle = shade(c, -0.55); ctx.lineWidth = 2.5;
      const P = {
        helmet: [[14, 34], [16, 18], [32, 10], [48, 18], [50, 34], [42, 34], [42, 26], [22, 26], [22, 34]],
        chest: [[10, 18], [22, 10], [28, 16], [36, 16], [42, 10], [54, 18], [50, 30], [44, 28], [44, 54], [20, 54], [20, 28], [14, 30]],
        legs: [[16, 10], [48, 10], [50, 54], [38, 54], [33, 26], [31, 26], [26, 54], [14, 54]],
        boots: [[12, 24], [26, 24], [26, 44], [30, 52], [8, 52], [8, 46], [12, 44], [38, 24], [52, 24], [52, 44], [56, 46], [56, 52], [34, 52], [38, 44]],
      }[sp.slot];
      const draw = pts => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); ctx.stroke(); };
      if (sp.slot === 'boots') { draw(P.slice(0, 7)); draw(P.slice(7)); } else draw(P);
      ctx.fillStyle = c; ctx.globalAlpha = 0.85;
      if (sp.slot === 'chest') { ctx.fillRect(24, 20, 16, 30); } else if (sp.slot === 'helmet') { ctx.fillRect(20, 16, 24, 6); } else if (sp.slot === 'legs') { ctx.fillRect(18, 13, 28, 6); } else { ctx.fillRect(11, 27, 13, 6); ctx.fillRect(40, 27, 13, 6); }
      ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(sp.slot === 'chest' ? 26 : 20, sp.slot === 'boots' ? 30 : 22, 3, 12);
      break;
    }
    case 'egg': {
      const g = ctx.createRadialGradient(26, 22, 2, 32, 34, 26); g.addColorStop(0, shade(c, 0.7)); g.addColorStop(1, shade(c, -0.25));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(32, 35, 18, 23, 0, 0, 7); ctx.fill();
      ctx.fillStyle = shade(c, -0.35); [[26, 30], [38, 40], [34, 22], [24, 44]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); }); break;
    }
    default: ctx.font = `${S * 0.6}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('?', 32, 32);
  }
  ctx.restore();
  if (sp.grease) {
    ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(70,50,20,.45)'; ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(40,30,10,.8)'; [[20, 22, 6], [42, 38, 7], [30, 46, 4]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0.4, 0, 7); ctx.fill(); }); ctx.restore();
  }
  if (sp.fast) { ctx.save(); ctx.fillStyle = '#ff5a3a'; ctx.font = `bold ${S * 0.3}px sans-serif`; ctx.fillText('»', 46, 18); ctx.restore(); }
  if (sp.glint) {
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(0, 0, S, S); g.addColorStop(0, 'rgba(190,90,255,.0)'); g.addColorStop(0.45, 'rgba(200,110,255,.45)'); g.addColorStop(0.6, 'rgba(200,110,255,.1)'); g.addColorStop(1, 'rgba(190,90,255,.0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S); ctx.restore();
  }
}
function iconCanvas(id) {
  if (ICONS[id]) return ICONS[id].cv;
  const it = ITEMS[id]; const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  drawIconSpec(cv.getContext('2d'), it ? it.icon : { s: 'x' }, 64);
  ICONS[id] = { cv, url: null };
  return cv;
}
function iconURL(id) { iconCanvas(id); const o = ICONS[id]; if (!o.url) o.url = o.cv.toDataURL(); return o.url; }

// ---------------------------------------------------------------- audio
const SFX = (() => {
  let ac = null, on = true, master = null;
  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.25; master.connect(ac.destination); } catch (e) { on = false; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(f, d, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    if (!on) return; const a = ctx(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(d, vol = 0.3, hp = 800) {
    if (!on) return; const a = ctx(); if (!a) return;
    const b = a.createBuffer(1, a.sampleRate * d, a.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    s.buffer = b; s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  return {
    set enabled(v) { on = v; }, get enabled() { return on; },
    unlock() { ctx(); },
    chop() { noise(0.08, 0.35, 400); tone(140, 0.08, 'triangle', 0.25, -40); },
    mine() { noise(0.06, 0.3, 2000); tone(420, 0.05, 'square', 0.12, -100); },
    harvest() { noise(0.05, 0.2, 3000); tone(600, 0.06, 'sine', 0.15, 200); },
    hit() { noise(0.07, 0.3, 1200); tone(180, 0.07, 'sawtooth', 0.15, -80); },
    crit() { tone(900, 0.08, 'square', 0.15, 300); noise(0.05, 0.25, 3000); },
    hurt() { tone(220, 0.15, 'sawtooth', 0.2, -120); },
    pop() { tone(500, 0.06, 'sine', 0.25, 400); },
    blip() { tone(660 + Math.random() * 120, 0.03, 'square', 0.04); },
    pickup() { tone(880, 0.05, 'sine', 0.14, 300); },
    coin() { tone(1200, 0.05, 'square', 0.1); tone(1600, 0.08, 'square', 0.1, 0, 0.05); },
    shoot() { tone(700, 0.1, 'triangle', 0.15, -400); },
    zap() { tone(300, 0.15, 'sawtooth', 0.12, 900); },
    place() { tone(260, 0.05, 'square', 0.15, -60); },
    splash() { noise(0.2, 0.25, 600); },
    bite() { tone(1000, 0.05, 'square', 0.15); tone(1000, 0.05, 'square', 0.15, 0, 0.1); },
    craft() { tone(520, 0.06, 'triangle', 0.2); tone(780, 0.1, 'triangle', 0.2, 0, 0.06); },
    level() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'square', 0.12, 0, i * 0.09)); },
    boss() { tone(110, 0.8, 'sawtooth', 0.25, -50); tone(82, 1.0, 'square', 0.15, -20, 0.2); },
    portal() { tone(300, 0.4, 'sine', 0.2, 600); },
    error() { tone(160, 0.12, 'square', 0.12); },
    hatch() { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.15, 'triangle', 0.15, 0, i * 0.07)); },
  };
})();
