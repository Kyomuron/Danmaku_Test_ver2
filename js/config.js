// Canvas dimensions
export const W = 480;
export const H = 720;
export const DT = 1 / 60; // fixed timestep

// Player configuration
export const PLAYER_SPEED = 240; // px/s
export const PLAYER_RADIUS = 4;  // small hitbox
export const SHOT_INTERVAL = 0.06; // sec
export const SHOT_SPEED = 520;
export const ENEMY_BULLET_SPEED = 180;
export const INVULN_TIME = 1.0; // sec
export const STAGE_MAX = 5; // available stages (1..STAGE_MAX)

// Player hitbox + focus movement
export const PLAYER_HIT_R_FAST = 2.4;   // normal mode (hidden)
export const PLAYER_HIT_R_SLOW = 3.0;   // focus mode (visible)
export const PLAYER_SPRITE_R = 6;       // visual body size (not hitbox)
export const FOCUS_SPEED_MULT = 0.5;    // speed multiplier while holding Shift
export const GRAZE_GAP = 12;            // extra radius for graze window

// Shards (Fragments)
export const LIFE_SHARDS_TO_EXTEND = 3;
export const BOMB_SHARDS_TO_BOMB = 3;
export const GRAZE_PER_BOMB_SHARD = 50;

// Quiet windows before bosses
export const PRE_MIDBOSS_SILENCE = 2.5; // seconds of no new trash before mid-boss
export const PRE_BOSS_SILENCE = 3.0;    // seconds of quiet before boss appears
export const BOSS_WARNING_LEAD = 1.5;   // seconds before spawn to display warning overlay
export const INTRO_READY_TIME = 2.2;    // seconds of countdown before a run starts

// Edge (off-screen) attack defaults
export const EDGE_MARGIN = 18;

// Visual clarity for enemy bullets
export const ENEMY_BULLET_SIZE_MUL = 1.25; // scale radii up slightly
export const ENEMY_BULLET_MIN_R = 3.8;     // enforce a readable minimum size

// Boss patrol tuning
export const BOSS_PATROL_SPEED_SCALE = 0.62;    // multiply patrol speed (lower = slower)
export const BOSS_PATROL_EDGE_PAUSE = 2.0;     // seconds to hover at edges

// Player shot damage (tunable)
export const PLAYER_SHOT_DMG_ENEMY = 10;            // vs normal enemies
export const PLAYER_SHOT_DMG_BOSS_DEFAULT = 3;      // default vs boss
export const PLAYER_SHOT_DMG_MIDBOSS_DEFAULT = 4;   // default vs mid-boss

// Player damage scaling (closer = stronger)
export const PLAYER_DMG_DIST_MAX = 300;   // px, at/above this distance ~ min scale
export const PLAYER_DMG_SCALE_MIN = 0.6;  // far
export const PLAYER_DMG_SCALE_MAX = 1.8;  // near

// Player shot roles (base damages)
export const DMG_A_LASER = 14;
export const DMG_A_WING = 6;
export const DMG_B_MAIN = 8;
export const DMG_B_HOMING = 2; // lowered homing damage for B-type

// B-type homing settings
export const B_HOMING_COUNT = 3;          // number of homing bullets per volley
export const B_HOMING_SPEED = 420;        // base speed
export const B_HOMING_TURN = 5.0;         // rad/s turn rate toward target

// Difficulty Presets
export const DIFF_PRESETS = {
  easy: {
    label: 'かんたん',
    playerLives: 5,
    playerBombs: 3,
    playerShotIntervalMul: 0.92,
    playerShotDamageMul: 1.1,
    playerInvulnMul: 1.25,
    enemyHpMul: 0.9,
    bossHpMul: 1.0,
    bossDamageTakenMul: 1.25,
    bulletSpeedMul: 0.95,
    patternEveryMul: 1.10,
    patternCountMul: 0.9,
    deathbombWindow: 0.22,
    bossHitboxMul: 0.85
  },
  normal: {
    label: 'ふつう',
    playerLives: 3,
    playerBombs: 2,
    playerShotIntervalMul: 1.00,
    playerShotDamageMul: 1.0,
    playerInvulnMul: 1.00,
    enemyHpMul: 1.0,
    bossHpMul: 1.0,
    bossDamageTakenMul: 1.00,
    bulletSpeedMul: 1.00,
    patternEveryMul: 1.00,
    patternCountMul: 1.0,
    deathbombWindow: 0.18,
    bossHitboxMul: 1.00
  },
  hard: {
    label: 'むずかしい',
    playerLives: 2,
    playerBombs: 1,
    playerShotIntervalMul: 1.12,
    playerShotDamageMul: 0.9,
    playerInvulnMul: 0.85,
    enemyHpMul: 1.12,
    bossHpMul: 1.10,
    bossDamageTakenMul: 0.82,
    bulletSpeedMul: 1.15,
    patternEveryMul: 0.85,
    patternCountMul: 1.2,
    deathbombWindow: 0.12,
    bossHitboxMul: 1.08
  }
};

