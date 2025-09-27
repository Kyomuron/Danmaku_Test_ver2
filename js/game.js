// Game orchestrator: ties together canvas, state, stages, and UI
import { 
  W, H, DT, STAGE_MAX, URL_PARAMS,
  PLAYER_SHOT_DMG_ENEMY, PLAYER_SHOT_DMG_BOSS_DEFAULT,
  LIFE_SHARDS_TO_EXTEND, BOMB_SHARDS_TO_BOMB, GRAZE_PER_BOMB_SHARD, GRAZE_GAP,
  EXTENDS,
  PRE_BOSS_SILENCE,
  BOSS_WARNING_LEAD,
  ENEMY_BULLET_SIZE_MUL, ENEMY_BULLET_MIN_R,
  THEME, ACTIVE_PALETTE,
  // Player damage scaling (point-blank bonus)
  PLAYER_DMG_DIST_MAX, PLAYER_DMG_SCALE_MIN, PLAYER_DMG_SCALE_MAX,
  // Shot role damages
  DMG_A_WING, DMG_B_MAIN, DMG_B_HOMING,
  // B-type homing
  B_HOMING_COUNT, B_HOMING_SPEED, B_HOMING_TURN
} from './config.js';
import { Player } from './entities/player.js';
import { PShot, PHoming, Bullet } from './entities/bullet.js';
import { Item } from './entities/item.js';
import { Enemy } from './entities/enemy.js';
import { Boss } from './entities/boss.js';
import { Dialogue } from './entities/dialogue.js';
import { fmtNum, toRad, dist2, randRange, lightenColor, quantizeColor, idle } from './utils.js';
import { addPopup, updatePopups, drawPopups } from './entities/popup.js';
import {
  difficulty,
  DIFF,
  ship,
  setStageNum,
  getStageNumInt,
  score,
  graze,
  lifeShards,
  bombShards,
  resetScore,
  addScore as gsAddScore,
  addGraze as gsAddGraze,
  runStats,
  stageDropCount,
  addLifeShards,
  addBombShards,
  consumeLifeShards,
  consumeBombShards
} from './game-state.js';
import {
  bgmPlay,
  bgmStop as audioBgmStop,
  playTitleBgm as audioPlayTitleBgm,
  playEndingBgm,
  preloadBgm,
  voiceStop as audioVoiceStop,
  sfxBombA,
  sfxBombB,
  sfxStageClear,
  sfxItem,
  sfxShard,
  sfxExtend,
  sfxLaserWarn,
  sfxLaserFire
} from './audio.js';

const STAGE_CACHE = new Map(); // stageNum(string) -> { obj, url }
const STAGE_PRELOADING = new Set();

function stagePath(n) {
  const i = String(n);
  return `stage/stage${i}.json`;
}

export class Game {
  constructor() {
    // Canvas
    this.canvas = document.getElementById('game');
    this.g = this.canvas?.getContext('2d');

    // UI elements
    this.hud = document.getElementById('hud');
    this.$st = {
      lives: document.getElementById('stLives'),
      bombs: document.getElementById('stBombs'),
      lsh: document.getElementById('stLShard'),
      bsh: document.getElementById('stBShard'),
      pow: document.getElementById('stPower'),
      score: document.getElementById('stScore'),
      graze: document.getElementById('stGraze'),
      ebul: document.getElementById('stEBul'),
      diff: document.getElementById('stDiff'),
      ship: document.getElementById('stShip')
    };
    this.$btnPause = document.getElementById('btnPause');
    this.$btnRestart = document.getElementById('btnRestart');

    // Practice UI
    this.$btnSpellPrev = document.getElementById('btnSpellPrev');
    this.$btnSpellNext = document.getElementById('btnSpellNext');
    this.$btnPracticeStart = document.getElementById('btnPracticeStart');
    this.$lblPractice = document.getElementById('lblPractice');

    // Core runtime
    this.state = 'title'; // 'title' | 'playing' | 'paused' | 'dialogue' | 'stageclear' | 'gameover' | 'ending'
    this.mode = 'normal'; // 'normal' | 'practice'
    this.nextStageReady = false;
    this.stage = null; // loaded stage JSON
    this.stageNum = '1';
    this.time = 0;
    this._acc = 0;
    this._last = 0;
    this._raf = 0;
    this._eventIdx = 0;
    this._homingTargetsCache = [];

    // Player + shots + enemies + bullets + items
    this.player = new Player();
    this.pshots = [];
    this.enemies = [];
    this.eBullets = [];
    this.eBeams = [];
    this.items = [];
    this.itemsMagnetT = 0;
    this.boss = null;
    this.midBoss = null;
    this._midActive = false;
    this._bossWarningActive = false;
    this._bossWarningT = 0;
    this._bossWarningCountdown = 0;
    this._bossWarningDuration = 0;
    this._bossSpawnDue = null;

    // Dialogue manager
    this.dialogue = new Dialogue();
    this.practiceSpellIndex = 0;
    this._nextExtendIdx = 0;
    this._prevLives = this.player.lives;

    // Initial HUD text
    if (this.hud) {
      this.hud.textContent = '難易度・自機を選んで ▶ 開始 / 矢印・Z / X / Shift / P';
    }
  }

  // ---------- Stage Loading ----------
  async loadStage(stageOverride = null) {
    // Determine target stage number
    const param = new URLSearchParams(window.location.search);
    const pick = (stageOverride != null) ? String(stageOverride) : (param.get('stage') || '1');
    this.stageNum = pick;
    setStageNum(pick);
    const url = stagePath(pick);

    // From cache
    const cached = STAGE_CACHE.get(String(pick));
    if (cached && cached.obj) {
      this.stage = cached.obj;
      if (this.hud) this.hud.textContent = `ステージを読み込みました（キャッシュ / ステージ=${pick}）。▶ 開始 でスタート`;
      return;
    }

    // Fetch
    if (this.hud) this.hud.textContent = `ステージデータ読み込み中（ステージ=${pick}）…`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const obj = await res.json();
    this.stage = obj;
    STAGE_CACHE.set(String(pick), { obj, url });
    if (this.hud) this.hud.textContent = `ステージを読み込みました（${url}）。▶ 開始 でスタート`;
    // Preload BGM for stage/boss
    try {
      const st = (typeof obj.bgm === 'string') ? obj.bgm : (obj.bgm?.stage ?? null);
      const boss = (obj.bgm && typeof obj.bgm === 'object' && obj.bgm.boss) ? obj.bgm.boss : (obj.boss?.bgm ?? null);
      if (st) preloadBgm(st);
      if (boss) preloadBgm(boss);
    } catch (_) { }
  }

  preloadAllStages() {
    // Throttle JSON preloads so the menu remains responsive
    const cur = getStageNumInt();
    const order = [];
    for (let i = cur + 1; i <= STAGE_MAX; i++) order.push(i);
    for (let i = 1; i < cur; i++) order.push(i);
    order.forEach((n, idx) => {
      idle(() => {
        setTimeout(() => this._preloadStageJson(n), 250 + idx * 300);
      });
    });
  }

