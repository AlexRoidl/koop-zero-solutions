/* Meme generator — canvas editor
 * - random base image centred on the canvas, re-randomize button
 * - multiple Impact-style text layers (black fill, white outline)
 * - each layer can be moved, scaled (corner handle / wheel / pinch), rotated
 * - save -> PNG uploaded to the shared /overview gallery
 */
'use strict';

const FONT_STACK = `'Impact','Anton','Haettenschweiler','Arial Narrow',sans-serif`;
const DESIGN_MAX = 1400;      // longest side of the working/export canvas
const STROKE_RATIO = 0.14;    // outline width relative to font size
const HANDLE_R = 13;          // handle radius in *screen* px
const MIN_SIZE = 14;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const hint = document.getElementById('hint');

const editorBar = document.getElementById('imgbar');
const textInput = document.getElementById('layer-text');

let baseImages = [];
let baseImg = null;
let baseName = '';
let layers = [];
let selectedId = null;
let uid = 1;

// ---------- utilities ----------
function toast(html, ms = 3200) {
  const t = document.getElementById('toast');
  t.innerHTML = html;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms);
}
function selected() { return layers.find((l) => l.id === selectedId) || null; }
function viewScale() { return canvas.getBoundingClientRect().width / canvas.width; }

// client (px) -> design-space coords
function toDesign(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width;
  const sy = canvas.height / r.height;
  return { x: (clientX - r.left) * sx, y: (clientY - r.top) * sy };
}

// ---------- layer geometry ----------
function layerMetrics(l) {
  ctx.font = `${l.size}px ${FONT_STACK}`;
  const lines = (l.text || ' ').split('\n');
  const lineH = l.size * 1.12;
  let maxW = 0;
  for (const ln of lines) maxW = Math.max(maxW, ctx.measureText(ln || ' ').width);
  const pad = l.size * 0.18;
  const hw = maxW / 2 + pad;
  const hh = (lineH * lines.length) / 2 + pad;
  return { lines, lineH, hw, hh };
}

// corner/handle positions in design space (accounting for rotation)
function layerPoints(l) {
  const m = layerMetrics(l);
  const c = Math.cos(l.rot), s = Math.sin(l.rot);
  const rot = (lx, ly) => ({ x: l.cx + lx * c - ly * s, y: l.cy + lx * s + ly * c });
  return {
    m,
    scale: rot(m.hw, m.hh),         // bottom-right
    del: rot(m.hw, -m.hh),          // top-right
    rotate: rot(0, -m.hh - l.size * 0.9), // above top-center
  };
}

function hitBody(l, p) {
  const c = Math.cos(-l.rot), s = Math.sin(-l.rot);
  const dx = p.x - l.cx, dy = p.y - l.cy;
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  const m = layerMetrics(l);
  return Math.abs(lx) <= m.hw && Math.abs(ly) <= m.hh;
}

// ---------- rendering ----------
function drawLayer(l) {
  const m = layerMetrics(l);
  ctx.save();
  ctx.translate(l.cx, l.cy);
  ctx.rotate(l.rot);
  ctx.font = `${l.size}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = l.size * STROKE_RATIO;
  const fill = l.invert ? '#ffffff' : '#000000';
  const stroke = l.invert ? '#000000' : '#ffffff';
  const top = -(m.lineH * m.lines.length) / 2;
  m.lines.forEach((ln, i) => {
    const y = top + m.lineH * (i + 0.5);
    ctx.strokeStyle = stroke;
    ctx.strokeText(ln, 0, y);
    ctx.fillStyle = fill;
    ctx.fillText(ln, 0, y);
  });
  ctx.restore();
}

function drawSelection(l) {
  const vs = viewScale();
  const r = HANDLE_R / vs;
  const pts = layerPoints(l);
  const m = pts.m;
  // bounding box
  ctx.save();
  ctx.translate(l.cx, l.cy);
  ctx.rotate(l.rot);
  ctx.strokeStyle = '#200010';
  ctx.lineWidth = 1.5 / vs;
  ctx.setLineDash([6 / vs, 5 / vs]);
  ctx.strokeRect(-m.hw, -m.hh, m.hw * 2, m.hh * 2);
  ctx.setLineDash([]);
  // line to rotate handle
  ctx.beginPath();
  ctx.moveTo(0, -m.hh);
  ctx.lineTo(0, -m.hh - l.size * 0.9);
  ctx.stroke();
  ctx.restore();

  const dot = (p, fill, glyph, ink) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2 / vs;
    ctx.strokeStyle = ink ? '#fff' : '#200010';
    ctx.stroke();
    if (glyph) {
      ctx.fillStyle = ink ? '#fff' : '#200010';
      ctx.font = `${r * 1.3}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, p.x, p.y + r * 0.05);
    }
  };
  dot(pts.rotate, '#200010', '⟳', true);
  dot(pts.scale, '#dfffef', '⤡', false);
  dot(pts.del, '#ff5a3c', '×', true);
}

