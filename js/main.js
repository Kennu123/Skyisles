'use strict';
// =====================================================================
//  Boot: title screen, input, main loop
// =====================================================================
const Title = {
  show() {
    $('title').hidden = false; $('hud').hidden = true;
    const list = listProfiles();
    $('profiles').innerHTML = list.length ? list.map(p => `<div class="prof"><div><b>${esc(p.name)}</b><div class="small dim">🪙 ${fmt(p.coins || 0)} · last played ${new Date(p.last).toLocaleDateString()}</div></div><div class="row gap"><button class="btn" data-a="tplay" data-v="${p.uid}">Play</button><button class="btn xs ghost" data-a="tdel" data-v="${p.uid}" title="Delete profile">✕</button></div></div>`).join('')
      : '<div class="small dim">No islands yet — name your islander below to begin.</div>';
    if (lsGet('__probe') === null && !lsSet('__probe', '1')) $('saveWarn').hidden = false;
  },
};
Object.assign(ACT, {
  tnew() { const n = $('newName').value.trim() || 'Islander'; startGame(newPlayer(n)); },
  tplay(v) { const P = loadProfile(v); if (!P) return UI.toast('Save not found', '#ff6a6a'); startGame(P); },
  tdel(v, el) { if (el.dataset.confirm) { deleteProfile(v); Title.show(); } else { el.dataset.confirm = 1; el.textContent = 'Delete?'; el.classList.remove('xs'); } },
  timport() { UI.open('Import save', () => `<p class="dim">Paste a save code exported from SkyIsles.</p><textarea id="importCode" rows="8"></textarea><button class="btn" data-a="doImport">Load save</button>`); },
});

