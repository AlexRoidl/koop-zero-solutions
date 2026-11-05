/* Meme overview — plain grid of every saved meme */
'use strict';

const content = document.getElementById('content');

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
    const a = document.createElement('a');
    a.className = 'card';
    a.href = src;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = `<img loading="lazy" src="${src}" alt="Meme">`;
    grid.appendChild(a);
  }
  content.innerHTML = '';
  content.appendChild(grid);
}

load();
