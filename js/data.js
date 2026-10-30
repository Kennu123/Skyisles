'use strict';
// =====================================================================
//  SkyIsles — game data: items, resources, mobs, recipes, zones, pets
// =====================================================================
const TILE = 48;
const RARITY = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const RCOL = ['#ececec', '#5dff6a', '#5aa8ff', '#c46bff', '#ffb020', '#ff5ce1'];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// ---------------------------------------------------------------- skills
const SKILLS = {
  foraging: { name: 'Foraging', icon: '🪓', col: '#59c96b', perk: l => `+${2 * l} Strength · +${4 * l} Foraging Fortune` },
  mining: { name: 'Mining', icon: '⛏️', col: '#a9b4c2', perk: l => `+${(1.5 * l).toFixed(1)} Defense · +${4 * l} Mining Fortune` },
  farming: { name: 'Farming', icon: '🌾', col: '#d8e04a', perk: l => `+${3 * l} Health · +${4 * l} Farming Fortune` },
  combat: { name: 'Combat', icon: '⚔️', col: '#ff5a5a', perk: l => `+${(0.5 * l).toFixed(1)}% Crit Chance · +${4 * l}% Damage` },
  fishing: { name: 'Fishing', icon: '🎣', col: '#3fc3ff', perk: l => `+${2 * l} Health · +${(0.5 * l).toFixed(1)} Sea Treasure` },
  dungeoneering: { name: 'Dungeoneering', icon: '💀', col: '#c9905a', perk: l => `+${4 * l} Health · +${2 * l}% Dungeon Damage` },
};
const SKILL_IDS = Object.keys(SKILLS);
const MAX_SKILL = 30;
// fast early levels, long tail — the first few levels come in minutes, the last ones take days
const XP_TABLE = [30, 70, 130, 220, 360, 560, 850, 1250, 1800, 2600, 3600, 5000, 6800, 9000, 12000, 15500, 20000, 26000, 33000, 42000, 53000, 66000, 82000, 100000, 125000, 155000, 190000, 235000, 290000, 350000];
function xpToNext(l) { return XP_TABLE[Math.min(l, XP_TABLE.length - 1)]; }
function levelCoins(l) { return l * l * 10; }
function applySkillPerks(id, l, s) {
  switch (id) {
    case 'foraging': s.strength += 2 * l; s.foragingFortune += 4 * l; break;
    case 'mining': s.defense += 1.5 * l; s.miningFortune += 4 * l; break;
    case 'farming': s.health += 3 * l; s.farmingFortune += 4 * l; break;
    case 'combat': s.critChance += 0.5 * l; s.damagePct += 4 * l; break;
    case 'fishing': s.health += 2 * l; s.treasure += 0.5 * l; break;
    case 'dungeoneering': s.health += 4 * l; s.dungeonDmg += 2 * l; break;
  }
}

const STAT_INFO = {
  health: ['❤', 'Health', '#ff5b5b'], defense: ['🛡', 'Defense', '#5dff6a'], strength: ['❁', 'Strength', '#ff6b4a'],
  critChance: ['☣', 'Crit Chance', '#7fb7ff', '%'], critDamage: ['☠', 'Crit Damage', '#7fb7ff', '%'], speed: ['✦', 'Speed', '#ffffff'],
  intelligence: ['✎', 'Intelligence', '#6fd8ff'], damagePct: ['⚔', 'Bonus Damage', '#ff9a4a', '%'],
  miningFortune: ['☘', 'Mining Fortune', '#ffc23a'], foragingFortune: ['☘', 'Foraging Fortune', '#ffc23a'], farmingFortune: ['☘', 'Farming Fortune', '#ffc23a'],
  breakPct: ['⸕', 'Break Speed', '#ffd27a', '%'], treasure: ['⚓', 'Sea Treasure', '#3fc3ff'], fishingSpeed: ['☂', 'Fishing Speed', '#3fc3ff', '%'],
  magicFind: ['✯', 'Magic Find', '#ff7bff'], xpBoost: ['✪', 'Skill XP Boost', '#c6ff6a', '%'], dungeonDmg: ['💀', 'Dungeon Damage', '#c9905a', '%'],
  spellDmg: ['✧', 'Spell Damage', '#b88aff', '%'], manaSave: ['☄', 'Mana Saved', '#6fd8ff', '%'],
};
function baseStats() {
  return { health: 100, defense: 0, strength: 0, critChance: 15, critDamage: 50, speed: 100, intelligence: 0, damagePct: 0,
    miningFortune: 0, foragingFortune: 0, farmingFortune: 0, breakPct: 0, treasure: 0, fishingSpeed: 0, magicFind: 0, xpBoost: 0, dungeonDmg: 0, spellDmg: 0, manaSave: 0 };
}

// ---------------------------------------------------------------- items
const ITEMS = {};
function I(id, name, o = {}) { ITEMS[id] = Object.assign({ id, name, rar: 0, cat: 'misc', icon: { s: 'e', e: '❔' } }, o); return ITEMS[id]; }
const RECIPES = [];
// st: 'hand' | 'bench'; bt = minimum workbench tier; coll = [item, collection tier] needed to unlock
function R(out, n, ins, st = 'bench', req = null, cat = null, bt = 1, coll = null) { const r = { out, n, in: ins, st, req, cat, bt, coll }; RECIPES.push(r); return r; }

// basic materials
I('stick', 'Stick', { price: 1, cat: 'foraging', icon: { s: 'stick', c: '#a87a45' } });
I('planks', 'Planks', { price: 1, cat: 'foraging', icon: { s: 'block', c: '#c49254', pat: 'planks' }, place: { k: 'block', solid: 1 } });
I('apple', 'Apple', { price: 3, cat: 'food', icon: { s: 'e', e: '🍎' }, food: 25 });
I('charcoal', 'Charcoal', { price: 3, cat: 'foraging', icon: { s: 'ore', c1: '#3a3a3a', c2: '#141414' }, tags: ['fuel'] });

// trees ------------------------------------------------------------
//   id, name, lvl, tier, hp, xp, price, bark, leaf, shape
const TREES = [
  ['oak', 'Oak', 0, 0, 10, 6, 2, '#7a5230', '#3f9b3f', 'round'],
  ['birch', 'Birch', 1, 0, 14, 9, 3, '#e8e2cc', '#86c75a', 'round'],
  ['spruce', 'Spruce', 3, 1, 20, 14, 5, '#5a3d22', '#2a6b40', 'cone'],
  ['jungle', 'Jungle', 5, 2, 28, 22, 8, '#8a6a3a', '#29a33a', 'big'],
  ['acacia', 'Acacia', 8, 3, 36, 32, 12, '#a8642f', '#a3b83c', 'flat'],
  ['darkoak', 'Dark Oak', 11, 3, 45, 45, 18, '#3e2a17', '#1f4a26', 'big'],
  ['cherry', 'Cherry', 14, 4, 55, 65, 26, '#6e3b3b', '#f6a8cc', 'round'],
  ['ancient', 'Ancient', 18, 5, 70, 90, 40, '#4a3b2a', '#7a9a3a', 'huge'],
  ['crystal', 'Crystal', 22, 6, 90, 130, 70, '#7fcfff', '#c4f4ff', 'crystal'],
];
const NODES = {};
TREES.forEach(([id, name, lvl, tier, hp, xp, price, bark, leaf, shape], i) => {
  I(id + '_log', name + ' Log', { price, cat: 'foraging', icon: { s: 'log', c1: bark, c2: '#d8b27a' }, tags: ['log'], rar: i >= 7 ? 2 : i >= 5 ? 1 : 0, bz: 1, place: { k: 'block', solid: 1 } });
  I(id + '_sapling', name + ' Sapling', { price: Math.max(1, price), cat: 'foraging', icon: { s: 'sapling', c: leaf }, place: { k: 'sapling', tree: id } });
  const drops = [[id + '_log', 1, 2, 1], [id + '_sapling', 1, 1, 0.12]];
  if (id === 'oak') drops.push(['apple', 1, 1, 0.06]);
  NODES[id] = { k: 'tree', id, name: name + ' Tree', skill: 'foraging', lvl, tier, hp, xp, bark, leaf, shape, drops, respawn: 16 + i * 3, idx: i, item: id + '_log' };
});
R('planks', 4, [['#log', 1]], 'hand', null, 'materials');
R('stick', 4, [['planks', 2]], 'hand', null, 'materials');

// rocks ------------------------------------------------------------
//   id, name, lvl, tier, hp, xp, drop, [min,max], base, spot, price
const ROCKS = [
  ['stone', 'Stone', 0, 1, 8, 5, 'cobblestone', [1, 1], '#8d8d8d', null, 1],
  ['coal', 'Coal', 1, 1, 10, 8, 'coal', [1, 2], '#7d7d7d', '#1c1c1c', 3],
  ['iron', 'Iron', 3, 2, 14, 13, 'iron_ore', [1, 1], '#8a8580', '#e8bd9c', 4],
  ['gold', 'Gold', 5, 3, 18, 18, 'gold_ore', [1, 1], '#8a8578', '#ffd23a', 7],
  ['lapis', 'Lapis', 7, 3, 18, 22, 'lapis', [3, 6], '#7a7f8c', '#2a55d8', 2],
  ['redstone', 'Redstone', 9, 3, 20, 26, 'redstone', [3, 5], '#86797a', '#ff2a2a', 3],
  ['diamond', 'Diamond', 12, 4, 30, 40, 'diamond', [1, 1], '#7c8a8c', '#5ff2ea', 30],
  ['mithril', 'Mithril', 16, 5, 42, 60, 'mithril', [1, 2], '#4d6670', '#7fffd4', 40],
  ['titanium', 'Titanium', 20, 6, 58, 85, 'titanium', [1, 1], '#5c5f6a', '#f0f0ff', 65],
  ['gemstone', 'Gemstone', 24, 6, 75, 120, 'gemstone', [1, 1], '#4b3c55', '#ff3fa0', 100],
];
I('cobblestone', 'Cobblestone', { price: 1, cat: 'mining', icon: { s: 'block', c: '#8d8d8d', pat: 'cobble' }, bz: 1, place: { k: 'block', solid: 1 } });
I('coal', 'Coal', { price: 3, cat: 'mining', icon: { s: 'ore', c1: '#2a2a2a', c2: '#0e0e0e' }, bz: 1, tags: ['fuel'] });
I('iron_ore', 'Iron Ore', { price: 4, cat: 'mining', icon: { s: 'ore', c1: '#9b928a', c2: '#e8bd9c' }, bz: 1, smelt: 'iron_ingot' });
I('gold_ore', 'Gold Ore', { price: 7, cat: 'mining', icon: { s: 'ore', c1: '#9b9580', c2: '#ffd23a' }, bz: 1, smelt: 'gold_ingot' });
I('lapis', 'Lapis Lazuli', { price: 2, cat: 'mining', icon: { s: 'gem', c: '#2a55d8' }, bz: 1 });
I('redstone', 'Redstone', { price: 3, cat: 'mining', icon: { s: 'dust', c: '#ff2a2a' }, bz: 1 });
I('diamond', 'Diamond', { price: 30, cat: 'mining', icon: { s: 'gem', c: '#5ff2ea' }, rar: 1, bz: 1 });
I('mithril', 'Mithril', { price: 40, cat: 'mining', icon: { s: 'gem', c: '#7fffd4' }, rar: 1, bz: 1 });
I('titanium', 'Titanium', { price: 65, cat: 'mining', icon: { s: 'ingot', c: '#f0f0ff' }, rar: 2, bz: 1 });
I('gemstone', 'Gemstone', { price: 100, cat: 'mining', icon: { s: 'gem', c: '#ff3fa0' }, rar: 2, bz: 1 });
I('iron_ingot', 'Iron Ingot', { price: 7, cat: 'mining', icon: { s: 'ingot', c: '#e6e6e6' }, bz: 1 });
I('gold_ingot', 'Gold Ingot', { price: 12, cat: 'mining', icon: { s: 'ingot', c: '#ffd23a' }, bz: 1 });
I('smooth_stone', 'Smooth Stone', { price: 2, cat: 'mining', icon: { s: 'block', c: '#b3b3b3', pat: 'smooth' }, place: { k: 'block', solid: 1 } });
ITEMS.cobblestone.smelt = 'smooth_stone';
ROCKS.forEach(([id, name, lvl, tier, hp, xp, drop, mm, base, spot], i) => {
  NODES[id] = { k: 'rock', id, name: id === 'stone' ? 'Stone' : name + ' Ore', skill: 'mining', lvl, tier, hp, xp, base, spot, drops: [[drop, mm[0], mm[1], 1]], respawn: 12 + i * 2, idx: i, item: drop };
});
TREES.forEach(t => { ITEMS[t[0] + '_log'].smelt = 'charcoal'; });

// crops ------------------------------------------------------------
//   id, name, lvl, xp, price, [min,max], color, grow seconds, seed item, emoji
const CROPS = [
  ['wheat', 'Wheat', 0, 4, 1, [1, 1], '#e8c547', 40, 'wheat_seeds', '🌾'],
  ['carrot', 'Carrot', 1, 5, 2, [1, 3], '#ff8a1f', 45, 'carrot', '🥕'],
  ['potato', 'Potato', 2, 6, 2, [1, 3], '#c8a055', 45, 'potato', '🥔'],
  ['pumpkin', 'Pumpkin', 4, 9, 5, [1, 1], '#ff9a1a', 60, 'pumpkin_seeds', '🎃'],
  ['melon', 'Melon Slice', 5, 10, 1, [3, 6], '#62c043', 60, 'melon_seeds', '🍉'],
  ['sugarcane', 'Sugar Cane', 7, 12, 3, [1, 3], '#8fd67a', 70, 'sugarcane', '🎋'],
  ['cocoa', 'Cocoa Beans', 9, 15, 4, [1, 3], '#7b4a25', 80, 'cocoa', '🫘'],
  ['netherwart', 'Nether Wart', 12, 20, 5, [1, 3], '#c22e45', 90, 'netherwart', '🌶️'],
  ['mushroom', 'Mushroom', 15, 26, 7, [1, 2], '#d63a3a', 100, 'mushroom', '🍄'],
  ['starfruit', 'Starfruit', 20, 40, 20, [1, 2], '#ffe94d', 140, 'starfruit_seeds', '⭐'],
];
CROPS.forEach(([id, name, lvl, xp, price, mm, col, grow, seed, emoji], i) => {
  I(id, name, { price, cat: 'farming', icon: { s: 'e', e: emoji }, bz: 1, rar: i >= 8 ? 1 : 0 });
  if (seed !== id) I(seed, name.replace(' Slice', '') + ' Seeds', { price: Math.max(1, Math.ceil(price / 2)), cat: 'farming', icon: { s: 'seed', c: col }, bz: 1 });
  ITEMS[seed].plant = id;
  const drops = [[id, mm[0], mm[1], 1]];
  if (seed !== id) drops.push([seed, 1, 2, 0.55]);
  NODES['crop_' + id] = { k: 'crop', id, name, skill: 'farming', lvl, tier: 0, hp: 1, xp, col, grow, drops, idx: i, seed, item: id };
});
ITEMS.potato.smelt = 'baked_potato';
I('bread', 'Bread', { price: 4, cat: 'food', icon: { s: 'e', e: '🍞' }, food: 45 });
I('baked_potato', 'Baked Potato', { price: 4, cat: 'food', icon: { s: 'e', e: '🥔' }, food: 40 });
I('compost', 'Compost', { price: 6, cat: 'farming', icon: { s: 'dust', c: '#6a4a2a' }, bz: 1 });
R('bread', 1, [['wheat', 3]], 'hand', null, 'food');

// fishing ----------------------------------------------------------
I('raw_cod', 'Raw Cod', { price: 3, cat: 'fishing', icon: { s: 'e', e: '🐟' }, bz: 1, food: 15 });
I('raw_salmon', 'Raw Salmon', { price: 6, cat: 'fishing', icon: { s: 'e', e: '🐠' }, bz: 1, food: 20 });
I('pufferfish', 'Pufferfish', { price: 10, cat: 'fishing', icon: { s: 'e', e: '🐡' }, bz: 1 });
I('shrimp', 'Glow Shrimp', { price: 16, cat: 'fishing', icon: { s: 'e', e: '🦐' }, bz: 1, rar: 1 });
I('ink', 'Ink Sac', { price: 4, cat: 'fishing', icon: { s: 'e', e: '🦑' }, bz: 1 });
I('prismarine', 'Prismarine Shard', { price: 18, cat: 'fishing', icon: { s: 'gem', c: '#4ad6c0' }, bz: 1, rar: 1 });
I('sponge', 'Sponge', { price: 25, cat: 'fishing', icon: { s: 'block', c: '#e2d24a', pat: 'sponge' }, bz: 1, rar: 1 });
I('pearl', 'Sea Pearl', { price: 120, cat: 'fishing', icon: { s: 'e', e: '🫧' }, bz: 1, rar: 2 });

