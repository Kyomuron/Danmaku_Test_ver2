export const keys = new Set();

export function initInput() {
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    
    // Prevent default for game keys
    if (e.key === " " || k === 'p' || k === 'x' || 
        k === 'arrowup' || k === 'arrowdown' || 
        k === 'arrowleft' || k === 'arrowright') {
      e.preventDefault();
    }
    
    keys.add(k);
  });
  
  window.addEventListener('keyup', e => {
    keys.delete(e.key.toLowerCase());
  });
}

export function isKeyPressed(key) {
  return keys.has(key.toLowerCase());
}

export function clearKeys() {
  keys.clear();
}