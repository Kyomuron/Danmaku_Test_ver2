import { DISABLE_MEDIA, TITLE_BGM_URL, ENDING_BGM_URL } from './config.js';

// WebAudio context
let audioCtx = null;

export function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// BGM manager (HTMLAudioElement-based)
const BGM_CACHE = new Map();
let bgmAudio = null;
let bgmCurrentUrl = null;
let bgmVol = 0.6;
let bgmFadeTimer = null;

export function preloadBgm(url) {
  if (DISABLE_MEDIA.bgm) return null;
  if (!url) return null;
  if (BGM_CACHE.has(url)) return BGM_CACHE.get(url);
  const a = new Audio();
  // Lighter prefetch to avoid heavy startup cost on menu screen
  a.preload = 'metadata';
  a.src = url;
  try { a.load(); } catch (_) { }
  BGM_CACHE.set(url, a);
  return a;
}

export function bgmStop(fadeSec = 0.5) {
  if (!bgmAudio) return;
  try { if (bgmFadeTimer) { clearInterval(bgmFadeTimer); bgmFadeTimer = null; } } catch (_) { }
  const a = bgmAudio;
  const url = bgmCurrentUrl;
  if (fadeSec && fadeSec > 0) {
    const v0 = a.volume;
    const steps = Math.max(1, Math.floor(fadeSec * 30));
    let i = 0;
    bgmFadeTimer = setInterval(() => {
      i++;
      const t = i / steps;
      a.volume = Math.max(0, v0 * (1 - t));
      if (i >= steps) {
        clearInterval(bgmFadeTimer);
        bgmFadeTimer = null;
        try { a.pause(); } catch (_) { }
        if (!BGM_CACHE.has(url)) {
          try { a.src = ''; } catch (_) { }
        }
        bgmAudio = null;
        bgmCurrentUrl = null;
      }
    }, Math.max(10, Math.floor((fadeSec * 1000) / steps)));
  } else {
    try { a.pause(); } catch (_) { }
    if (!BGM_CACHE.has(url)) {
      try { a.src = ''; } catch (_) { }
    }
    bgmAudio = null;
    bgmCurrentUrl = null;
  }
}

export function bgmPlay(url, { loop = true, fadeIn = 0.6 } = {}) {
  if (DISABLE_MEDIA.bgm) return;
  if (!url) { bgmStop(0.3); return; }
  if (bgmAudio && bgmCurrentUrl === url && !bgmAudio.paused) { return; }
  bgmStop(0.25);
  const a = preloadBgm(url) || new Audio(url);
  a.loop = !!loop;
  a.volume = 0;
  try { a.currentTime = 0; } catch (_) { }
  bgmAudio = a;
  bgmCurrentUrl = url;
  a.play().then(() => {
    if (fadeIn && fadeIn > 0) {
      const steps = Math.max(1, Math.floor(fadeIn * 30));
      let i = 0;
      if (bgmFadeTimer) { clearInterval(bgmFadeTimer); bgmFadeTimer = null; }
      bgmFadeTimer = setInterval(() => {
        i++;
        const t = i / steps;
        a.volume = Math.min(bgmVol, bgmVol * t);
        if (i >= steps) {
          clearInterval(bgmFadeTimer);
          bgmFadeTimer = null;
          a.volume = bgmVol;
        }
      }, Math.max(10, Math.floor((fadeIn * 1000) / steps)));
    } else {
      a.volume = bgmVol;
    }
  }).catch(() => { });
}

export function bgmPause() {
  try { if (bgmAudio) bgmAudio.pause(); } catch (_) { }
}

export function bgmResume() {
  try { if (bgmAudio) bgmAudio.play(); } catch (_) { }
}

export function playTitleBgm() {
  if (TITLE_BGM_URL) bgmPlay(TITLE_BGM_URL, { loop: true, fadeIn: 0.6 });
}

export function playEndingBgm() {
  if (ENDING_BGM_URL) bgmPlay(ENDING_BGM_URL, { loop: true, fadeIn: 0.8 });
}

// Voice (Dialogue Voiceover)
const VOICE_CACHE = new Map();
let voiceAudio = null;
let voiceCurrentUrl = null;
let voiceEnabled = true;
let voiceVol = 0.95;

try {
  const v = localStorage.getItem('voiceEnabled');
  if (v != null) voiceEnabled = (v === 'true');
} catch (_) { }