// mob drops --------------------------------------------------------
I('slimeball', 'Slimeball', { price: 2, cat: 'combat', icon: { s: 'blob', c: '#62d162' }, bz: 1 });
I('rotten_flesh', 'Rotten Flesh', { price: 2, cat: 'combat', icon: { s: 'e', e: '🥩' }, bz: 1 });
I('bone', 'Bone', { price: 3, cat: 'combat', icon: { s: 'e', e: '🦴' }, bz: 1 });
I('string', 'String', { price: 3, cat: 'combat', icon: { s: 'e', e: '🧵' }, bz: 1 });
I('spider_eye', 'Spider Eye', { price: 5, cat: 'combat', icon: { s: 'e', e: '👁️' }, bz: 1 });
I('wolf_tooth', 'Wolf Tooth', { price: 9, cat: 'combat', icon: { s: 'e', e: '🦷' }, bz: 1 });
I('ender_pearl', 'Void Pearl', { price: 20, cat: 'combat', icon: { s: 'gem', c: '#1f9e8a' }, bz: 1, rar: 1 });
I('ectoplasm', 'Ectoplasm', { price: 18, cat: 'combat', icon: { s: 'blob', c: '#a8f0ff' }, bz: 1, rar: 1 });
I('void_shard', 'Void Shard', { price: 40, cat: 'combat', icon: { s: 'gem', c: '#9a4dff' }, bz: 1, rar: 2 });
I('bog_heart', 'Bog Heart', { price: 300, cat: 'combat', icon: { s: 'e', e: '💚' }, rar: 3 });
I('venom_gland', 'Venom Gland', { price: 900, cat: 'combat', icon: { s: 'e', e: '🧪' }, rar: 3 });
I('wyrm_scale', 'Wyrm Scale', { price: 3000, cat: 'combat', icon: { s: 'e', e: '🐉' }, rar: 4 });
I('golem_core', 'Golem Core', { price: 700, cat: 'mining', icon: { s: 'gem', c: '#ff8a3a' }, rar: 3 });
I('treant_bark', 'Treant Bark', { price: 700, cat: 'foraging', icon: { s: 'log', c1: '#3b2a1a', c2: '#7aff8a' }, rar: 3 });
I('golden_straw', 'Golden Straw', { price: 600, cat: 'farming', icon: { s: 'e', e: '🪈' }, rar: 3 });
I('dungeon_essence', 'Dungeon Essence', { price: 25, cat: 'combat', icon: { s: 'gem', c: '#ffe0a0' }, bz: 1, rar: 1 });

// compacted "enchanted" materials -----------------------------------
const COMPACT = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'darkoak_log', 'cherry_log', 'ancient_log', 'crystal_log',
  'cobblestone', 'coal', 'iron_ingot', 'gold_ingot', 'lapis', 'redstone', 'diamond', 'mithril', 'titanium', 'gemstone',
  'wheat', 'carrot', 'potato', 'pumpkin', 'melon', 'sugarcane', 'cocoa', 'netherwart', 'mushroom', 'starfruit',
  'rotten_flesh', 'bone', 'string', 'slimeball', 'spider_eye', 'ender_pearl', 'raw_cod', 'ink', 'prismarine'];
COMPACT.forEach(b => {
  const base = ITEMS[b];
  I('enchanted_' + b, 'Compacted ' + base.name, { price: Math.round(base.price * 32 * 1.15), cat: base.cat, icon: Object.assign({}, base.icon, { glint: 1 }), rar: Math.min(5, base.rar + 1), bz: 1, compactOf: b });
  base.compact = 'enchanted_' + b;
  R('enchanted_' + b, 1, [[b, 32]], 'bench', null, 'materials', 2, [b, 2]);
});
I('cooked_cod', 'Cooked Cod', { price: 5, cat: 'food', icon: { s: 'e', e: '🍤' }, food: 40 });
I('cooked_salmon', 'Cooked Salmon', { price: 8, cat: 'food', icon: { s: 'e', e: '🍣' }, food: 60 });
ITEMS.raw_cod.smelt = 'cooked_cod'; ITEMS.raw_salmon.smelt = 'cooked_salmon';
// furnace: seconds per item, and how many items one fuel item smelts
const SMELT_TIME = { iron_ore: 3, gold_ore: 4, cobblestone: 1.5, potato: 2, raw_cod: 2, raw_salmon: 2, log: 2 };
function smeltTime(id) { return SMELT_TIME[id] || (ITEMS[id].tags && ITEMS[id].tags.includes('log') ? SMELT_TIME.log : 2); }
const FUEL = { coal: 8, charcoal: 8, enchanted_coal: 300, planks: 0.75, stick: 0.25 };
function fuelValue(id) { return FUEL[id] || (ITEMS[id] && ITEMS[id].tags && ITEMS[id].tags.includes('log') ? 1.5 : 0); }

// tools & weapons ----------------------------------------------------
const MATS = [
  { k: 'wood', n: 'Wooden', mat: 'planks', c: '#b5823f', rar: 0, req: 0, bt: 1 },
  { k: 'stone', n: 'Stone', mat: 'cobblestone', c: '#a2a2a2', rar: 0, req: 0, bt: 1 },
  { k: 'iron', n: 'Iron', mat: 'iron_ingot', c: '#e6e6e6', rar: 1, req: 2, bt: 2 },
  { k: 'gold', n: 'Golden', mat: 'gold_ingot', c: '#ffd23a', rar: 1, req: 4, bt: 2 },
  { k: 'diamond', n: 'Diamond', mat: 'diamond', c: '#5ff2ea', rar: 2, req: 8, bt: 3 },
  { k: 'mithril', n: 'Mithril', mat: 'enchanted_mithril', c: '#6fffc8', rar: 3, req: 14, bt: 4 },
  { k: 'titanium', n: 'Titanium', mat: 'enchanted_titanium', c: '#f4f4ff', rar: 4, req: 20, bt: 4 },
];
const POWER = [3, 5, 8, 12, 18, 26, 36];
MATS.forEach((m, i) => {
  const t = i + 1;
  I(m.k + '_axe', m.n + ' Axe', { unique: 1, rar: m.rar, cat: 'tool', icon: { s: 'axe', c: m.c }, tool: { kind: 'axe', tier: t, power: POWER[i] }, stats: { foragingFortune: [0, 5, 10, 15, 25, 40, 60][i] } });
  I(m.k + '_pickaxe', m.n + ' Pickaxe', { unique: 1, rar: m.rar, cat: 'tool', icon: { s: 'pickaxe', c: m.c }, tool: { kind: 'pickaxe', tier: t, power: POWER[i] }, stats: { miningFortune: [0, 5, 10, 15, 25, 40, 60][i] } });
  I(m.k + '_hoe', m.n + ' Hoe', { unique: 1, rar: m.rar, cat: 'tool', icon: { s: 'hoe', c: m.c }, tool: { kind: 'hoe', tier: t, power: 1, sweep: t >= 5 ? 1 : 0 }, stats: { farmingFortune: [10, 20, 35, 50, 75, 110, 150][i] } });
  I(m.k + '_sword', m.n + ' Sword', { unique: 1, rar: m.rar, cat: 'weapon', icon: { s: 'sword', c: m.c }, tool: { kind: 'sword', dmg: [20, 30, 45, 60, 85, 120, 170][i] }, stats: { strength: [0, 0, 5, 10, 20, 35, 50][i] } });
  R(m.k + '_axe', 1, [[m.mat, 3], ['stick', 2]], 'bench', ['foraging', m.req], 'tools', m.bt).shape = 'axe';
  R(m.k + '_pickaxe', 1, [[m.mat, 3], ['stick', 2]], 'bench', ['mining', m.req], 'tools', m.bt).shape = 'pickaxe';
  R(m.k + '_hoe', 1, [[m.mat, 2], ['stick', 2]], 'bench', ['farming', m.req], 'tools', m.bt).shape = 'hoe';
  R(m.k + '_sword', 1, [[m.mat, 2], ['stick', 1]], 'bench', ['combat', m.req], 'weapons', m.bt).shape = 'sword';
});
// drills
// drills: the fastest miners, but they burn fuel (right-click with a drill to refuel from coal in your bag)
I('iron_drill', 'Prospector Drill', { unique: 1, rar: 2, cat: 'tool', icon: { s: 'drill', c: '#e6e6e6' }, tool: { kind: 'drill', tier: 4, power: 16, fuel: 1500 }, stats: { miningFortune: 25, breakPct: 10 } });
I('mithril_drill', 'Mithril Drill', { unique: 1, rar: 3, cat: 'tool', icon: { s: 'drill', c: '#6fffc8' }, tool: { kind: 'drill', tier: 6, power: 32, fuel: 3000 }, stats: { miningFortune: 50, breakPct: 15 } });
I('titanium_drill', 'Titanium Drill', { unique: 1, rar: 4, cat: 'tool', icon: { s: 'drill', c: '#f4f4ff' }, tool: { kind: 'drill', tier: 7, power: 48, fuel: 5000 }, stats: { miningFortune: 80, breakPct: 25 } });
I('gemstone_drill', 'Gemstone Drill', { unique: 1, rar: 5, cat: 'tool', icon: { s: 'drill', c: '#ff3fa0' }, tool: { kind: 'drill', tier: 8, power: 70, fuel: 10000 }, stats: { miningFortune: 130, breakPct: 35 } });
I('drill_engine', 'Drill Engine', { price: 2500, rar: 2, cat: 'tool', icon: { s: 'e', e: '⚙️' }, desc: 'Install at Engineer Ezra: +1 engine level on a drill (max 3), each +20% break speed.' });
I('fuel_tank', 'Fuel Tank', { price: 1500, rar: 1, cat: 'tool', icon: { s: 'e', e: '🛢️' }, desc: 'Install at Engineer Ezra: doubles a drill\'s fuel capacity (max 2).' });
R('iron_drill', 1, [['enchanted_iron_ingot', 3], ['enchanted_coal', 2], ['redstone', 32]], 'bench', ['mining', 9], 'tools', 3, ['iron_ore', 3]);
R('mithril_drill', 1, [['enchanted_mithril', 4], ['enchanted_iron_ingot', 4], ['enchanted_redstone', 2]], 'bench', ['mining', 14], 'tools', 4, ['mithril', 2]);
R('titanium_drill', 1, [['enchanted_titanium', 5], ['enchanted_mithril', 4], ['enchanted_redstone', 4]], 'bench', ['mining', 20], 'tools', 4, ['titanium', 2]);
R('gemstone_drill', 1, [['enchanted_gemstone', 5], ['enchanted_titanium', 3], ['golem_core', 1]], 'bench', ['mining', 24], 'tools', 4, ['gemstone', 2]);
R('drill_engine', 1, [['enchanted_iron_ingot', 4], ['enchanted_redstone', 2], ['gold_ingot', 16]], 'bench', ['mining', 9], 'tools', 3);
R('fuel_tank', 1, [['enchanted_iron_ingot', 2], ['enchanted_coal', 1]], 'bench', ['mining', 9], 'tools', 3);
// bows
I('bow', 'Bow', { unique: 1, rar: 0, cat: 'weapon', icon: { s: 'bow', c: '#b5823f' }, tool: { kind: 'bow', dmg: 30 } });
I('iron_bow', 'Iron Bow', { unique: 1, rar: 1, cat: 'weapon', icon: { s: 'bow', c: '#e6e6e6' }, tool: { kind: 'bow', dmg: 55 }, stats: { critChance: 3 } });
I('diamond_bow', 'Diamond Bow', { unique: 1, rar: 2, cat: 'weapon', icon: { s: 'bow', c: '#5ff2ea' }, tool: { kind: 'bow', dmg: 95 }, stats: { critChance: 5, critDamage: 15 } });
I('mithril_bow', 'Mithril Longbow', { unique: 1, rar: 3, cat: 'weapon', icon: { s: 'bow', c: '#6fffc8' }, tool: { kind: 'bow', dmg: 150 }, stats: { critChance: 8, critDamage: 30, strength: 20 } });
R('bow', 1, [['stick', 3], ['string', 3]], 'bench', ['combat', 0], 'weapons');
R('iron_bow', 1, [['iron_ingot', 6], ['string', 8], ['stick', 3]], 'bench', ['combat', 4], 'weapons');
R('diamond_bow', 1, [['diamond', 6], ['enchanted_string', 2], ['stick', 3]], 'bench', ['combat', 10], 'weapons');
R('mithril_bow', 1, [['enchanted_mithril', 3], ['enchanted_string', 4], ['enchanted_bone', 2]], 'bench', ['combat', 18], 'weapons');
// wands
I('apprentice_wand', 'Apprentice Wand', { unique: 1, rar: 0, cat: 'weapon', icon: { s: 'wand', c: '#2a55d8' }, tool: { kind: 'wand', dmg: 28, mana: 12 }, stats: { intelligence: 25 } });
I('redstone_wand', 'Redstone Wand', { unique: 1, rar: 1, cat: 'weapon', icon: { s: 'wand', c: '#ff2a2a' }, tool: { kind: 'wand', dmg: 55, mana: 18 }, stats: { intelligence: 60 } });
I('diamond_staff', 'Diamond Staff', { unique: 1, rar: 2, cat: 'weapon', icon: { s: 'wand', c: '#5ff2ea' }, tool: { kind: 'wand', dmg: 95, mana: 25 }, stats: { intelligence: 110 } });
I('mithril_scepter', 'Mithril Scepter', { unique: 1, rar: 3, cat: 'weapon', icon: { s: 'wand', c: '#6fffc8' }, tool: { kind: 'wand', dmg: 165, mana: 35 }, stats: { intelligence: 190, critDamage: 20 } });
R('apprentice_wand', 1, [['stick', 2], ['lapis', 12]], 'bench', ['combat', 2], 'weapons');
R('redstone_wand', 1, [['redstone', 48], ['gold_ingot', 4], ['stick', 2]], 'bench', ['combat', 6], 'weapons');
R('diamond_staff', 1, [['diamond', 8], ['enchanted_lapis', 2], ['stick', 2]], 'bench', ['combat', 12], 'weapons');
R('mithril_scepter', 1, [['enchanted_mithril', 4], ['enchanted_redstone', 4], ['ectoplasm', 16]], 'bench', ['combat', 20], 'weapons');
// rods
I('fishing_rod', 'Fishing Rod', { unique: 1, rar: 0, cat: 'tool', icon: { s: 'rod', c: '#b5823f' }, tool: { kind: 'rod', tier: 1 } });
I('iron_rod', 'Iron Rod', { unique: 1, rar: 1, cat: 'tool', icon: { s: 'rod', c: '#e6e6e6' }, tool: { kind: 'rod', tier: 2 }, stats: { fishingSpeed: 10 } });
I('diamond_rod', 'Diamond Rod', { unique: 1, rar: 2, cat: 'tool', icon: { s: 'rod', c: '#5ff2ea' }, tool: { kind: 'rod', tier: 3 }, stats: { fishingSpeed: 20, treasure: 3 } });
I('mithril_rod', 'Mithril Rod', { unique: 1, rar: 3, cat: 'tool', icon: { s: 'rod', c: '#6fffc8' }, tool: { kind: 'rod', tier: 4 }, stats: { fishingSpeed: 35, treasure: 6 } });
R('fishing_rod', 1, [['stick', 3], ['string', 2]], 'bench', null, 'tools');
R('iron_rod', 1, [['iron_ingot', 4], ['string', 4], ['stick', 2]], 'bench', ['fishing', 3], 'tools');
R('diamond_rod', 1, [['diamond', 4], ['enchanted_string', 1], ['prismarine', 8]], 'bench', ['fishing', 8], 'tools');
R('mithril_rod', 1, [['enchanted_mithril', 2], ['enchanted_prismarine', 2], ['pearl', 2]], 'bench', ['fishing', 16], 'tools');
// boss & dungeon weapons
I('bog_cleaver', 'Bog Cleaver', { unique: 1, rar: 3, cat: 'weapon', icon: { s: 'sword', c: '#6fbf3a' }, tool: { kind: 'sword', dmg: 110 }, stats: { strength: 30, health: 40 } });
I('venom_fang', 'Venom Fang', { unique: 1, rar: 4, cat: 'weapon', icon: { s: 'sword', c: '#b03aff' }, tool: { kind: 'sword', dmg: 190 }, stats: { critChance: 10, critDamage: 40, strength: 30 } });
I('void_blade', 'Void Blade', { unique: 1, rar: 5, cat: 'weapon', icon: { s: 'sword', c: '#7a3aff' }, tool: { kind: 'sword', dmg: 320 }, stats: { strength: 80, critDamage: 80, intelligence: 50 } });
I('bone_reaver', 'Bone Reaver', { unique: 1, rar: 3, cat: 'weapon', icon: { s: 'sword', c: '#f0ead0' }, tool: { kind: 'sword', dmg: 150 }, stats: { strength: 40, dungeonDmg: 10 } });
I('necro_staff', 'Necromancer Staff', { unique: 1, rar: 4, cat: 'weapon', icon: { s: 'wand', c: '#5aff9a' }, tool: { kind: 'wand', dmg: 260, mana: 30 }, stats: { intelligence: 260, dungeonDmg: 15 } });
I('hunter_longbow', "Hunter's Longbow", { unique: 1, rar: 4, cat: 'weapon', icon: { s: 'bow', c: '#ff9a3a' }, tool: { kind: 'bow', dmg: 230 }, stats: { critChance: 15, critDamage: 50, strength: 40 } });
I('lich_bane', 'Lich Bane', { unique: 1, rar: 5, cat: 'weapon', icon: { s: 'sword', c: '#66e0ff' }, tool: { kind: 'sword', dmg: 420 }, stats: { strength: 120, critDamage: 100, dungeonDmg: 25 } });
I('treecapitator', 'Timberfall Axe', { unique: 1, rar: 4, cat: 'tool', icon: { s: 'axe', c: '#ff5a3a' }, tool: { kind: 'axe', tier: 7, power: 50, cleave: 1 }, stats: { foragingFortune: 80, strength: 20 } });
I('golem_pickaxe', 'Golem Pickaxe', { unique: 1, rar: 4, cat: 'tool', icon: { s: 'pickaxe', c: '#ff8a3a' }, tool: { kind: 'pickaxe', tier: 7, power: 42 }, stats: { miningFortune: 90, defense: 30 } });
I('harvest_scythe', 'Harvest Scythe', { unique: 1, rar: 4, cat: 'tool', icon: { s: 'hoe', c: '#ffd23a' }, tool: { kind: 'hoe', tier: 7, power: 1, sweep: 2 }, stats: { farmingFortune: 200, speed: 15 } });

