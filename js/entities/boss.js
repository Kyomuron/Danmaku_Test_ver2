import { Enemy } from './enemy.js';
import { W, PLAYER_SHOT_DMG_BOSS_DEFAULT, BOSS_PATROL_SPEED_SCALE, BOSS_PATROL_EDGE_PAUSE, BOSS_PATROL_VARIANTS } from '../config.js';
import { getImage } from './dialogue.js';
import { DIFF, DIFF_STAGE, getStageNumInt, stageDropCount } from '../game-state.js';
import { randRange, clamp } from '../utils.js';
import { 
  sfxSpellDecl, sfxSpellCapture, sfxSpellFail 
} from '../audio.js';

export class Boss extends Enemy {
  constructor() {
    super();
    this.isBoss = true;
    this.r = 28;
    this.hitR = this.r;
    this.color = "#f38ba8";
    this.maxHp = 1500;
    this.damagePerHit = PLAYER_SHOT_DMG_BOSS_DEFAULT;
    this.patterns = [];
    this.phase = 0;
    this.phaseT = 0;
    this.switchEvery = 8;
    this.duration = 9999;
    // Sprite drawing (battle)
    this.spriteUrl = null;
    this.spriteDamagedUrl = null;
    this._spriteImg = null;
    this._spriteDamagedImg = null;
    this.spriteScale = 0.4; // scale factor for drawing (battle)
    // Patrol movement
    this.patrolActive = false;
    this.patrolLeft = 60;
    this.patrolRight = Math.max(120, W - 60);
    this.patrolAmpX = 160;
    this.patrolSpeed = 120;
    this.patrolDir = 1;
    this.anchorY = 140;
    this.hoverAmp = 8;
    this.hoverSpeed = 1.2;
    this.patrolPauseT = 0;
    // Spells
    this.useSpells = false;
    this.spells = [];
    this.spellIndex = 0;
    this.baseConf = null;
    this.spellTime = 0;
    this.spellTimeLeft = 0;
    this.spellName = '';
    this.spellBonus = 0;
    this.spellBroken = false;
    this.declareT = 0;
    this.spellGlobalIndex = null;
    this.spellStageIndex = null;
    this.spellDisplayIndex = null;
    this.recovering = false;
    this.recoverT = 0;
    this.recoverDur = 0;
    this.recoverStartHp = 0;
    this.recoverTargetHp = 0;
    this.pendingSpell = null;
    this.spellPrepName = '';
    this.spellResultTimer = 0;
    this.spellResultSuccess = false;
    this.spellResultText = '';
    this.patrolDriftAmp = 0;
    this.patrolDriftSpeed = 0;
    this.patrolDriftPhase = 0;
    this.completedSpells = [];
    this.spellIntroT = 0;
    this.spellIntroGrace = 0;
  }

  spawn(conf) {
    super.spawn(conf);
    this.baseConf = conf;
    this.damagePerHit = conf.damagePerHit ?? PLAYER_SHOT_DMG_BOSS_DEFAULT;
    this.completedSpells = [];
    this.spellIntroT = 0;
    this.spellIntroGrace = 0;
    // Sprite URLs (may be provided by game.js)
    this.spriteUrl = conf.sprite || null;
    this.spriteDamagedUrl = conf.spriteDamaged || null;
    this._spriteImg = this.spriteUrl ? getImage(this.spriteUrl) : null;
    this._spriteDamagedImg = this.spriteDamagedUrl ? getImage(this.spriteDamagedUrl) : null;
    
    if (Array.isArray(conf.spells) && conf.spells.length > 0) {
      this.useSpells = true;
      this.spells = conf.spells.slice();
      this.spellIndex = 0;
      this._loadSpell(this.spells[this.spellIndex]);
    } else {
      this.useSpells = false;
      this.maxHp = conf.hp ?? 1500;
      this.hp = this.maxHp;
      this.patterns = Array.isArray(conf.patterns) && conf.patterns.length > 0
        ? conf.patterns
        : (conf.pattern ? [conf.pattern] : []);
      this.emitters.length = 0;
      this.phase = 0;
      this.phaseT = 0;
      this.switchEvery = conf.switchEvery ?? 8;
      if (this.patterns[0]) this.addEmitter(this.patterns[0]);
    }
    
    // Apply patrol config
    this.applyPatrolConfig(conf.patrol);
  }

