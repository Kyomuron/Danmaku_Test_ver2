import { W, H } from '../config.js';
import { randRange } from '../utils.js';
import { DIFF, DIFF_STAGE } from '../game-state.js';

export class Enemy {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.r = 12;
    this.color = "#a6e3a1";
    this.hp = 30;
    this.t = 0;
    this.duration = 10;
    this.emitters = [];
    this.path = null;
    this.x0 = null;
    this.y0 = null;
    this._dropped = false;
  }

  spawn(conf) {
    this.active = true;
    this.x = conf.spawn.x;
    this.y = conf.spawn.y;
    this.vx = conf.path?.vx ?? 0;
    this.vy = conf.path?.vy ?? 60;
    this.hp = conf.hp ?? 30;
    this.t = 0;
    this.duration = conf.duration ?? 8;
    this.emitters.length = 0;
    this.path = conf.path ?? null;
    this.x0 = null;
    this.y0 = null;
    this._dropped = false;
    if (conf.pattern) this.addEmitter(conf.pattern);
  }

  addEmitter(pat) {
    // Emitter will be created by game
    this.emitters.push({ pattern: pat });
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    
    if (this.path) {
      const p = this.path;
      if (p.type === 'line') {
        this.x += (p.vx ?? 0) * dt;
        this.y += (p.vy ?? 60) * dt;
      } else if (p.type === 'easeInOut' && p.to) {
        const T = Math.max(0.0001, p.t || 2.0);
        const u = Math.min(1, this.t / T);
        const s = u * u * (3 - 2 * u);
        this.x0 = this.x0 ?? this.x;
        this.y0 = this.y0 ?? this.y;
        this.x = this.x0 * (1 - s) + p.to.x * s;
        this.y = this.y0 * (1 - s) + p.to.y * s;
      }
    } else {
      this.y += this.vy * dt;
    }
    
    // Emitters updated by game
    
    if (this.t > this.duration || this.y > H + 30 || this.hp <= 0) {
      this.active = false;
    }
  }

  draw(g) {
    if (!this.active) return;
    g.fillStyle = this.color;
    g.beginPath();
    g.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    g.fill();
  }
}