// misc special items
I('recombobulator', 'Rarity Prism', { price: 5000, rar: 4, cat: 'special', icon: { s: 'e', e: '🔆' }, desc: 'Use at the Blacksmith to upgrade an item\'s rarity by one tier.' });
I('ench_book', 'Enchanted Book', { unique: 1, price: 400, rar: 1, cat: 'special', icon: { s: 'e', e: '📕', glint: 1 }, desc: 'Apply at an Enchanter to push an enchant past its normal limit.' });
I('health_potion', 'Health Potion', { price: 20, cat: 'food', icon: { s: 'e', e: '🧃' }, food: 9999, desc: 'Fully restores health.' });
I('mana_potion', 'Mana Potion', { price: 25, cat: 'food', icon: { s: 'e', e: '🧪' }, mana: 9999, desc: 'Fully restores mana.' });
R('health_potion', 2, [['melon', 8], ['redstone', 2]], 'bench', ['farming', 8], 'food');
R('mana_potion', 2, [['lapis', 8], ['netherwart', 2]], 'bench', ['farming', 16], 'food');

// pet eggs
const EGGS = {
  egg_common: { name: 'Common Pet Egg', rar: 0, pool: ['bee', 'rabbit', 'mole', 'silverfish', 'monkey', 'owl', 'wolf', 'tiger', 'squid'], rolls: [70, 25, 5, 0, 0] },
  egg_rare: { name: 'Rare Pet Egg', rar: 2, pool: ['bee', 'rabbit', 'mole', 'silverfish', 'monkey', 'owl', 'wolf', 'tiger', 'squid'], rolls: [0, 45, 40, 13, 2] },
  egg_golem: { name: 'Golem Egg', rar: 3, pool: ['golem'], rolls: [0, 0, 60, 35, 5] },
  egg_sprout: { name: 'Sprout Egg', rar: 3, pool: ['sprout'], rolls: [0, 0, 60, 35, 5] },
  egg_scarecrow: { name: 'Straw Egg', rar: 3, pool: ['crow'], rolls: [0, 0, 60, 35, 5] },
  egg_phoenix: { name: 'Phoenix Egg', rar: 4, pool: ['phoenix'], rolls: [0, 0, 0, 70, 30] },
  egg_dragon: { name: 'Dragon Egg', rar: 5, pool: ['dragon'], rolls: [0, 0, 0, 40, 60] },
};
const EGG_COL = { egg_common: '#f2e6c8', egg_rare: '#7ab8ff', egg_golem: '#ff8a3a', egg_sprout: '#7aff8a', egg_scarecrow: '#ffd23a', egg_phoenix: '#ff5a2a', egg_dragon: '#a04dff' };
Object.entries(EGGS).forEach(([id, e]) => I(id, e.name, { price: [1200, 12000, 20000, 20000, 20000, 60000, 150000][Object.keys(EGGS).indexOf(id)], rar: e.rar, cat: 'pet', icon: { s: 'egg', c: EGG_COL[id] }, egg: 1, desc: 'Right-click or open Pets to hatch!' }));

// building blocks & stations ----------------------------------------
I('stone_bricks', 'Stone Bricks', { price: 4, cat: 'block', icon: { s: 'block', c: '#9a9a9a', pat: 'bricks' }, place: { k: 'block', solid: 1 } });
I('fence', 'Fence', { price: 3, cat: 'block', icon: { s: 'block', c: '#b5823f', pat: 'fence' }, place: { k: 'block', solid: 1 } });
I('lamp', 'Lamp', { price: 14, cat: 'block', icon: { s: 'block', c: '#ffe08a', pat: 'lamp' }, place: { k: 'block', solid: 1, light: 1 } });
I('path', 'Stone Path', { price: 2, cat: 'block', icon: { s: 'block', c: '#b8a98a', pat: 'path' }, place: { k: 'block', floor: 1 } });
I('wood_floor', 'Wood Floor', { price: 2, cat: 'block', icon: { s: 'block', c: '#a8743c', pat: 'planks' }, place: { k: 'block', floor: 1 } });
I('flower', 'Flower', { price: 2, cat: 'block', icon: { s: 'e', e: '🌷' }, place: { k: 'block', floor: 1, deco: 1 } });
I('hedge', 'Hedge', { price: 4, cat: 'block', icon: { s: 'block', c: '#3f8f3f', pat: 'hedge' }, place: { k: 'block', solid: 1 } });
I('workbench', 'Workbench', { price: 4, cat: 'station', icon: { s: 'block', c: '#b5823f', pat: 'bench' }, place: { k: 'block', solid: 1, station: 'bench' } });
I('furnace', 'Furnace', { price: 10, cat: 'station', icon: { s: 'block', c: '#7a7a7a', pat: 'furnace' }, place: { k: 'block', solid: 1, station: 'furnace' } });
I('chest', 'Chest', { price: 8, cat: 'station', icon: { s: 'block', c: '#b5823f', pat: 'chest' }, place: { k: 'block', solid: 1, chest: 1 } });
I('enchant_table', 'Enchanting Table', { price: 300, rar: 2, cat: 'station', icon: { s: 'block', c: '#3a2a55', pat: 'etable' }, place: { k: 'block', solid: 1, station: 'enchant' } });
I('anvil', 'Anvil', { price: 200, rar: 1, cat: 'station', icon: { s: 'block', c: '#5a5a62', pat: 'anvil' }, place: { k: 'block', solid: 1, station: 'anvil' } });
R('workbench', 1, [['planks', 4]], 'hand', null, 'blocks');
R('chest', 1, [['planks', 8]], 'bench', null, 'blocks');
R('furnace', 1, [['cobblestone', 8]], 'bench', null, 'blocks');
R('stone_bricks', 4, [['cobblestone', 4]], 'bench', null, 'blocks');
R('fence', 3, [['planks', 4], ['stick', 2]], 'bench', null, 'blocks');
R('lamp', 1, [['iron_ingot', 1], ['coal', 2]], 'bench', null, 'blocks');
R('path', 4, [['cobblestone', 2]], 'bench', null, 'blocks');
R('wood_floor', 4, [['planks', 2]], 'bench', null, 'blocks');
R('hedge', 2, [['oak_sapling', 1], ['planks', 1]], 'bench', null, 'blocks');
R('enchant_table', 1, [['diamond', 4], ['enchanted_lapis', 1], ['planks', 8]], 'bench', ['mining', 10], 'blocks');
R('anvil', 1, [['iron_ingot', 24]], 'bench', ['mining', 5], 'blocks');
// workbench tiers: better benches unlock better recipes
I('workbench_2', 'Reinforced Workbench', { price: 80, rar: 1, cat: 'station', icon: { s: 'block', c: '#8a8f9a', pat: 'bench' }, place: { k: 'block', solid: 1, station: 'bench', bt: 2 }, desc: 'Tier II crafting: iron & gold gear, machines, compacted materials.' });
I('workbench_3', 'Arcane Workbench', { price: 600, rar: 2, cat: 'station', icon: { s: 'block', c: '#5a3aa0', pat: 'bench' }, place: { k: 'block', solid: 1, station: 'bench', bt: 3 }, desc: 'Tier III crafting: diamond gear, drills, enchanting tables.' });
I('workbench_4', 'Starforge Workbench', { price: 5000, rar: 3, cat: 'station', icon: { s: 'block', c: '#1fae9a', pat: 'bench' }, place: { k: 'block', solid: 1, station: 'bench', bt: 4 }, desc: 'Tier IV crafting: mithril & titanium gear and the best drills.' });
ITEMS.workbench.place.bt = 1; ITEMS.workbench.desc = 'Tier I crafting: wooden & stone tools, chests, furnaces.';
R('workbench_2', 1, [['workbench', 1], ['iron_ingot', 8], ['cobblestone', 16]], 'bench', ['mining', 2], 'blocks', 1);
R('workbench_3', 1, [['workbench_2', 1], ['diamond', 4], ['lapis', 32]], 'bench', ['mining', 8], 'blocks', 2);
R('workbench_4', 1, [['workbench_3', 1], ['enchanted_mithril', 2], ['enchanted_gold_ingot', 2]], 'bench', ['mining', 14], 'blocks', 3);

// boss materials for the newer islands (defined here so armor recipes can use them)
I('arcane_shard', 'Arcane Shard', { price: 400, cat: 'combat', icon: { s: 'gem', c: '#b88aff' }, rar: 3, bz: 1 });
I('titan_heart', 'Titan Heart', { price: 9000, cat: 'combat', icon: { s: 'e', e: '❤️‍🔥' }, rar: 4 });
I('kraken_beak', 'Kraken Beak', { price: 2500, cat: 'fishing', icon: { s: 'e', e: '🦑' }, rar: 3 });
I('frost_core', 'Frost Core', { price: 4000, cat: 'mining', icon: { s: 'gem', c: '#9af0ff' }, rar: 4 });
I('witch_heart', 'Witchwood Heart', { price: 4000, cat: 'foraging', icon: { s: 'e', e: '💜' }, rar: 4 });
I('wraith_lantern', 'Wraith Lantern', { price: 4000, cat: 'farming', icon: { s: 'e', e: '🏮' }, rar: 4 });

// armor sets ------------------------------------------------------------
const ARMOR_SLOTS = ['helmet', 'chest', 'legs', 'boots'];
const ARMOR_PIECE = { helmet: ['Helmet', 5, 0.18], chest: ['Chestplate', 8, 0.36], legs: ['Leggings', 7, 0.28], boots: ['Boots', 4, 0.18] };
//  set id, name, material, colour, rarity, base stats (whole set), recipe req, bench tier, collection req, bonus
const ARMOR_SETS = [
  ['leaf', 'Leafweave', 'oak_log', '#5fae3f', 0, { health: 40, foragingFortune: 30 }, ['foraging', 1], 1, ['oak_log', 1], { name: 'Canopy', desc: '+25% Foraging XP', st: { xpBoost: 0 }, foragingXp: 25 }],
  ['miner', 'Miner\'s', 'cobblestone', '#8d8d93', 0, { defense: 40, miningFortune: 30 }, ['mining', 1], 1, ['cobblestone', 1], { name: 'Deep Delver', desc: '+20% Break Speed', st: { breakPct: 20 } }],
  ['farmer', 'Farmhand', 'wheat', '#e8c547', 0, { health: 50, farmingFortune: 30 }, ['farming', 1], 1, ['wheat', 1], { name: 'Green Thumb', desc: '+15 Speed and +25% Farming XP', st: { speed: 15 }, farmingXp: 25 }],
  ['angler', 'Angler', 'raw_cod', '#3fa8d8', 1, { health: 60, treasure: 6, fishingSpeed: 20 }, ['fishing', 3], 1, ['raw_cod', 2], { name: 'Tidecaller', desc: 'Sea creatures appear 2× as often', st: {} }],
  ['iron', 'Iron', 'iron_ingot', '#d8d8de', 1, { defense: 110, health: 30 }, ['combat', 2], 2, null, { name: 'Ironclad', desc: '+30 Defense', st: { defense: 30 } }],
  ['gold', 'Golden', 'gold_ingot', '#ffd23a', 1, { defense: 70, magicFind: 8, health: 40 }, ['combat', 4], 2, null, { name: 'Midas Touch', desc: '+50% coins from monsters', st: {} }],
  ['diamond', 'Diamond', 'diamond', '#5ff2ea', 2, { defense: 220, health: 80 }, ['combat', 8], 3, null, { name: 'Brilliance', desc: '+10% Damage', st: { damagePct: 10 } }],
  ['bog', 'Swampking', 'bog_heart', '#5f8f2f', 3, { health: 180, defense: 120, strength: 40 }, ['combat', 6], 3, null, { name: 'Bog Regrowth', desc: 'Heal 2% of max health every second', st: {} }],
  ['venom', 'Venomweave', 'venom_gland', '#b03aff', 4, { health: 260, defense: 180, critDamage: 60, strength: 50 }, ['combat', 12], 3, null, { name: 'Neurotoxin', desc: '+20% Crit Chance', st: { critChance: 20 } }],
  ['void', 'Voidscale', 'wyrm_scale', '#7a3aff', 5, { health: 450, defense: 320, strength: 100, critDamage: 100 }, ['combat', 18], 4, null, { name: 'Event Horizon', desc: '+25% Damage and +20 Speed', st: { damagePct: 25, speed: 20 } }],
  ['golem', 'Stoneheart', 'golem_core', '#ff8a3a', 3, { defense: 300, health: 150, miningFortune: 60 }, ['mining', 12], 3, null, { name: 'Bedrock', desc: '+40 Mining Fortune and +25% Break Speed', st: { miningFortune: 40, breakPct: 25 } }],
  ['treant', 'Barkguard', 'treant_bark', '#4a6a2a', 3, { health: 200, defense: 120, foragingFortune: 60 }, ['foraging', 12], 3, null, { name: 'Old Growth', desc: '+40 Foraging Fortune and +40 Strength', st: { foragingFortune: 40, strength: 40 } }],
  ['straw', 'Strawman', 'golden_straw', '#d8b04a', 3, { health: 200, defense: 80, farmingFortune: 60 }, ['farming', 12], 3, null, { name: 'Harvest Moon', desc: '+40 Farming Fortune and +20 Speed', st: { farmingFortune: 40, speed: 20 } }],
  ['bone', 'Ossuary', 'enchanted_bone', '#e6dcc0', 3, { health: 160, defense: 140, strength: 60, dungeonDmg: 10 }, ['dungeoneering', 4], 3, null, { name: 'Undying', desc: '+25% Dungeon Damage', st: { dungeonDmg: 25 } }],
  // mage robes
  ['apprentice', 'Apprentice', 'lapis', '#3a6ae0', 1, { intelligence: 90, health: 30, defense: 20 }, ['combat', 3], 2, ['lapis', 2], { name: 'Focus', desc: 'Spells cost 25% less mana', st: { manaSave: 25 } }],
  ['arcanist', 'Arcanist', 'ectoplasm', '#9a6ae0', 2, { intelligence: 260, health: 100, defense: 70 }, ['combat', 10], 3, ['ectoplasm', 2], { name: 'Spellweave', desc: '+30% Spell Damage', st: { spellDmg: 30 } }],
  ['archmage', 'Archmage', 'arcane_shard', '#d8a8ff', 4, { intelligence: 650, health: 240, defense: 150 }, ['combat', 18], 4, null, { name: 'Archmage', desc: '+60% Spell Damage and 40% less mana', st: { spellDmg: 60, manaSave: 40 } }],
  // new boss sets
  ['titan', 'Infernal', 'titan_heart', '#ff5a1a', 5, { health: 700, defense: 450, strength: 160, critDamage: 120 }, ['combat', 22], 4, null, { name: 'Molten Core', desc: '+35% Damage and +200 Health', st: { damagePct: 35, health: 200 } }],
  ['coral', 'Tidebound', 'kraken_beak', '#ff7ad8', 3, { health: 260, defense: 120, treasure: 12, fishingSpeed: 40 }, ['fishing', 12], 3, null, { name: 'Abyssal', desc: '+10 Sea Treasure and 2× sea creatures', st: { treasure: 10 } }],
  ['frost', 'Frostguard', 'frost_core', '#9af0ff', 4, { defense: 420, health: 260, miningFortune: 120 }, ['mining', 22], 4, null, { name: 'Permafrost', desc: '+80 Mining Fortune and +40% Break Speed', st: { miningFortune: 80, breakPct: 40 } }],
  ['witch', 'Hexwood', 'witch_heart', '#9a5ad8', 4, { health: 380, defense: 200, foragingFortune: 120, strength: 60 }, ['foraging', 22], 4, null, { name: 'Coven', desc: '+80 Foraging Fortune and +60 Strength', st: { foragingFortune: 80, strength: 60 } }],
  ['wraith', 'Moonreaper', 'wraith_lantern', '#7a8aff', 4, { health: 380, defense: 180, farmingFortune: 120 }, ['farming', 22], 4, null, { name: 'Night Harvest', desc: '+80 Farming Fortune and +30 Speed', st: { farmingFortune: 80, speed: 30 } }],
];
const SETS = {};
ARMOR_SETS.forEach(([sid, name, mat, col, rar, st, req, bt, coll, bonus]) => {
  SETS[sid] = Object.assign({ id: sid, name, col }, bonus);
  const boss = ITEMS[mat] && ITEMS[mat].rar >= 3;
  for (const slot of ARMOR_SLOTS) {
    const [pn, cnt, share] = ARMOR_PIECE[slot], stats = {};
    for (const k in st) stats[k] = Math.max(1, Math.round(st[k] * share));
    I(sid + '_' + slot, `${name} ${pn}`, { unique: 1, rar, cat: 'armor', icon: { s: 'armor', c: col, slot }, armor: { slot, set: sid }, stats });
    const ins = boss ? [[mat, Math.ceil(cnt / 2.5)], ['enchanted_iron_ingot', Math.ceil(cnt / 3)]] : [[mat, cnt * (rar >= 2 ? 1 : 2)]];
    R(sid + '_' + slot, 1, ins, 'bench', req, 'armor', bt, coll).shape = slot;
  }
});

// collections: gather a resource to unlock recipes and earn rewards ------
const COLL_TIERS = [50, 250, 1000, 5000, 25000];
const COLL_GROUPS = {
  foraging: TREES.map(t => t[0] + '_log'),
  mining: ['cobblestone', 'coal', 'iron_ore', 'gold_ore', 'lapis', 'redstone', 'diamond', 'mithril', 'titanium', 'gemstone'],
  farming: CROPS.map(c => c[0]),
  combat: ['rotten_flesh', 'slimeball', 'bone', 'string', 'spider_eye', 'wolf_tooth', 'ender_pearl', 'ectoplasm', 'void_shard'],
  fishing: ['raw_cod', 'raw_salmon', 'pufferfish', 'shrimp', 'prismarine', 'ink'],
};
const COLLECTION = new Set(Object.values(COLL_GROUPS).flat());