// test commands typed into chat (T or Enter), e.g. /max, /give diamond 64
function findItemId(q) {
  q = q.toLowerCase().replace(/\s+/g, '_');
  if (ITEMS[q]) return q;
  return Object.keys(ITEMS).find(id => ITEMS[id].name.toLowerCase().replace(/[^a-z0-9]+/g, '_') === q) || Object.keys(ITEMS).find(id => id.includes(q) || ITEMS[id].name.toLowerCase().includes(q.replace(/_/g, ' ')));
}
function runCommand(text) {
  const [cmd, ...args] = text.slice(1).split(/\s+/), P = G.P, say = m => NET.sys(m);
  switch (cmd.toLowerCase()) {
    case 'help': say('Commands: <b>/max</b> · <b>/level &lt;skill|all&gt; &lt;n&gt;</b> · <b>/coins &lt;n&gt;</b> · <b>/give &lt;item&gt; [amount]</b> · <b>/collections</b> · <b>/warp &lt;island&gt;</b> · <b>/heal</b> · <b>/tutorial skip</b>'); break;
    case 'max':
      for (const s of SKILL_IDS) P.skills[s] = { lvl: MAX_SKILL, xp: 0 };
      for (const id of COLLECTION) P.coll[id] = Math.max(P.coll[id] || 0, COLL_TIERS[COLL_TIERS.length - 1]);
      for (const z in ZONES) P.visited[z] = 1;
      P.coins += 10000000; P.tut = TUTORIAL.length;
      { const hz = G.zones[homeKey()]; if (hz) ensureHomePortal(hz); }
      say('Maxed every skill and collection, unlocked all islands and added 10M coins.'); break;
    case 'level': {
      const s = (args[0] || '').toLowerCase(), n = clamp(parseInt(args[1]) || MAX_SKILL, 0, MAX_SKILL);
      const list = s === 'all' ? SKILL_IDS : SKILL_IDS.filter(x => x.startsWith(s));
      if (!list.length) { say('Unknown skill. Try: ' + SKILL_IDS.join(', ') + ', all'); break; }
      for (const x of list) P.skills[x] = { lvl: n, xp: 0 };
      say(`Set ${list.join(', ')} to level ${n}.`); break;
    }
    case 'coins': { const n = parseInt(args[0]) || 1000000; P.coins += n; say(`Added ${fmt(n)} coins.`); break; }
    case 'give': {
      const amt = /^\d+$/.test(args[args.length - 1] || '') && args.length > 1 ? parseInt(args.pop()) : 1;
      const id = findItemId(args.join(' '));
      if (!id) { say(`No item matches "${esc(args.join(' '))}".`); break; }
      const left = addItem(id, amt); say(`Gave ${amt - left}× ${esc(ITEMS[id].name)}${left ? ' (inventory full)' : ''}.`); break;
    }
    case 'collections': for (const id of COLLECTION) P.coll[id] = Math.max(P.coll[id] || 0, COLL_TIERS[COLL_TIERS.length - 1]); say('Maxed every collection.'); break;
    case 'warp': {
      const q = (args.join(' ') || '').toLowerCase();
      const key = q === 'home' ? 'home' : Object.keys(ZONES).find(k => k === q || ZONES[k].name.toLowerCase().includes(q));
      if (!key || !q) { say('Islands: ' + Object.keys(ZONES).join(', ')); break; }
      P.visited[key] = 1; travel(key === 'home' ? homeKey() : key, { force: true }); break;
    }
    case 'heal': G.me.hp = G.me.maxHp; G.me.mana = G.me.maxMana; say('Healed.'); break;
    case 'tutorial': P.tut = TUTORIAL.length; { const hz = G.zones[homeKey()]; if (hz) ensureHomePortal(hz); } say('Tutorial skipped.'); break;
    default: say(`Unknown command /${esc(cmd)}. Type <b>/help</b>.`);
  }
  G.invDirty = true; questCheck(); saveGame();
}
function toggleBigMap() { MM.big = !MM.big; $('mapwrap').classList.toggle('big', MM.big); drawMinimap(0); }
function togglePanel(title, fn) { if (UI.cur && UI.cur.title === title) UI.close(); else fn.call(UI); }
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (UI.typing()) {
    const a = document.activeElement;
    if (a.id === 'chatin') { if (k === 'enter') { if (a.value.trim().startsWith('/')) runCommand(a.value.trim()); else NET.chat(a.value); a.value = ''; a.blur(); $('chat').classList.remove('typing'); e.preventDefault(); } if (k === 'escape') { a.blur(); $('chat').classList.remove('typing'); } }
    else if (a.id === 'newName' && k === 'enter') ACT.tnew();
    else if (k === 'escape') a.blur();
    return;
  }
  if (!G.running) { if (k === 'enter' && $('newName') === document.activeElement) ACT.tnew(); return; }
  G.keys[k] = true; G.keys.shift = e.shiftKey;
  if (UI.dlg && (k === ' ' || k === 'enter' || k === 'f')) { UI.dialogNext(); e.preventDefault(); return; }
  if (UI.dlg && k === 'escape') { UI.dlg = null; UI.renderDialog(); return; }
  if (k === 'escape') { if (!$('overlay').hidden) ACT.closeOv(); else if (UI.isOpen()) UI.close(); else UI.openMenu(); return; }
  if (!$('overlay').hidden && (k === 'enter' || k === ' ')) { ACT.closeOv(); return; }
  if (k === 'e' || k === 'i') togglePanel('Inventory', UI.openInventory);
  else if (k === 'c') { if (UI.cur && UI.cur.title.includes('Craft') || UI.cur && UI.cur.title.includes('Workbench')) UI.close(); else UI.openCraft(); }
  else if (k === 'k') togglePanel('Skills & Collections', () => UI.openSkills());
  else if (k === 'p') togglePanel('Pets', UI.openPets);
  else if (k === 'm') togglePanel('Warp Map', UI.openMap);
  else if (k === 'h') togglePanel('Controls & Tips', UI.openHelp);
  else if (k === 'o') NET.openPanel();
  else if (k === 'f') { if (UI.isOpen()) UI.close(); else interactNearest(); }
  else if (k === 'r') { G.placeDir = (G.placeDir + 1) % 4; SFX.pop(); }
  else if (k === 't' || k === 'enter') { $('chat').classList.add('typing'); setTimeout(() => $('chatin').focus(), 0); e.preventDefault(); }
  else if (/^[1-9]$/.test(k)) UI.selectHot(+k - 1);
  else if (k === '=' || k === '+') setZoom(RD.zoom * 1.15);
  else if (k === '-' || k === '_') setZoom(RD.zoom / 1.15);
  else if (k === 'n') toggleBigMap();
  if (k === ' ' || k === 'tab') e.preventDefault();
});
window.addEventListener('keyup', e => { G.keys[e.key.toLowerCase()] = false; G.keys.shift = e.shiftKey; });
window.addEventListener('blur', () => { G.keys = {}; G.mouse.l = G.mouse.r = false; });
function bindInput() {
  const cv = $('game');
  cv.addEventListener('mousedown', e => {
    e.preventDefault(); if (document.activeElement && document.activeElement !== document.body && !UI.typing()) document.activeElement.blur();
    try { window.getSelection().removeAllRanges(); } catch (err) { }
    SFX.unlock(); if (!G.running) return;
    if (UI.isOpen() && e.button === 0) { UI.close(); return; }
    if (e.button === 0) { G.mouse.l = true; G.mouse.lEdge = true; }
    if (e.button === 2) { G.mouse.r = true; G.mouse.rEdge = true; }
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) G.mouse.l = false; if (e.button === 2) G.mouse.r = false; UI.mouseDown = false; });
  document.addEventListener('mousedown', () => { UI.mouseDown = true; }, true);
  window.addEventListener('mousemove', e => { G.mouse.x = e.clientX; G.mouse.y = e.clientY; G.mouse.overUI = e.target !== cv; UI.moveTip(e.clientX, e.clientY); });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => {
    if (!G.running) return; e.preventDefault();
    if (e.ctrlKey || e.altKey) setZoom(RD.zoom * (e.deltaY > 0 ? 1 / 1.1 : 1.1)); else UI.selectHot(G.sel + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });
  document.addEventListener('selectstart', e => { if (!e.target.closest || !e.target.closest('input,textarea')) e.preventDefault(); });
  document.addEventListener('contextmenu', e => { if (G.running && !e.target.closest('input,textarea')) e.preventDefault(); });
  $('mapwrap').addEventListener('click', e => { const b = e.target.closest('[data-z]'); if (b) { setZoom(RD.zoom * (b.dataset.z === 'in' ? 1.2 : 1 / 1.2)); return; } toggleBigMap(); });
  document.addEventListener('click', e => {
    const hs = e.target.closest('[data-hs]'); if (hs && !UI.isOpen()) { UI.selectHot(+hs.dataset.hs); return; }
    const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
    SFX.unlock(); UI.act(el.dataset.a, el.dataset.v, el, e);
  });
  document.addEventListener('mouseover', e => { const t = e.target.closest('[data-tip]'); if (t) UI.showTip(t.dataset.tip, e.clientX, e.clientY); else UI.hideTip(); });
  $('panel').addEventListener('mousedown', e => { if (e.target.id === 'panel') UI.close(); });
  document.addEventListener('input', e => { if (e.target.id === 'craftQ') UI.refresh(); });
  $('hudBtns').addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    ({ inv: () => togglePanel('Inventory', UI.openInventory), craft: () => UI.openCraft(), skills: () => togglePanel('Skills & Collections', () => UI.openSkills()), pets: () => togglePanel('Pets', UI.openPets), map: () => togglePanel('Warp Map', UI.openMap), coop: () => NET.openPanel(), menu: () => UI.openMenu() })[b.dataset.k]();
  });
  window.addEventListener('beforeunload', () => saveGame());
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
}

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
  if (G.running && G.zone) {
    const w = screenToWorld(G.mouse.x, G.mouse.y); G.mouse.wx = w.x; G.mouse.wy = w.y;
    try { update(dt); render(); } catch (err) { console.error(err); }
    UI.hudT -= dt; if (UI.hudT <= 0) { UI.hudT = 0.1; UI.hudTick(); drawMinimap(0.1); }
    UI.dialogTick(dt);
  }
  requestAnimationFrame(frame);
}
window.addEventListener('load', () => {
  initRender(); bindInput(); NET.init(); Title.show();
  // warm the font so canvas text uses it
  if (document.fonts) document.fonts.load('20px "Lilita One"').catch(() => { });
  requestAnimationFrame(frame);
});
