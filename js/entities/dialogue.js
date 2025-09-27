import { voiceStop, voicePlay, preloadVoice } from '../audio.js';
import { DISABLE_MEDIA } from '../config.js';

// Image cache
const IMG_CACHE = new Map();

export function getImage(url) {
  if (!url) return null;
  if (IMG_CACHE.has(url)) return IMG_CACHE.get(url).img;
  const img = new Image();
  const entry = { img, ok: false, err: null };
  IMG_CACHE.set(url, entry);
  img.onload = () => { entry.ok = true; };
  img.onerror = (e) => { entry.err = e || true; };
  img.src = url;
  return img;
}

export class Dialogue {
  constructor() {
    this.active = false;
    this.lines = [];
    this.i = 0;
    this.onFinish = null;
    this.context = 'generic';
  }

  start(lines, onFinish, context) {
    this.lines = Array.isArray(lines) ? lines.slice() : [];
    this.i = 0;
    this.onFinish = onFinish || null;
    this.active = true;
    this.context = context || 'generic';
    
    // Preload resources
    const urls = new Set();
    for (const ln of this.lines) {
      if (ln && typeof ln === 'object') {
        if (ln.portrait) urls.add(ln.portrait);
        if (ln.icon) urls.add(ln.icon);
        if (ln.voice) {
          try { preloadVoice(ln.voice); } catch (_) { }
        }
      }
    }
    
    if (!DISABLE_MEDIA.portraits) {
      urls.forEach(u => { getImage(u); });
    }
    
    // Play first voice
    const cur = this.current();
    if (cur && cur.voice) voicePlay(cur.voice);
  }

  current() {
    return (this.active && this.i < this.lines.length) ? this.lines[this.i] : null;
  }

  advance() {
    if (!this.active) return;
    voiceStop();
    this.i++;
    if (this.i >= this.lines.length) {
      this.finish();
    } else {
      const cur = this.current();
      if (cur && cur.voice) voicePlay(cur.voice);
    }
  }

  finish() {
    if (!this.active) return;
    voiceStop();
    this.active = false;
    const cb = this.onFinish;
    this.onFinish = null;
    if (typeof cb === 'function') cb();
  }

  skip() {
    this.i = this.lines.length;
    this.finish();
  }