// automation machines -------------------------------------------------
const MACHINES = {
  lumber_bot: { name: 'Lumber Bot', kind: 'gather', res: 'tree', skill: 'foraging', base: 14, col: '#4caf50', e: '🪓', desc: 'Chops trees automatically.' },
  auto_drill: { name: 'Auto Drill', kind: 'gather', res: 'rock', skill: 'mining', base: 13, col: '#8a94a6', e: '⛏️', desc: 'Mines ore automatically.' },
  auto_grower: { name: 'Auto Grower', kind: 'gather', res: 'crop', skill: 'farming', base: 12, col: '#c8d84a', e: '🌱', desc: 'Grows and harvests crops.' },
  mob_grinder: { name: 'Mob Grinder', kind: 'gather', res: 'mob', skill: 'combat', base: 18, col: '#d84a4a', e: '💀', desc: 'Spawns and grinds monsters for drops.' },
  auto_furnace: { name: 'Auto Furnace', kind: 'process', col: '#ff8a3a', e: '🔥', base: 3, desc: 'Smelts ores, logs and cobblestone fed into it.' },
  compactor: { name: 'Compactor', kind: 'process', col: '#a06bff', e: '🗜️', base: 2, desc: 'Packs 32 items into 1 enchanted item.' },
  auto_seller: { name: 'Auto Seller', kind: 'process', col: '#ffd23a', e: '💰', base: 0.6, desc: 'Sells everything fed into it to the merchant.' },
};
const MACHINE_MAX_TIER = 5;
Object.entries(MACHINES).forEach(([id, m]) => I(id, m.name, { unique: 1, rar: 1, cat: 'machine', icon: { s: 'machine', c: m.col, e: m.e }, place: { k: 'mach', m: id }, desc: m.desc }));
I('conveyor', 'Conveyor', { price: 6, cat: 'machine', icon: { s: 'conveyor', c: '#3a3f4a' }, place: { k: 'conv' }, desc: 'Moves items. Press R to rotate before placing.' });
R('conveyor', 4, [['iron_ingot', 2], ['planks', 2]], 'bench', null, 'machines', 2, ['iron_ore', 1]);
R('lumber_bot', 1, [['oak_log', 64], ['cobblestone', 32], ['iron_ingot', 8]], 'bench', ['foraging', 3], 'machines', 2, ['oak_log', 2]);
R('auto_drill', 1, [['cobblestone', 96], ['coal', 32], ['iron_ingot', 12]], 'bench', ['mining', 3], 'machines', 2, ['cobblestone', 2]);
R('auto_grower', 1, [['wheat', 96], ['planks', 32], ['iron_ingot', 8]], 'bench', ['farming', 3], 'machines', 2, ['wheat', 2]);
R('mob_grinder', 1, [['rotten_flesh', 64], ['bone', 32], ['iron_ingot', 16]], 'bench', ['combat', 4], 'machines', 2, ['rotten_flesh', 2]);
R('auto_furnace', 1, [['cobblestone', 64], ['coal', 32], ['iron_ingot', 8]], 'bench', ['mining', 3], 'machines', 2, ['coal', 2]);
R('compactor', 1, [['iron_ingot', 32], ['gold_ingot', 8], ['redstone', 32]], 'bench', ['mining', 9], 'machines', 2, ['redstone', 2]);
R('auto_seller', 1, [['gold_ingot', 16], ['planks', 32], ['chest', 1]], 'bench', ['mining', 6], 'machines', 2, ['gold_ore', 2]);
// switching a gatherer to another resource costs coins plus a starter batch of that resource
function machineSwitchCost(mid, res) {
  const M = MACHINES[mid], lv = M.res === 'mob' ? MOBS[res].lvl : M.res === 'fish' ? FISH_RES[res] : NODES[res].lvl, item = M.res === 'mob' ? MOBS[res].drops[0][0] : M.res === 'fish' ? res : NODES[res].item;
  return { coins: Math.round(150 * Math.pow(lv + 1, 1.8)), items: [[item, 32 + lv * 8]], item };
}
function machinePeriod(id, tier) { return MACHINES[id].base * Math.pow(0.8, tier - 1); }
function machineCap(tier) { return 64 * tier; }
const MACHINE_UPGRADES = [null, null,
  { coins: 500, items: [['iron_ingot', 16]] },
  { coins: 3000, items: [['enchanted_iron_ingot', 3]] },
  { coins: 15000, items: [['enchanted_gold_ingot', 4], ['enchanted_redstone', 2]] },
  { coins: 60000, items: [['enchanted_diamond', 4], ['enchanted_mithril', 1]] },
];

// ---------------------------------------------------------------- pets
const PETS = {
  bee: { name: 'Bee', skill: 'farming', e: '🐝', per: { farmingFortune: 0.6, xpBoost: 0.05 } },
  rabbit: { name: 'Rabbit', skill: 'farming', e: '🐰', per: { farmingFortune: 0.35, speed: 0.25 } },
  mole: { name: 'Mole', skill: 'mining', e: '🦔', per: { miningFortune: 0.6, defense: 0.2 } },
  silverfish: { name: 'Silverfish', skill: 'mining', e: '🐛', per: { breakPct: 0.4, defense: 0.15 } },
  monkey: { name: 'Monkey', skill: 'foraging', e: '🐒', per: { foragingFortune: 0.6, speed: 0.1 } },
  owl: { name: 'Owl', skill: 'foraging', e: '🦉', per: { xpBoost: 0.15, intelligence: 0.4 } },
  wolf: { name: 'Wolf', skill: 'combat', e: '🐺', per: { strength: 0.3, critDamage: 0.3 } },
  tiger: { name: 'Tiger', skill: 'combat', e: '🐯', per: { critChance: 0.1, strength: 0.25 } },
  squid: { name: 'Squid', skill: 'fishing', e: '🐙', per: { fishingSpeed: 0.5, treasure: 0.06 } },
  golem: { name: 'Golem', skill: 'mining', e: '🗿', per: { health: 1.5, defense: 0.5, miningFortune: 0.4 } },
  sprout: { name: 'Sprout', skill: 'foraging', e: '🌳', per: { foragingFortune: 0.9, strength: 0.15 } },
  crow: { name: 'Crow', skill: 'farming', e: '🐦‍⬛', per: { farmingFortune: 0.9, magicFind: 0.05 } },
  phoenix: { name: 'Phoenix', skill: 'combat', e: '🐦‍🔥', per: { strength: 0.45, intelligence: 0.6, critDamage: 0.2 } },
  dragon: { name: 'Dragon', skill: 'combat', e: '🐲', per: { strength: 0.6, critDamage: 0.6, miningFortune: 0.2, foragingFortune: 0.2, farmingFortune: 0.2 } },
};
const PET_MAX = 100;
function petXpToNext(l) { return Math.round(60 * Math.pow(1.055, l)); }
function petStats(p) {
  const d = PETS[p.id], m = 1 + p.rar * 0.25, out = {};
  for (const k in d.per) out[k] = +(d.per[k] * p.lvl * m).toFixed(1);
  return out;
}
const PET_UPGRADE = [
  { coins: 5000, items: [['enchanted_oak_log', 2]] },
  { coins: 25000, items: [['enchanted_iron_ingot', 4]] },
  { coins: 100000, items: [['enchanted_diamond', 4]] },
  { coins: 400000, items: [['enchanted_mithril', 6]] },
];

// ------------------------------------------------------------ enchants
const ALL_TOOLS = ['axe', 'pickaxe', 'drill', 'hoe', 'sword', 'bow', 'wand', 'rod'];
const ENCHANTS = {
  sharpness: { name: 'Sharpness', max: 5, on: ['sword'], desc: l => `+${l * 10}% melee damage`, cost: 120 },
  power: { name: 'Power', max: 5, on: ['bow'], desc: l => `+${l * 10}% bow damage`, cost: 120 },
  arcane: { name: 'Arcane', max: 5, on: ['wand'], desc: l => `+${l * 10}% spell damage`, cost: 120 },
  critical: { name: 'Critical', max: 5, on: ['sword', 'bow'], desc: l => `+${l * 10}% Crit Damage`, cost: 160 },
  lifesteal: { name: 'Life Steal', max: 3, on: ['sword'], desc: l => `Heal ${l}% max health per hit`, cost: 400 },
  looting: { name: 'Looting', max: 4, on: ['sword', 'bow', 'wand'], desc: l => `+${l * 15}% mob drop chance`, cost: 300 },
  scavenger: { name: 'Scavenger', max: 5, on: ['sword', 'bow', 'wand'], desc: l => `+${l * 20}% coins from mobs`, cost: 200 },
  efficiency: { name: 'Efficiency', max: 5, on: ['axe', 'pickaxe', 'drill', 'hoe'], desc: l => `+${l * 15}% breaking power`, cost: 120 },
  fortune: { name: 'Fortune', max: 4, on: ['pickaxe', 'drill'], desc: l => `+${l * 12} Mining Fortune`, cost: 260 },
  timber: { name: 'Timber', max: 4, on: ['axe'], desc: l => `+${l * 12} Foraging Fortune`, cost: 260 },
  harvesting: { name: 'Harvesting', max: 5, on: ['hoe'], desc: l => `+${l * 12} Farming Fortune`, cost: 220 },
  experience: { name: 'Experience', max: 4, on: ALL_TOOLS, desc: l => `+${l * 8}% skill XP`, cost: 350 },
  smelting: { name: 'Smelting Touch', max: 1, on: ['pickaxe', 'drill'], desc: () => 'Ores drop already smelted', cost: 900 },
  telekinesis: { name: 'Telekinesis', max: 1, on: ALL_TOOLS, desc: () => 'Drops go straight to your inventory', cost: 600 },
  lure: { name: 'Lure', max: 5, on: ['rod'], desc: l => `-${l * 10}% bite time`, cost: 150 },
  luck: { name: 'Luck of the Sea', max: 5, on: ['rod'], desc: l => `+${l * 2} Sea Treasure`, cost: 200 },
  protection: { name: 'Protection', max: 5, on: ['armor'], desc: l => `+${l * 4} Defense`, cost: 150 },
  growth: { name: 'Growth', max: 5, on: ['armor'], desc: l => `+${l * 15} Health`, cost: 150 },
};
function enchantCost(id, l) { return { coins: Math.round(ENCHANTS[id].cost * l * l), lapis: l * 6 }; }

// ------------------------------------------------------------ reforges
const REFORGE_GROUP = { sword: 'melee', bow: 'ranged', wand: 'magic', axe: 'tool', pickaxe: 'tool', drill: 'tool', hoe: 'tool', rod: 'rod', armor: 'armor' };
function gearKind(d) { return d.tool ? d.tool.kind : d.armor ? 'armor' : null; }
const REFORGES = {
  melee: { sharp: { n: 'Sharp', st: { critChance: 2, critDamage: 10 } }, heroic: { n: 'Heroic', st: { strength: 8, intelligence: 20 } }, spicy: { n: 'Spicy', st: { strength: 4, critDamage: 20 } }, fierce: { n: 'Fierce', st: { strength: 6, critChance: 3, critDamage: 10 } }, legendary: { n: 'Legendary', st: { strength: 6, critChance: 4, critDamage: 8, intelligence: 8 } } },
  ranged: { rapid: { n: 'Rapid', st: { strength: 6, critDamage: 15 } }, deadly: { n: 'Deadly', st: { critChance: 6, critDamage: 8 } }, hasty: { n: 'Hasty', st: { critChance: 10 } }, precise: { n: 'Precise', st: { critDamage: 22 } } },
  magic: { wise: { n: 'Wise', st: { intelligence: 40 } }, mythic: { n: 'Mythic', st: { strength: 4, intelligence: 25, critChance: 2 } }, arcane: { n: 'Arcane', st: { intelligence: 30, critDamage: 10 } } },
  tool: { lucky: { n: 'Lucky', st: { fortune: 10 } }, fruitful: { n: 'Fruitful', st: { fortune: 8, xpBoost: 2 } }, blessed: { n: 'Blessed', st: { fortune: 6, xpBoost: 4 } }, swift: { n: 'Swift', st: { breakPct: 15 } }, refined: { n: 'Refined', st: { fortune: 5, breakPct: 8 } } },
  rod: { salty: { n: 'Salty', st: { fishingSpeed: 15 } }, treacherous: { n: 'Treacherous', st: { treasure: 3, strength: 5 } }, pitchin: { n: "Pitchin'", st: { fishingSpeed: 8, treasure: 2 } } },
  armor: { sturdy: { n: 'Sturdy', st: { defense: 12 } }, vital: { n: 'Vital', st: { health: 20 } }, keen: { n: 'Keen', st: { critDamage: 6, strength: 3 } }, nimble: { n: 'Nimble', st: { speed: 3, critChance: 1 } }, sage: { n: 'Sage', st: { intelligence: 15, health: 5 } } },
};
const REFORGE_COST = [250, 500, 1000, 2500, 5000, 10000];

