/* Meme overview — gallery of every saved meme */
'use strict';

const content = document.getElementById('content');
const countEl = document.getElementById('count');
let moderation = false;

function fmtDate(ts) {
  try {
    return new Date(ts).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch (_) { return ''; }
}

async function load() {
  try {
    const cfg = await (await fetch('/api/config')).json();
    moderation = !!cfg.moderation;
  } catch (_) {}

  let memes = [];
  try {
    const j = await (await fetch('/api/memes')).json();
    memes = j.memes || [];
  } catch (_) {
    content.innerHTML = '<div class="empty">Konnte Memes nicht laden.</div>';
    return;
  }

  countEl.textContent = memes.length ? `${memes.length} Meme${memes.length === 1 ? '' : 's'}` : '';

  if (!memes.length) {
    content.innerHTML = '<div class="empty">Noch keine Memes.<br><br><a href="/">Erstelle das erste →</a></div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const m of memes) {
    const src = `/api/memes/${encodeURIComponent(m.id)}/png`;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <a href="${src}" target="_blank" rel="noopener"><img loading="lazy" src="${src}" alt="Meme"></a>
      <div class="card-bar">
        <span>${fmtDate(m.createdAt)}</span>
        <span class="card-actions">
          <a class="btn" href="${src}" download="meme-${m.id}.png">⬇︎</a>
          ${moderation ? `<button class="danger del" data-id="${m.id}">🗑️</button>` : ''}
        </span>
      </div>`;
    grid.appendChild(card);
  }
  content.innerHTML = '';
  content.appendChild(grid);

  if (moderation) {
    content.querySelectorAll('.del').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('Dieses Meme löschen?')) return;
        const id = b.getAttribute('data-id');
        const tok = new URLSearchParams(location.search).get('token') || '';
        await fetch(`/api/memes/${encodeURIComponent(id)}/delete${tok ? '?token=' + encodeURIComponent(tok) : ''}`, { method: 'POST' });
        load();
      });
    });
  }
}

load();