  draw(g, W, H, stage, time) {
    if (!this.active) return;
    
    g.save();
    // Dim background
    g.globalAlpha = 0.45;
    g.fillStyle = '#000000';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
    
    // Get current line
    const line = this.current() || { speaker: '', text: '' };
    const side = (line.side === 'right' || line.side === 'r') ? 'right' : 
                 (line.side === 'left' || line.side === 'l') ? 'left' : 
                 (line.speaker === 'boss' ? 'right' : 'left');
    
    // Portrait (keep above dialogue box so they don't overlap)
    const pw = 240, ph = 360;
    const px = (side === 'left') ? 18 : (W - 18 - pw);
    const boxY = H - 180; // dialogue box top
    const py = Math.max(12, boxY - ph - 12);
    const portraitUrl = line.portrait || this.getDefaultPortrait(line.speaker, stage);
    
    if (portraitUrl) {
      const img = getImage(portraitUrl);
      if (img && img.complete && !img.src.endsWith('#')) {
        try {
          const iw = img.naturalWidth || img.width || 0;
          const ih = img.naturalHeight || img.height || 0;
          if (iw > 0 && ih > 0) {
            const s = Math.min(pw / iw, ph / ih);
            const dw = Math.floor(iw * s), dh = Math.floor(ih * s);
            const dx = px + Math.floor((pw - dw) / 2);
            const dy = py + Math.floor((ph - dh) / 2);
            g.save();
            g.globalAlpha = 0.95;
            g.drawImage(img, dx, dy, dw, dh);
            g.restore();
          }
        } catch (_) { }
      }
    }
    
    // Box
    const bx = 24, by = H - 180, bw = W - 48, bh = 156;
    g.fillStyle = '#0b1220';
    g.fillRect(bx, by, bw, bh);
    g.strokeStyle = '#384258';
    g.lineWidth = 2;
    g.strokeRect(bx, by, bw, bh);
    
    // Text (icons disabled)
    const name = line.name || this._resolveSpeakerLabel(line, stage);
    g.fillStyle = '#cdd6f4';
    g.font = '13px ui-sans-serif, system-ui';
    if (name) g.fillText(name, bx + 12, by + 20);

    // Dialogue body with automatic wrapping within the box
    g.font = '16px ui-sans-serif, system-ui';
    g.textBaseline = 'top';
    const text = String(line.text || '');
    const paddingX = 12, paddingTop = 40, paddingBottom = 20;
    const clipX = bx + paddingX, clipY = by + paddingTop;
    const clipW = bw - paddingX * 2, clipH = bh - paddingTop - paddingBottom;
    const maxW = Math.max(10, clipW);
    const lineH = 22;
    const ty0 = clipY + 8;
    const maxLines = Math.max(1, Math.floor((bh - 60) / lineH));

    // Simple character-based wrapping (handles CJK without spaces)
    const wrapLines = (ctx, raw, mw) => {
      const result = [];
      const blocks = String(raw).split('\n');
      for (const blk of blocks) {
        let cur = '';
        for (const ch of blk) {
          const trial = cur + ch;
          if (ctx.measureText(trial).width <= mw) cur = trial;
          else {
            if (cur.length > 0) result.push(cur);
            cur = ch;
          }
        }
        result.push(cur);
      }
      return result;
    };

    const lines = wrapLines(g, text, maxW);
    // Clip to the interior area so drawn text never overflows
    g.save();
    g.beginPath();
    g.rect(clipX, clipY, clipW, clipH);
    g.clip();
    const drawCount = Math.min(lines.length, maxLines);
    for (let i = 0; i < drawCount; i++) {
      g.fillText(lines[i], clipX, ty0 + i * lineH);
    }
    // If overflow, truncate with ellipsis inside the clipped region
    if (lines.length > maxLines) {
      const last = lines[maxLines - 1] || '';
      let ell = last + '…';
      while (g.measureText(ell).width > maxW && ell.length > 1) {
        ell = ell.slice(0, -2) + '…';
      }
      g.fillText(ell, clipX, ty0 + (maxLines - 1) * lineH);
    }
    g.restore();
    
    // Hint
    g.font = '12px ui-sans-serif, system-ui';
    g.fillStyle = '#8c8fa1';
    g.textAlign = 'right';
    g.fillText('Z/Enter: 次へ   X/Esc: スキップ', bx + bw - 12, by + bh - 12);
    g.textAlign = 'left';
    
    g.restore();
  }

  getDefaultPortrait(speaker, stage) {
    const p = stage?.dialogue?.portraits;
    const mid = stage?.dialogue?.midBossPortraits;
    if (!p) return null;
    const sp = (speaker || '').toLowerCase();
    if (sp === 'boss') {
      if (this.context === 'preMid' && mid) {
        return mid.boss?.normal || p.boss?.normal || null;
      }
      if (this.context === 'postBoss') {
        return p.boss?.damaged || p.boss?.normal || null;
      }
      return p.boss?.normal || null;
    }
    if ((speaker || '').toLowerCase() === 'player') {
      return p.player?.normal || null;
    }
    return null;
  }

  // Icons disabled: always return null
  getDefaultIcon(speaker, stage) { return null; }

  _resolveSpeakerLabel(line, stage) {
    const raw = (line?.speaker || '').toLowerCase();
    const map = stage?.dialogue?.speakers || stage?.dialogue?.labels || stage?.dialogue?.names || null;
    if (map) {
      const key = raw || (typeof line?.speaker === 'string' ? line.speaker : '');
      if (key && map[key] != null) return String(map[key]);
    }
    if (raw === 'boss') return 'ボス';
    if (raw === 'player') return 'プレイヤー';
    return '';
  }
}