// ---------------------------------------------------------------- mobs
//  shape: slime | humanoid | spider | beast | tall | ghost | golem | wyrm | tree | scarecrow
const MOBS = {
  slime: { name: 'Slime', lvl: 1, hp: 25, dmg: 4, spd: 1.4, xp: 5, coins: [1, 2], r: 0.36, col: '#62d162', shape: 'slime', drops: [['slimeball', 1, 2, 0.8]] },
  zombie: { name: 'Zombie', lvl: 3, hp: 50, dmg: 7, spd: 1.6, xp: 9, coins: [2, 4], r: 0.34, col: '#5b9a5b', col2: '#3a5f8a', shape: 'humanoid', drops: [['rotten_flesh', 1, 2, 0.9], ['carrot', 1, 1, 0.05], ['potato', 1, 1, 0.05]] },
  skeleton: { name: 'Skeleton', lvl: 5, hp: 45, dmg: 6, spd: 1.5, xp: 12, coins: [2, 5], r: 0.32, col: '#e6e6d6', col2: '#a9a99a', shape: 'humanoid', ranged: { spd: 8, cd: 1.9, range: 7, col: '#e6e6d6' }, drops: [['bone', 1, 2, 0.9]] },
  spider: { name: 'Spider', lvl: 8, hp: 90, dmg: 10, spd: 2.4, xp: 18, coins: [3, 7], r: 0.4, col: '#3a2a2a', shape: 'spider', drops: [['string', 1, 3, 0.9], ['spider_eye', 1, 1, 0.3]] },
  wolf: { name: 'Wolf', lvl: 12, hp: 160, dmg: 16, spd: 2.6, xp: 28, coins: [5, 10], r: 0.38, col: '#b0b0b0', shape: 'beast', drops: [['wolf_tooth', 1, 2, 0.7], ['bone', 1, 1, 0.4]] },
  broodling: { name: 'Broodling', lvl: 14, hp: 130, dmg: 14, spd: 3, xp: 24, coins: [4, 8], r: 0.3, col: '#5a1a3a', shape: 'spider', drops: [['string', 2, 4, 0.9], ['spider_eye', 1, 2, 0.5]] },
  voidwalker: { name: 'Voidwalker', lvl: 20, hp: 420, dmg: 30, spd: 2.2, xp: 60, coins: [12, 25], r: 0.34, col: '#1a1024', col2: '#d070ff', shape: 'tall', teleport: 1, drops: [['ender_pearl', 1, 2, 0.8]] },
  wraith: { name: 'Wraith', lvl: 22, hp: 340, dmg: 26, spd: 1.8, xp: 55, coins: [10, 22], r: 0.34, col: '#9ad0e0', shape: 'ghost', ranged: { spd: 7, cd: 2, range: 8, col: '#9ae8ff' }, drops: [['ectoplasm', 1, 2, 0.8]] },
  void_golem: { name: 'Void Golem', lvl: 25, hp: 950, dmg: 45, spd: 1.1, xp: 110, coins: [25, 50], r: 0.5, col: '#2a2040', col2: '#8040ff', shape: 'golem', drops: [['void_shard', 1, 2, 0.7]] },
  pest: { name: 'Pest', lvl: 4, hp: 40, dmg: 3, spd: 2.3, xp: 8, skill: 'farming', coins: [6, 15], r: 0.28, col: '#8a6a3a', shape: 'beast', drops: [['compost', 1, 2, 0.8]] },
  golden_goblin: { name: 'Gilded Gremlin', lvl: 10, hp: 220, dmg: 0, spd: 2.8, flee: 1, xp: 45, skill: 'mining', coins: [150, 400], r: 0.32, col: '#ffd23a', col2: '#c89a1a', shape: 'humanoid', drops: [['gold_ingot', 2, 6, 1]] },
  squid: { name: 'Squid', lvl: 3, hp: 60, dmg: 5, spd: 1.4, xp: 18, skill: 'fishing', coins: [3, 6], r: 0.36, col: '#2a3a7a', shape: 'ghost', drops: [['ink', 1, 3, 1]] },
  sea_guardian: { name: 'Sea Guardian', lvl: 12, hp: 380, dmg: 18, spd: 1.6, xp: 70, skill: 'fishing', coins: [20, 40], r: 0.42, col: '#4ab0a0', col2: '#ffb050', shape: 'golem', ranged: { spd: 8, cd: 2.2, range: 7, col: '#7affea' }, drops: [['prismarine', 1, 3, 1]] },
  leviathan: { name: 'Leviathan', lvl: 25, hp: 2800, dmg: 40, spd: 1.8, xp: 450, skill: 'fishing', coins: [150, 300], r: 0.7, col: '#1a5a7a', col2: '#7affea', shape: 'wyrm', boss: 1, attacks: ['ring', 'charge'], drops: [['prismarine', 5, 10, 1], ['pearl', 1, 2, 0.5], ['egg_rare', 1, 1, 0.08], ['ench_book', 1, 1, 0.3]] },
  // dungeon mobs (scaled per floor)
  d_skeleton: { name: 'Skeleton Soldier', lvl: 10, hp: 160, dmg: 14, spd: 1.8, xp: 22, skill: 'dungeoneering', coins: [4, 8], r: 0.32, col: '#d8d0b8', col2: '#7a6a5a', shape: 'humanoid', drops: [['bone', 1, 3, 0.7], ['dungeon_essence', 1, 1, 0.25]] },
  d_zombie: { name: 'Zombie Knight', lvl: 12, hp: 260, dmg: 18, spd: 1.5, xp: 28, skill: 'dungeoneering', coins: [5, 10], r: 0.36, col: '#4a7a4a', col2: '#9aa0aa', shape: 'humanoid', drops: [['rotten_flesh', 1, 3, 0.7], ['dungeon_essence', 1, 1, 0.25]] },
  d_mage: { name: 'Dungeon Mage', lvl: 14, hp: 140, dmg: 16, spd: 1.6, xp: 30, skill: 'dungeoneering', coins: [6, 12], r: 0.32, col: '#5a3aa0', col2: '#c0a0ff', shape: 'humanoid', ranged: { spd: 8, cd: 1.6, range: 8, col: '#c38bff' }, drops: [['lapis', 2, 6, 0.6], ['dungeon_essence', 1, 1, 0.3]] },
  // bosses
  bog_king: { name: 'Bog King', boss: 1, lvl: 15, hp: 2600, dmg: 20, spd: 1.5, xp: 420, coins: [300, 600], r: 0.95, col: '#3f6f2f', col2: '#c9ff5a', shape: 'golem', attacks: ['slam', 'summon', 'spit'], summon: 'zombie',
    drops: [['bog_cleaver', 1, 1, 0.15], ['bog_heart', 1, 1, 0.35], ['egg_common', 1, 1, 0.3], ['enchanted_rotten_flesh', 1, 3, 0.8], ['ench_book', 1, 1, 0.25], ['recombobulator', 1, 1, 0.02]] },
  broodmother: { name: 'Broodmother', boss: 1, lvl: 25, hp: 9000, dmg: 34, spd: 2.2, xp: 1200, coins: [800, 1500], r: 1.0, col: '#4a1030', col2: '#ff4a9a', shape: 'spider', attacks: ['charge', 'summon', 'spit', 'ring'], summon: 'broodling',
    drops: [['venom_fang', 1, 1, 0.1], ['venom_gland', 1, 1, 0.35], ['egg_rare', 1, 1, 0.12], ['enchanted_string', 2, 5, 0.9], ['ench_book', 1, 1, 0.4], ['recombobulator', 1, 1, 0.03]] },
  void_wyrm: { name: 'Void Wyrm', boss: 1, lvl: 40, hp: 32000, dmg: 60, spd: 2.4, xp: 4000, coins: [3000, 6000], r: 1.2, col: '#2a1050', col2: '#c070ff', shape: 'wyrm', attacks: ['ring', 'charge', 'slam', 'summon'], summon: 'voidwalker',
    drops: [['void_blade', 1, 1, 0.07], ['wyrm_scale', 1, 1, 0.4], ['egg_dragon', 1, 1, 0.03], ['egg_phoenix', 1, 1, 0.05], ['enchanted_ender_pearl', 2, 4, 0.9], ['ench_book', 1, 2, 0.6], ['recombobulator', 1, 1, 0.05]] },
  rock_golem: { name: 'Rock Golem', boss: 1, lvl: 20, hp: 5200, dmg: 28, spd: 1.2, xp: 600, skill: 'mining', coins: [400, 900], r: 1.0, col: '#7a6a5a', col2: '#ff8a3a', shape: 'golem', attacks: ['slam', 'ring'],
    drops: [['golem_pickaxe', 1, 1, 0.12], ['golem_core', 1, 1, 0.4], ['egg_golem', 1, 1, 0.12], ['enchanted_iron_ingot', 1, 4, 0.9], ['diamond', 3, 8, 0.7], ['recombobulator', 1, 1, 0.02]] },
  elder_treant: { name: 'Elder Treant', boss: 1, lvl: 20, hp: 5200, dmg: 25, spd: 1.0, xp: 600, skill: 'foraging', coins: [400, 900], r: 1.05, col: '#4a3a22', col2: '#5fd35f', shape: 'tree', attacks: ['slam', 'summon', 'ring'], summon: 'slime',
    drops: [['treecapitator', 1, 1, 0.12], ['treant_bark', 1, 1, 0.4], ['egg_sprout', 1, 1, 0.12], ['enchanted_oak_log', 2, 6, 0.9], ['recombobulator', 1, 1, 0.02]] },
  scarecrow: { name: 'Giant Scarecrow', boss: 1, lvl: 15, hp: 3800, dmg: 18, spd: 1.4, xp: 500, skill: 'farming', coins: [300, 800], r: 0.95, col: '#c89a4a', col2: '#6a3a1a', shape: 'scarecrow', attacks: ['ring', 'summon', 'spit'], summon: 'pest',
    drops: [['harvest_scythe', 1, 1, 0.12], ['golden_straw', 1, 1, 0.4], ['egg_scarecrow', 1, 1, 0.12], ['enchanted_wheat', 2, 6, 0.9], ['recombobulator', 1, 1, 0.02]] },
  bonelord: { name: 'Bonelord', boss: 1, lvl: 20, hp: 4200, dmg: 30, spd: 1.6, xp: 700, skill: 'dungeoneering', coins: [400, 700], r: 0.95, col: '#e6dcc0', col2: '#ff5a3a', shape: 'golem', attacks: ['ring', 'summon', 'slam'], summon: 'd_skeleton', drops: [] },
  necromancer: { name: 'Necromancer', boss: 1, lvl: 30, hp: 15000, dmg: 55, spd: 1.8, xp: 2000, skill: 'dungeoneering', coins: [1200, 2000], r: 0.9, col: '#2a2a4a', col2: '#5aff9a', shape: 'tall', attacks: ['ring', 'summon', 'spit', 'charge'], summon: 'd_mage', drops: [] },
  lich_king: { name: 'Lich King', boss: 1, lvl: 45, hp: 52000, dmg: 105, spd: 2.0, xp: 6000, skill: 'dungeoneering', coins: [4000, 7000], r: 1.1, col: '#1a2a4a', col2: '#66e0ff', shape: 'tall', attacks: ['ring', 'charge', 'summon', 'slam', 'spit'], summon: 'd_zombie', drops: [] },
};

// ---------------------------------------------------------------- npcs
const NPCS = {
  merchant: { name: 'Merchant Mara', role: 'Buy & Sell', e: '🛒', shirt: '#c07a3a', hair: '#5a3a1a' },
  bazaar: { name: 'Bazaar', role: 'Trade materials', e: '📈', shirt: '#3a8a5a', hair: '#222' },
  auction: { name: 'Auction Master', role: 'Auction House', e: '🔨', shirt: '#8a3a3a', hair: '#ddd' },
  petshop: { name: 'Pet Seller Pip', role: 'Pet Eggs', e: '🐾', shirt: '#d8a03a', hair: '#a05a2a' },
  petsitter: { name: 'Pet Sitter Kai', role: 'Pet Upgrades', e: '✨', shirt: '#7a5ad8', hair: '#2a2a2a' },
  enchanter: { name: 'Enchanter Elra', role: 'Enchanting', e: '📖', shirt: '#4a2a8a', hair: '#e8e8ff' },
  blacksmith: { name: 'Blacksmith Brom', role: 'Reforge & Recombobulate', e: '⚒️', shirt: '#5a5a62', hair: '#8a3a1a' },
  banker: { name: 'Banker Bo', role: 'Bank', e: '🏦', shirt: '#2a4a8a', hair: '#777' },
  engineer: { name: 'Engineer Ezra', role: 'Machines & Island', e: '⚙️', shirt: '#d86a2a', hair: '#333' },
  guide: { name: 'Guide Gale', role: 'Tips', e: '❔', shirt: '#3aa0c8', hair: '#f0d08a' },
  bounty: { name: 'Captain Rook', role: 'Bounty Board', e: '📜', shirt: '#8a5a2a', hair: '#2a1a0a' },
};
const MERCHANT_STOCK = [['wheat_seeds', 2], ['carrot', 5], ['potato', 5], ['pumpkin_seeds', 15], ['melon_seeds', 15], ['oak_sapling', 6], ['birch_sapling', 12],
  ['stick', 2], ['planks', 2], ['flower', 6], ['bread', 10], ['health_potion', 60], ['mana_potion', 80], ['fishing_rod', 60], ['wood_pickaxe', 30], ['wood_axe', 30], ['wood_hoe', 25], ['wood_sword', 30]];
const ENGINEER_STOCK = [['conveyor', 40], ['chest', 60], ['lumber_bot', 2500], ['auto_drill', 3000], ['auto_grower', 2500], ['mob_grinder', 5000], ['auto_furnace', 3500], ['compactor', 9000], ['auto_seller', 12000]];
const ISLAND_SIZES = [{ r: 11, cost: 0 }, { r: 14, cost: 5000 }, { r: 17, cost: 30000 }, { r: 20, cost: 150000 }];
const PETSHOP_STOCK = [['egg_common', 2500], ['egg_rare', 30000]];

// --------------------------------------------------------------- zones
//  cat: home | hub | farming | mining | foraging | combat | dungeon
const ZONES = {
  home: { name: 'Your Island', cat: 'home', w: 48, h: 48, sky: '#2a7fb8' },
  hub: { name: 'SkyHub', cat: 'hub', w: 76, h: 60, sky: '#2a7fb8' },
  farm1: { name: 'Golden Meadows', cat: 'farming', skill: 'farming', tier: 1, req: 0, w: 56, h: 46, crops: ['wheat', 'carrot', 'potato'], sky: '#2f8fc8' },
  farm2: { name: 'Harvest Valley', cat: 'farming', skill: 'farming', tier: 2, req: 5, w: 60, h: 50, crops: ['pumpkin', 'melon', 'sugarcane', 'cocoa'], boss: 'scarecrow', sky: '#3a9ac0' },
  farm3: { name: 'Mushroom Wilds', cat: 'farming', skill: 'farming', tier: 3, req: 12, w: 60, h: 50, crops: ['netherwart', 'mushroom', 'starfruit'], boss: 'scarecrow', ground: 'mycel', sky: '#4a3a6a' },
  mine1: { name: 'Pebble Quarry', cat: 'mining', skill: 'mining', tier: 1, req: 0, w: 54, h: 44, rocks: [['stone', 6], ['coal', 3], ['iron', 2]], dark: 0, sky: '#1a1a22' },
  mine2: { name: 'Deep Caverns', cat: 'mining', skill: 'mining', tier: 2, req: 5, w: 58, h: 48, rocks: [['stone', 3], ['iron', 3], ['gold', 3], ['lapis', 2], ['redstone', 2], ['diamond', 0.6]], dark: 0.55, boss: 'rock_golem', sky: '#0e0e14' },
  mine3: { name: 'Crystal Core', cat: 'mining', skill: 'mining', tier: 3, req: 12, w: 60, h: 50, rocks: [['diamond', 3], ['mithril', 3], ['titanium', 2], ['gemstone', 1.2], ['redstone', 1]], dark: 0.75, boss: 'rock_golem', sky: '#08060e' },
  forest1: { name: 'Oakwood Grove', cat: 'foraging', skill: 'foraging', tier: 1, req: 0, w: 56, h: 48, trees: [['oak', 5], ['birch', 4], ['spruce', 2]], sky: '#2a7fb8' },
  forest2: { name: 'Jungle Canopy', cat: 'foraging', skill: 'foraging', tier: 2, req: 5, w: 60, h: 50, trees: [['jungle', 4], ['acacia', 3], ['darkoak', 2.5]], boss: 'elder_treant', sky: '#2a8a90' },
  forest3: { name: 'Ancient Woods', cat: 'foraging', skill: 'foraging', tier: 3, req: 12, w: 60, h: 50, trees: [['cherry', 4], ['ancient', 3], ['crystal', 1.6]], boss: 'elder_treant', sky: '#5a4a8a' },
  combat1: { name: 'Rotting Marsh', cat: 'combat', skill: 'combat', tier: 1, req: 0, w: 58, h: 48, mobs: [['slime', 3], ['zombie', 4], ['skeleton', 2]], cap: 14, boss: 'bog_king', ground: 'swamp', sky: '#2a4a3a' },
  combat2: { name: "Spider's Nest", cat: 'combat', skill: 'combat', tier: 2, req: 5, w: 60, h: 50, mobs: [['spider', 4], ['wolf', 2], ['broodling', 2]], cap: 15, boss: 'broodmother', ground: 'dirt', sky: '#3a2a2a' },
  combat3: { name: 'Void Reach', cat: 'combat', skill: 'combat', tier: 3, req: 12, w: 62, h: 52, mobs: [['voidwalker', 3], ['wraith', 3], ['void_golem', 1.5]], cap: 14, boss: 'void_wyrm', ground: 'void', sky: '#0a0614' },
  dungeon1: { name: 'Catacombs · Floor I', cat: 'dungeon', skill: 'combat', tier: 1, req: 3, floor: 1, boss: 'bonelord', sky: '#050508' },
  dungeon2: { name: 'Catacombs · Floor II', cat: 'dungeon', skill: 'combat', tier: 2, req: 8, floor: 2, boss: 'necromancer', sky: '#050508' },
  dungeon3: { name: 'Catacombs · Floor III', cat: 'dungeon', skill: 'combat', tier: 3, req: 15, floor: 3, boss: 'lich_king', sky: '#050508' },
};
const DUNGEON_LOOT = {
  1: [['bone_reaver', 0.08], ['egg_common', 0.25], ['ench_book', 0.5], ['enchanted_bone', 0.8], ['recombobulator', 0.02]],
  2: [['necro_staff', 0.06], ['hunter_longbow', 0.06], ['egg_rare', 0.12], ['ench_book', 0.7], ['enchanted_bone', 1], ['recombobulator', 0.04]],
  3: [['lich_bane', 0.05], ['egg_phoenix', 0.05], ['egg_rare', 0.25], ['ench_book', 1], ['recombobulator', 0.08]],
};
// global, clock-based events (same schedule for every player)
const EVENT_CYCLE = 6 * 60 * 1000, EVENT_LEN = 150 * 1000;
const EVENTS = [
  { id: 'harvest', name: 'Bountiful Harvest', cat: 'farming', col: '#d8e04a', desc: '2× farming drops · pests invade the fields' },
  { id: 'fiesta', name: 'Ore Rush', cat: 'mining', col: '#ffb020', desc: '2× ore drops · Gilded Gremlins appear' },
  { id: 'timber', name: 'Timber Rush', cat: 'foraging', col: '#59c96b', desc: '2× log drops · bonus foraging XP' },
  { id: 'bloodmoon', name: 'Blood Moon', cat: 'combat', col: '#ff4a4a', desc: '2× combat XP · bosses awaken instantly' },
];
function currentEvent(now = Date.now()) {
  const n = Math.floor(now / EVENT_CYCLE), into = now % EVENT_CYCLE;
  const ev = EVENTS[n % EVENTS.length];
  return { ev, active: into < EVENT_LEN, left: into < EVENT_LEN ? EVENT_LEN - into : EVENT_CYCLE - into, next: EVENTS[(n + (into < EVENT_LEN ? 1 : 1)) % EVENTS.length], cycle: n };
}

// =====================================================================
//  Expansion: frontier resources, wands, new islands & bosses, factory parts
// =====================================================================
// frontier tree / ore / crop for the tier IV islands
I('witchwood_log', 'Witchwood Log', { price: 110, cat: 'foraging', icon: { s: 'log', c1: '#3a2a4a', c2: '#c8a0ff' }, tags: ['log'], rar: 2, bz: 1, smelt: 'charcoal', place: { k: 'block', solid: 1 } });
I('witchwood_sapling', 'Witchwood Sapling', { price: 60, cat: 'foraging', icon: { s: 'sapling', c: '#9a5ad8' }, place: { k: 'sapling', tree: 'witchwood' } });
NODES.witchwood = { k: 'tree', id: 'witchwood', name: 'Witchwood Tree', skill: 'foraging', lvl: 24, tier: 7, hp: 120, xp: 170, bark: '#3a2a4a', leaf: '#9a5ad8', shape: 'huge', drops: [['witchwood_log', 1, 2, 1], ['witchwood_sapling', 1, 1, 0.06]], respawn: 45, idx: 9, item: 'witchwood_log' };
I('frostite', 'Frostite', { price: 160, cat: 'mining', icon: { s: 'gem', c: '#bff4ff' }, rar: 2, bz: 1 });
NODES.frostite = { k: 'rock', id: 'frostite', name: 'Frostite Ore', skill: 'mining', lvl: 26, tier: 7, hp: 95, xp: 160, base: '#9ab8d0', spot: '#e8fbff', drops: [['frostite', 1, 1, 1]], respawn: 40, idx: 10, item: 'frostite' };
I('moonberry', 'Moonberry', { price: 30, cat: 'farming', icon: { s: 'e', e: '🫐' }, rar: 1, bz: 1, plant: 'moonberry' });
NODES.crop_moonberry = { k: 'crop', id: 'moonberry', name: 'Moonberry', skill: 'farming', lvl: 23, tier: 0, hp: 1, xp: 55, col: '#5a6aff', grow: 170, drops: [['moonberry', 1, 2, 1]], idx: 10, seed: 'moonberry', item: 'moonberry' };
for (const b of ['witchwood_log', 'frostite', 'moonberry']) {
  const base = ITEMS[b];
  I('enchanted_' + b, 'Compacted ' + base.name, { price: Math.round(base.price * 32 * 1.15), cat: base.cat, icon: Object.assign({}, base.icon, { glint: 1 }), rar: Math.min(5, base.rar + 1), bz: 1, compactOf: b });
  base.compact = 'enchanted_' + b; COMPACT.push(b);
  R('enchanted_' + b, 1, [[b, 32]], 'bench', null, 'materials', 2, [b, 2]);
}
COLL_GROUPS.foraging.push('witchwood_log'); COLL_GROUPS.mining.push('frostite'); COLL_GROUPS.farming.push('moonberry');
['witchwood_log', 'frostite', 'moonberry'].forEach(id => COLLECTION.add(id));

// greasy produce: crops that ride conveyors can get grimy — wash them or sell them cheap
[...CROPS.map(c => c[0]), 'moonberry'].forEach(id => {
  const b = ITEMS[id];
  I('greasy_' + id, 'Greasy ' + b.name, { price: Math.max(1, Math.round(b.price * 0.25)), cat: 'farming', icon: Object.assign({}, b.icon, { grease: 1 }), greasyOf: id, desc: 'Got grimy on a conveyor. Run it through a Washer, or sell it cheaply.' });
  b.greasy = 'greasy_' + id;
});