// Stage-specific difficulty tweaks
export const STAGE_DIFF_TWEAKS = {
  easy: {
    '1': { 
      bulletSpeedMul: 0.93, 
      patternEveryMul: 1.12, 
      patternCountMul: 0.86,
      enemyHpMul: 0.92, 
      bossHpMul: 0.92, 
      bossDamageTakenMul: 1.05,
      drop: {
        betweenSpellPow: 0.35,
        betweenSpellScore: 0.5,
        capturePowItem: 0.6,
        captureLifeShard: 0.7,
        finalLarge: 0.25,
        finalMedium: 0.4,
        finalSmall: 0.6,
        finalScore: 0.6,
        finalLifeShard: 0.5,
        finalBombShard: 0.5
      }
    },
    '2': { 
      bulletSpeedMul: 0.92, 
      patternEveryMul: 1.08, 
      patternCountMul: 0.92,
      enemyHpMul: 0.95, 
      bossHpMul: 0.94, 
      bossDamageTakenMul: 1.04,
      drop: {
        betweenSpellPow: 0.6,
        betweenSpellScore: 0.75,
        capturePowItem: 0.85,
        captureLifeShard: 0.85,
        finalLarge: 0.6,
        finalMedium: 0.75,
        finalSmall: 0.85,
        finalScore: 0.8,
        finalLifeShard: 0.75,
        finalBombShard: 0.75
      }
    }
  },
  normal: {
    '1': {
      bulletSpeedMul: 1.02,
      patternEveryMul: 0.98,
      patternCountMul: 1.05,
      enemyHpMul: 1.04,
      bossHpMul: 1.04,
      bossDamageTakenMul: 0.97,
      drop: {
        betweenSpellPow: 0.55,
        betweenSpellScore: 0.7,
        capturePowItem: 0.75,
        captureLifeShard: 0.8,
        finalLarge: 0.7,
        finalMedium: 0.85,
        finalSmall: 0.95,
        finalScore: 0.9,
        finalLifeShard: 0.75,
        finalBombShard: 0.75
      }
    }
  },
  hard: {
    '1': {
      bulletSpeedMul: 1.12,
      patternEveryMul: 0.88,
      patternCountMul: 1.2,
      enemyHpMul: 1.1,
      bossHpMul: 1.1,
      bossDamageTakenMul: 0.88,
      drop: {
        betweenSpellPow: 0.85,
        betweenSpellScore: 1.0,
        capturePowItem: 0.95,
        captureLifeShard: 0.95,
        finalLarge: 0.95,
        finalMedium: 1.05,
        finalSmall: 1.1,
        finalScore: 1.05,
        finalLifeShard: 0.9,
        finalBombShard: 0.9
      }
    }
  }
};

// Score extends
export const EXTENDS = [200000, 600000, 1200000];

// Spell card numbering (global) per stage
export const SPELL_CARD_COUNTS = {
  '1': 2,
  '2': 3,
  '3': 5,
  '4': 5,
  '5': 8
};

// BGM URLs
export const TITLE_BGM_URL = 'assets/bgm/title.mp3';
export const ENDING_BGM_URL = 'assets/bgm/ending.mp3';

// URL parameters
export const URL_PARAMS = new URLSearchParams(location.search || '');
export const DISABLE_MEDIA = {
  bgm: URL_PARAMS.has('nobgm') || URL_PARAMS.get('assets') === 'none' || URL_PARAMS.get('assets') === 'minimal',
  voice: URL_PARAMS.has('novoice') || URL_PARAMS.get('assets') === 'none' || URL_PARAMS.get('assets') === 'minimal',
  portraits: URL_PARAMS.has('noimg') || URL_PARAMS.get('assets') === 'none' || URL_PARAMS.get('assets') === 'minimal'
};

// Theme (Retro)
export const THEME = {
  retro: true,
  crt: true,
  // 'pico8' | 'cyber'
  palette: 'cyber'
};

// PICO-8 palette (16 colors)
export const RETRO_PALETTE = [
  '#000000', '#1D2B53', '#7E2553', '#008751',
  '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
  '#FF004D', '#FFA300', '#FFEC27', '#00E436',
  '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'
];

// Cyber retro neon palette
export const CYBER_PALETTE = [
  '#0a0f1e', '#1b1e3b', '#2a2d6f', '#00ffff',
  '#00e5ff', '#29adff', '#7aa2ff', '#ff00ff',
  '#ff4dff', '#ff4d6d', '#ff77a8', '#a200ff',
  '#00ff9c', '#faff00', '#e6f2ff', '#ffccaa'
];

// Boss patrol variants per stage (fallback used when stage JSON omits patrol config)
export const BOSS_PATROL_VARIANTS = {
  '1': { speedMul: 0.75, ampX: 130, hoverAmp: 10, hoverSpeed: 1.05, driftAmp: 32, driftSpeed: 0.48 },
  '2': { speedMul: 0.7, ampX: 150, hoverAmp: 12, hoverSpeed: 1.1, driftAmp: 36, driftSpeed: 0.5 },
  '3': { speedMul: 0.68, ampX: 160, hoverAmp: 14, hoverSpeed: 1.15, driftAmp: 40, driftSpeed: 0.55 },
  '4': { speedMul: 0.66, ampX: 170, hoverAmp: 16, hoverSpeed: 1.18, driftAmp: 46, driftSpeed: 0.6 },
  '5': { speedMul: 0.64, ampX: 180, hoverAmp: 18, hoverSpeed: 1.22, driftAmp: 52, driftSpeed: 0.66 }
};

export const ACTIVE_PALETTE = (THEME?.palette === 'cyber') ? CYBER_PALETTE : RETRO_PALETTE;
