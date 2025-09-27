export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const randRange = (a, b) => a + Math.random() * (b - a);
export const toRad = deg => (deg * Math.PI / 180);
export const dist2 = (x1, y1, x2, y2) => { 
  const dx = x1 - x2, dy = y1 - y2; 
  return dx * dx + dy * dy; 
};

export function idle(fn) {
  if ('requestIdleCallback' in window) {
    try {
      requestIdleCallback(() => fn());
      return;
    } catch (_) { }
  }
  setTimeout(fn, 120);
}

export function fmtNum(n) {
  return Math.floor(n).toLocaleString('en-US');
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// --- Color utilities (for subtle palette variations) ---
export function lightenColor(hex, amt = 0) {
  try {
    const h = String(hex || '').trim();
    if (!h || h[0] !== '#') return hex;
    const s = h.length === 4
      ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
      : h;
    const r = parseInt(s.slice(1, 3), 16);
    const g = parseInt(s.slice(3, 5), 16);
    const b = parseInt(s.slice(5, 7), 16);
    const f = (v) => clamp(Math.round(v + 255 * amt), 0, 255);
    const rr = f(r).toString(16).padStart(2, '0');
    const gg = f(g).toString(16).padStart(2, '0');
    const bb = f(b).toString(16).padStart(2, '0');
    return `#${rr}${gg}${bb}`;
  } catch (_) {
    return hex;
  }
}

export function parseHex(hex) {
  const h = String(hex || '').trim();
  if (!h || h[0] !== '#') return null;
  const s = h.length === 4
    ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
    : h;
  const r = parseInt(s.slice(1, 3), 16);
  const g = parseInt(s.slice(3, 5), 16);
  const b = parseInt(s.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

export function quantizeColor(hex, palette) {
  try {
    const src = parseHex(hex);
    if (!src || !Array.isArray(palette) || palette.length === 0) return hex;
    let best = palette[0];
    let bestD = Infinity;
    for (const p of palette) {
      const c = parseHex(p);
      if (!c) continue;
      const dr = c.r - src.r, dg = c.g - src.g, db = c.b - src.b;
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best || hex;
  } catch (_) { return hex; }
}