function render() {
  if (baseImg) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);
  }
  for (const l of layers) drawLayer(l);
  const sel = selected();
  if (sel) drawSelection(sel);
}

// ---------- base image ----------
function fitCanvasToImage(img) {
  const scale = Math.min(1, DESIGN_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
}

function loadBase(name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      baseImg = img;
      baseName = name;
      fitCanvasToImage(img);
      render();
      resolve();
    };
    img.onerror = reject;
    img.src = '/base/' + encodeURIComponent(name);
  });
}

async function randomBase() {
  if (!baseImages.length) return;
  let name;
  do { name = baseImages[Math.floor(Math.random() * baseImages.length)]; }
  while (name === baseName && baseImages.length > 1);
  await loadBase(name);
}

// ---------- layer actions ----------
function addText(text) {
  const size = Math.round(canvas.height * 0.09);
  const l = {
    id: uid++,
    text: text || 'DEIN TEXT',
    cx: canvas.width / 2,
    cy: layers.length === 0 ? canvas.height * 0.14 : canvas.height * (0.3 + Math.random() * 0.4),
    size,
    rot: 0,
    invert: false,
  };
  layers.push(l);
  select(l.id);
  render();
  return l;
}

function select(id) {
  selectedId = id;
  const l = selected();
  if (l) {
    editorBar.classList.add('active');
    textInput.value = l.text;
  } else {
    editorBar.classList.remove('active');
  }
  render();
}

function deleteSelected() {
  if (selectedId == null) return;
  layers = layers.filter((l) => l.id !== selectedId);
  select(null);
}

// ---------- pointer interaction ----------
const pointers = new Map();
let drag = null;   // { mode, ... }

