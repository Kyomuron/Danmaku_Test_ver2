import { 
  W, H, PLAYER_SPEED, PLAYER_HIT_R_FAST, PLAYER_HIT_R_SLOW,
  PLAYER_SPRITE_R, FOCUS_SPEED_MULT, SHOT_INTERVAL, SHOT_SPEED,
  INVULN_TIME, PLAYER_SHOT_DMG_ENEMY
} from '../config.js';
import { clamp } from '../utils.js';
import { isKeyPressed } from '../input.js';
import { DIFF, ship } from '../game-state.js';
import { sfxHit } from '../audio.js';

export class Player {
  constructor() {
    this.x = W / 2;
    this.y = H - 80;
    this.r = PLAYER_HIT_R_FAST;
    this.color = "#f2cdcd";
    this.power = 1.00;
    this.lives = 3;
    this.bombs = 2;
    this.inv = 0;
    this.shotCd = 0;
    this.alive = true;
    this.focus = false;
    this.spriteR = PLAYER_SPRITE_R;
    this.isBombing = false;
    this.bombT = 0;
    this.bombDur = 0;
    this.ship = 'A';
    this.hitPending = false;
    this.deathBombT = 0;
  }

  reset() {
    this.x = W / 2;
    this.y = H - 80;
    this.inv = 0;
    this.shotCd = 0;
    this.alive = true;
    this.lives = DIFF.playerLives ?? 3;
    this.bombs = DIFF.playerBombs ?? 2;
    this.power = 1.00;
    this.isBombing = false;
    this.bombT = 0;
    this.bombDur = 0;
    this.ship = ship;
    this.hitPending = false;
    this.deathBombT = 0;
  }

  update(dt, shootCallback) {
    if (!this.alive) return;
    
    this.focus = isKeyPressed('shift');
    const sp = PLAYER_SPEED * (this.focus ? FOCUS_SPEED_MULT : 1);
    
    let dx = (isKeyPressed('arrowright') ? 1 : 0) - (isKeyPressed('arrowleft') ? 1 : 0);
    let dy = (isKeyPressed('arrowdown') ? 1 : 0) - (isKeyPressed('arrowup') ? 1 : 0);
    
    if (dx && dy) {
      const k = 1 / Math.sqrt(2);
      dx *= k;
      dy *= k;
    }
    
    this.x = clamp(this.x + dx * sp * dt, 10, W - 10);
    this.y = clamp(this.y + dy * sp * dt, 20, H - 20);
    
    this.r = this.focus ? PLAYER_HIT_R_SLOW : PLAYER_HIT_R_FAST;
    this.inv = Math.max(0, this.inv - dt);
    this.shotCd = Math.max(0, this.shotCd - dt);
    
    if (isKeyPressed('z') && this.shotCd <= 0) {
      if (shootCallback) shootCallback(this);
      this.shotCd = SHOT_INTERVAL * (DIFF.playerShotIntervalMul ?? 1);
    }
    
    if (this.isBombing) {
      this.bombT += dt;
      if (this.bombT >= this.bombDur) {
        this.isBombing = false;
      }
    }
    
    if (this.hitPending) {
      this.deathBombT = Math.max(0, this.deathBombT - dt);
      if (this.deathBombT <= 0) {
        this.commitPendingDeath();
      }
    }
  }

  commitPendingDeath() {
    if (!this.hitPending) return;
    this.hitPending = false;
    this.deathBombT = 0;
    this.lives--;
    this.inv = INVULN_TIME * (DIFF.playerInvulnMul ?? 1);
    // Death callback handled by game
  }

  draw(g, time) {
    const t = time || 0;
    const invBlink = this.inv > 0 ? (0.5 + 0.5 * Math.sin(t * 20)) : 1;
    g.save();
    g.globalAlpha = Math.max(0.25, invBlink);
    g.beginPath();
    g.fillStyle = this.inv > 0 ? "#ffffff" : "#f2cdcd";
    g.arc(this.x, this.y, this.spriteR, 0, Math.PI * 2);
    g.fill();
    g.restore();
    
    if (this.focus) {
      const pulse = 0.6 + 0.4 * Math.sin((time || 0) * 8);
      g.save();
      g.shadowBlur = 12;
      g.shadowColor = '#ffffff';
      g.globalAlpha = 0.7 * pulse;
      g.beginPath();
      g.fillStyle = '#ffffff';
      g.arc(this.x, this.y, Math.max(1.5, PLAYER_HIT_R_SLOW * 0.7), 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.9;
      g.beginPath();
      g.strokeStyle = '#f2cdcd';
      g.lineWidth = 1.5;
      g.arc(this.x, this.y, PLAYER_HIT_R_SLOW, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    
    g.globalAlpha = .5;
    g.beginPath();
    g.strokeStyle = "#f2cdcd";
    g.lineWidth = 2;
    g.arc(this.x, this.y, 10, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }

  useBomb(bombStartCallback) {
    if (!this.alive) return;
    if (this.isBombing) return;
    if (this.bombs <= 0) return;
    this.bombs--;
    if (this.hitPending) {
      this.hitPending = false;
      this.deathBombT = 0;
    }
    if (bombStartCallback) bombStartCallback(this);
  }

  damage() {
    sfxHit();
    if (this.inv > 0) return;
    if (this.hitPending) return;
    this.hitPending = true;
    this.deathBombT = DIFF.deathbombWindow ?? 0.18;
    this.inv = Math.max(this.inv, this.deathBombT);
  }
}
