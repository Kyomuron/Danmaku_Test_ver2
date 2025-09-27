#!/usr/bin/env node
/**
 * Stage JSON sync/validator
 *
 * Goals:
 * - Validate stage JSONs (types/shapes) against engine (index.html)
 * - Optionally apply codemod rules (rename type/shape, set defaults)
 * - Optional convenience: set per-stage BGM fields
 *
 * Usage:
 *   node tools/sync-stage-json.mjs               # dry-run validate only
 *   node tools/sync-stage-json.mjs --apply       # apply fixes per rules
 *   node tools/sync-stage-json.mjs --set-bgm     # add bgm fields if missing
 *   node tools/sync-stage-json.mjs --rules tools/sync-rules.json --apply
 */

import fs from 'fs/promises';
import path from 'path';

const root = process.cwd();
const STAGE_DIR = path.join(root, 'stage');
const GAME_JS = path.join(root, 'js', 'game.js');
const BULLET_JS = path.join(root, 'js', 'entities', 'bullet.js');

const args = new Set(process.argv.slice(2));
const getArg = (name, def=null) => {
  const idx = process.argv.indexOf(name);
  return idx>=0 && process.argv[idx+1] ? process.argv[idx+1] : def;
};
const APPLY = args.has('--apply');
const SET_BGM = args.has('--set-bgm');
const RULES_PATH = getArg('--rules', path.join(root, 'tools', 'sync-rules.json'));

function log(...a){ console.log('[sync-stage]', ...a); }

async function readText(file){
  try{ return await fs.readFile(file, 'utf8'); } catch(e){ return null; }
}

function uniq(a){ return Array.from(new Set(a)); }

function extractEngineInfoFromModules(gameJs, bulletJs){
  const patterns = [];
  const shapes = [];
  // pattern types in game.js: if (type === 'spread') {...} else if (type === 'spiral') ...
  const typeRegex = /\btype\s*===\s*'([^']+)'/g;
  let m;
  while((m = typeRegex.exec(gameJs))){ patterns.push(m[1]); }
  // bullet shapes in bullet.js: if (this.shape === 'circle') {...}
  const shapeRegex = /this\.shape\s*===\s*'([^']+)'/g;
  while((m = shapeRegex.exec(bulletJs))){ shapes.push(m[1]); }
  return { patternTypes: uniq(patterns).sort(), shapes: uniq(shapes).sort() };
}

function walkPatterns(stageObj, fn){
  if(!stageObj || typeof stageObj !== 'object') return;
  const waves = Array.isArray(stageObj.waves) ? stageObj.waves : [];
  for(const w of waves){ if(w?.enemy?.pattern) fn(w.enemy.pattern, ['waves']); }
  const mids = Array.isArray(stageObj.midBosses) ? stageObj.midBosses : [];
  for(const mb of mids){
    if(mb?.pattern) fn(mb.pattern, ['midBosses']);
    if(Array.isArray(mb?.patterns)) for(const p of mb.patterns){ fn(p, ['midBosses']); }
  }
  const b = stageObj.boss;
  if(b){
    if(b.pattern) fn(b.pattern, ['boss']);
    if(Array.isArray(b.patterns)) for(const p of b.patterns){ fn(p, ['boss']); }
    if(Array.isArray(b.spells)) for(const sp of b.spells){ if(sp?.pattern) fn(sp.pattern, ['boss', 'spells']); }
  }
}

function applyRulesToPattern(pat, rules){
  let changed = false;
  if(!pat || typeof pat !== 'object') return { changed, pat };
  // Rename type
  if(pat.type && rules.typeRename && rules.typeRename[pat.type]){
    pat.type = rules.typeRename[pat.type];
    changed = true;
  }
  // Defaults to ensure engine compatibility (optional)
  if(rules.setDefaults){
    const d = rules.setDefaults;
    const b = pat.bullet || (pat.bullet = {});
    if(b.shape==null && d.bullet?.shape!=null){ b.shape = d.bullet.shape; changed = true; }
    if(b.r==null && d.bullet?.r!=null){ b.r = d.bullet.r; changed = true; }
    if(b.color==null && d.bullet?.color!=null){ b.color = d.bullet.color; changed = true; }
    if(pat.every==null && d.every!=null){ pat.every = d.every; changed = true; }
    if(pat.count==null && d.count!=null){ pat.count = d.count; changed = true; }
    if(pat.speed==null && d.speed!=null){ pat.speed = d.speed; changed = true; }
  }
  // Rename bullet shape
  const shape = pat?.bullet?.shape ?? pat.shape;
  if(shape && rules.shapeRename && rules.shapeRename[shape]){
    if(pat.bullet && pat.bullet.shape){ pat.bullet.shape = rules.shapeRename[shape]; changed = true; }
    else if(pat.shape){ pat.shape = rules.shapeRename[shape]; changed = true; }
  }
  return { changed, pat };
}

