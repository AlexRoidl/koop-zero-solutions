# Auto-publish a Signal sticker pack from the meme gallery

This local script pulls every meme from **koop.zero-solutions.solutions**,
converts each to a 512×512 WebP sticker (<300 KiB), and **uploads them as a
Signal sticker pack**, printing the `signal.art` share link.

Signal has no public upload API, so this runs **on your machine** with your own
Signal account. Your credentials stay local (env vars) — they are never printed,
stored, or sent anywhere except Signal's own servers.

> ⚠️ Signal sticker packs are **immutable**. Each run creates a *new* pack with a
> *new* link. Run it once when you want to publish the current state of the wall.

---

## 1. Build the stickers (no Signal account needed)

```bash
./run.sh --dry-run --out out
```

This creates `out/sticker-001.webp …` so you can check the result. (First run sets
up a Python virtualenv in `.venv/` and installs the dependencies.)

## 2. Get your Signal credentials (once)

Uploading needs your Signal account's `user` + `password`, read from a linked
**Signal Desktop**:

1. Quit Signal Desktop, then relaunch it with developer tools enabled:
   - **macOS:** `open -a Signal --args --enable-dev-tools`
     (or `/Applications/Signal.app/Contents/MacOS/Signal --enable-dev-tools`)
2. Open the Developer Tools (**⌥⌘I** on macOS).
3. In the Console, **change the JavaScript context** dropdown from `top` to
   **`Electron Isolated Context`** (this step is essential — the commands return
   `undefined` otherwise).
4. Run these two lines and copy the values:
   ```js
   window.reduxStore.getState().items.uuid_id   // -> your USER
   window.reduxStore.getState().items.password  // -> your PASSWORD
   ```

(These are account secrets — treat them like a password.)

## 3. Upload the pack

```bash
SIGNAL_USER='the-uuid-value' SIGNAL_PASSWORD='the-password-value' \
  ./run.sh --title "Koop Memes" --author "Symposium Kooperation"
```

Tip: put a **leading space** before the command so the secrets don't land in your
shell history, or `export` them in a throwaway terminal.

On success it prints:

```
✅ Pack uploaded!
https://signal.art/addstickers/#pack_id=...&pack_key=...
```

Open that link (or share it) to add the pack in Signal.

---

## Options

| flag / env            | default                          | meaning                                  |
|-----------------------|----------------------------------|------------------------------------------|
| `--url` / `MEMES_URL` | `https://koop.zero-solutions.solutions` | where to pull memes from          |
| `--title` / `PACK_TITLE`  | `Koop Memes`                 | pack title                               |
| `--author` / `PACK_AUTHOR`| `koop.zero-solutions.solutions` | pack author                          |
| `--emoji` / `PACK_EMOJI`  | `😂`                          | emoji assigned to every sticker          |
| `--limit`             | `200`                            | max stickers (Signal's cap is 200)       |
| `--dry-run`           | —                                | build only, no upload                    |
| `--out <dir>`         | —                                | also write the `.webp` files to `<dir>`  |

## Requirements

- Python 3 (tested on 3.14). `run.sh` creates the virtualenv and installs
  `signalstickers-client`, `Pillow`, and a modern `httpx`.
- Uses the unofficial [`signalstickers-client`](https://github.com/signalstickers/signalstickers-client)
  library. Not affiliated with Signal.
