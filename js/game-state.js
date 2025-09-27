import { DIFF_PRESETS, STAGE_DIFF_TWEAKS, STAGE_MAX } from './config.js';

// Global game state
export let difficulty = 'normal';
export let DIFF = DIFF_PRESETS[difficulty];
export let DIFF_STAGE = { 
  bulletSpeedMul: 1, 
  patternEveryMul: 1, 
  patternCountMul: 1, 
  enemyHpMul: 1, 
  bossHpMul: 1, 
  bossDamageTakenMul: 1, 
  drop: null 
};
export let ship = 'A';
export let stageNum = '1';

// Score and items
export let score = 0;
export let graze = 0;
export let nextExtend = 0;
export let lifeShards = 0;
export let bombShards = 0;
export let grazeProgress = 0;
export let itemsMagnetT = 0;

// Run statistics
export const runStats = {
  score0: 0,
  graze0: 0,
  bombsUsed: 0,
  deaths: 0,
  itemsP: 0,
  itemsS: 0,
  spellCaps: 0,
  spellsTotal: 0,
  startTime: 0
};

export function setDifficulty(name) {
  if (!DIFF_PRESETS[name]) return;
  difficulty = name;
  DIFF = DIFF_PRESETS[name];
  try {
    localStorage.setItem('difficulty', name);
  } catch (_) { }
  updateStageDiffTweaks();
}

export function setShip(name) {
  ship = (name === 'B' ? 'B' : 'A');
  try {
    localStorage.setItem('ship', ship);
  } catch (_) { }
}

export function setStageNum(num) {
  stageNum = String(num);
  window.stageNum = stageNum;
  updateStageDiffTweaks();
}

export function updateStageDiffTweaks() {
  const t = STAGE_DIFF_TWEAKS[difficulty]?.[String(stageNum)] || null;
  DIFF_STAGE = {
    bulletSpeedMul: t?.bulletSpeedMul ?? 1,
    patternEveryMul: t?.patternEveryMul ?? 1,
    patternCountMul: t?.patternCountMul ?? 1,
    enemyHpMul: t?.enemyHpMul ?? 1,
    bossHpMul: t?.bossHpMul ?? 1,
    bossDamageTakenMul: t?.bossDamageTakenMul ?? 1,
    drop: t?.drop ?? null
  };
}

export function getStageNumInt() {
  try {
    return Math.max(1, Math.min(STAGE_MAX, parseInt(stageNum, 10) || 1));
  } catch (_) {
    return 1;
  }
}

export function scaleCount(n) {
  return Math.max(1, Math.round(n * (DIFF.patternCountMul ?? 1) * (DIFF_STAGE.patternCountMul ?? 1)));
}

export function resetScore() {
  score = 0;
  graze = 0;
  nextExtend = 0;
  lifeShards = 0;
  bombShards = 0;
  grazeProgress = 0;
  itemsMagnetT = 0;
}

export function addScore(n, px = null, py = null) {
  const prev = score;
  score += Math.floor(n);
  // Handle popup and extend logic elsewhere
  return { prev, score };
}

export function addGraze() {
  graze++;
  grazeProgress++;
  return grazeProgress;
}

export function resetRunStats() {
  runStats.score0 = score;
  runStats.graze0 = graze;
  runStats.bombsUsed = 0;
  runStats.deaths = 0;
  runStats.itemsP = 0;
  runStats.itemsS = 0;
  runStats.spellCaps = 0;
  runStats.spellsTotal = 0;
  runStats.startTime = 0;
}

export function stageDropCount(base, key) {
  const mul = (DIFF_STAGE?.drop && typeof DIFF_STAGE.drop[key] === 'number') ? DIFF_STAGE.drop[key] : 1;
  return Math.max(0, Math.floor(base * mul));
}

// Shard helpers
export function addLifeShards(n = 1) {
  lifeShards += n;
  return lifeShards;
}

export function addBombShards(n = 1) {
  bombShards += n;
  return bombShards;
}

export function consumeLifeShards(n = 1) {
  lifeShards = Math.max(0, lifeShards - n);
  return lifeShards;
}

export function consumeBombShards(n = 1) {
  bombShards = Math.max(0, bombShards - n);
  return bombShards;
}