export function preloadVoice(url) {
  if (DISABLE_MEDIA.voice) return null;
  if (!url) return null;
  if (VOICE_CACHE.has(url)) return VOICE_CACHE.get(url);
  const a = new Audio();
  a.preload = 'auto';
  a.src = url;
  try { a.load(); } catch (_) { }
  VOICE_CACHE.set(url, a);
  return a;
}

export function voiceStop() {
  try { if (voiceAudio) voiceAudio.pause(); } catch (_) { }
  voiceAudio = null;
  voiceCurrentUrl = null;
}

export function voicePlay(url) {
  if (DISABLE_MEDIA.voice) return;
  voiceStop();
  if (!voiceEnabled || !url) return;
  const a = preloadVoice(url) || new Audio(url);
  a.volume = Math.max(0, Math.min(1, voiceVol));
  voiceAudio = a;
  voiceCurrentUrl = url;
  a.play().catch(() => { });
}

export function setVoiceEnabled(v) {
  voiceEnabled = !!v;
  try { localStorage.setItem('voiceEnabled', String(voiceEnabled)); } catch (_) { }
  if (!voiceEnabled) voiceStop();
  const btnVoiceToggle = document.getElementById('btnVoiceToggle');
  if (btnVoiceToggle) {
    btnVoiceToggle.textContent = voiceEnabled ? '🎤 ON' : '🎤 OFF';
    btnVoiceToggle.classList.toggle('muted', !voiceEnabled);
  }
}

export function getVoiceEnabled() {
  return voiceEnabled;
}

// Sound effects
export function playBeep(freq = 440, dur = 0.12, type = 'sine', gain = 0.08) {
  ensureAudio();
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.03, dur));
  osc.connect(g).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

export function playNoise(dur = 0.09, gain = 0.1) {
  ensureAudio();
  const sr = audioCtx.sampleRate;
  const len = Math.max(1, Math.floor(sr * dur));
  const buf = audioCtx.createBuffer(1, len, sr);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const g = audioCtx.createGain();
  g.gain.value = gain;
  const biq = audioCtx.createBiquadFilter();
  biq.type = 'lowpass';
  biq.frequency.value = 4000;
  src.connect(biq).connect(g).connect(audioCtx.destination);
  const t0 = audioCtx.currentTime;
  src.start(t0);
  src.stop(t0 + dur);
}

export function playMelody(freqs, step = 0.18) {
  ensureAudio();
  const t0 = audioCtx.currentTime;
  freqs.forEach((f, i) => {
    const t = t0 + i * step;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + step * 0.9);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + step);
  });
}

// Game sound effects
export function sfxHit() {
  playNoise(0.07, 0.12);
  playBeep(220, 0.08, 'square', 0.06);
}

export function sfxStageClear() {
  playMelody([523.25, 659.25, 783.99, 1046.50], 0.16);
}

export function sfxExtend() {
  playMelody([392.00, 523.25, 659.25], 0.11);
}

export function sfxSpellDecl() {
  playMelody([659.25, 783.99, 987.77], 0.08);
}

export function sfxSpellCapture() {
  playMelody([783.99, 987.77, 1318.51], 0.10);
}

export function sfxSpellFail() {
  playBeep(196.00, 0.2, 'sawtooth', 0.06);
}

export function sfxBombA() {
  playNoise(0.2, 0.2);
  playBeep(440, 0.25, 'sine', 0.08);
}

export function sfxBombB() {
  playNoise(0.15, 0.18);
  playBeep(110, 0.12, 'square', 0.08);
  playBeep(880, 0.2, 'sawtooth', 0.05);
}

export function sfxItem() {
  playBeep(880, 0.05, 'sine', 0.08);
}

export function sfxShard() {
  playBeep(660, 0.06, 'square', 0.08);
}

// Lasers
export function sfxLaserWarn() {
  // Quick high-pitch warn chirp
  playBeep(1200, 0.08, 'triangle', 0.06);
  playBeep(900, 0.06, 'sawtooth', 0.05);
}

export function sfxLaserFire() {
  // Short hiss + low tone
  playNoise(0.06, 0.18);
  playBeep(220, 0.18, 'sine', 0.06);
}

// Initialize
try {
  preloadBgm(TITLE_BGM_URL);
  preloadBgm(ENDING_BGM_URL);
} catch (_) { }