// new fish and mob drops
I('coral_snapper', 'Coral Snapper', { price: 22, cat: 'fishing', icon: { s: 'e', e: '🐠' }, bz: 1, rar: 1 });
I('glowfish', 'Abyssal Glowfish', { price: 60, cat: 'fishing', icon: { s: 'e', e: '🐟', glint: 1 }, bz: 1, rar: 2 });
I('crab_claw', 'Crab Claw', { price: 12, cat: 'fishing', icon: { s: 'e', e: '🦀' }, bz: 1 });
I('magma_cream', 'Magma Cream', { price: 45, cat: 'combat', icon: { s: 'blob', c: '#ff6a1a' }, bz: 1, rar: 1 });
I('blaze_rod', 'Blaze Rod', { price: 55, cat: 'combat', icon: { s: 'stick', c: '#ffaa2a' }, bz: 1, rar: 1 });
I('rat_crown', 'Rat King\'s Crown', { price: 900, cat: 'farming', icon: { s: 'e', e: '👑' }, rar: 2 });
COLL_GROUPS.fishing.push('coral_snapper', 'crab_claw'); COLL_GROUPS.combat.push('magma_cream', 'blaze_rod');
['coral_snapper', 'crab_claw', 'magma_cream', 'blaze_rod'].forEach(id => COLLECTION.add(id));
for (const b of ['magma_cream', 'blaze_rod']) { const base = ITEMS[b]; I('enchanted_' + b, 'Compacted ' + base.name, { price: Math.round(base.price * 32 * 1.15), cat: base.cat, icon: Object.assign({}, base.icon, { glint: 1 }), rar: 2, bz: 1, compactOf: b }); base.compact = 'enchanted_' + b; COMPACT.push(b); R('enchanted_' + b, 1, [[b, 32]], 'bench', null, 'materials', 2, [b, 2]); }

// wands: every wand casts a different kind of spell
//   bolt = piercing bolt · boom = explodes on impact · frost = slows · chain = lightning jumps between foes · heal = mends you
const WANDS = [
  ['ember_wand', 'Ember Wand', '#ff7a2a', 1, { dmg: 42, mana: 16, ab: 'boom' }, { intelligence: 40 }, [['coal', 48], ['lapis', 24], ['stick', 2]], ['combat', 4], 2],
  ['frost_wand', 'Frost Wand', '#8ae8ff', 1, { dmg: 36, mana: 15, ab: 'frost' }, { intelligence: 45 }, [['ink', 24], ['lapis', 24], ['stick', 2]], ['combat', 5], 2],
  ['mending_wand', 'Wand of Mending', '#6aff9a', 1, { dmg: 18, mana: 30, ab: 'heal' }, { intelligence: 30, health: 40 }, [['melon', 48], ['lapis', 16], ['stick', 2]], ['combat', 3], 2],
  ['spark_staff', 'Spark Staff', '#ffe94d', 2, { dmg: 72, mana: 24, ab: 'chain' }, { intelligence: 90 }, [['enchanted_redstone', 2], ['gold_ingot', 12], ['diamond', 2]], ['combat', 9], 3],
  ['void_wand', 'Void Wand', '#9a4dff', 3, { dmg: 140, mana: 30, ab: 'bolt' }, { intelligence: 170, critDamage: 20 }, [['void_shard', 12], ['enchanted_ender_pearl', 2], ['diamond', 4]], ['combat', 14], 3],
  ['starfall_scepter', 'Starfall Scepter', '#ffd23a', 4, { dmg: 330, mana: 50, ab: 'chain' }, { intelligence: 350, spellDmg: 15 }, [['enchanted_starfruit', 4], ['enchanted_gemstone', 2], ['arcane_shard', 4]], ['combat', 22], 4],
];
WANDS.forEach(([id, name, c, rar, tool, stats, ins, req, bt]) => {
  I(id, name, { unique: 1, rar, cat: 'weapon', icon: { s: 'wand', c }, tool: Object.assign({ kind: 'wand' }, tool), stats });
  R(id, 1, ins, 'bench', req, 'weapons', bt);
});
Object.assign(ITEMS.apprentice_wand.tool, { ab: 'bolt' }); Object.assign(ITEMS.redstone_wand.tool, { ab: 'boom' }); Object.assign(ITEMS.diamond_staff.tool, { ab: 'frost' });
Object.assign(ITEMS.mithril_scepter.tool, { ab: 'chain' }); Object.assign(ITEMS.necro_staff.tool, { ab: 'bolt' });
I('inferno_staff', 'Inferno Staff', { unique: 1, rar: 5, cat: 'weapon', icon: { s: 'wand', c: '#ff3a1a' }, tool: { kind: 'wand', dmg: 280, mana: 45, ab: 'boom' }, stats: { intelligence: 320, spellDmg: 20 }, price: 120000 });
I('tidecaller_staff', 'Tidecaller Staff', { unique: 1, rar: 4, cat: 'weapon', icon: { s: 'wand', c: '#3ae0ff' }, tool: { kind: 'wand', dmg: 170, mana: 35, ab: 'frost' }, stats: { intelligence: 220, treasure: 5 }, price: 40000 });
I('titan_cleaver', 'Titan Cleaver', { unique: 1, rar: 5, cat: 'weapon', icon: { s: 'sword', c: '#ff5a1a' }, tool: { kind: 'sword', dmg: 480 }, stats: { strength: 150, critDamage: 120 }, price: 250000 });
I('frostbite_pickaxe', 'Frostbite Pickaxe', { unique: 1, rar: 5, cat: 'tool', icon: { s: 'pickaxe', c: '#bff4ff' }, tool: { kind: 'pickaxe', tier: 8, power: 62 }, stats: { miningFortune: 170, breakPct: 30 }, price: 120000 });
I('hollow_axe', 'Hollowfang Axe', { unique: 1, rar: 5, cat: 'tool', icon: { s: 'axe', c: '#b88aff' }, tool: { kind: 'axe', tier: 8, power: 72 }, stats: { foragingFortune: 170, strength: 40 }, price: 120000 });
I('moon_scythe', 'Moonreaper Scythe', { unique: 1, rar: 5, cat: 'tool', icon: { s: 'hoe', c: '#7a8aff' }, tool: { kind: 'hoe', tier: 8, power: 1, sweep: 2 }, stats: { farmingFortune: 320, speed: 25 }, price: 120000 });

// new monsters and bosses
Object.assign(MOBS, {
  reef_crab: { name: 'Reef Crab', lvl: 10, hp: 220, dmg: 14, spd: 1.8, xp: 30, skill: 'fishing', coins: [6, 12], r: 0.36, col: '#ff6a4a', shape: 'beast', drops: [['crab_claw', 1, 2, 0.8]] },
  magma_slime: { name: 'Magma Slime', lvl: 28, hp: 1100, dmg: 55, spd: 1.6, xp: 120, coins: [25, 45], r: 0.42, col: '#ff5a1a', shape: 'slime', drops: [['magma_cream', 1, 2, 0.8]] },
  blaze: { name: 'Blaze', lvl: 30, hp: 900, dmg: 50, spd: 1.7, xp: 130, coins: [25, 50], r: 0.36, col: '#ffaa2a', shape: 'ghost', ranged: { spd: 9, cd: 1.6, range: 8, col: '#ff7a1a' }, drops: [['blaze_rod', 1, 2, 0.8]] },
  ash_golem: { name: 'Ash Golem', lvl: 34, hp: 2600, dmg: 85, spd: 1.1, xp: 260, coins: [50, 90], r: 0.52, col: '#4a4040', col2: '#ff6a1a', shape: 'golem', drops: [['magma_cream', 2, 4, 0.8], ['arcane_shard', 1, 1, 0.04]] },
  rat_king: { name: 'Rat King', boss: 1, lvl: 6, hp: 1100, dmg: 9, spd: 2.2, xp: 160, skill: 'farming', coins: [120, 250], r: 0.7, col: '#7a6a5a', col2: '#ffd23a', shape: 'beast', attacks: ['summon', 'spit', 'charge'], summon: 'pest', drops: [['rat_crown', 1, 1, 0.3], ['compost', 4, 10, 1], ['egg_common', 1, 1, 0.12], ['enchanted_wheat', 1, 2, 0.4]] },
  pebble_golem: { name: 'Pebble Golem', boss: 1, lvl: 6, hp: 1300, dmg: 10, spd: 1.2, xp: 160, skill: 'mining', coins: [120, 250], r: 0.8, col: '#9a9aa0', col2: '#ffb020', shape: 'golem', attacks: ['slam', 'ring'], drops: [['enchanted_cobblestone', 1, 2, 0.5], ['coal', 10, 24, 1], ['iron_ore', 6, 14, 0.8], ['egg_common', 1, 1, 0.12]] },
  mossback: { name: 'Mossback', boss: 1, lvl: 6, hp: 1300, dmg: 9, spd: 1.0, xp: 160, skill: 'foraging', coins: [120, 250], r: 0.85, col: '#5a4a2a', col2: '#7ad84a', shape: 'tree', attacks: ['slam', 'summon'], summon: 'slime', drops: [['enchanted_oak_log', 1, 2, 0.5], ['birch_log', 10, 24, 1], ['egg_common', 1, 1, 0.12]] },
  kraken: { name: 'Kraken', boss: 1, lvl: 30, hp: 14000, dmg: 45, spd: 1.8, xp: 2200, skill: 'fishing', coins: [1200, 2400], r: 1.1, col: '#5a1a4a', col2: '#ff7ad8', shape: 'wyrm', attacks: ['ring', 'spit', 'summon', 'charge'], summon: 'squid', drops: [['tidecaller_staff', 1, 1, 0.08], ['kraken_beak', 1, 1, 0.35], ['pearl', 2, 4, 0.8], ['egg_rare', 1, 1, 0.15], ['ench_book', 1, 1, 0.5]] },
  inferno_titan: { name: 'Inferno Titan', boss: 1, lvl: 50, hp: 95000, dmg: 120, spd: 1.6, xp: 9000, coins: [8000, 14000], r: 1.3, col: '#3a2020', col2: '#ff5a1a', shape: 'golem', attacks: ['slam', 'ring', 'summon', 'spit', 'charge'], summon: 'magma_slime', drops: [['inferno_staff', 1, 1, 0.06], ['titan_cleaver', 1, 1, 0.05], ['titan_heart', 1, 1, 0.3], ['arcane_shard', 1, 3, 0.6], ['egg_phoenix', 1, 1, 0.06], ['ench_book', 1, 2, 0.7], ['recombobulator', 1, 1, 0.06]] },
  glacier_colossus: { name: 'Glacier Colossus', boss: 1, lvl: 40, hp: 32000, dmg: 70, spd: 1.1, xp: 3500, skill: 'mining', coins: [2500, 5000], r: 1.2, col: '#9ab8d0', col2: '#7af0ff', shape: 'golem', attacks: ['slam', 'ring', 'spit'], drops: [['frostbite_pickaxe', 1, 1, 0.08], ['frost_core', 1, 1, 0.35], ['enchanted_frostite', 1, 3, 0.8], ['egg_golem', 1, 1, 0.12], ['recombobulator', 1, 1, 0.04]] },
  hollow_king: { name: 'Hollow King', boss: 1, lvl: 40, hp: 32000, dmg: 65, spd: 1.0, xp: 3500, skill: 'foraging', coins: [2500, 5000], r: 1.2, col: '#2a1a3a', col2: '#c070ff', shape: 'tree', attacks: ['slam', 'summon', 'ring'], summon: 'wraith', drops: [['hollow_axe', 1, 1, 0.08], ['witch_heart', 1, 1, 0.35], ['enchanted_witchwood_log', 1, 3, 0.8], ['egg_sprout', 1, 1, 0.12], ['recombobulator', 1, 1, 0.04]] },
  harvest_wraith: { name: 'Harvest Wraith', boss: 1, lvl: 40, hp: 30000, dmg: 60, spd: 1.6, xp: 3500, skill: 'farming', coins: [2500, 5000], r: 1.1, col: '#4a4a8a', col2: '#9ab0ff', shape: 'scarecrow', attacks: ['ring', 'summon', 'spit', 'charge'], summon: 'pest', drops: [['moon_scythe', 1, 1, 0.08], ['wraith_lantern', 1, 1, 0.35], ['enchanted_moonberry', 1, 3, 0.8], ['egg_scarecrow', 1, 1, 0.12], ['recombobulator', 1, 1, 0.04]] },
});
MOBS.necromancer.drops = [['arcane_shard', 1, 2, 0.4]]; MOBS.lich_king.drops = [['arcane_shard', 2, 4, 0.8]];

// new islands
Object.assign(ZONES, {
  farm4: { name: 'Sky Orchard', cat: 'farming', skill: 'farming', tier: 4, req: 20, w: 60, h: 50, crops: ['moonberry', 'starfruit', 'mushroom'], boss: 'harvest_wraith', sky: '#6a8ad8' },
  mine4: { name: 'Frostpeak Glacier', cat: 'mining', skill: 'mining', tier: 4, req: 22, w: 60, h: 50, rocks: [['frostite', 3], ['titanium', 2], ['gemstone', 2]], dark: 0.45, ground: 'ice', boss: 'glacier_colossus', sky: '#0a1424' },
  forest4: { name: 'Witchwood Hollow', cat: 'foraging', skill: 'foraging', tier: 4, req: 20, w: 60, h: 50, trees: [['witchwood', 3], ['crystal', 2], ['ancient', 1]], boss: 'hollow_king', dark: 0.35, sky: '#2a1a3a' },
  combat4: { name: 'Ashen Caldera', cat: 'combat', skill: 'combat', tier: 4, req: 20, w: 64, h: 52, mobs: [['magma_slime', 3], ['blaze', 3], ['ash_golem', 1.5]], cap: 14, boss: 'inferno_titan', ground: 'ash', sky: '#1a0a08' },
  fishing1: { name: 'Coral Atoll', cat: 'fishing', skill: 'fishing', tier: 1, req: 5, w: 64, h: 52, mobs: [['reef_crab', 1]], cap: 6, boss: 'kraken', sky: '#1a8ac8' },
});
ZONES.farm1.boss = 'rat_king'; ZONES.mine1.boss = 'pebble_golem'; ZONES.forest1.boss = 'mossback';

// factory parts
I('fast_conveyor', 'Express Conveyor', { price: 20, cat: 'machine', icon: { s: 'conveyor', c: '#3a3f4a', fast: 1 }, place: { k: 'conv', fast: 1 }, desc: 'Twice as fast as a normal conveyor. Press R to rotate before placing.' });
I('sorter', 'Sorter', { price: 60, cat: 'machine', icon: { s: 'machine', c: '#5a6a8a', e: '🔀' }, place: { k: 'sort' }, desc: 'Items matching its filter go straight through; everything else goes left or right. With no filter it splits items evenly three ways. Right-click to set the filter.' });
Object.assign(MACHINES, {
  auto_fisher: { name: 'Auto Fisher', kind: 'gather', res: 'fish', skill: 'fishing', base: 16, col: '#2a8ad8', e: '🎣', desc: 'Catches fish. Must be placed next to water.' },
  washer: { name: 'Washer', kind: 'process', col: '#3ab0e0', e: '🫧', base: 1.5, desc: 'Cleans Greasy produce back into the real thing.' },
  assembler: { name: 'Assembler', kind: 'process', col: '#a07ad8', e: '🏭', base: 4, desc: 'Crafts a chosen recipe on its own from items fed into it.' },
});
for (const id of ['auto_fisher', 'washer', 'assembler']) { const m = MACHINES[id]; I(id, m.name, { unique: 1, rar: id === 'assembler' ? 2 : 1, cat: 'machine', icon: { s: 'machine', c: m.col, e: m.e }, place: { k: 'mach', m: id }, desc: m.desc }); }
R('fast_conveyor', 4, [['conveyor', 4], ['gold_ingot', 2], ['redstone', 8]], 'bench', ['mining', 6], 'machines', 2, ['redstone', 1]);
R('sorter', 1, [['conveyor', 2], ['redstone', 8], ['iron_ingot', 4]], 'bench', ['mining', 5], 'machines', 2, ['redstone', 1]);
R('auto_fisher', 1, [['fishing_rod', 1], ['raw_cod', 64], ['iron_ingot', 12]], 'bench', ['fishing', 3], 'machines', 2, ['raw_cod', 2]);
R('washer', 1, [['sponge', 2], ['iron_ingot', 16], ['planks', 16]], 'bench', ['farming', 4], 'machines', 2, ['wheat', 3]);
R('assembler', 1, [['workbench_2', 1], ['enchanted_iron_ingot', 4], ['enchanted_redstone', 2]], 'bench', ['mining', 10], 'machines', 3, ['iron_ore', 4]);
const FISH_RES = { raw_cod: 0, raw_salmon: 2, pufferfish: 5, prismarine: 6, shrimp: 10, coral_snapper: 12 };
ENGINEER_STOCK.push(['fast_conveyor', 90], ['sorter', 400], ['auto_fisher', 3500], ['washer', 4000]);
MERCHANT_STOCK.push(['moonberry', 200]);

// =====================================================================
//  Expansion II: relics, crafting components, advanced gear, crystals,
//  more enchants, quest givers and the black market
// =====================================================================
// relics can't be crafted: they come from quests, the black market and a few bosses
const RELICS = [
  ['heartwood', 'Heartwood', 'foraging', { s: 'log', c1: '#5a2a1a', c2: '#ffb46a', glint: 1 }, 2, 900],
  ['deep_ore', 'Deep Ore Fragment', 'mining', { s: 'ore', c1: '#3a3a52', c2: '#ff9a3a', glint: 1 }, 2, 900],
  ['golden_seed', 'Golden Seed', 'farming', { s: 'seed', c: '#ffd23a', glint: 1 }, 2, 900],
  ['warlord_sigil', 'Warlord Sigil', 'combat', { s: 'e', e: '🎖️', glint: 1 }, 2, 900],
  ['ancient_rune', 'Ancient Rune', 'combat', { s: 'e', e: '🪬', glint: 1 }, 2, 1100],
  ['tide_pearl', 'Tide Pearl', 'fishing', { s: 'e', e: '🔵', glint: 1 }, 2, 1100],
  ['sky_crystal', 'Sky Crystal', 'special', { s: 'gem', c: '#9ae0ff', glint: 1 }, 3, 3500],
];
RELICS.forEach(([id, name, cat, icon, rar, price]) => I(id, name, { cat, icon, rar, price, relic: 1, desc: 'A relic. Earned from quests, sold now and then on the Black Market.' }));

