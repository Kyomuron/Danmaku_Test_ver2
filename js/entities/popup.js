export class Popup {
  constructor(txt, x, y, clr = '#cdd6f4') {
    this.t = 0;
    this.txt = txt;
    this.x = x;
    this.y = y;
    this.clr = clr;
    this.active = true;
  }

  update(dt) {
    this.t += dt;
    if (this.t > 1.2) this.active = false;
  }

  draw(g) {
    if (!this.active) return;
    g.save();
    g.globalAlpha = Math.max(0, 1.2 - this.t);
    g.fillStyle = this.clr;
    g.font = '12px ui-sans-serif, system-ui';
    g.textAlign = 'center';
    g.fillText(this.txt, this.x, this.y - this.t * 30);
    g.restore();
  }
}

export const popups = [];

export function addPopup(txt, x, y, clr) {
  const p = new Popup(txt, x, y, clr);
  popups.push(p);
}

export function updatePopups(dt) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.update(dt);
    if (!p.active) popups.splice(i, 1);
  }
}

export function drawPopups(g) {
  popups.forEach(p => p.draw(g));
}