  applyPatrolConfig(patrol) {
    const s = getStageNumInt();
    const variant = BOSS_PATROL_VARIANTS?.[String(s)] || null;
    const defAmpX = variant?.ampX ?? Math.min(220, 110 + (s - 1) * 18);
    const defSpeedX = (variant?.speedMul ?? 0.7) * Math.min(130, 80 + (s - 1) * 5);
    const defAmpY = variant?.hoverAmp ?? Math.min(24, 8 + (s - 1) * 3);
    const defSpeedY = variant?.hoverSpeed ?? Math.min(2.0, 1.0 + (s - 1) * 0.1);
    const defDriftAmp = variant?.driftAmp ?? Math.min(60, 20 + (s - 1) * 8);
    const defDriftSpeed = variant?.driftSpeed ?? (0.45 + (s - 1) * 0.05);
    const p = patrol || {};
    this.patrolAmpX = (typeof p.ampX === 'number') ? p.ampX : defAmpX;
    this.patrolSpeed = ((typeof p.speedX === 'number') ? p.speedX : defSpeedX) * (BOSS_PATROL_SPEED_SCALE || 1);
    this.hoverAmp = (typeof p.ampY === 'number') ? p.ampY : defAmpY;
    this.hoverSpeed = (typeof p.speedY === 'number') ? p.speedY : defSpeedY;
    this.patrolDriftAmp = (typeof p.driftAmp === 'number') ? p.driftAmp : defDriftAmp;
    this.patrolDriftSpeed = Math.max(0, (typeof p.driftSpeed === 'number') ? p.driftSpeed : defDriftSpeed);
    this.patrolDriftPhase = 0;
  }

  _loadSpell(sp) {
    this.emitters.length = 0;
    this.phase = 0;
    this.phaseT = 0;
    this.switchEvery = sp.switchEvery ?? (this.baseConf?.switchEvery ?? 8);
    this.maxHp = sp.hp ?? (this.baseConf?.hp ?? 1500);
    this.hp = this.maxHp;
    const pats = Array.isArray(sp.patterns) && sp.patterns.length > 0 
      ? sp.patterns 
      : (sp.pattern ? [sp.pattern] : []);
    this.patterns = pats.map(q => ({ ...q }));
    for (const q of this.patterns) {
      if (typeof q.backfire === 'undefined') q.backfire = true;
    }
    if (this.patterns[0]) this.addEmitter(this.patterns[0]);
    this.damagePerHit = sp.damagePerHit ?? (this.baseConf?.damagePerHit ?? PLAYER_SHOT_DMG_BOSS_DEFAULT);
    this.spellTime = Math.max(5, sp.time ?? 30);
    this.spellTimeLeft = this.spellTime;
    this.spellName = sp.name ?? `スペル ${this.spellIndex + 1}`;
    this.spellGlobalIndex = sp._globalIndex ?? null;
    this.spellStageIndex = sp._stageIndex ?? null;
    this.spellDisplayIndex = sp._autoIndex ?? this.spellStageIndex ?? this.spellGlobalIndex ?? null;
    this.spellPrepName = '';
    this.recovering = false;
    this.pendingSpell = null;
    this.recoverT = 0;
    this.recoverDur = 0;
    this.spellResultTimer = 0;
    this.spellResultText = '';
    this.spellBonus = Math.max(0, sp.bonus ?? 100000);
    this.spellBroken = false;
    this.declareT = 0;
    const introBase = this.baseConf?.spellIntroTime;
    const introGraceBase = this.baseConf?.spellIntroGrace;
    const introTime = Math.max(0, sp.introTime ?? introBase ?? 0.7);
    const introGrace = Math.max(0, sp.introGrace ?? introGraceBase ?? 0.35);
    this.spellIntroT = introTime;
    this.spellIntroGrace = introGrace;
    this.inv = Math.max(this.inv ?? 0, introTime + introGrace);
    sfxSpellDecl();
    
    // Add ambient emitter
    const amb = this.baseConf?.ambient;
    const s = getStageNumInt();
    const ambientEnabled = amb ? (amb.enabled !== false) : true;
    if (ambientEnabled) {
      const type = amb?.type || 'burst';
      const every = amb?.every ?? Math.max(0.35, 0.7 - (s - 1) * 0.05);
      const count = amb?.count ?? Math.min(24, 10 + (s - 1) * 3);
      const spd = amb?.speed ?? Math.min(220, 140 + (s - 1) * 10);
      const clr = amb?.color ?? '#93c5fd';
      const sh = amb?.shape ?? 'orb';
      const pat = { 
        type, every, count, speed: spd, 
        bullet: { shape: sh, r: 2.8, color: clr }, 
        angleCenter: 90, angleWidth: 180 
      };
      this.addEmitter(pat);
    }
  }