// middle-ground components
const CMP = (id, name, icon, rar, ins, bt, req, desc) => { I(id, name, { cat: 'component', icon, rar, desc }); R(id, 1, ins, 'bench', req, 'components', bt); };
CMP('reinforced_handle', 'Reinforced Handle', { s: 'stick', c: '#c8c8d0' }, 1, [['iron_ingot', 4], ['stick', 8], ['string', 4]], 2, null, 'Sturdy grip for advanced tools.');
CMP('gear_assembly', 'Gear Assembly', { s: 'e', e: '⚙️' }, 1, [['iron_ingot', 8], ['redstone', 16], ['gold_ingot', 2]], 2, null, 'Moving parts for advanced tools.');
CMP('tempered_plate', 'Tempered Plate', { s: 'ingot', c: '#9aa0b8' }, 1, [['enchanted_iron_ingot', 1], ['coal', 16]], 2, null, 'Hardened metal plating.');
CMP('arcane_circuit', 'Arcane Circuit', { s: 'gem', c: '#6a8aff' }, 2, [['lapis', 32], ['redstone', 32], ['diamond', 1]], 3, null, 'Channels magic through metal.');
CMP('mithril_plating', 'Mithril Plating', { s: 'ingot', c: '#6fffc8', glint: 1 }, 3, [['enchanted_mithril', 2], ['tempered_plate', 2]], 4, ['mining', 14], 'Light, unbreakable plating.');
CMP('starsteel_ingot', 'Starsteel Ingot', { s: 'ingot', c: '#ffe9a8', glint: 1 }, 4, [['enchanted_titanium', 1], ['mithril_plating', 1], ['sky_crystal', 2]], 4, ['mining', 20], 'The finest metal in the skies.');
CMP('lumber_core', 'Lumber Core', { s: 'gem', c: '#6ad84a', glint: 1 }, 2, [['heartwood', 2], ['gear_assembly', 1], ['enchanted_oak_log', 2]], 2, ['foraging', 4], 'The heart of an advanced axe.');
CMP('mining_core', 'Mining Core', { s: 'gem', c: '#ff9a3a', glint: 1 }, 2, [['deep_ore', 2], ['gear_assembly', 1], ['enchanted_cobblestone', 2]], 2, ['mining', 4], 'The heart of an advanced pickaxe or drill.');
CMP('harvest_core', 'Harvest Core', { s: 'gem', c: '#ffd23a', glint: 1 }, 2, [['golden_seed', 2], ['gear_assembly', 1], ['enchanted_wheat', 2]], 2, ['farming', 4], 'The heart of an advanced hoe.');
CMP('battle_core', 'Battle Core', { s: 'gem', c: '#ff4a4a', glint: 1 }, 2, [['warlord_sigil', 2], ['tempered_plate', 1], ['enchanted_bone', 2]], 2, ['combat', 4], 'The heart of an advanced sword or bow.');
CMP('arcane_core', 'Arcane Core', { s: 'gem', c: '#b88aff', glint: 1 }, 2, [['ancient_rune', 2], ['arcane_circuit', 1], ['enchanted_lapis', 2]], 3, ['combat', 5], 'The heart of an advanced wand.');
CMP('tide_core', 'Tide Core', { s: 'gem', c: '#3ac8ff', glint: 1 }, 2, [['tide_pearl', 2], ['gear_assembly', 1], ['enchanted_raw_cod', 2]], 2, ['fishing', 4], 'The heart of an advanced fishing rod.');

// advanced gear: lots of gathering + components + relics, a reason to do more than grind levels
//   id, name, icon shape, colour, rarity, tool, stats, ingredients, requirement, bench tier
const ADV = [
  ['woodsplitter', 'Woodsplitter', 'axe', '#8ae86a', 2, { kind: 'axe', tier: 4, power: 16 }, { foragingFortune: 45 }, [['lumber_core', 1], ['reinforced_handle', 1], ['birch_log', 64]], ['foraging', 4], 2],
  ['jungle_reaper', 'Jungle Reaper', 'axe', '#2fd36a', 3, { kind: 'axe', tier: 6, power: 30 }, { foragingFortune: 95, strength: 15 }, [['lumber_core', 2], ['mithril_plating', 1], ['enchanted_jungle_log', 6]], ['foraging', 12], 4],
  ['worldtree_axe', 'Worldtree Axe', 'axe', '#ffb46a', 5, { kind: 'axe', tier: 8, power: 80 }, { foragingFortune: 230, strength: 45 }, [['lumber_core', 3], ['starsteel_ingot', 2], ['heartwood', 8], ['enchanted_witchwood_log', 4]], ['foraging', 22], 4],
  ['stonebreaker', 'Stonebreaker', 'pickaxe', '#ffb46a', 2, { kind: 'pickaxe', tier: 4, power: 16 }, { miningFortune: 45 }, [['mining_core', 1], ['reinforced_handle', 1], ['cobblestone', 128]], ['mining', 4], 2],
  ['excavator', 'Excavator', 'drill', '#ffd23a', 3, { kind: 'drill', tier: 6, power: 36, fuel: 4000 }, { miningFortune: 85, breakPct: 20 }, [['mining_core', 2], ['mithril_plating', 1], ['gear_assembly', 2]], ['mining', 13], 4],
  ['stardriller', 'Stardriller', 'drill', '#ffe9a8', 5, { kind: 'drill', tier: 8, power: 90, fuel: 15000 }, { miningFortune: 230, breakPct: 45 }, [['mining_core', 3], ['starsteel_ingot', 2], ['deep_ore', 8], ['enchanted_frostite', 4]], ['mining', 24], 4],
  ['bountiful_hoe', 'Bountiful Hoe', 'hoe', '#ffe94d', 2, { kind: 'hoe', tier: 4, power: 1, sweep: 1 }, { farmingFortune: 95 }, [['harvest_core', 1], ['reinforced_handle', 1], ['wheat', 128]], ['farming', 4], 2],
  ['ember_sickle', 'Ember Sickle', 'hoe', '#ff7a2a', 3, { kind: 'hoe', tier: 6, power: 1, sweep: 2 }, { farmingFortune: 175, speed: 10 }, [['harvest_core', 2], ['tempered_plate', 2], ['enchanted_pumpkin', 4]], ['farming', 10], 3],
  ['harvest_crown', 'Harvest Crown Hoe', 'hoe', '#ffd23a', 5, { kind: 'hoe', tier: 8, power: 1, sweep: 2 }, { farmingFortune: 390, speed: 30 }, [['harvest_core', 3], ['starsteel_ingot', 2], ['golden_seed', 8], ['enchanted_moonberry', 4]], ['farming', 22], 4],
  ['knights_blade', 'Knight\'s Blade', 'sword', '#d8d8ff', 2, { kind: 'sword', dmg: 75 }, { strength: 25, defense: 15 }, [['battle_core', 1], ['reinforced_handle', 1], ['iron_ingot', 32]], ['combat', 4], 2],
  ['warlord_greatsword', 'Warlord Greatsword', 'sword', '#ff6a4a', 3, { kind: 'sword', dmg: 200 }, { strength: 70, critDamage: 40 }, [['battle_core', 2], ['mithril_plating', 1], ['enchanted_spider_eye', 4]], ['combat', 12], 4],
  ['skybreaker', 'Skybreaker', 'sword', '#9ae0ff', 5, { kind: 'sword', dmg: 440 }, { strength: 140, critDamage: 120, critChance: 10 }, [['battle_core', 3], ['starsteel_ingot', 2], ['warlord_sigil', 8], ['void_shard', 32]], ['combat', 22], 4],
  ['ranger_bow', 'Ranger Bow', 'bow', '#8ae86a', 2, { kind: 'bow', dmg: 70 }, { critChance: 5, critDamage: 15 }, [['battle_core', 1], ['reinforced_handle', 1], ['string', 32]], ['combat', 5], 2],
  ['stormstring', 'Stormstring Bow', 'bow', '#7ab8ff', 3, { kind: 'bow', dmg: 185 }, { critChance: 10, critDamage: 40, strength: 30 }, [['battle_core', 2], ['arcane_circuit', 1], ['enchanted_string', 4]], ['combat', 12], 3],
  ['celestial_bow', 'Celestial Bow', 'bow', '#ffe9a8', 5, { kind: 'bow', dmg: 400 }, { critChance: 15, critDamage: 90, strength: 60 }, [['battle_core', 3], ['starsteel_ingot', 2], ['sky_crystal', 4]], ['combat', 22], 4],
  ['runic_wand', 'Runic Wand', 'wand', '#b88aff', 2, { kind: 'wand', dmg: 65, mana: 18, ab: 'bolt' }, { intelligence: 90 }, [['arcane_core', 1], ['reinforced_handle', 1]], ['combat', 5], 3],
  ['arcanum_staff', 'Arcanum Staff', 'wand', '#7a6aff', 3, { kind: 'wand', dmg: 180, mana: 30, ab: 'chain' }, { intelligence: 230 }, [['arcane_core', 2], ['mithril_plating', 1], ['ectoplasm', 32]], ['combat', 13], 4],
  ['astral_codex', 'Astral Codex', 'wand', '#ffd2ff', 5, { kind: 'wand', dmg: 380, mana: 48, ab: 'boom' }, { intelligence: 430, spellDmg: 20 }, [['arcane_core', 3], ['starsteel_ingot', 2], ['ancient_rune', 8]], ['combat', 22], 4],
  ['anglers_pride', 'Angler\'s Pride', 'rod', '#3ac8ff', 2, { kind: 'rod', tier: 3 }, { fishingSpeed: 30, treasure: 5 }, [['tide_core', 1], ['reinforced_handle', 1], ['string', 32]], ['fishing', 4], 2],
  ['abyss_rod', 'Abyss Rod', 'rod', '#5a3aff', 4, { kind: 'rod', tier: 5 }, { fishingSpeed: 60, treasure: 12 }, [['tide_core', 2], ['mithril_plating', 1], ['tide_pearl', 6]], ['fishing', 14], 4],
];
ADV.forEach(([id, name, shape, c, rar, tool, stats, ins, req, bt]) => {
  I(id, name, { unique: 1, rar, cat: shape === 'sword' || shape === 'bow' || shape === 'wand' ? 'weapon' : 'tool', icon: { s: shape, c }, tool, stats });
  const r = R(id, 1, ins, 'bench', req, shape === 'sword' || shape === 'bow' || shape === 'wand' ? 'weapons' : 'tools', bt);
  if (['axe', 'pickaxe', 'hoe', 'sword'].includes(shape) && ins.length <= 3) r.shape = null;
});

// crystals: socket one at the Blacksmith for a powerful special reforge
//   id, name, colour, rarity, reforge name, groups it fits, stats
const CRYSTALS = [
  ['ember_crystal', 'Ember Crystal', '#ff7a2a', 2, 'Blazing', ['melee', 'ranged'], { strength: 18, critDamage: 28 }],
  ['frost_crystal', 'Frost Crystal', '#9af0ff', 2, 'Glacial', ['armor', 'melee'], { defense: 35, health: 50 }],
  ['storm_crystal', 'Storm Crystal', '#ffe94d', 3, 'Stormborn', ['magic', 'ranged'], { intelligence: 70, critChance: 7 }],
  ['verdant_crystal', 'Verdant Crystal', '#6ad84a', 2, 'Verdant', ['tool'], { fortune: 28, xpBoost: 6 }],
  ['void_crystal', 'Void Crystal', '#9a4dff', 4, 'Abyssal', ['melee', 'magic'], { strength: 32, critDamage: 45, damagePct: 6 }],
  ['sun_crystal', 'Sun Crystal', '#ffd23a', 4, 'Radiant', ['armor', 'magic'], { health: 80, defense: 25, intelligence: 40 }],
  ['tide_crystal', 'Tide Crystal', '#3ac8ff', 3, 'Tidal', ['rod', 'tool'], { treasure: 6, fishingSpeed: 20, fortune: 12 }],
];
const CRYSTAL_REF = {};
CRYSTALS.forEach(([id, name, c, rar, rname, groups, st]) => {
  I(id, name, { cat: 'special', icon: { s: 'gem', c, glint: 1 }, rar, price: [0, 0, 6000, 15000, 40000][rar], crystal: 'cr_' + id, desc: `Socket at the Blacksmith for the "${rname}" reforge on ${groups.map(g => ({ melee: 'swords', ranged: 'bows', magic: 'wands', tool: 'tools', armor: 'armor', rod: 'rods' }[g])).join(', ')}.` });
  CRYSTAL_REF['cr_' + id] = { n: rname, st, groups, item: id, crystal: 1 };
});
// crystals and relics also drop from bosses now
const addDrop = (mob, d) => MOBS[mob].drops.push(d);
addDrop('bog_king', ['ember_crystal', 1, 1, 0.05]); addDrop('bog_king', ['warlord_sigil', 1, 2, 0.4]);
addDrop('broodmother', ['void_crystal', 1, 1, 0.04]); addDrop('broodmother', ['warlord_sigil', 1, 3, 0.5]);
addDrop('rock_golem', ['frost_crystal', 1, 1, 0.08]); addDrop('rock_golem', ['deep_ore', 1, 3, 0.5]);
addDrop('elder_treant', ['verdant_crystal', 1, 1, 0.08]); addDrop('elder_treant', ['heartwood', 1, 3, 0.5]);
addDrop('scarecrow', ['verdant_crystal', 1, 1, 0.08]); addDrop('scarecrow', ['golden_seed', 1, 3, 0.5]);
addDrop('kraken', ['tide_crystal', 1, 1, 0.15]); addDrop('kraken', ['tide_pearl', 2, 4, 0.7]);
addDrop('inferno_titan', ['sun_crystal', 1, 1, 0.1]); addDrop('inferno_titan', ['sky_crystal', 1, 2, 0.5]);
addDrop('glacier_colossus', ['frost_crystal', 1, 1, 0.15]); addDrop('hollow_king', ['verdant_crystal', 1, 1, 0.15]); addDrop('harvest_wraith', ['sun_crystal', 1, 1, 0.06]);
addDrop('void_wyrm', ['void_crystal', 1, 1, 0.12]); addDrop('necromancer', ['storm_crystal', 1, 1, 0.1]); addDrop('lich_king', ['sky_crystal', 1, 3, 0.6]);

// more enchantments
Object.assign(ENCHANTS, {
  first_strike: { name: 'First Strike', max: 4, on: ['sword', 'bow'], desc: l => `+${l * 25}% damage against unhurt foes`, cost: 220 },
  giant_killer: { name: 'Giant Killer', max: 5, on: ['sword', 'bow', 'wand'], desc: l => `+${l * 6}% damage against bosses`, cost: 300 },
  vampirism: { name: 'Vampirism', max: 4, on: ['sword', 'bow'], desc: l => `Heal ${l * 4}% of missing health on each kill`, cost: 260 },
  haste: { name: 'Haste', max: 4, on: ['sword'], desc: l => `Swing ${l * 6}% faster`, cost: 280 },
  abundance: { name: 'Abundance', max: 4, on: ['axe', 'pickaxe', 'drill', 'hoe'], desc: l => `${l * 3}% chance to triple your drops`, cost: 350 },
  replenish: { name: 'Replenish', max: 3, on: ['hoe'], desc: l => `Your replanted crops start ${l * 10}% grown`, cost: 250 },
  green_thumb: { name: 'Green Thumb', max: 4, on: ['hoe'], desc: l => `+${l * 8}% Farming XP`, cost: 220 },
  thorns: { name: 'Thorns', max: 4, on: ['armor'], desc: l => `Reflect ${l * 3}% of damage taken (stacks across pieces)`, cost: 200 },
  rejuvenate: { name: 'Rejuvenate', max: 4, on: ['armor'], desc: l => `+${(l * 0.3).toFixed(1)}% health regen per second (stacks)`, cost: 200 },
  wisdom: { name: 'Wisdom', max: 5, on: ['wand'], desc: l => `+${l * 15} Intelligence`, cost: 180 },
  mana_flow: { name: 'Mana Flow', max: 4, on: ['wand'], desc: l => `${l * 5}% less mana per spell`, cost: 220 },
  magnet: { name: 'Magnet', max: 3, on: ['rod'], desc: l => `${l * 10}% chance to catch double`, cost: 180 },
});