function handleUnderPointer(l, p) {
  const vs = viewScale();
  const r = HANDLE_R / vs * 1.25;
  const pts = layerPoints(l);
  const near = (hp) => Math.hypot(p.x - hp.x, p.y - hp.y) <= r;
  if (near(pts.del)) return 'del';
  if (near(pts.scale)) return 'scale';
  if (near(pts.rotate)) return 'rotate';
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = toDesign(e.clientX, e.clientY);
  pointers.set(e.pointerId, p);

  // two fingers -> pinch scale/rotate the selected (or topmost) layer
  if (pointers.size === 2) {
    const l = selected() || layers[layers.length - 1];
    if (l) {
      select(l.id);
      const [a, b] = [...pointers.values()];
      drag = {
        mode: 'pinch',
        l,
        startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        startAngle: Math.atan2(b.y - a.y, b.x - a.x),
        startSize: l.size,
        startRot: l.rot,
      };
    }
    return;
  }

  // single pointer
  const sel = selected();
  if (sel) {
    const h = handleUnderPointer(sel, p);
    if (h === 'del') { deleteSelected(); drag = null; return; }
    if (h === 'scale') {
      drag = { mode: 'scale', l: sel, startDist: Math.hypot(p.x - sel.cx, p.y - sel.cy) || 1, startSize: sel.size };
      return;
    }
    if (h === 'rotate') {
      drag = { mode: 'rotate', l: sel };
      return;
    }
  }
  // hit-test layers topmost first
  for (let i = layers.length - 1; i >= 0; i--) {
    if (hitBody(layers[i], p)) {
      select(layers[i].id);
      const l = layers[i];
      drag = { mode: 'move', l, dx: p.x - l.cx, dy: p.y - l.cy };
      // bring to front
      layers.splice(i, 1); layers.push(l);
      render();
      return;
    }
  }
  // tapped empty space
  select(null);
  drag = null;
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const p = toDesign(e.clientX, e.clientY);
  pointers.set(e.pointerId, p);
  if (!drag) return;

  if (drag.mode === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    drag.l.size = Math.max(MIN_SIZE, drag.startSize * (dist / drag.startDist));
    drag.l.rot = drag.startRot + (angle - drag.startAngle);
    render();
    return;
  }
  if (drag.mode === 'move') {
    drag.l.cx = p.x - drag.dx;
    drag.l.cy = p.y - drag.dy;
    render();
  } else if (drag.mode === 'scale') {
    const d = Math.hypot(p.x - drag.l.cx, p.y - drag.l.cy);
    drag.l.size = Math.max(MIN_SIZE, drag.startSize * (d / drag.startDist));
    render();
  } else if (drag.mode === 'rotate') {
    drag.l.rot = Math.atan2(p.y - drag.l.cy, p.x - drag.l.cx) + Math.PI / 2;
    render();
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  if (pointers.size < 2 && drag && drag.mode === 'pinch') drag = null;
  if (pointers.size === 0) drag = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

// double-tap / double-click a layer to edit text
canvas.addEventListener('dblclick', (e) => {
  const p = toDesign(e.clientX, e.clientY);
  for (let i = layers.length - 1; i >= 0; i--) {
    if (hitBody(layers[i], p)) { select(layers[i].id); textInput.focus(); textInput.select(); return; }
  }
});

// wheel scales the selected layer
canvas.addEventListener('wheel', (e) => {
  const l = selected();
  if (!l) return;
  e.preventDefault();
  l.size = Math.max(MIN_SIZE, l.size * (e.deltaY < 0 ? 1.06 : 0.94));
  render();
}, { passive: false });

// ---------- editor bar ----------
textInput.addEventListener('input', () => {
  const l = selected();
  if (!l) return;
  l.text = textInput.value;
  render();
});
document.getElementById('btn-del').addEventListener('click', () => { deleteSelected(); });
document.getElementById('btn-invert').addEventListener('click', () => {
  const l = selected();
  if (!l) return;
  l.invert = !l.invert;
  render();
});

// keyboard
window.addEventListener('keydown', (e) => {
  if (document.activeElement === textInput) {
    if (e.key === 'Escape') textInput.blur();
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedId != null) { e.preventDefault(); deleteSelected(); } }
  if (e.key === 'Escape') select(null);
});

// ---------- toolbar ----------
document.getElementById('btn-random').addEventListener('click', randomBase);
document.getElementById('btn-add-text').addEventListener('click', () => {
  const l = addText('TEXT');
  textInput.focus();
  textInput.select();
});

document.getElementById('btn-save').addEventListener('click', save);

async function save() {
  const btn = document.getElementById('btn-save');
  const prev = selectedId;
  select(null); // drop selection chrome from the export
  // render a clean frame
  render();
  btn.disabled = true;
  btn.innerHTML = '⏳ <span>Speichern…</span>';
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const res = await fetch('/api/memes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl, base: baseName, w: canvas.width, h: canvas.height }),
    });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || 'Fehler beim Speichern');
    toast(`✅ Gespeichert! <a href="/overview">Im Overview ansehen →</a>`);
  } catch (err) {
    toast('⚠️ ' + err.message, 4000);
    if (prev != null) select(prev);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '💾 <span>Speichern</span>';
  }
}

// ---------- boot ----------
async function boot() {
  try { await document.fonts.load(`64px 'Anton'`); } catch (_) {}
  try {
    const res = await fetch('/api/base-images');
    const j = await res.json();
    baseImages = j.images || [];
  } catch (_) { baseImages = []; }
  if (!baseImages.length) {
    toast('Keine Bilder gefunden.', 5000);
    return;
  }
  await randomBase();
  addText('DEIN TEXT');
  // fonts may finish loading after first paint
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
}
window.addEventListener('resize', render);
boot();