  _beginSpellRecovery(nextSpell) {
    if (!nextSpell) {
      this.recovering = false;
      this.pendingSpell = null;
      return;
    }
    const baseRec = this.baseConf?.spellRecovery || {};
    const recConf = nextSpell.recovery || baseRec;
    this.recoverDur = Math.max(0.12, recConf.duration ?? 1.2);
    this.recoverT = 0;
    this.recoverStartHp = Math.max(0, this.hp);
    const fallbackHp = nextSpell.hp ?? this.baseConf?.hp ?? this.maxHp ?? 1500;
    const targetHp = Math.max(1, fallbackHp);
    this.recoverTargetHp = targetHp;
    this.maxHp = targetHp;
    this.hp = this.recoverStartHp;
    this.recovering = true;
    this.pendingSpell = nextSpell;
    this.spellPrepName = nextSpell.name ?? '';
    this.spellTime = 0;
    this.spellTimeLeft = 0;
    this.spellName = this.spellName || '';
    this.emitters.length = 0;
    this.inv = Math.max(this.inv ?? 0, this.recoverDur + 0.4);
    this.spellResultTimer = Math.max(0, this.spellResultTimer);
  }

  _advanceSpell(success = true) {
    if (!this.useSpells) {
      this.active = false;
      return;
    }
    
    // Clear bullets handled by game
    
    const prevName = this.spellName;
    const effectiveSuccess = success && !this.spellBroken;
    const finishedStageIdx = this.spellStageIndex ?? (this.spellIndex + 1);
    this.completedSpells ||= [];
    if (finishedStageIdx != null) {
      this.completedSpells.push({ index: finishedStageIdx, success: !!effectiveSuccess });
    }
    if (effectiveSuccess) {
      sfxSpellCapture();
    } else {
      sfxSpellFail();
    }
    this.spellResultSuccess = effectiveSuccess;
    this.spellResultText = effectiveSuccess ? `${prevName || 'スペル'} 取得！` : `${prevName || 'スペル'} 失敗…`;
    this.spellResultTimer = 2.8;
    
    this.spellIndex++;
    if (this.spellIndex < this.spells.length) {
      const next = this.spells[this.spellIndex];
      this._beginSpellRecovery(next);
    } else {
      this.active = false;
    }
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    if (this.spellResultTimer > 0) {
      this.spellResultTimer = Math.max(0, this.spellResultTimer - dt);
    }

    if (this.inv && this.inv > 0) {
      this.inv = Math.max(0, this.inv - dt);
    }

    if (this.spellIntroT > 0) {
      this.spellIntroT = Math.max(0, this.spellIntroT - dt);
    }

    if (this.recovering) {
      const dur = Math.max(0.05, this.recoverDur || 0.05);
      this.recoverT += dt;
      const raw = Math.min(1, this.recoverT / dur);
      const eased = 1 - Math.pow(1 - raw, 2.2);
      const nextHp = this.recoverStartHp + (this.recoverTargetHp - this.recoverStartHp) * eased;
      this.hp = Math.min(this.recoverTargetHp, nextHp);
      this.maxHp = Math.max(this.maxHp, this.recoverTargetHp);
      this.inv = Math.max(this.inv ?? 0, 0.2);
      if (raw >= 1 - 1e-4) {
        const pending = this.pendingSpell;
        this.recovering = false;
        this.pendingSpell = null;
        this.recoverT = 0;
        this.recoverDur = 0;
        this._loadSpell(pending);
      }
      return;
    }
    
    // Path movement
    if (this.path) {
      const p = this.path;
      if (p.type === 'line') {
        this.x += (p.vx ?? 0) * dt;
        this.y += (p.vy ?? 40) * dt;
      } else if (p.type === 'easeInOut' && p.to) {
        const T = Math.max(0.0001, p.t || 2.0);
        const u = clamp(this.t / T, 0, 1);
        const s = u * u * (3 - 2 * u);
        const xFrom = this.x0 ?? (this.x0 = this.x);
        const yFrom = this.y0 ?? (this.y0 = this.y);
        const xTo = p.to.x, yTo = p.to.y;
        const tx = xFrom * (1 - s) + xTo * s;
        const ty = yFrom * (1 - s) + yTo * s;
        this.x = tx;
        this.y = ty;
        
        if (u >= 1 && !this.patrolActive) {
          const margin = 48;
          const ampX = Math.max(40, this.patrolAmpX || 160);
          this.patrolLeft = clamp(xTo - ampX, margin, W - margin - 40);
          this.patrolRight = clamp(xTo + ampX, this.patrolLeft + 40, W - margin);
          this.anchorY = yTo;
          this.x = clamp(this.x, this.patrolLeft, this.patrolRight);
          this.patrolDir = (this.x - this.patrolLeft) < (this.patrolRight - this.x) ? 1 : -1;
          this.patrolActive = true;
          this.path = null;
        }
      }
    }
    
    // Patrol movement
    if (this.patrolActive) {
      if (this.patrolPauseT > 0) {
        this.patrolPauseT = Math.max(0, this.patrolPauseT - dt);
      } else {
        this.x += (this.patrolSpeed || 0) * this.patrolDir * dt;
        if (this.x <= this.patrolLeft) {
          this.x = this.patrolLeft;
          this.patrolDir = 1;
          this.patrolPauseT = BOSS_PATROL_EDGE_PAUSE || 2.0;
        }
        if (this.x >= this.patrolRight) {
          this.x = this.patrolRight;
          this.patrolDir = -1;
          this.patrolPauseT = BOSS_PATROL_EDGE_PAUSE || 2.0;
        }
      }
      const amp = this.hoverAmp || 0;
      const sp = this.hoverSpeed || 1.0;
      if (this.patrolDriftSpeed > 0 && this.patrolDriftAmp !== 0) {
        this.patrolDriftPhase = (this.patrolDriftPhase || 0) + dt * this.patrolDriftSpeed;
      }
      const drift = (this.patrolDriftAmp || 0) * Math.sin(this.patrolDriftPhase || 0);
      if (amp > 0) {
        this.y = this.anchorY + drift + Math.sin(this.t * sp) * amp;
      } else {
        this.y = this.anchorY + drift;
      }
    }
    
    this.phaseT += dt;
    if (this.switchEvery && this.patterns.length > 1 && this.phaseT >= this.switchEvery) {
      this.phaseT = 0;
      this.phase = (this.phase + 1) % this.patterns.length;
      this.emitters.length = 0;
      this.addEmitter(this.patterns[this.phase]);
    }
    
    // Emitters updated by game
    
    if (this.useSpells) {
      this.declareT += dt;
      this.spellTimeLeft = Math.max(0, this.spellTimeLeft - dt);
      if (this.spellTimeLeft <= 0) {
        this._advanceSpell(false);
        return;
      }
      if (this.hp <= 0) {
        this._advanceSpell(true);
        return;
      }
    } else {
      if (this.hp <= 0) this.active = false;
    }
  }

  draw(g) {
    // Battle sprite: always use normal sprite; damaged variant is used in dialogue only
    let drawn = false;
    try {
      const img = (this._spriteImg && this._spriteImg.complete) ? this._spriteImg : null;
      if (img) {
        const iw = img.naturalWidth || img.width || 0;
        const ih = img.naturalHeight || img.height || 0;
        if (iw > 0 && ih > 0) {
          const scale = this.spriteScale || 0.4;
          const dw = Math.max(24, Math.floor(iw * scale));
          const dh = Math.max(24, Math.floor(ih * scale));
          g.save();
          g.globalAlpha = 0.95;
          g.drawImage(img, Math.floor(this.x - dw / 2), Math.floor(this.y - dh / 2), dw, dh);
          g.restore();
          drawn = true;
        }
      }
    } catch (_) { /* ignore draw errors */ }
    if (!drawn) super.draw(g);
    if (this.recovering) {
      g.save();
      const pulse = 0.4 + 0.6 * Math.sin((this.recoverT || 0) * Math.PI);
      g.globalAlpha = 0.35 + pulse * 0.3;
      g.fillStyle = '#50f2c1';
      g.beginPath();
      g.arc(this.x, this.y, (this.r || 28) + 16, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
}