// quest givers: each has a story chain, then a repeatable job that pays in relics
//   q: [type, target, amount, intro line, reward {c: coins, x: [skill, xp], i: items}]
//   types: kill, gather (by hand), fish (any catch), craft, level, visit, deliver (items are taken)
const QUESTGIVERS = {
  lars: { name: 'Lumberjack Lars', role: 'Quests', e: '🪓', shirt: '#6a8a3a', hair: '#c8641a', zone: 'hub', at: [32, 12], cd: 30,
    q: [
      ['gather', 'oak_log', 32, 'These woods need thinning! Chop me 32 Oak Logs, would you?', { c: 150, x: ['foraging', 80], i: [['heartwood', 1]] }],
      ['craft', 'stone_axe', 1, 'Fists are for brawling, not for trees. Craft yourself a Stone Axe.', { c: 200, x: ['foraging', 120] }],
      ['gather', 'birch_log', 64, 'Birch makes the best handles. Bring in 64 Birch Logs.', { c: 300, x: ['foraging', 200], i: [['heartwood', 1]] }],
      ['level', 'foraging', 5, 'Show me you\'re a real lumberjack: reach Foraging 5.', { c: 500, i: [['heartwood', 2], ['verdant_crystal', 1]] }],
      ['gather', 'spruce_log', 128, 'Spruce for the long winters. 128 logs, friend.', { c: 900, x: ['foraging', 600], i: [['heartwood', 2]] }],
      ['kill', 'mossback', 1, 'A walking stump called Mossback is trampling Oakwood Grove. Fell it!', { c: 1500, x: ['foraging', 900], i: [['heartwood', 3]] }],
    ],
    rep: ['deliver', 'enchanted_oak_log', 2, 'Got any Compacted Oak? 2 of those and I\'ll pay in Heartwood.', { c: 400, i: [['heartwood', 2]] }] },
  magda: { name: 'Miner Magda', role: 'Quests', e: '⛏️', shirt: '#5a5a7a', hair: '#e8e8e8', zone: 'hub', at: [22, 36], cd: 30,
    q: [
      ['gather', 'cobblestone', 64, 'Every miner starts with stone. Dig up 64 Cobblestone.', { c: 150, x: ['mining', 80], i: [['deep_ore', 1]] }],
      ['gather', 'coal', 48, 'Coal keeps the furnaces burning. Mine 48 of it.', { c: 200, x: ['mining', 120] }],
      ['craft', 'furnace', 1, 'Build yourself a Furnace. Raw ore\'s no good to anyone.', { c: 200, x: ['mining', 120] }],
      ['gather', 'iron_ore', 64, 'Now for real metal: mine 64 Iron Ore.', { c: 400, x: ['mining', 300], i: [['deep_ore', 1]] }],
      ['deliver', 'iron_ingot', 32, 'Smelt it down and bring me 32 Iron Ingots.', { c: 600, x: ['mining', 400], i: [['deep_ore', 2], ['ember_crystal', 1]] }],
      ['kill', 'pebble_golem', 1, 'The Pebble Golem in the Quarry keeps collapsing my tunnels. Smash it!', { c: 1500, x: ['mining', 900], i: [['deep_ore', 3]] }],
    ],
    rep: ['deliver', 'enchanted_cobblestone', 3, 'Need Compacted Cobblestone for supports. 3 of them, and the deep ore is yours.', { c: 400, i: [['deep_ore', 2]] }] },
  fen: { name: 'Farmer Fen', role: 'Quests', e: '🌾', shirt: '#c8a03a', hair: '#7a4a1a', zone: 'hub', at: [79, 34], cd: 30,
    q: [
      ['gather', 'wheat', 64, 'Harvest time! Bring in 64 Wheat from the fields.', { c: 150, x: ['farming', 80], i: [['golden_seed', 1]] }],
      ['craft', 'bread', 5, 'Bake 5 loaves of Bread. Farmers need fuel too!', { c: 200, x: ['farming', 120] }],
      ['gather', 'carrot', 128, 'The rabbits got into my patch. Grow me 128 Carrots.', { c: 300, x: ['farming', 200] }],
      ['level', 'farming', 5, 'Reach Farming 5 and I\'ll share my lucky seeds.', { c: 500, i: [['golden_seed', 2], ['verdant_crystal', 1]] }],
      ['deliver', 'pumpkin', 64, 'Festival\'s coming! I need 64 Pumpkins.', { c: 900, x: ['farming', 600], i: [['golden_seed', 2]] }],
      ['kill', 'rat_king', 1, 'The Rat King is stealing from Golden Meadows. End his reign!', { c: 1500, x: ['farming', 900], i: [['golden_seed', 3]] }],
    ],
    rep: ['deliver', 'enchanted_wheat', 2, 'Two Compacted Wheat, and you\'ll get Golden Seeds in return.', { c: 400, i: [['golden_seed', 2]] }] },
  vex: { name: 'Sergeant Vex', role: 'Quests', e: '🛡️', shirt: '#8a2a2a', hair: '#2a2a2a', zone: 'hub', at: [54, 60], cd: 30,
    q: [
      ['kill', 'zombie', 15, 'Recruit! The graveyard\'s crawling. Put down 15 Zombies.', { c: 150, x: ['combat', 80], i: [['warlord_sigil', 1]] }],
      ['kill', 'slime', 15, 'Slimes next. 15 of them. Mind your boots.', { c: 200, x: ['combat', 120] }],
      ['craft', 'iron_sword', 1, 'That stick won\'t cut it. Forge an Iron Sword.', { c: 300, x: ['combat', 200] }],
      ['visit', 'combat1', 1, 'Time for real work. Travel to the Rotting Marsh.', { c: 300, x: ['combat', 200] }],
      ['kill', 'skeleton', 25, 'Skeletons are sniping our scouts. Take down 25.', { c: 700, x: ['combat', 500], i: [['warlord_sigil', 2], ['ember_crystal', 1]] }],
      ['kill', 'bog_king', 1, 'The Bog King rules that swamp. Dethrone him, soldier!', { c: 2000, x: ['combat', 1200], i: [['warlord_sigil', 3], ['storm_crystal', 1]] }],
    ],
    rep: ['deliver', 'enchanted_rotten_flesh', 2, 'Bring 2 Compacted Rotten Flesh for the war hounds. I pay in sigils.', { c: 400, i: [['warlord_sigil', 2]] }] },
  orin: { name: 'Sage Orin', role: 'Quests', e: '🔮', shirt: '#4a3a8a', hair: '#e8e8ff', zone: 'hub', at: [55, 33], cd: 40,
    q: [
      ['deliver', 'lapis', 32, 'Magic begins with Lapis. Bring me 32, apprentice.', { c: 200, x: ['combat', 100], i: [['ancient_rune', 1]] }],
      ['craft', 'apprentice_wand', 1, 'Craft an Apprentice Wand. Feel the spark!', { c: 300, x: ['combat', 150] }],
      ['kill', 'zombie', 20, 'Practice your spells: defeat 20 Zombies.', { c: 300, x: ['combat', 200] }],
      ['level', 'combat', 5, 'Return when you have reached Combat 5.', { c: 500, i: [['ancient_rune', 2], ['storm_crystal', 1]] }],
      ['craft', 'workbench_2', 1, 'Great crafts need great tables. Build a Reinforced Workbench.', { c: 600, x: ['mining', 300], i: [['sky_crystal', 1]] }],
      ['deliver', 'diamond', 8, 'For my final lesson, I need 8 Diamonds.', { c: 2000, x: ['combat', 800], i: [['ancient_rune', 3], ['sun_crystal', 1]] }],
    ],
    rep: ['deliver', 'enchanted_lapis', 2, 'Two Compacted Lapis, and I\'ll carve you more runes.', { c: 500, i: [['ancient_rune', 2]] }] },
  marlo: { name: 'Captain Marlo', role: 'Quests', e: '⚓', shirt: '#2a5a8a', hair: '#e8e8e8', zone: 'fishing1', rel: [3, -1], cd: 30,
    q: [
      ['fish', 'any', 10, 'Welcome aboard! Catch 10 fish from these waters.', { c: 300, x: ['fishing', 150], i: [['tide_pearl', 1]] }],
      ['gather', 'coral_snapper', 16, 'Coral Snappers are the local delicacy. Catch 16.', { c: 500, x: ['fishing', 300] }],
      ['kill', 'reef_crab', 10, 'The Reef Crabs keep snipping my nets. Clear out 10.', { c: 500, x: ['fishing', 300] }],
      ['level', 'fishing', 8, 'Reach Fishing 8 and you\'ll earn your sea legs.', { c: 800, i: [['tide_pearl', 2], ['tide_crystal', 1]] }],
      ['kill', 'kraken', 1, 'The Kraken! It rises when you fish here long enough. Slay it!', { c: 3000, x: ['fishing', 1500], i: [['tide_pearl', 4]] }],
    ],
    rep: ['deliver', 'raw_salmon', 64, '64 Raw Salmon for the galley, and pearls are yours.', { c: 400, i: [['tide_pearl', 2]] }] },
  ivy: { name: 'Ranger Ivy', role: 'Quests', e: '🏹', shirt: '#2f6a3a', hair: '#a05a2a', zone: 'forest2', rel: [3, -1], cd: 45,
    q: [
      ['gather', 'jungle_log', 128, 'The canopy is choking the light. Fell 128 Jungle Logs.', { c: 800, x: ['foraging', 500], i: [['heartwood', 2]] }],
      ['gather', 'acacia_log', 128, 'Now 128 Acacia Logs for the ranger lodge.', { c: 1000, x: ['foraging', 700] }],
      ['kill', 'elder_treant', 1, 'The Elder Treant stirs during Timber Rush. Bring it down.', { c: 3000, x: ['foraging', 1500], i: [['sky_crystal', 1], ['verdant_crystal', 1]] }],
      ['deliver', 'enchanted_darkoak_log', 4, 'Last favour: 4 Compacted Dark Oak Logs.', { c: 4000, i: [['heartwood', 4], ['sky_crystal', 1]] }],
    ],
    rep: ['deliver', 'enchanted_jungle_log', 3, '3 Compacted Jungle Logs buys you a Sky Crystal.', { c: 800, i: [['sky_crystal', 1]] }] },
  gus: { name: 'Prospector Gus', role: 'Quests', e: '💎', shirt: '#8a6a3a', hair: '#cfcfcf', zone: 'mine2', rel: [3, 0], cd: 45,
    q: [
      ['gather', 'gold_ore', 128, 'Gold fever! Dig up 128 Gold Ore.', { c: 1000, x: ['mining', 600], i: [['deep_ore', 2]] }],
      ['gather', 'lapis', 256, 'Lapis veins run deep. Collect 256 Lapis.', { c: 1000, x: ['mining', 600] }],
      ['gather', 'redstone', 256, 'And 256 Redstone for my contraptions.', { c: 1200, x: ['mining', 700] }],
      ['kill', 'rock_golem', 1, 'The Rock Golem wakes during Ore Rush. Crack it open!', { c: 3500, x: ['mining', 1500], i: [['sky_crystal', 1], ['frost_crystal', 1]] }],
    ],
    rep: ['deliver', 'enchanted_gold_ingot', 2, '2 Compacted Gold Ingots for a Sky Crystal. Deal?', { c: 800, i: [['sky_crystal', 1]] }] },
  kael: { name: 'Warden Kael', role: 'Quests', e: '⚔️', shirt: '#3a2a4a', hair: '#1a1a1a', zone: 'combat2', rel: [3, -1], cd: 45,
    q: [
      ['kill', 'spider', 40, 'This nest must burn. Slay 40 Spiders.', { c: 1200, x: ['combat', 700], i: [['warlord_sigil', 2]] }],
      ['kill', 'wolf', 25, 'The wolves hunt our scouts. Take out 25.', { c: 1200, x: ['combat', 700] }],
      ['kill', 'broodling', 30, 'Broodlings swarm near the queen. 30 of them.', { c: 1500, x: ['combat', 900] }],
      ['kill', 'broodmother', 1, 'Now the Broodmother herself. End this nightmare.', { c: 5000, x: ['combat', 2000], i: [['sky_crystal', 2], ['void_crystal', 1]] }],
    ],
    rep: ['deliver', 'enchanted_string', 3, '3 Compacted String keeps the walls standing. Here\'s a Sky Crystal.', { c: 900, i: [['sky_crystal', 1]] }] },
};
for (const [id, q] of Object.entries(QUESTGIVERS)) NPCS[id] = { name: q.name, role: q.role, e: q.e, shirt: q.shirt, hair: q.hair, quest: 1 };
NPCS.blackmarket = { name: 'Shady Silas', role: 'Black Market', e: '🕶️', shirt: '#1a1a22', hair: '#3a3a3a' };
// black market pool: [item, min price, max price, weight]
const BLACK_MARKET = [
  ['heartwood', 1800, 3200, 3], ['deep_ore', 1800, 3200, 3], ['golden_seed', 1800, 3200, 3], ['warlord_sigil', 1800, 3200, 3], ['ancient_rune', 2200, 3800, 3], ['tide_pearl', 2200, 3800, 3],
  ['sky_crystal', 7000, 12000, 2], ['ember_crystal', 12000, 20000, 1.2], ['frost_crystal', 12000, 20000, 1.2], ['verdant_crystal', 12000, 20000, 1.2], ['storm_crystal', 25000, 40000, 0.8],
  ['tide_crystal', 25000, 40000, 0.8], ['void_crystal', 70000, 110000, 0.4], ['sun_crystal', 70000, 110000, 0.4], ['lumber_core', 9000, 14000, 0.8], ['mining_core', 9000, 14000, 0.8],
  ['battle_core', 9000, 14000, 0.8], ['arcane_core', 12000, 18000, 0.6], ['recombobulator', 45000, 70000, 0.5], ['egg_rare', 25000, 40000, 0.6], ['ench_book', 2500, 6000, 1.5],
  ['starsteel_ingot', 60000, 90000, 0.3], ['knights_blade', 15000, 22000, 0.3], ['stonebreaker', 12000, 18000, 0.3],
];

// gear needs the right skill level to use (so lucky auction finds can't skip progression)
function setUseReqs() {
  for (const r of RECIPES) { const it = ITEMS[r.out]; if ((it.tool || it.armor) && r.req && !it.useReq) it.useReq = r.req; }
  const manual = { bog_cleaver: ['combat', 6], venom_fang: ['combat', 12], void_blade: ['combat', 18], bone_reaver: ['dungeoneering', 3], necro_staff: ['dungeoneering', 8], hunter_longbow: ['dungeoneering', 8],
    lich_bane: ['dungeoneering', 15], treecapitator: ['foraging', 10], golem_pickaxe: ['mining', 10], harvest_scythe: ['farming', 10], inferno_staff: ['combat', 22], tidecaller_staff: ['fishing', 12],
    titan_cleaver: ['combat', 24], frostbite_pickaxe: ['mining', 24], hollow_axe: ['foraging', 24], moon_scythe: ['farming', 24] };
  for (const id in manual) ITEMS[id].useReq = manual[id];
  for (const sid of ['bog', 'venom', 'void', 'golem', 'treant', 'straw', 'titan', 'coral', 'frost', 'witch', 'wraith']) for (const sl of ARMOR_SLOTS) { const it = ITEMS[sid + '_' + sl]; const r = RECIPES.find(x => x.out === it.id); if (r && r.req) it.useReq = r.req; }
}

// ------------------------------------------------- derived prices pass
(function computePrices() {
  for (let pass = 0; pass < 4; pass++) {
    for (const r of RECIPES) {
      const it = ITEMS[r.out];
      if (!it || it.price) continue;
      let v = 0, ok = true;
      for (const [id, n] of r.in) {
        const src = id[0] === '#' ? { price: 3 } : ITEMS[id];
        if (!src || !src.price) { ok = false; break; }
        v += src.price * n;
      }
      if (ok) it.price = Math.max(1, Math.round(v * 1.1 / r.n));
    }
  }
  for (const id in ITEMS) if (!ITEMS[id].price) ITEMS[id].price = ITEMS[id].unique ? 500 : 5;
  // boss/dungeon gear
  Object.assign(ITEMS.bog_cleaver, { price: 6000 }); Object.assign(ITEMS.venom_fang, { price: 30000 }); Object.assign(ITEMS.void_blade, { price: 150000 });
  Object.assign(ITEMS.bone_reaver, { price: 12000 }); Object.assign(ITEMS.necro_staff, { price: 45000 }); Object.assign(ITEMS.hunter_longbow, { price: 45000 });
  Object.assign(ITEMS.lich_bane, { price: 200000 }); Object.assign(ITEMS.treecapitator, { price: 25000 }); Object.assign(ITEMS.golem_pickaxe, { price: 25000 });
  Object.assign(ITEMS.harvest_scythe, { price: 25000 });
})();
// better materials need a better workbench
(function inferBenchTiers() {
  const t4 = ['enchanted_mithril', 'enchanted_titanium', 'enchanted_gemstone', 'wyrm_scale', 'golem_core'];
  const t3 = ['diamond', 'enchanted_diamond', 'prismarine', 'enchanted_prismarine', 'ectoplasm', 'pearl', 'bog_heart', 'venom_gland', 'treant_bark', 'golden_straw', 'enchanted_string', 'enchanted_lapis', 'enchanted_redstone'];
  const t2 = ['iron_ingot', 'gold_ingot', 'redstone', 'lapis'];
  for (const r of RECIPES) {
    if (r.st === 'hand' || r.out.startsWith('enchanted_') || r.out.startsWith('workbench')) continue;
    let bt = r.bt || 1;
    for (const [id] of r.in) { if (t4.includes(id)) bt = Math.max(bt, 4); else if (t3.includes(id)) bt = Math.max(bt, 3); else if (t2.includes(id) || id.startsWith('enchanted_')) bt = Math.max(bt, 2); }
    r.bt = bt;
  }
})();
const BENCH_NAMES = ['', 'Workbench', 'Reinforced Workbench', 'Arcane Workbench', 'Starforge Workbench'];
setUseReqs();

// cinematic boss moves: shockwaves you jump over, meteors you roll away from
for (const [id, extra] of Object.entries({ bog_king: ['shock'], rock_golem: ['shock'], glacier_colossus: ['shock', 'meteor'], inferno_titan: ['shock', 'meteor'], pebble_golem: ['shock'], bonelord: ['shock'],
  lich_king: ['shock', 'meteor'], necromancer: ['meteor'], void_wyrm: ['meteor'], harvest_wraith: ['meteor'], hollow_king: ['shock'], broodmother: ['meteor'], elder_treant: ['shock'],
  scarecrow: ['meteor'], kraken: ['shock'], mossback: ['shock'], leviathan: ['shock'], rat_king: ['meteor'] })) MOBS[id].attacks.push(...extra);
MOBS.skeleton.ranged.kind = 'arrow'; MOBS.blaze.ranged.kind = 'fire'; MOBS.d_mage.ranged.kind = 'magic'; MOBS.wraith.ranged.kind = 'ghost'; MOBS.sea_guardian.ranged.kind = 'magic';