  _preloadStageJson(n) {
    const key = String(n);
    if (STAGE_CACHE.has(key) || STAGE_PRELOADING.has(key)) return;
    STAGE_PRELOADING.add(key);
    const url = stagePath(n);
    fetch(url, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(obj => { if (obj) STAGE_CACHE.set(key, { obj, url }); })
      .catch(() => { /* ignore */ })
      .finally(() => { STAGE_PRELOADING.delete(key); });
  }

  // ---------- Loop ----------
  startLoop() {
    this._acc = 0;
    this._last = (performance.now ? performance.now() : Date.now());
    if (this._raf) cancelAnimationFrame(this._raf);
    const step = () => {
      const now = (performance.now ? performance.now() : Date.now());
      let dt = Math.min(100, now - this._last) / 1000;
      this._last = now;
      this._acc += dt;
      while (this._acc >= DT) {
        this.update(DT);
        this._acc -= DT;
      }
      this.draw();
      this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  update(dt) {
    if (this.state === 'playing') {
      // Player
      const _plPrevLives = this._prevLives ?? this.player.lives;
      this.player.update(dt, (p) => this._shootPlayer(p));
      if (this.player.lives < _plPrevLives) this._onPlayerLifeLost();
      this._prevLives = this.player.lives;
      // Shots
      const homingTargets = this._collectHomingTargets();
      for (let i = this.pshots.length - 1; i >= 0; i--) {
        const s = this.pshots[i];
        // For homing shots, pass enemies + boss as candidates; others ignore extras safely
        s.update(dt, homingTargets, this.player);
        if (!s.active) this.pshots.splice(i, 1);
      }
      // Stage timeline
      this._updateStageTimeline(dt);
      // Enemies
      this._updateEnemies(dt);
      // Enemy bullets
      this._updateEnemyBullets(dt);
      // Enemy beams
      this._updateEnemyBeams(dt);
      // Collisions
      this._handleCollisions();
      // Bomb effects
      if (this.player.isBombing) {
        if (ship === 'B') this._updateBombB(this.player, dt);
        else this._updateBombA(this.player, dt);
      }
      // Items
      this.itemsMagnetT = Math.max(0, this.itemsMagnetT - dt);
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        it.update(dt, this.player, this.itemsMagnetT);
        if (!it.active) this.items.splice(i, 1);
      }
      updatePopups(dt);
      this.time += dt;
      this._updateStatsPanel();
    } else if (this.state === 'dialogue') {
      // Dialogue is advanced via key handlers; no simulation advance needed
    }
  }

  draw() {
    const g = this.g;
    if (!g) return;
    g.clearRect(0, 0, W, H);
    // Background
    g.fillStyle = '#04060a';
    g.fillRect(0, 0, W, H);
    this._drawCyberGrid(g);

    if (this.state === 'dialogue') {
      this.dialogue.draw(g, W, H, this.stage, this.time || 0);
      return;
    }

    // Player + enemies + bullets (non-dialogue)
    this.player.draw(g, this.time || 0);
    // Items below bullets
    for (const it of this.items) it.draw(g, this.time || 0);
    for (const e of this.enemies) e.draw(g);
    if (this.boss && this.boss.active) this.boss.draw(g);
    for (const s of this.pshots) s.draw(g);
    for (const b of this.eBullets) b.draw(g, this.time || 0);
    this._drawEnemyBeams(g);
    // Bomb visuals
    if (this.player.isBombing) {
      if (ship === 'B') this._drawBombB(this.player, g);
      else this._drawBombA(this.player, g);
    }
    if (this._bossWarningActive) this._drawBossWarning(g);
    // Spell HUD
    this._drawSpellHud(g);
    drawPopups(g);

    // GAME OVER overlay
    if (this.state === 'gameover') {
      g.save();
      g.globalAlpha = 0.6;
      g.fillStyle = '#000000';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
      g.fillStyle = '#ff4d6d';
      g.font = 'bold 48px ui-sans-serif, system-ui';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('GAME OVER', W / 2, H / 2 - 10);
      g.font = '16px ui-sans-serif, system-ui';
      g.fillStyle = '#cdd6f4';
      g.fillText('▶ 開始 で再挑戦', W / 2, H / 2 + 28);
      g.restore();
    }
    // STAGE CLEAR overlay
    if (this.state === 'stageclear') {
      g.save();
      g.globalAlpha = 0.5;
      g.fillStyle = '#000000';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
      g.fillStyle = '#00e5ff';
      g.font = 'bold 42px ui-sans-serif, system-ui';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const num = getStageNumInt();
      g.fillText(`STAGE ${num} CLEAR`, W / 2, H / 2 - 10);
      g.font = '16px ui-sans-serif, system-ui';
      g.fillStyle = '#cdd6f4';
      g.fillText('▶ 開始 で次へ', W / 2, H / 2 + 28);
      g.restore();
    }
    // ENDING overlay
    if (this.state === 'ending') {
      g.save();
      g.globalAlpha = 0.6;
      g.fillStyle = '#000000';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
      g.fillStyle = '#93c5fd';
      g.font = 'bold 48px ui-sans-serif, system-ui';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('エンディング', W / 2, H / 2 - 10);
      g.font = '16px ui-sans-serif, system-ui';
      g.fillStyle = '#cdd6f4';
      g.fillText('Enter/Z/Space: タイトルへ', W / 2, H / 2 + 28);
      g.restore();
    }
  }

  // ---------- UI helpers ----------
  _updateStatsPanel() {
    const p = this.player;
    const S = this.$st;
    if (!S) return;
    if (S.lives) S.lives.textContent = String(Math.max(0, p.lives));
    if (S.bombs) S.bombs.textContent = String(Math.max(0, p.bombs));
    if (S.lsh) S.lsh.textContent = `${lifeShards ?? 0}/${LIFE_SHARDS_TO_EXTEND}`;
    if (S.bsh) S.bsh.textContent = `${bombShards ?? 0}/${BOMB_SHARDS_TO_BOMB}`;
    if (S.pow) S.pow.textContent = (p.power ?? 0).toFixed(2);
    if (S.score) S.score.textContent = (score ?? 0).toLocaleString('en-US');
    if (S.graze) S.graze.textContent = String(graze ?? 0);
    if (S.ebul) S.ebul.textContent = '0'; // placeholder until enemy bullets wired
    if (S.ebul) {
      const beamCnt = (this.eBeams?.filter(b => b.active && b.phase === 'fire').length) || 0;
      S.ebul.textContent = String(this.eBullets.length + beamCnt);
    }
    if (S.diff) S.diff.textContent = DIFF?.label || difficulty || '-';
    if (S.ship) S.ship.textContent = ship || '-';
  }

  updatePracticeUI() {
    const spells = this.getBossSpells();
    const n = Array.isArray(spells) ? spells.length : 0;
    const i = Math.max(0, Math.min(n - 1, this.practiceSpellIndex || 0));
    this.practiceSpellIndex = i;

    if (this.$lblPractice) {
      if (n <= 0) this.$lblPractice.textContent = '(スペルなし)';
      else {
        const name = spells[i]?.name || 'スペル';
        this.$lblPractice.textContent = `ステージ-${this.stageNum}  ${i + 1} / ${n}：${name}`;
      }
    }
    const canPrev = i > 0;
    const canNext = i < (n - 1);
    const canStart = n > 0 && (this.state === 'title' || this.state === 'stageclear' || this.state === 'gameover');
    if (this.$btnSpellPrev) this.$btnSpellPrev.classList.toggle('muted', !canPrev);
    if (this.$btnSpellNext) this.$btnSpellNext.classList.toggle('muted', !canNext);
    if (this.$btnPracticeStart) this.$btnPracticeStart.classList.toggle('muted', !canStart);
  }

  getBossSpells() {
    const b = this.stage?.boss;
    if (!b) return null;
    return Array.isArray(b.spells) ? b.spells : null;
  }

  // ---------- Flow controls ----------
  startGame() {
    if (!this.stage) return;
    this.mode = 'normal';
    this.state = 'playing';
    this.time = 0;
    this.player.reset();
    resetScore();
    this._nextExtendIdx = 0;
    this._resetStageRuntime();
    if (this.hud) this.hud.textContent = `ステージ-${this.stageNum} [${DIFF.label}]：がんばって！`;
    this.$btnPause?.classList.remove('muted');
    this.$btnRestart?.classList.remove('muted');
    try { document.body.classList.remove('state-title'); } catch (_) {}
    // Stage BGM
    const b = this.stage?.bgm;
    const url = (typeof b === 'string') ? b : (b?.stage || null);
    if (url) bgmPlay(url, { loop: true, fadeIn: 0.6 });
  }

  startPractice() {
    if (!this.stage) return;
    this.mode = 'practice';
    // Optional: show pre-boss dialogue if available
    const talk = this.stage?.dialogue?.preBoss;
    const spawn = () => {
      this.state = 'playing';
      this.time = 0;
      this.player.reset();
      resetScore();
      this._nextExtendIdx = 0;
      this._resetStageRuntime();
      if (this.hud) this.hud.textContent = `練習: ${(this.getBossSpells()?.[this.practiceSpellIndex]?.name || 'スペル')}（ステージ-${this.stageNum} / ${DIFF.label}）`;
      this.$btnPause?.classList.remove('muted');
      this.$btnRestart?.classList.remove('muted');
      try { document.body.classList.remove('state-title'); } catch (_) {}
      // Spawn boss with only the selected spell
      const base = this.stage?.boss;
      if (base) {
        const spells = Array.isArray(base.spells) ? base.spells : [];
        const i = Math.max(0, Math.min(spells.length - 1, this.practiceSpellIndex || 0));
        const pick = spells[i] ? [spells[i]] : [];
        const conf = { ...base, spells: pick };
        this._spawnBoss(conf);
      }
    };
    if (Array.isArray(talk) && talk.length > 0) this.startDialogue(talk, spawn, 'preBoss');
    else spawn();
  }

  startNextStage() {
    const cur = getStageNumInt();
    const nxt = (cur % STAGE_MAX) + 1;
    return this.loadStage(String(nxt)).then(() => {
      this.updatePracticeUI();
      this.startGame();
    });
  }

  restartGame() {
    if (this.mode === 'practice') this.startPractice();
    else this.startGame();
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      if (this.hud) this.hud.textContent = '一時停止中（Pで再開）';
      this.$btnPause && (this.$btnPause.textContent = '▶ 再開');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      if (this.mode === 'practice') {
        if (this.hud) this.hud.textContent = `練習: ${(this.getBossSpells()?.[this.practiceSpellIndex]?.name || 'スペル')}（ステージ-${this.stageNum} / ${DIFF.label}）`;
      } else {
        if (this.hud) this.hud.textContent = `ステージ-${this.stageNum} [${DIFF.label}]：がんばって！`;
      }
      this.$btnPause && (this.$btnPause.textContent = '⸏ 一時停止');
    }
  }

  goToTitle() {
    this.state = 'title';
    this.$btnPause?.classList.add('muted');
    this.$btnRestart?.classList.add('muted');
    if (this.hud) this.hud.textContent = '難易度・自機を選んで ▶ 開始 / 矢印・Z / X / Shift / P';
    audioPlayTitleBgm();
    try { document.body.classList.add('state-title'); } catch (_) {}
  }

  // ---------- Dialogue ----------
  startDialogue(lines, onFinish, context = 'generic') {
    this.state = 'dialogue';
    this.dialogue.start(lines, () => {
      this.state = 'playing';
      if (typeof onFinish === 'function') onFinish();
    }, context);
  }
  advanceDialogue() { if (this.state === 'dialogue') this.dialogue.advance(); }
  skipDialogue() { if (this.state === 'dialogue') this.dialogue.skip(); }
  voiceStop() { audioVoiceStop(); }

  // ---------- Audio passthrough ----------
  playTitleBgm() { audioPlayTitleBgm(); }
  bgmStop(sec = 0.5) { audioBgmStop(sec); }

  // ---------- Bomb ----------
  tryUseBomb() {
    this.player.useBomb((p) => {
      const extraInv = 0.2;
      if (ship === 'B') {
        // Laser-like bomb: long, wide lane
        p.isBombing = true;
        p.bombT = 0;
        p.bombDur = 1.6; // 少し長め
        p.inv = Math.max(p.inv, p.bombDur + extraInv);
        try { sfxBombB(); } catch (_) {}
      } else {
        // A-type: expanding circle
        p.isBombing = true;
        p.bombT = 0;
        p.bombDur = 1.8; // やや長め
        p.inv = Math.max(p.inv, p.bombDur + extraInv);
        try { sfxBombA(); } catch (_) {}
      }
      try { runStats.bombsUsed++; } catch (_) {}
    });
  }

  // ---------- Shots ----------
  _shootPlayer(p) {
    // Ship-specific firing
    const y = p.y - 10;
    if (ship === 'A') {
      // A-type rework: remove laser; fire a wide multi-way spread
      const vxSet = [-160, -130, -100, -70, -40, -20, 0, 0, 20, 40, 70, 100, 130, 160];
      const offSet = [-26, -22, -18, -14, -10, -6, -2, 2, 6, 10, 14, 18, 22, 26];
      for (let i = 0; i < vxSet.length; i++) {
        const vx = vxSet[i];
        const ox = offSet[i] ?? 0;
        this._spawnShot(p.x + ox, y, vx, -520, 3, DMG_A_WING, 'wing');
      }
    } else {
      // B-type: main straight shots + homing sub-shots
      this._spawnShot(p.x - 6, y, 0, -520, 3, DMG_B_MAIN, 'main');
      this._spawnShot(p.x + 6, y, 0, -520, 3, DMG_B_MAIN, 'main');
      this._spawnHoming(p);
    }
  }

  _spawnShot(x, y, vx = 0, vy = -520, r = 3, baseDamage = PLAYER_SHOT_DMG_ENEMY, kind = 'main') {
    const s = new PShot();
    const dmg = baseDamage; // apply difficulty + distance scaling on hit
    let col = '#ffd1dc';
    if (THEME?.retro) col = quantizeColor(col, ACTIVE_PALETTE);
    s.spawn(x, y, vx, vy, dmg, r, col, kind);
    this.pshots.push(s);
  }

  // Laser removed for A-type; no-op stub kept to avoid references
  _spawnLaser() { /* removed */ }

  _spawnHoming(p) {
    const n = Math.max(1, B_HOMING_COUNT | 0);
    const spread = 16; // px spacing for spawn offsets
    const left = -Math.floor((n - 1) / 2);
    for (let i = 0; i < n; i++) {
      const s = new PHoming();
      let col = '#bdeeff';
      if (THEME?.retro) col = quantizeColor(col, ACTIVE_PALETTE);
      const off = (left + i) * spread;
      s.spawn(p.x + off, p.y - 10, B_HOMING_SPEED, B_HOMING_TURN, DMG_B_HOMING, 3, col);
      this.pshots.push(s);
    }
  }

  _playerDamageScaleTo(tx, ty) {
    const px = this.player?.x ?? 0;
    const py = this.player?.y ?? 0;
    const d = Math.hypot(tx - px, ty - py);
    const t = Math.max(0, Math.min(1, 1 - d / Math.max(1, PLAYER_DMG_DIST_MAX)));
    return PLAYER_DMG_SCALE_MIN + (PLAYER_DMG_SCALE_MAX - PLAYER_DMG_SCALE_MIN) * t;
  }

  // ---------- Stage Runtime ----------
  _resetStageRuntime() {
    this.enemies.length = 0;
    this.eBullets.length = 0;
    this.items.length = 0;
    this.itemsMagnetT = 0;
    this.boss = null;
    this.midBoss = null;
    this._midActive = false;
    this._bossFlowStarted = false;
    this._bossClearHandled = false;
    this.stageTime = 0;
    this._events = this._compileStageEvents(this.stage);
    this._eventIdx = 0;
    this._homingTargetsCache.length = 0;
    this._bossWarningActive = false;
    this._bossWarningT = 0;
    this._bossWarningCountdown = 0;
    this._bossWarningDuration = 0;
    this._bossSpawnDue = null;
  }

  _compileStageEvents(stage) {
    const ev = [];
    if (!stage) return ev;
    // Waves
    const waves = Array.isArray(stage.waves) ? stage.waves : [];
    for (const w of waves) {
      const baseT = Number(w.time || 0) || 0;
      const cnt = Math.max(1, Math.floor((w.count ?? 1) * (DIFF.patternCountMul ?? 1) * (1 /* DIFF_STAGE applied in-game */)));
      const every = Math.max(0.01, (w.every ?? 0.7) * (DIFF.patternEveryMul ?? 1));
      for (let i = 0; i < cnt; i++) {
        ev.push({ t: baseT + i * every, type: 'enemy', payload: w.enemy });
      }
    }
    // Mid-bosses (defer)
    const mids = Array.isArray(stage.midBosses) ? stage.midBosses : [];
    for (const mb of mids) {
      const t = Number(mb.time || 0) || 0;
      ev.push({ t, type: 'midboss', payload: mb });
    }
    // Boss (no time in JSON; trigger near end via heuristic)
    // Keep explicit event at large time to allow manual spawn if needed
    ev.sort((a, b) => a.t - b.t);
    // Compute boss trigger time (last event + silence)
    const lastT = ev.length > 0 ? ev[ev.length - 1].t : 0;
    this._bossTriggerT = lastT + (PRE_BOSS_SILENCE ?? 0);
    return ev;
  }

  _updateStageTimeline(dt) {
    this.stageTime = (this.stageTime || 0) + dt;
    const T = this.stageTime;
    const ev = this._events || [];
    const len = ev.length;
    while (this._eventIdx < len) {
      const e = ev[this._eventIdx];
      if (!e || e.t > T + 1e-6) break;
      if (this._midActive && e.type !== 'midboss') break;
      this._eventIdx++;
      this._dispatchStageEvent(e);
    }
    if (this._bossWarningActive) {
      this._bossWarningT += dt;
      if (this._bossSpawnDue != null) {
        this._bossWarningCountdown = Math.max(0, this._bossSpawnDue - this.stageTime);
      }
      if (this._bossWarningT >= this._bossWarningDuration - 1e-6) {
        this._bossWarningActive = false;
        this._bossWarningCountdown = 0;
        const spawnNow = () => {
          this._bossSpawnDue = null;
          this._bossWarningDuration = 0;
          this._beginBossSequence();
        };
        // Ensure remaining stray bullets do not linger by soft-clearing
        if (this.eBullets.length > 0) {
          this._softClearEnemyBullets();
        }
        spawnNow();
      }
    } else if (!this.boss && !this._bossFlowStarted && !this._midActive && this.enemies.length === 0 && this.stage?.boss && this.mode === 'normal') {
      if (T >= (this._bossTriggerT || 0)) {
        const warnLead = BOSS_WARNING_LEAD ?? 0;
        if (warnLead > 1e-3) {
          this._bossWarningActive = true;
          this._bossWarningT = 0;
          this._bossWarningDuration = warnLead;
          this._bossSpawnDue = this.stageTime + warnLead;
          this._bossWarningCountdown = warnLead;
          this._onBossWarningStart();
        } else {
          this._beginBossSequence();
        }
      }
    } else if (!this._bossWarningActive) {
      this._bossWarningCountdown = 0;
    }
  }

  _dispatchStageEvent(e) {
    if (!e) return;
    if (e.type === 'enemy') this._spawnEnemy(e.payload);
    else if (e.type === 'midboss') this._spawnMidBoss(e.payload);
  }

  _onBossWarningStart() {
    // Fade out stray items and gently slow bullets so the field calms down
    this.itemsMagnetT = Math.max(this.itemsMagnetT, 0.8);
    // Encourage soft clearing of remaining enemy bullets for a fair reset
    this._softClearEnemyBullets();
  }

  _softClearEnemyBullets() {
    for (const b of this.eBullets) {
      if (!b) continue;
      if ((b.maxT || 0) > b.t + 0.8) b.maxT = b.t + 0.8;
      b.vx *= 0.85;
      b.vy *= 0.85;
    }
  }

  _beginBossSequence() {
    this._bossFlowStarted = true;
    const talk = this._dialoguePick('preBoss');
    const go = () => { this._spawnBoss(this.stage.boss); };
    if (Array.isArray(talk) && talk.length > 0) this.startDialogue(talk, go, 'preBoss');
    else go();
  }

  // ---------- Enemy Beams (Lasers) disabled ----------
  _spawnBeam() { /* beams disabled */ }

  _updateEnemyBeams(dt) {
    // Consume and clear any existing beams to ensure none persist
    for (let i = this.eBeams.length - 1; i >= 0; i--) this.eBeams.splice(i, 1);
  }

  _drawEnemyBeams(g) { /* beams disabled */ }

  _spawnEnemy(conf) {
    if (!conf) return;
    const e = new Enemy();
    const c = this._materializeEnemyConf(conf);
    e.spawn(c);
    this.enemies.push(e);
    // Ensure emitter runtime will be handled in update
  }

  _spawnMidBoss(conf) {
    // Optional mid-boss dialogue support (default OFF). Enable via JSON flag only.
    const spawnIt = () => {
      // Use Boss orchestrator for mid-boss so patterns/switching work
      const b = new Boss();
      const cc = this._materializeEnemyConf(conf);
      // Set sprite from mid-boss portraits if available, fallback to boss portraits
      try {
        const d = this.stage?.dialogue || {};
        const mid = d.midBossPortraits?.boss;
        const por = d.portraits?.boss;
        if (!cc.sprite && (mid?.normal || por?.normal)) cc.sprite = mid?.normal || por?.normal;
        if (!cc.spriteDamaged && (mid?.damaged || por?.damaged)) cc.spriteDamaged = mid?.damaged || por?.damaged;
      } catch (_) { }
      b.spawn(cc);
      b.isMidBoss = true;
      // Track as midBoss but update via enemies loop
      this.enemies.push(b);
      this.midBoss = b;
      this._midActive = true;
    };
    // Talk only if explicitly enabled in JSON
    const talkArr = this._dialoguePick('preMid', conf?.dialogue);
    if (Array.isArray(talkArr) && talkArr.length > 0) { this.startDialogue(talkArr, spawnIt, 'preMid'); return; }
    spawnIt();
  }

  _spawnBoss(conf) {
    const b = new Boss();
    const spawnConf = this._materializeEnemyConf(conf);
    // Set sprite from portraits if not explicitly set
    try {
      const por = this.stage?.dialogue?.portraits?.boss;
      if (por) {
        if (!spawnConf.sprite && por.normal) spawnConf.sprite = por.normal;
        if (!spawnConf.spriteDamaged && por.damaged) spawnConf.spriteDamaged = por.damaged;
      }
    } catch (_) { }
    b.spawn(spawnConf);
    this.boss = b;
    // Switch BGM to boss if available
    const bossUrl = (this.stage?.bgm && typeof this.stage.bgm === 'object' && this.stage.bgm.boss)
      ? this.stage.bgm.boss : (this.stage?.boss?.bgm ?? null);
    if (bossUrl) bgmPlay(bossUrl, { loop: true, fadeIn: 0.6 });
  }

  _materializeEnemyConf(conf) {
    // Deep-ish copy and evaluate rand() and expressions in spawn/path minimaly
    const parseVal = (v) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const m = v.match(/^rand\(([-\d.]+),\s*([-\d.]+)\)$/);
        if (m) return randRange(parseFloat(m[1]), parseFloat(m[2]));
        const n = parseFloat(v);
        if (!Number.isNaN(n)) return n;
      }
      return v;
    };
    const spawn = conf.spawn ? { x: parseVal(conf.spawn.x), y: parseVal(conf.spawn.y) } : { x: W / 2, y: -20 };
    const path = conf.path ? { ...conf.path } : null;
    if (path && path.to) path.to = { x: parseVal(path.to.x), y: parseVal(path.to.y) };
    const pattern = conf.pattern ? { ...conf.pattern } : null;
    const patterns = Array.isArray(conf.patterns) ? conf.patterns.map(p => ({ ...p })) : undefined;
    return {
      ...conf,
      spawn,
      path,
      pattern,
      patterns,
    };
  }

  _updateEnemies(dt) {
    // Attach/update emitters and step enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt);
      this._updateEmittersOwner(e, dt);
      if (!e.active) this.enemies.splice(i, 1);
    }
    // Mid-boss defeated handling
    if (this._midActive && (!this.midBoss || !this.midBoss.active)) {
      this._midActive = false;
      // Mid-boss defeat drop burst
      if (this.midBoss) {
        const x = this.midBoss.x, y = this.midBoss.y;
        for (let i = 0; i < 5; i++) this._spawnPowerItem(x + randRange(-25, 25), y + randRange(-15, 15), 'small');
        for (let i = 0; i < 2; i++) this._spawnPowerItem(x + randRange(-20, 20), y + randRange(-10, 10), 'medium');
        for (let i = 0; i < 8; i++) this._spawnItem(x + randRange(-30, 30), y + randRange(-20, 20), 's');
        this._spawnItem(x, y - 10, 'b');
        // Do not magnetize on mid-boss defeat; let items fall vertically
      }
      this.midBoss = null;
    }
    if (this.boss) {
      if (this.boss.active !== false) {
        const beforeSig = this._ownerSig(this.boss);
        this.boss.update(dt);
        this._updateEmittersOwner(this.boss, dt);
        const afterSig = this._ownerSig(this.boss);
        if (beforeSig !== afterSig) {
          // Pattern set changed (phase or spell) → clear bullets for fairness
          this.eBullets.length = 0;
          // Between-spell small drop
          const cP = stageDropCount(2, 'betweenSpellPow');
          const cS = stageDropCount(2, 'betweenSpellScore');
          for (let i = 0; i < cP; i++) this._spawnPowerItem(this.boss.x + randRange(-24, 24), this.boss.y + 10 + randRange(-8, 8), 'small');
          for (let i = 0; i < cS; i++) this._spawnItem(this.boss.x + randRange(-26, 26), this.boss.y + 18 + randRange(-10, 10), 's');
          this.itemsMagnetT = Math.max(this.itemsMagnetT, 0.8);
        }
      } else if (!this._bossClearHandled) {
        this._bossClearHandled = true;
        this._onBossDefeated();
      }
    }
  }

  _ownerSig(owner) {
    try {
      return (owner.emitters || []).map(e => e?.pattern?.type || '?').join('|') + `#phase:${owner.phase ?? 0}`;
    } catch (_) { return ''; }
  }

  _onBossDefeated() {
    this.eBullets.length = 0;
    const talk = this._dialoguePick('postBoss');
    const finalize = () => this._stageClear();
    if (Array.isArray(talk) && talk.length > 0) this.startDialogue(talk, finalize, 'postBoss');
    else finalize();
    // Final drop burst
    const x = this.boss?.x ?? W / 2, y = this.boss?.y ?? H / 3;
    const cL = stageDropCount(1, 'finalLifeShard');
    const cB = stageDropCount(1, 'finalBombShard');
    const cLarge = stageDropCount(2, 'finalLarge');
    const cMed = stageDropCount(4, 'finalMedium');
    const cSmall = stageDropCount(10, 'finalSmall');
    const cScore = stageDropCount(6, 'finalScore');
    for (let i = 0; i < cL; i++) this._spawnItem(x + randRange(-14, 14), y - 10 + randRange(-10, 6), 'l');
    for (let i = 0; i < cB; i++) this._spawnItem(x + randRange(-14, 14), y - 6 + randRange(-6, 10), 'b');
    for (let i = 0; i < cLarge; i++) this._spawnPowerItem(x + randRange(-30, 30), y + randRange(-16, 16), 'large');
    for (let i = 0; i < cMed; i++) this._spawnPowerItem(x + randRange(-34, 34), y + randRange(-18, 18), 'medium');
    for (let i = 0; i < cSmall; i++) this._spawnPowerItem(x + randRange(-38, 38), y + randRange(-18, 22), 'small');
    for (let i = 0; i < cScore; i++) this._spawnItem(x + randRange(-40, 40), y + randRange(-24, 24), 's');
    this.itemsMagnetT = Math.max(this.itemsMagnetT, 4.0);
  }

  _stageClear() {
    this.state = 'stageclear';
    this.nextStageReady = true;
    this.$btnPause?.classList.add('muted');
    if (this.hud) this.hud.textContent = 'ステージクリア！ ▶ 開始 で次へ';
    try { sfxStageClear(); } catch (_) { }
    const cur = getStageNumInt();
    if (cur >= STAGE_MAX) {
      // Ending sequence for last stage
      try { playEndingBgm(); } catch (_) { }
      this.showEnding();
    } else {
      // Stop BGM softly
      this.bgmStop(0.7);
      // Auto-advance for all non-final stages after short delay
      clearTimeout(this._autoNextTimer);
      this._autoNextTimer = setTimeout(() => {
        if (this.state === 'stageclear') this.startNextStage();
      }, 2200);
    }
  }

  _dialoguePick(name, local = null) {
    const d = this.stage?.dialogue || {};
    const shipId = (ship === 'B') ? 'B' : 'A';
    // Local override (e.g., midBoss)
    if (local && local.enabled === true) {
      const srcLocal = (name === 'preMid') ? (local.pre || null) : (local[name] || null);
      if (Array.isArray(srcLocal)) return srcLocal;
      if (srcLocal && typeof srcLocal === 'object' && Array.isArray(srcLocal[shipId])) return srcLocal[shipId];
    }
    let src = null;
    if (name === 'preMid') {
      if (d.preMidEnabled === true) src = d.preMid;
    } else {
      src = d[name];
    }
    if (!src) return null;
    if (Array.isArray(src)) return src;
    if (src && typeof src === 'object') return Array.isArray(src[shipId]) ? src[shipId] : null;
    return null;
  }

  showOpening() {
    const lines = this._dialoguePick('opening');
    if (Array.isArray(lines) && lines.length > 0) {
      this.startDialogue(lines, () => { this.goToTitle(); }, 'opening');
    } else {
      // Fallback: dummy opening line
      this.startDialogue([{ speaker: 'player', text: 'オープニング' }], () => { this.goToTitle(); }, 'opening');
    }
  }

  showEnding() {
    const lines = this._dialoguePick('ending');
    if (Array.isArray(lines) && lines.length > 0) {
      this.startDialogue(lines, () => { this.state = 'ending'; }, 'ending');
    } else {
      // Fallback: dummy ending line then switch to ending overlay
      this.startDialogue([{ speaker: 'player', text: 'エンディング' }], () => { this.state = 'ending'; }, 'ending');
    }
  }

  _updateEmittersOwner(owner, dt) {
    if (!owner.emitters) return;
    for (const em of owner.emitters) {
      if (!em._rt) em._rt = this._createEmitterRuntime(em.pattern, owner);
      const rt = em._rt;
      if (!rt) continue;
      rt.t += dt;
      rt.cd -= dt;
      while (rt.cd <= 1e-8) {
        this._emitPattern(rt, owner.x, owner.y);
        rt.cd += Math.max(0.05, rt.every);
      }
    }
  }

  _createEmitterRuntime(pattern, owner) {
    if (!pattern) return null;
    const p = { ...pattern };
    const every = Math.max(0.05, (p.every ?? 0.8) * (DIFF.patternEveryMul ?? 1));
    const speed = (p.speed ?? 170) * (DIFF.bulletSpeedMul ?? 1);
    const count = Math.max(1, Math.round((p.count ?? 1) * (DIFF.patternCountMul ?? 1)));
    return {
      p,
      t: 0,
      cd: 0,
      every,
      speed,
      count,
      angle: (p.angleCenter ?? 90),
      angVel: (p.angVel ?? 0),
    };
  }

  _emitPattern(rt, ox, oy) {
    const { p } = rt;
    const baseSpeed = rt.speed;
    const bulletSpec = p.bullet || {};
    const shape = bulletSpec.shape || 'circle';
    const r0 = bulletSpec.r ?? 3;
    const r = Math.max(ENEMY_BULLET_MIN_R, r0 * ENEMY_BULLET_SIZE_MUL);
    const color = bulletSpec.color || '#7dd3fc';

    const spawnBullet = (angDeg, spd = baseSpeed, extra = {}, lifeMul = 1, colorOverride = null) => {
      const a = toRad(angDeg);
      const vx = Math.cos(a) * spd;
      const vy = Math.sin(a) * spd;
      const b = new Bullet();
      const life = Math.max(8, Math.round(15 * lifeMul));
      let colUse = colorOverride || color;
      if (THEME?.retro) colUse = quantizeColor(colUse, ACTIVE_PALETTE);
      b.spawn(ox, oy, vx, vy, r, colUse, life, shape, extra);
      this.eBullets.push(b);
    };

    // Pattern types
    const type = String(p.type || 'spread');
    if (type === 'spread') {
      const n = rt.count;
      const cen = p.angleCenter ?? 90;
      const width = p.angleWidth ?? 60;
      if (n <= 1) spawnBullet(cen);
      else {
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0.5 : (i / (n - 1));
          const ang = cen - width / 2 + width * t;
          const col = (shape === 'orb') ? color : lightenColor(color, (t - 0.5) * 0.15);
          const ex = { ...((p.extra) || {}), glowIntensity: 0.6, trailLength: 6 + Math.round(2 * t), rotSpeed: (shape === 'diamond' || shape === 'star') ? 2.2 : 0, moveType: extraMoveOr(p, 'curve'), curveStrength: 0.4 * (t - 0.5), curveDir: 1 };
          spawnBullet(ang, baseSpeed, ex, 1, col);
        }
      }
    } else if (type === 'spiral' || type === 'reverseSpiral') {
      const angVel = (type === 'reverseSpiral') ? -(p.angVel ?? 180) : (p.angVel ?? 180);
      rt.angle = (rt.angle ?? (p.angleCenter ?? 90)) + angVel * (rt.every);
      const n = p.count ?? 1;
      const step = (p.angleWidth ?? 0) / Math.max(1, n - 1);
      for (let i = 0; i < n; i++) {
        const ang = (rt.angle || 0) + i * step;
        const t = n === 1 ? 0.5 : (i / (n - 1));
        const col = (shape === 'orb') ? color : lightenColor(color, (t - 0.5) * 0.18);
        const ex = { glowIntensity: 0.85, trailLength: 8 + Math.round(2 * t), rotSpeed: (shape === 'diamond' || shape === 'star') ? 3.2 : 0 };
        spawnBullet(ang, baseSpeed, ex, 1.2, col);
      }
    } else if (type === 'target') {
      const px = this.player.x, py = this.player.y;
      const ang = Math.atan2(py - oy, px - ox) * 180 / Math.PI;
      const n = p.count ?? 1;
      const width = p.angleWidth ?? 0;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : (i / (n - 1));
        const a = ang - width / 2 + width * t;
        const ex = { glowIntensity: 0.35, trailLength: 4 + Math.round(2 * t) };
        spawnBullet(a, baseSpeed, ex, 1);
      }
    } else if (type === 'wave') {
      const cen = p.angleCenter ?? 90;
      const width = p.angleWidth ?? 60;
      const osc = Math.sin(rt.t * (p.freq ?? 2)) * width * 0.5;
      const n = p.count ?? 1;
      for (let i = 0; i < n; i++) {
        const ex = { glowIntensity: 0.55, trailLength: 6, moveType: 'curve', curveStrength: 0.5, curveDir: (i % 2) ? -1 : 1 };
        spawnBullet(cen + osc, baseSpeed, ex);
      }
    } else if (type === 'flower') {
      // Simple petal ring
      const layers = p.layers ?? 1;
      const n = Math.max(6, p.petals ?? 12);
      for (let L = 0; L < layers; L++) {
        const spd = baseSpeed * (1 + L * 0.08);
        for (let i = 0; i < n; i++) {
          const ang = (360 / n) * i + (L * 360 / (n * 2));
          const t = i / n;
          const col = (shape === 'orb') ? color : lightenColor(color, (t - 0.5) * 0.12);
          const ex = { glowIntensity: 0.75, trailLength: 7, rotSpeed: (shape === 'diamond' || shape === 'star') ? 2.6 : 0 };
          spawnBullet(ang, spd, ex, 1.1, col);
        }
      }
    } else if (type === 'burst') {
      const n = Math.max(4, p.count ?? 16);
      for (let i = 0; i < n; i++) {
        const ang = (360 / n) * i + (p.angleCenter ?? 0);
        const t = n === 1 ? 0.5 : (i / (n - 1));
        const ex = { glowIntensity: 0.7, trailLength: 6 };
        spawnBullet(ang, baseSpeed, ex, 1, (shape === 'orb') ? color : lightenColor(color, (t - 0.5) * 0.14));
      }
    } else if (type === 'butterfly') {
      const n = p.count ?? 3;
      for (let i = 0; i < n; i++) {
        const ang = (p.angleCenter ?? 90) + (i - (n - 1) / 2) * (p.angleWidth ?? 20) / Math.max(1, n - 1);
        const ex = { moveType: 'butterfly', glowIntensity: 0.6, trailLength: 8 };
        spawnBullet(ang, baseSpeed, ex);
      }
    } else if (type === 'homing') {
      const n = p.count ?? 1;
      const hspd = (p.homingSpeed ?? (baseSpeed * 1.1));
      for (let i = 0; i < n; i++) {
        const ang = (p.angleCenter ?? 90) + (i - (n - 1) / 2) * (p.angleWidth ?? 16) / Math.max(1, n - 1);
        const ex = { moveType: 'homing', homingSpeed: hspd, glowIntensity: 0.5, trailLength: 5 };
        spawnBullet(ang, baseSpeed * 0.7, ex, 1.05);
      }
    } else if (type === 'laser' || type === 'crossLaser') {
      // Fallback: replace lasers with a dense burst pattern (no beams)
      const n = Math.max(10, p.count ?? 24);
      const angC = (p.angleCenter ?? 90);
      const angW = Math.max(40, p.angleWidth ?? 120);
      for (let i = 0; i < n; i++) {
        const ang = angC + (i - (n - 1) / 2) * angW / Math.max(1, n - 1);
        const ex = { glowIntensity: 0.7, trailLength: 6 };
        spawnBullet(ang, baseSpeed * 1.0, ex);
      }
    } else {
      // default
      spawnBullet(p.angleCenter ?? 90);
    }

    function extraMoveOr(p, def = null) {
      if (p && typeof p.moveType === 'string') return p.moveType;
      return def;
    }
  }

  _updateEnemyBullets(dt) {
    const p = this.player;
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      b.update(dt, p);
      if (!b.active) this.eBullets.splice(i, 1);
    }
  }

  // Collect current homing targets: active enemies + boss (if active)
  _collectHomingTargets() {
    const list = this._homingTargetsCache;
    list.length = 0;
    for (const e of this.enemies) {
      if (e && e.active) list.push(e);
    }
    // Include mid-boss explicitly if active (redundant safety in case it's not in enemies list)
    if (this.midBoss && this.midBoss.active) list.push(this.midBoss);
    if (this.boss && this.boss.active) {
      // Push boss as a target candidate; PHoming uses x/y and optional velocity
      list.push(this.boss);
    }
    return list;
  }

  _handleCollisions() {
    const p = this.player;
    if (!p.alive) return;
    // Enemy bullets vs player
    for (const b of this.eBullets) {
      if (!b.active) continue;
      const r = Math.max(1, p.r || 3);
      const d2 = dist2(b.x, b.y, p.x, p.y);
      const collR = r + b.r;
      if (d2 <= collR * collR) {
        p.damage();
        break;
      }
      // Graze window
      const grR = collR + GRAZE_GAP;
      if (d2 < grR * grR && d2 > collR * collR && (b.gzcool || 0) <= 0) {
        const prog = gsAddGraze();
        this._addScore(5);
        if (prog > 0 && (prog % GRAZE_PER_BOMB_SHARD) === 0) {
          // Grant bomb shard every threshold grazes
          this._spawnItem(p.x + randRange(-6, 6), p.y - 10, 'b');
          addPopup('ボムかけら', p.x, p.y - 22, '#a6e3a1');
        }
        b.gzcool = 0.12;
      }
    }
    // Player shots vs enemies/boss (includes special handling for lasers)
    for (let i = this.pshots.length - 1; i >= 0; i--) {
      const s = this.pshots[i];
      if (!s.active) continue;

      // No player lasers anymore

      // Non-laser shots: discrete hits that consume the shot on hit
      let hit = false;
      for (let j = this.enemies.length - 1; j >= 0 && !hit; j--) {
        const e = this.enemies[j];
        if (!e.active) continue;
        const rr = (e.r || 10) + (s.r || 2);
        if (dist2(e.x, e.y, s.x, s.y) <= rr * rr) {
          const base = s.dmg ?? PLAYER_SHOT_DMG_ENEMY;
          const scale = this._playerDamageScaleTo(e.x, e.y);
          const dmg = base * (DIFF.playerShotDamageMul ?? 1) * scale;
          e.hp -= dmg;
          s.active = false;
          hit = true;
          if (e.hp <= 0) { e.active = false; this._dropFromEnemy(e); }
        }
      }
      if (!hit && this.boss && this.boss.active) {
        const b = this.boss;
        const rr = (b.hitR || b.r || 24) + (s.r || 2);
        if (dist2(b.x, b.y, s.x, s.y) <= rr * rr) {
          const base = s.dmg ?? (b.damagePerHit ?? PLAYER_SHOT_DMG_BOSS_DEFAULT);
          const scale = this._playerDamageScaleTo(b.x, b.y);
          const perHit = base * (DIFF.playerShotDamageMul ?? 1) * scale;
          b.hp -= perHit;
          s.active = false;
          if (b.hp <= 0) b.active = false;
        }
      }
      if (!s.active) this.pshots.splice(i, 1);
    }

    // Enemy beams vs player (only during fire phase)
    for (const L of this.eBeams) {
      if (!L.active || L.phase !== 'fire') continue;
      const w = Math.max(10, L.width || 60);
      const r2 = Math.max(1, p.r || 3);
      if (L.orientation === 'v') {
        const dx = Math.abs(p.x - L.x);
        if (dx <= w * 0.5 + r2) { p.damage(); break; }
      } else {
        const dy = Math.abs(p.y - L.y);
        if (dy <= w * 0.5 + r2) { p.damage(); break; }
      }
    }

    // Player vs items
    const pickR = 10;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (!it.active) continue;
      const rr = pickR + (it.r || 5);
      if (dist2(p.x, p.y, it.x, it.y) <= rr * rr) {
        it.active = false;
        // Remove now
        this.items.splice(i, 1);
        if (it.type === 'p') {
          try { sfxItem(); } catch (_) { }
          const prevPower = p.power;
          p.power = Math.min(4.00, (p.power || 0) + (it.value || 0.01));
          runStats.itemsP++;
          // Popup
          if (it.value >= 1.00) addPopup(`POWER +${it.value.toFixed(2)}!`, it.x, it.y, '#fbbf24');
          else if (it.value >= 0.10) addPopup(`P +${it.value.toFixed(2)}`, it.x, it.y, '#fde047');
          else addPopup(`+${it.value.toFixed(2)}`, it.x, it.y - 10, '#fef3c7');
          // Max power bonus
          if (prevPower < 4.00 && p.power >= 4.00) {
            try { sfxExtend(); } catch (_) { }
            addPopup('FULL POWER!', W / 2, H / 2 - 30, '#fbbf24');
            this._addScore(10000, W / 2, H / 2);
          }
        } else if (it.type === 's') {
          try { sfxItem(); } catch (_) { }
          runStats.itemsS++;
          const scoreVal = p.power >= 4.00 ? 500 : 100;
          this._addScore(scoreVal, it.x, it.y);
        } else if (it.type === 'l') {
          try { sfxShard(); } catch (_) { }
          const n = addLifeShards(1);
          addPopup(`残機かけら ${n}/${LIFE_SHARDS_TO_EXTEND}`, it.x, it.y, '#f38ba8');
          if (n >= LIFE_SHARDS_TO_EXTEND) {
            consumeLifeShards(LIFE_SHARDS_TO_EXTEND);
            p.lives++;
            try { sfxExtend(); } catch (_) { }
            addPopup('エクステンド（かけら）！', W / 2, H / 2, '#f38ba8');
          }
        } else if (it.type === 'b') {
          try { sfxShard(); } catch (_) { }
          const n = addBombShards(1);
          addPopup(`ボムかけら ${n}/${BOMB_SHARDS_TO_BOMB}`, it.x, it.y, '#a6e3a1');
          if (n >= BOMB_SHARDS_TO_BOMB) {
            consumeBombShards(BOMB_SHARDS_TO_BOMB);
            p.bombs++;
            addPopup('ボム +1', p.x, p.y - 24, '#a6e3a1');
          }
        }
      }
    }
  }

  // ---------- Bomb (A: expanding circle) ----------
  _updateBombA(p, dt) {
    const t = p.bombT;
    p.bombT += dt;
    if (!p.isBombing) return;
    const k = Math.min(1, p.bombT / Math.max(0.1, p.bombDur));
    const r = 40 + (200 - 40) * k; // 少し広め
    this._clearBulletsCircle(p.x, p.y, r);
    const dps = 210 * (DIFF.playerShotDamageMul ?? 1);
    this._damageEnemiesCircle(p.x, p.y, r, dps * dt);
  }

  _drawBombA(p, g) {
    if (!p.isBombing) return;
    const t = p.bombT, dur = p.bombDur;
    const k = Math.min(1, t / Math.max(0.1, dur));
    const r = 40 + (200 - 40) * k;
    g.save();
    g.globalAlpha = 0.25;
    g.fillStyle = '#93c5fd';
    g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 0.9;
    g.strokeStyle = '#c7d2fe';
    g.lineWidth = 2;
    g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  // ---------- Bomb (B: vertical laser lane) ----------
  _updateBombB(p, dt) {
    p.bombT += dt;
    if (!p.isBombing) return;
    const center = p.x;
    const w = 80 + 24 * Math.sin(p.bombT * 10); // 少し広め
    const x1 = center - w * 0.5;
    const x2 = center + w * 0.5;
    this._clearBulletsRect(x1, -20, x2, H + 20);
    const dps = 260 * (DIFF.playerShotDamageMul ?? 1);
    this._damageEnemiesRect(x1, -20, x2, H + 20, dps * dt);
  }

  _drawBombB(p, g) {
    if (!p.isBombing) return;
    const center = p.x;
    const w = 80 + 24 * Math.sin(p.bombT * 10);
    g.save();
    const grd = g.createLinearGradient(center, 0, center, H);
    grd.addColorStop(0, 'rgba(255,255,255,0.85)');
    grd.addColorStop(1, 'rgba(147,197,253,0.35)');
    g.fillStyle = grd;
    g.globalAlpha = 0.92;
    g.fillRect(center - w * 0.5, 0, w, H);
    g.globalAlpha = 1;
    g.strokeStyle = '#fde047';
    g.lineWidth = 2;
    g.strokeRect(center - w * 0.5, 0, w, H);
    g.restore();
  }

  // ---------- Bomb helpers ----------
  _clearBulletsCircle(x, y, r) {
    const rr = r * r;
    for (const b of this.eBullets) {
      if (!b.active) continue;
      if (dist2(b.x, b.y, x, y) <= rr) b.active = false;
    }
    // Clear beams overlapped by circle
    for (const L of this.eBeams) {
      if (!L.active) continue;
      const w = Math.max(10, L.width || 60);
      if (L.orientation === 'v') {
        if (Math.abs(L.x - x) <= w * 0.5 + r) L.active = false;
      } else {
        if (Math.abs(L.y - y) <= w * 0.5 + r) L.active = false;
      }
    }
  }
  _clearBulletsRect(x1, y1, x2, y2) {
    const minx = Math.min(x1, x2), maxx = Math.max(x1, x2);
    const miny = Math.min(y1, y2), maxy = Math.max(y1, y2);
    for (const b of this.eBullets) {
      if (!b.active) continue;
      if (b.x >= minx && b.x <= maxx && b.y >= miny && b.y <= maxy) b.active = false;
    }
    for (const L of this.eBeams) {
      if (!L.active) continue;
      const w = Math.max(10, L.width || 60);
      if (L.orientation === 'v') {
        const bx1 = L.x - w * 0.5, bx2 = L.x + w * 0.5;
        if (bx2 >= minx && bx1 <= maxx) L.active = false;
      } else {
        const by1 = L.y - w * 0.5, by2 = L.y + w * 0.5;
        if (by2 >= miny && by1 <= maxy) L.active = false;
      }
    }
  }
  _damageEnemiesCircle(x, y, r, dmg) {
    const rr = r * r;
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (dist2(e.x, e.y, x, y) <= rr) {
        e.hp -= dmg;
        if (e.hp <= 0 && !e._dropped) { e.active = false; this._dropFromEnemy(e); }
      }
    }
    if (this.boss && this.boss.active) {
      if (dist2(this.boss.x, this.boss.y, x, y) <= rr) this.boss.hp -= dmg;
    }
  }
  _damageEnemiesRect(x1, y1, x2, y2, dmg) {
    const minx = Math.min(x1, x2), maxx = Math.max(x1, x2);
    const miny = Math.min(y1, y2), maxy = Math.max(y1, y2);
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e.x >= minx && e.x <= maxx && e.y >= miny && e.y <= maxy) {
        e.hp -= dmg;
        if (e.hp <= 0 && !e._dropped) { e.active = false; this._dropFromEnemy(e); }
      }
    }
    if (this.boss && this.boss.active) {
      if (this.boss.x >= minx && this.boss.x <= maxx && this.boss.y >= miny && this.boss.y <= maxy) this.boss.hp -= dmg;
    }
  }

  // ---------- Items / Score ----------
  _spawnItem(x, y, type, value = 0) {
    const it = new Item();
    it.spawn(x, y, type, value);
    this.items.push(it);
  }

  _spawnPowerItem(x, y, size = 'small') {
    const value = size === 'large' ? 1.00 : size === 'medium' ? 0.10 : 0.01;
    this._spawnItem(x, y, 'p', value);
  }

  _dropFromEnemy(e) {
    if (e._dropped) return; e._dropped = true;
    const r = Math.random();
    if (r < 0.4) {
      this._spawnPowerItem(e.x, e.y, 'small');
    } else if (r < 0.7) {
      this._spawnItem(e.x, e.y, 's');
    } else if (r < 0.85) {
      this._spawnPowerItem(e.x + randRange(-10, 10), e.y, 'medium');
    }
  }

  _addScore(n, px = null, py = null) {
    const { prev, score: cur } = gsAddScore(n, px, py);
    if (px != null && py != null) addPopup(`+${Math.floor(n)}`, px, py, '#a6e3a1');
    if (typeof prev === 'number') {
      let idx = this._nextExtendIdx || 0;
      while (idx < EXTENDS.length && prev < EXTENDS[idx] && cur >= EXTENDS[idx]) {
        this.player.lives++;
        try { sfxExtend(); } catch (_) { }
        addPopup('エクステンド！', W / 2, H / 2, '#fbbf24');
        idx++;
      }
      this._nextExtendIdx = idx;
    }
  }

  _drawBossWarning(g) {
    g.save();
    g.globalAlpha = 0.55;
    g.fillStyle = '#05070d';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
    g.fillStyle = '#ffec27';
    g.font = 'bold 40px "Trebuchet MS", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ボス接近中…', W / 2, H / 2 - 36);
    const remain = Math.max(0, this._bossWarningCountdown || 0);
    g.font = '28px "Trebuchet MS", system-ui, sans-serif';
    g.fillStyle = '#cdd6f4';
    g.fillText(`あと ${remain.toFixed(1)} 秒`, W / 2, H / 2 + 4);
    g.font = '18px system-ui, sans-serif';
    g.fillStyle = '#94e2d5';
    g.fillText('パワーアイテムを回収して備えよう', W / 2, H / 2 + 44);
    g.restore();
  }

  _drawSpellHud(g) {
    const b = this.boss;
    if (!b || !b.active || !b.useSpells) return;
    const name = b.spellName || 'スペル';
    const tLeft = Math.max(0, Math.ceil(b.spellTimeLeft || 0));
    const tAll = Math.max(1, Math.ceil(b.spellTime || (b.spellTimeLeft || 1)));
    const bonus = Math.max(0, Math.floor(b.spellBonus || 0));
    const x = 16, y = 10, w = W - 32, h = 44;
    g.save();
    g.globalAlpha = 0.85;
    g.fillStyle = '#0b1220';
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#384258';
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
    g.fillStyle = '#cdd6f4';
    g.font = 'bold 14px ui-sans-serif, system-ui';
    g.fillText(name, x + 10, y + 18);
    g.font = '12px ui-sans-serif, system-ui';
    g.fillStyle = '#8c8fa1';
    g.fillText(`残り ${tLeft}s  Bonus ${bonus.toLocaleString('en-US')}`, x + 10, y + 34);
    // time bar
    const pad = 8;
    const bw = w * 0.35;
    const bx = x + w - pad - bw;
    const by = y + 12;
    const bh = 20;
    g.strokeStyle = '#3a4263';
    g.strokeRect(bx, by, bw, bh);
    const ratio = Math.max(0, Math.min(1, (b.spellTimeLeft || 0) / (b.spellTime || (b.spellTimeLeft || 1))));
    g.fillStyle = '#93c5fd';
    g.fillRect(bx, by, Math.floor(bw * ratio), bh);
    g.restore();
  }

  _drawCyberGrid(g) {
    if (!THEME?.retro || THEME?.palette !== 'cyber') return;
    const t = (this.time || 0);
    g.save();
    g.globalAlpha = 0.08;
    g.strokeStyle = '#29adff';
    const step = 24;
    const off = (t * 12) % step;
    g.beginPath();
    for (let x = -off; x < W + step; x += step) {
      g.moveTo(x, 0);
      g.lineTo(x, H);
    }
    for (let y = -off; y < H + step; y += step) {
      g.moveTo(0, y);
      g.lineTo(W, y);
    }
    g.stroke();
    g.restore();
  }

  _onPlayerLifeLost() {
    // Count death (bullets remain to keep tension)
    try { runStats.deaths++; } catch (_) {}
    // Game over if lives dropped below 0
    if (this.player.lives < 0) {
      this.player.lives = 0;
      this.state = 'gameover';
      this.$btnPause?.classList.add('muted');
      if (this.hud) this.hud.textContent = 'ゲームオーバー ▶ 開始 で再挑戦';
      this.bgmStop(0.8);
    }
  }
}
