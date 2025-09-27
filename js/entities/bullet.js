import { W, H } from '../config.js';

export class Bullet {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.r = 3;
    this.color = "#7dd3fc";
    this.t = 0;
    this.maxT = 12;
    this.shape = 'circle';
    this.gzcool = 0;
    // Extended properties for advanced patterns
    this.ax = 0;
    this.ay = 0;
    this.moveType = 'linear';
    this.homingT = 0;
    this.homingSpeed = 0;
    this.curveStrength = 0;
    this.curveDir = 1;
    this.trailLength = 0;
    this.trail = [];
    this.glowIntensity = 0;
    this.rotSpeed = 0;
    this.angle = 0;
  }

  spawn(x, y, vx, vy, r = 5, color = "#7dd3fc", life = 15, shape = 'circle', extra = {}) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.r = r;
    this.color = color;
    this.t = 0;
    this.maxT = life;
    this.shape = shape;
    // Apply extra properties
    this.moveType = extra.moveType || 'linear';
    this.ax = extra.ax || 0;
    this.ay = extra.ay || 0;
    this.homingSpeed = extra.homingSpeed || 0;
    this.curveStrength = extra.curveStrength || 0;
    this.curveDir = extra.curveDir || 1;
    this.trailLength = extra.trailLength || 0;
    this.glowIntensity = extra.glowIntensity || 0;
    this.rotSpeed = extra.rotSpeed || 0;
    this.angle = extra.angle || 0;
    this.trail = [];
  }

  update(dt, player) {
    if (!this.active) return;
    this.t += dt;
    this.gzcool = Math.max(0, this.gzcool - dt);

    // Store trail positions
    if (this.trailLength > 0 && this.t > 0.02) {
      this.trail.push({ x: this.x, y: this.y, a: Math.min(1, this.t * 2) });
      if (this.trail.length > this.trailLength) this.trail.shift();
    }

    // Movement patterns
    if (this.moveType === 'curve') {
      const curve = Math.sin(this.t * 3) * this.curveStrength * this.curveDir;
      this.vx += curve * dt * 100;
    } else if (this.moveType === 'butterfly') {
      const bt = this.t * 4;
      this.vx += Math.sin(bt) * 150 * dt;
      this.vy += Math.cos(bt * 0.7) * 50 * dt;
    } else if (this.moveType === 'homing' && this.homingT < 1.5) {
      this.homingT += dt;
      if (player && player.alive) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const homing = this.homingSpeed * (1 - this.homingT / 1.5);
        this.vx += (dx / d) * homing * dt;
        this.vy += (dy / d) * homing * dt;
      }
    }

    // Apply acceleration
    this.vx += this.ax * dt;
    this.vy += this.ay * dt;

    // Update position
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.rotSpeed * dt;

    // Deactivate if out of bounds or expired
    if (this.t > this.maxT || this.x < -40 || this.x > W + 40 || this.y < -40 || this.y > H + 40) {
      this.active = false;
    }
  }

  draw(g, time) {
    if (!this.active) return;
    const r = this.r;
    const x = this.x, y = this.y;
    const a = this.angle || Math.atan2(this.vy, this.vx);

    // Draw trail
    if (this.trail.length > 0) {
      g.save();
      for (let i = 0; i < this.trail.length; i++) {
        const tp = this.trail[i];
        const alpha = (i / this.trail.length) * 0.3 * tp.a;
        g.globalAlpha = alpha;
        g.fillStyle = this.color;
        g.beginPath();
        g.arc(tp.x, tp.y, r * (i / this.trail.length) * 0.7, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    // Draw glow effect
    if (this.glowIntensity > 0) {
      g.save();
      g.shadowBlur = r * 2 * this.glowIntensity;
      g.shadowColor = this.color;
    }

    g.save();
    g.translate(x, y);
    if (this.shape === 'circle') {
      g.beginPath();
      g.fillStyle = this.color;
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
    } else if (this.shape === 'ring') {
      g.beginPath();
      g.strokeStyle = this.color;
      g.lineWidth = Math.max(1.5, r * 0.4);
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.stroke();
    } else if (this.shape === 'diamond') {
      g.rotate(a);
      g.beginPath();
      g.fillStyle = this.color;
      g.moveTo(0, -r * 1.3);
      g.lineTo(r * 0.9, 0);
      g.lineTo(0, r * 1.3);
      g.lineTo(-r * 0.9, 0);
      g.closePath();
      g.fill();
    } else if (this.shape === 'arrow') {
      g.rotate(a);
      g.beginPath();
      g.fillStyle = this.color;
      const L = r * 2, W = r;
      g.moveTo(L * 0.7, 0);
      g.lineTo(-L * 0.3, -W * 0.7);
      g.lineTo(-L * 0.1, 0);
      g.lineTo(-L * 0.3, W * 0.7);
      g.closePath();
      g.fill();
    } else if (this.shape === 'star') {
      g.rotate(this.t * 4 + a);
      g.beginPath();
      g.fillStyle = this.color;
      const pts = 5, R = r * 1.1, r2 = r * 0.5;
      for (let i = 0; i < pts * 2; i++) {
        const ang = i * Math.PI / pts;
        const rr = (i % 2 === 0) ? R : r2;
        const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
    } else if (this.shape === 'heart') {
      g.rotate(a);
      g.beginPath();
      g.fillStyle = this.color;
      const s = r / 5;
      g.moveTo(0, -2.5 * s);
      g.bezierCurveTo(2.5 * s, -5 * s, 6 * s, -1 * s, 0, 5.5 * s);
      g.bezierCurveTo(-6 * s, -1 * s, -2.5 * s, -5 * s, 0, -2.5 * s);
      g.fill();
    } else if (this.shape === 'butterfly') {
      g.rotate(a + Math.sin(this.t * 6) * 0.3);
      g.beginPath();
      g.fillStyle = this.color;
      const w = r;
      g.moveTo(0, 0);
      g.bezierCurveTo(w, -w, w * 1.5, -w * 0.5, w, 0);
      g.bezierCurveTo(w * 1.5, w * 0.5, w, w, 0, 0);
      g.bezierCurveTo(-w, w, -w * 1.5, w * 0.5, -w, 0);
      g.bezierCurveTo(-w * 1.5, -w * 0.5, -w, -w, 0, 0);
      g.fill();
    } else if (this.shape === 'orb') {
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grd.addColorStop(0, this.color);
      grd.addColorStop(0.5, this.color + 'cc');
      grd.addColorStop(1, this.color + '33');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(0, 0, r * 1.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.globalAlpha = 0.8;
      g.beginPath();
      g.arc(-r * 0.3, -r * 0.3, r * 0.2, 0, Math.PI * 2);
      g.fill();
    } else {
      g.beginPath();
      g.fillStyle = this.color;
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    if (this.glowIntensity > 0) g.restore();
  }
}

export class PShot {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = -520;
    this.r = 3;
    this.color = "#ffd1dc";
    this.dmg = null;
    this.kind = 'main';
  }

  spawn(x, y, vx = 0, vy = -520, dmg = null, r = 3, color = "#ffd1dc", kind = 'main') {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.dmg = dmg;
    this.r = r;
    this.color = color;
    this.kind = kind || 'main';
  }

  update(dt) {
    if (!this.active) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -20) this.active = false;
  }

  draw(g) {
    if (!this.active) return;
    g.save();
    g.globalAlpha = 0.68;
    g.beginPath();
    g.fillStyle = this.color;
    g.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
}

// Homing player shot
export class PHoming extends PShot {
  constructor() {
    super();
    this.kind = 'homing';
    this.turn = 4.0; // rad/s, overridden by config
    this.speed = 400;
  }
  spawn(x, y, speed, turn, dmg, r = 3, color = "#bdeeff") {
    const ang = -Math.PI / 2;
    const vx = Math.cos(ang) * speed;
    const vy = Math.sin(ang) * speed;
    super.spawn(x, y, vx, vy, dmg, r, color, 'homing');
    this.speed = speed;
    this.turn = turn;
  }
  update(dt, enemies) {
    if (!this.active) return;
    // steer toward nearest enemy (with light prediction)
    let tx = null, ty = null, best = Infinity, tvx = 0, tvy = 0;
    if (Array.isArray(enemies)) {
      for (const e of enemies) {
        if (!e || !e.active) continue;
        const dx = e.x - this.x, dy = e.y - this.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < best) {
          best = d2; tx = e.x; ty = e.y; tvx = e.vx || 0; tvy = e.vy || 0;
        }
      }
    }
    // Fallback: if no target found in array, try boss or mid-boss from global game instance
    if (tx == null) {
      try {
        const g = (typeof window !== 'undefined' && window.game) ? window.game : null;
        const boss = g && g.boss;
        const mid = g && g.midBoss;
        if (mid && mid.active) { tx = mid.x; ty = mid.y; tvx = mid.vx || 0; tvy = mid.vy || 0; }
        else if (boss && boss.active) { tx = boss.x; ty = boss.y; tvx = boss.vx || 0; tvy = boss.vy || 0; }
      } catch (_) { /* ignore */ }
    }
    if (tx != null) {
      const angCur = Math.atan2(this.vy, this.vx);
      // simple lead prediction based on relative distance and own speed
      const d = Math.hypot((tx - this.x), (ty - this.y));
      const lead = Math.min(0.25, d / Math.max(120, this.speed * 2));
      const px = tx + tvx * lead;
      const py = ty + tvy * lead;
      const angDes = Math.atan2(py - this.y, px - this.x);
      let diff = angDes - angCur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = this.turn * dt;
      const angNew = angCur + Math.max(-maxTurn, Math.min(maxTurn, diff));
      this.vx = Math.cos(angNew) * this.speed;
      this.vy = Math.sin(angNew) * this.speed;
    }
    super.update(dt);
  }
}

// Thin vertical laser (short-lived, piercing)
// Player laser removed
