/* Meme overview — plain grid, with a hidden delete mode */
'use strict';

const content = document.getElementById('content');
const delToggle = document.getElementById('del-toggle');

// Hidden delete mode: toggled by the faint dot (top-left) or the "d" key.
// When on, each meme shows a small × to delete it. Remembered per browser,
// and openable directly via /overview?del
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

async function load() {
  let memes = [];
  try {
    const j = await (await fetch('/api/memes')).json();
    memes = j.memes || [];
  } catch (_) {
    content.innerHTML = '<div class="empty">Konnte Memes nicht laden.</div>';
    return;
  }

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