function stripDialogueIcons(obj){
  const d = obj?.dialogue;
  if(!d || typeof d !== 'object') return false;
  let changed = false;
  const dropIcons = (por) => {
    if(!por || typeof por !== 'object') return;
    for(const k of Object.keys(por)){
      const v = por[k];
      if(v && typeof v === 'object' && 'icon' in v){ delete v.icon; changed = true; }
    }
  };
  dropIcons(d.portraits);
  if(d.midBossPortraits) dropIcons(d.midBossPortraits);
  return changed;
}

async function main(){
  const gameJs = await readText(GAME_JS);
  const bulletJs = await readText(BULLET_JS);
  if(!gameJs || !bulletJs){
    console.error('js/game.js or js/entities/bullet.js not found. Run from project root.');
    process.exit(1);
  }
  const engine = extractEngineInfoFromModules(gameJs, bulletJs);
  log('Engine patterns:', engine.patternTypes.join(', '));
  log('Engine bullet shapes:', engine.shapes.join(', '));

  // Load rules (optional)
  let rules = { typeRename:{}, shapeRename:{}, setDefaults:null };
  const rulesTxt = await readText(RULES_PATH);
  if(rulesTxt){
    try{ rules = { ...rules, ...JSON.parse(rulesTxt) }; log('Loaded rules from', RULES_PATH); }
    catch(e){ console.warn('Failed to parse rules JSON at', RULES_PATH, e.message); }
  } else {
    // scaffold a sample rules file for users
    const sample = {
      "typeRename": {
        "reverseSpiral": "spiral"
      },
      "shapeRename": {
        "rhombus": "diamond"
      },
      "setDefaults": {
        "every": null,
        "count": null,
        "speed": null,
        "bullet": { "shape": null, "r": null, "color": null }
      }
    };
    try{
      await fs.mkdir(path.dirname(RULES_PATH), { recursive: true });
      await fs.writeFile(RULES_PATH, JSON.stringify(sample, null, 2));
      log('Created sample rules file at', RULES_PATH);
    }catch(e){ /* ignore */ }
  }

  // Stage files
  let files = [];
  try{
    const ents = await fs.readdir(STAGE_DIR, { withFileTypes:true });
    files = ents.filter(e=>e.isFile() && e.name.endsWith('.json')).map(e=>path.join(STAGE_DIR, e.name)).sort();
  }catch(e){ console.error('stage/ directory not found'); process.exit(1); }

  let hasErrors = false;
  let writes = 0;

  for(const file of files){
    const txt = await readText(file);
    if(!txt){ console.warn('Skip unreadable', file); continue; }
    let obj;
    try{ obj = JSON.parse(txt); }catch(e){ console.error('Invalid JSON:', file, e.message); hasErrors = true; continue; }

    const unknownTypes = new Set();
    const unknownShapes = new Set();
    let changedCount = 0;

    walkPatterns(obj, (p)=>{
      // validate
      if(p?.type && !engine.patternTypes.includes(p.type)) unknownTypes.add(p.type);
      const shape = p?.bullet?.shape ?? p?.shape;
      if(shape && !engine.shapes.includes(shape)) unknownShapes.add(shape);
      // apply rules
      const { changed } = applyRulesToPattern(p, rules);
      if(changed) changedCount++;
    });

    // Optional: set bgm if requested and missing
    if(SET_BGM){
      const m = file.match(/stage\/(?:stage)?(\d+)\.json$/);
      const num = m ? parseInt(m[1], 10) : null;
      if(num){
        // stage bgm
        const stPath = `assets/bgm/stage${num}.mp3`;
        if(!obj.bgm){ obj.bgm = stPath; changedCount++; }
        else if(typeof obj.bgm === 'object'){ if(!obj.bgm.stage){ obj.bgm.stage = stPath; changedCount++; } }
        // boss bgm
        if(obj.boss){
          if(!obj.boss.bgm){ obj.boss.bgm = `assets/bgm/boss${num}.mp3`; changedCount++; }
        }
      }
    }

    const rel = path.relative(root, file);

    // Dialogue cleanup: remove all icon fields to avoid unwanted overlays
    if(stripDialogueIcons(obj)) changedCount++;
    if(unknownTypes.size>0 || unknownShapes.size>0){
      hasErrors = true;
      if(unknownTypes.size>0) console.warn(`${rel}: unknown pattern types: ${Array.from(unknownTypes).join(', ')}`);
      if(unknownShapes.size>0) console.warn(`${rel}: unknown bullet shapes: ${Array.from(unknownShapes).join(', ')}`);
    }
    if(changedCount>0){
      log(`${rel}: ${changedCount} change(s) ${APPLY?'applied':'pending (dry-run)'}`);
      if(APPLY){
        await fs.writeFile(file, JSON.stringify(obj, null, 2)+'\n');
        writes++;
      }
    } else {
      log(`${rel}: OK (no changes)`);
    }
  }

  if(hasErrors){
    console.error('Validation found unknown types/shapes. Consider adding rename rules.');
    process.exitCode = 2;
  }
  if(APPLY) log(`Wrote ${writes} file(s).`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
