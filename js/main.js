// Main entry point - integrates all modules
import { Game } from './game.js';
import { ensureAudio, setVoiceEnabled, getVoiceEnabled } from './audio.js';
import { initInput } from './input.js';
import { setDifficulty, setShip } from './game-state.js';
import { URL_PARAMS } from './config.js';

// Global game instance
let game = null;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize input system
  initInput();
  
  // Create game instance
  game = new Game();
  window.game = game; // For debugging
  try { document.body.classList.add('state-title'); } catch (_) {}
  
  // Initialize UI elements
  initializeUI();
  
  // Initialize difficulty from URL or localStorage
  initializeDifficulty();
  
  // Initialize ship selection
  initializeShip();
  
  // Initialize voice settings
  initializeVoice();
  
  // Load initial stage
  try {
    await game.loadStage(null);
    game.updatePracticeUI();
    game.playTitleBgm();
    game.preloadAllStages();
  } catch (err) {
    const hud = document.getElementById('hud');
    hud.textContent = 'ステージ読み込みエラー: ' + err.message;
    console.error(err);
  }
  
  // Start game loop
  game.startLoop();
});

function initializeUI() {
  const btnStart = document.getElementById('btnStart');
  const btnRestart = document.getElementById('btnRestart');
  const btnPause = document.getElementById('btnPause');
  const btnDiffEasy = document.getElementById('btnDiffEasy');
  const btnDiffNormal = document.getElementById('btnDiffNormal');
  const btnDiffHard = document.getElementById('btnDiffHard');
  const btnShipA = document.getElementById('btnShipA');
  const btnShipB = document.getElementById('btnShipB');
  const btnSpellPrev = document.getElementById('btnSpellPrev');
  const btnSpellNext = document.getElementById('btnSpellNext');
  const btnPracticeStart = document.getElementById('btnPracticeStart');
  const btnVoiceToggle = document.getElementById('btnVoiceToggle');
  const btnVoiceSkip = document.getElementById('btnVoiceSkip');
  const btnOpening = document.getElementById('btnOpening');
  const btnGoTitle = document.getElementById('btnGoTitle');
  
  // Start button
  btnStart?.addEventListener('click', () => {
    ensureAudio();
    if (!game.stage) {
      game.hud.textContent = 'まだロード中です…';
      return;
    }
    if (game.state === 'title' || game.state === 'gameover') {
      game.startGame();
    } else if (game.state === 'stageclear') {
      if (game.mode === 'practice') {
        game.startPractice();
      } else if (game.nextStageReady) {
        game.startNextStage();
      } else {
        game.startGame();
      }
    }
  });
  
  // Restart button
  btnRestart?.addEventListener('click', () => {
    game.restartGame();
  });
  
  // Pause button
  btnPause?.addEventListener('click', () => {
    if (game.state === 'playing' || game.state === 'paused') {
      game.togglePause();
    }
  });
  
  // Pause key
  window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'p') {
      if (game.state === 'playing' || game.state === 'paused') {
        game.togglePause();
      }
    }
  });
  
  // Difficulty buttons
  btnDiffEasy?.addEventListener('click', () => {
    if (game.state === 'title' || game.state === 'stageclear' || game.state === 'gameover') {
      setDifficulty('easy');
      updateDifficultyUI('easy');
    }
  });
  
  btnDiffNormal?.addEventListener('click', () => {
    if (game.state === 'title' || game.state === 'stageclear' || game.state === 'gameover') {
      setDifficulty('normal');
      updateDifficultyUI('normal');
    }
  });
  
  btnDiffHard?.addEventListener('click', () => {
    if (game.state === 'title' || game.state === 'stageclear' || game.state === 'gameover') {
      setDifficulty('hard');
      updateDifficultyUI('hard');
    }
  });
  
  // Ship buttons
  btnShipA?.addEventListener('click', () => {
    if (game.state === 'title' || game.state === 'stageclear' || game.state === 'gameover') {
      setShip('A');
      updateShipUI('A');
    }
  });
  
  btnShipB?.addEventListener('click', () => {
    if (game.state === 'title' || game.state === 'stageclear' || game.state === 'gameover') {
      setShip('B');
      updateShipUI('B');
    }
  });
  
  // Practice mode buttons
  btnSpellPrev?.addEventListener('click', () => {
    if (game.state === 'title' || game.state === 'stageclear' || game.state === 'gameover') {
      game.practiceSpellIndex = Math.max(0, game.practiceSpellIndex - 1);
      game.updatePracticeUI();
    }
  });
  
  btnSpellNext?.addEventListener('click', () => {
    if (game.state === 'title' || game.state === 'stageclear' || game.state === 'gameover') {
      const spells = game.getBossSpells();
      const max = spells ? (spells.length - 1) : 0;
      game.practiceSpellIndex = Math.min(max, game.practiceSpellIndex + 1);
      game.updatePracticeUI();
    }
  });
  
  btnPracticeStart?.addEventListener('click', () => {
    ensureAudio();
    if (!game.stage) {
      game.hud.textContent = 'まだロード中です…';
      return;
    }
    if (game.state === 'title' || game.state === 'gameover' || game.state === 'stageclear') {
      game.startPractice();
    }
  });
  
  // Voice toggle
  btnVoiceToggle?.addEventListener('click', () => {
    setVoiceEnabled(!getVoiceEnabled());
  });
  
  // Voice skip during dialogue
  btnVoiceSkip?.addEventListener('click', (e) => {
    if (game.state === 'dialogue') {
      e?.preventDefault?.();
      game.advanceDialogue();
    }
  });

  // Opening
  btnOpening?.addEventListener('click', () => {
    if (game.state === 'title' || game.state === 'stageclear' || game.state === 'gameover') {
      game.showOpening();
    }
  });

  // Go to Title (always available)
  btnGoTitle?.addEventListener('click', () => {
    game.bgmStop?.(0.5);
    game.goToTitle();
  });
}

function initializeDifficulty() {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = (params.get('diff') || '').toLowerCase();
    const saved = localStorage.getItem('difficulty');
    
    if (q === 'easy' || q === 'normal' || q === 'hard') {
      setDifficulty(q);
      updateDifficultyUI(q);
    } else if (saved === 'easy' || saved === 'normal' || saved === 'hard') {
      setDifficulty(saved);
      updateDifficultyUI(saved);
    } else {
      setDifficulty('normal');
      updateDifficultyUI('normal');
    }
  } catch (_) {
    setDifficulty('normal');
    updateDifficultyUI('normal');
  }
}

function updateDifficultyUI(name) {
  const btnDiffEasy = document.getElementById('btnDiffEasy');
  const btnDiffNormal = document.getElementById('btnDiffNormal');
  const btnDiffHard = document.getElementById('btnDiffHard');
  
  const map = { easy: btnDiffEasy, normal: btnDiffNormal, hard: btnDiffHard };
  
  for (const k of Object.keys(map)) {
    if (!map[k]) continue;
    if (k === name) {
      map[k].classList.remove('muted');
      map[k].classList.add('selected');
    } else {
      map[k].classList.add('muted');
      map[k].classList.remove('selected');
    }
  }
}

function initializeShip() {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = (params.get('ship') || '').toUpperCase();
    const saved = localStorage.getItem('ship');
    
    if (q === 'A' || q === 'B') {
      setShip(q);
      updateShipUI(q);
    } else if (saved === 'A' || saved === 'B') {
      setShip(saved);
      updateShipUI(saved);
    } else {
      setShip('A');
      updateShipUI('A');
    }
  } catch (_) {
    setShip('A');
    updateShipUI('A');
  }
}

function updateShipUI(name) {
  const btnShipA = document.getElementById('btnShipA');
  const btnShipB = document.getElementById('btnShipB');
  
  const map = { A: btnShipA, B: btnShipB };
  
  for (const k of Object.keys(map)) {
    if (!map[k]) continue;
    if (k === name) {
      map[k].classList.remove('muted');
      map[k].classList.add('selected');
    } else {
      map[k].classList.add('muted');
      map[k].classList.remove('selected');
    }
  }
}

function initializeVoice() {
  setVoiceEnabled(getVoiceEnabled());
}

// Special dialogue key handling
window.addEventListener('keydown', e => {
  if (!game) return;
  
  const k = e.key.toLowerCase();
  
  // Dialogue consume keys
  if (game.state === 'dialogue') {
    if (k === 'z' || k === 'enter' || e.key === ' ') {
      e.preventDefault();
      game.advanceDialogue();
      return;
    }
    if (k === 'x' || k === 'escape') {
      e.preventDefault();
      game.skipDialogue();
      return;
    }
    if (k === 'c') {
      e.preventDefault();
      game.voiceStop();
      return;
    }
    if (k === 'v') {
      e.preventDefault();
      setVoiceEnabled(!getVoiceEnabled());
      return;
    }
  }
  
  // Ending screen - return to title
  if (game.state === 'ending') {
    if (k === 'enter' || k === 'z' || e.key === ' ') {
      e.preventDefault();
      game.bgmStop(0.5);
      game.goToTitle();
      return;
    }
  }
  
  // Bomb key
  if (k === 'x' && game.state === 'playing') {
    game.tryUseBomb();
  }
});
