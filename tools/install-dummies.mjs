#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

const root = process.cwd();

async function ensureDir(p){ await fs.mkdir(p, { recursive: true }); }
async function exists(p){ try{ await fs.access(p); return true; }catch{ return false; } }
async function writeIfMissing(file, data){
  if(!(await exists(file))){
    await ensureDir(path.dirname(file));
    await fs.writeFile(file, data);
    console.log('created', path.relative(root, file));
  } else {
    // console.log('exists ', path.relative(root, file));
  }
}

// 1x1 transparent PNG
const PNG_1x1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAucB9ZsS8lMAAAAASUVORK5CYII=';
const PNG_1x1 = Buffer.from(PNG_1x1_BASE64, 'base64');

// Minimal MP3 placeholder (0-byte OK to avoid 404; playback errors are handled by engine)
const MP3_DUMMY = Buffer.alloc(0);

async function main(){
  // favicon
  await writeIfMissing(path.join(root, 'favicon.ico'), Buffer.alloc(0));

  // Common images
  await writeIfMissing(path.join(root, 'assets/common/player.png'), PNG_1x1);
  await writeIfMissing(path.join(root, 'assets/common/player_icon.png'), PNG_1x1);

  // Stage portraits
  for(let i=1;i<=5;i++){
    const dir = path.join(root, `assets/stage${i}`);
    await writeIfMissing(path.join(dir, 'boss.png'), PNG_1x1);
    await writeIfMissing(path.join(dir, 'boss_damaged.png'), PNG_1x1);
    await writeIfMissing(path.join(dir, 'boss_icon.png'), PNG_1x1);
  }

  // BGM files
  await writeIfMissing(path.join(root, 'assets/bgm/title.mp3'), MP3_DUMMY);
  await writeIfMissing(path.join(root, 'assets/bgm/ending.mp3'), MP3_DUMMY);
  for(let i=1;i<=5;i++){
    await writeIfMissing(path.join(root, `assets/bgm/stage${i}.mp3`), MP3_DUMMY);
    await writeIfMissing(path.join(root, `assets/bgm/boss${i}.mp3`), MP3_DUMMY);
  }

  // Voice files (preBoss / postBoss). Stage1 also uses pre_003 in placeholders.
  for(let i=1;i<=5;i++){
    const vdir = path.join(root, `assets/voice/stage${i}`);
    await writeIfMissing(path.join(vdir, 'pre_001.mp3'), MP3_DUMMY);
    await writeIfMissing(path.join(vdir, 'pre_002.mp3'), MP3_DUMMY);
    if(i===1){ await writeIfMissing(path.join(vdir, 'pre_003.mp3'), MP3_DUMMY); }
    await writeIfMissing(path.join(vdir, 'post_001.mp3'), MP3_DUMMY);
    await writeIfMissing(path.join(vdir, 'post_002.mp3'), MP3_DUMMY);
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });

