/* Meme overview — plain grid, hidden delete mode, Signal sticker-pack export */
'use strict';

const content = document.getElementById('content');
const delToggle = document.getElementById('del-toggle');
const exportBtn = document.getElementById('sticker-export');

/* ---------------- hidden delete mode ---------------- */
let delMode = false;
try { delMode = localStorage.getItem('memeDelMode') === '1'; } catch (_) {}
if (new URLSearchParams(location.search).has('del')) delMode = true;

function applyMode() {
  document.body.classList.toggle('del-mode', delMode);
  try { localStorage.setItem('memeDelMode', delMode ? '1' : '0'); } catch (_) {}
}
function toggleMode() { delMode = !delMode; applyMode(); }

delToggle.addEventListener('click', toggleMode);
window.addEventListener('keydown', (e) => {
  const tag = document.activeElement ? document.activeElement.tagName : '';
  if (e.key === 'd' && tag !== 'INPUT' && tag !== 'TEXTAREA') toggleMode();
});

async function deleteMeme(id) {
  if (!confirm('Dieses Meme löschen?')) return;
  try { await fetch(`/api/memes/${encodeURIComponent(id)}/delete`, { method: 'POST' }); }
  catch (_) {}
  load();
}

/* ---------------- Signal sticker-pack export ---------------- */
const STICKER = 512;          // Signal sticker canvas (px)
const MAX_BYTES = 300 * 1024; // Signal per-sticker limit

function loadImg(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
function toBlob(canvas, type, q) {
  return new Promise((res) => canvas.toBlob(res, type, q));
}

// Draw a meme centred ("contain") on a transparent 512×512 canvas and return
// a Signal-ready WebP blob (Signal's native sticker format), ≤ 300 KiB.
async function makeSticker(src) {
  const img = await loadImg(src);
  const c = document.createElement('canvas');
  c.width = c.height = STICKER;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  const s = Math.min(STICKER / img.width, STICKER / img.height);
  const w = Math.round(img.width * s), h = Math.round(img.height * s);
  g.drawImage(img, Math.round((STICKER - w) / 2), Math.round((STICKER - h) / 2), w, h);

  let blob = null;
  for (const q of [0.95, 0.9, 0.85, 0.8, 0.7, 0.6]) {
    const b = await toBlob(c, 'image/webp', q);
    if (b) { blob = b; if (b.size <= MAX_BYTES) break; }
  }
  return { blob, ext: 'webp' };
}

async function exportPack() {
  let memes = [];
  try { memes = (await (await fetch('/api/memes')).json()).memes || []; } catch (_) {}
  if (!memes.length) { alert('Noch keine Memes zum Exportieren.'); return; }

  exportBtn.disabled = true;
  const label = exportBtn.textContent;
  const files = [];
  try {
    const pad = String(memes.length).length;
    for (let i = 0; i < memes.length; i++) {
      exportBtn.textContent = `Erstelle… ${i + 1}/${memes.length}`;
      const src = `/api/memes/${encodeURIComponent(memes[i].id)}/png`;
      const { blob, ext } = await makeSticker(src);
      const buf = new Uint8Array(await blob.arrayBuffer());
      const n = String(i + 1).padStart(pad, '0');
      files.push({ name: `sticker-${n}.${ext}`, data: buf });
    }
    exportBtn.textContent = 'Packe ZIP…';
    const zip = window.buildZip(files);
    const url = URL.createObjectURL(zip);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signal-sticker-pack.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (err) {
    alert('Export fehlgeschlagen: ' + (err && err.message || err));
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = label;
  }
}
exportBtn.addEventListener('click', exportPack);

/* ---------------- grid ---------------- */
async function load() {
  let memes = [];
  try {
    const j = await (await fetch('/api/memes')).json();
    memes = j.memes || [];
  } catch (_) {
    content.innerHTML = '<div class="empty">Konnte Memes nicht laden.</div>';
    return;
  }

  exportBtn.style.display = memes.length ? '' : 'none';

  if (!memes.length) {
    content.innerHTML = '<div class="empty"><a href="/">Erstelle das erste Meme →</a></div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const m of memes) {
    const src = `/api/memes/${encodeURIComponent(m.id)}/png`;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<a href="${src}" target="_blank" rel="noopener"><img loading="lazy" src="${src}" alt="Meme"></a>`;
    const btn = document.createElement('button');
    btn.className = 'del';
    btn.textContent = '×';
    btn.title = 'Löschen';
    btn.addEventListener('click', () => deleteMeme(m.id));
    card.appendChild(btn);
    grid.appendChild(card);
  }
  content.innerHTML = '';
  content.appendChild(grid);
}

applyMode();
load();
