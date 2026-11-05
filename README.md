# koop-zero-solutions — Meme Generator

A tiny zero-dependency Node server that hosts a meme editor and a shared gallery.

- **Editor (`/`)** — shows a random base image centred on a canvas. Buttons:
  - 🎲 **Neues Bild** — pick another random base image
  - ➕ **Text** — add an Impact-style caption (black fill, white outline)
  - 💾 **Speichern** — flatten to PNG and submit to the gallery

  Each text layer can be dragged to reposition, scaled (corner handle, mouse
  wheel, or two-finger pinch), rotated (top handle / pinch), edited (type in the
  bar or double-tap), inverted (black↔white) and deleted. Add as many as you like.

- **Overview (`/overview`)** — every meme saved by any visitor, newest first,
  with download links.

## Base images

The random pool is every image in [`public/base/`](public/base). Drop in more
`.jpg`/`.png`/`.webp` files and redeploy — no code change needed.

## Font

Captions use `Impact` where available and fall back to the bundled
[Anton](https://fonts.google.com/specimen/Anton) (`public/fonts/Anton.woff2`, SIL OFL)
everywhere else, so they render consistently across devices.

## Run locally

```bash
node server.js        # http://localhost:3000
```

## Config (env)

| var          | default         | meaning                                             |
|--------------|-----------------|-----------------------------------------------------|
| `PORT`       | `3000`          | listen port                                         |
| `HOST`       | `127.0.0.1`     | bind address (`0.0.0.0` in the container)           |
| `DATA_DIR`   | `./data`        | where saved memes are stored (a volume in prod)     |
| `ADMIN_TOKEN`| *(unset)*       | if set, `/overview?token=…` shows delete buttons    |

## Deploy

Built from the `Dockerfile` by dokploy. Saved memes persist on a volume mounted
at `/data`. Served at **https://koop.zero-solutions.solutions**.
