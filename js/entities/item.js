import { W, H, THEME, ACTIVE_PALETTE } from '../config.js';
import { randRange, quantizeColor } from '../utils.js';

export class Item {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 90;
    this.r = 6;
    this.type = 'p';
    this.color = '#ef4444';
    this.value = 0;
  }

  spawn(x, y, type = 'p', value = 0) {
    this.active = true;
    this.x = x;
    this.y = y;
    // Drop straight down initially
    this.vx = 0;
    this.vy = randRange(90, 120);
    this.type = type;
    // Fixed size and vivid colors regardless of value
    this.value = (type === 'p') ? (value || 0.01) : value;
    this.r = 7; // fixed radius for all items
    this.color = (type === 'p') ? '#FFEC27' :
                 (type === 's') ? '#00E5FF' :
                 (type === 'l') ? '#FF77A8' :
                 (type === 'b') ? '#00FF9C' : '#F4F4F5';
    if (THEME?.retro) this.color = quantizeColor(this.color, ACTIVE_PALETTE);
  }

  update(dt, player, itemsMagnetT) {
    if (!this.active) return;
    const magnet = (player.y < 80) || (itemsMagnetT > 0) || (player.power >= 4.00);
    if (magnet) {
      const sp = 280;
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const ax = (dx / d) * sp - this.vx;
      const ay = (dy / d) * sp - this.vy;
      this.vx += ax * 0.12;
      this.vy += ay * 0.12;
    } else {
      this.vy = Math.min(this.vy + 30 * dt, 160);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < -20 || this.x > W + 20 || this.y > H + 30) {
      this.active = false;
    }
  }

  draw(g, time) {
    if (!this.active) return;
    g.save();
    g.translate(this.x, this.y);
    g.fillStyle = this.color;
    
    if (this.type === 'p') {
      // Power items show P
      g.font = `bold ${this.r * 1.4}px ui-sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('P', 0, 0);
      // Glow for large power items
      if (this.value >= 0.10) {
        g.save();
        g.globalAlpha = 0.3 + Math.sin(time * 5) * 0.2;
        g.strokeStyle = this.color;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, 0, this.r * 1.5, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
    } else if (this.type === 's') { // star
      const r = this.r, r2 = this.r * 0.5;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = i * Math.PI / 5;
        const rr = (i % 2 === 0) ? r : r2;
        const px = Math.cos(ang) * rr;
        const py = Math.sin(ang) * rr;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
    } else if (this.type === 'l') { // life shard (heart)
      const s = this.r / 3;
      g.beginPath();
      g.moveTo(0, -2.0 * s);
      g.bezierCurveTo(2 * s, -4 * s, 5 * s, -1 * s, 0, 4 * s);
      g.bezierCurveTo(-5 * s, -1 * s, -2 * s, -4 * s, 0, -2.0 * s);
      g.fill();
    } else if (this.type === 'b') { // bomb shard (circle + fuse)
      g.beginPath();
      g.arc(0, 0, this.r * 0.9, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(this.r * 0.2, -this.r * 0.9);
      g.lineTo(this.r * 0.8, -this.r * 1.4);
      g.strokeStyle = this.color;
      g.lineWidth = 1.3;
      g.stroke();
    } else {
      g.beginPath();
      g.arc(0, 0, this.r, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}
