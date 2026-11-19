// Keyboard + mouse input. Tracks held keys, pressed-this-frame edges, and mouse
// position in screen space. No game logic here.

export function createInput() {
  const keys = new Set();
  const pressed = new Set();
  const state = {
    keys, pressed,
    mouseX: 0, mouseY: 0, mouseDown: false, mousePressed: false,
    anyKey: false,
  };
  return state;
}

export function attachInput(state, el) {
  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!state.keys.has(k)) state.pressed.add(k);
    state.keys.add(k);
    state.anyKey = true;
  };
  const up = (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    state.keys.delete(k);
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => { state.keys.clear(); });
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    state.mouseX = e.clientX - r.left;
    state.mouseY = e.clientY - r.top;
  });
  el.addEventListener('mousedown', (e) => {
    if (!state.mouseDown) state.mousePressed = true;
    state.mouseDown = true;
  });
  window.addEventListener('mouseup', () => { state.mouseDown = false; });
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}

export function held(state, ...names) {
  return names.some((n) => state.keys.has(n));
}

export function wasPressed(state, ...names) {
  return names.some((n) => state.pressed.has(n));
}

export function endFrame(state) {
  state.pressed.clear();
  state.mousePressed = false;
  state.anyKey = false;
}
