#!/usr/bin/env python3
"""
Build a Signal sticker pack from the koop meme gallery and upload it.

Fetches every meme from the running tool (default koop.zero-solutions.solutions),
converts each to a 512x512 WebP sticker (transparent margins, <300 KiB), and
uploads them as a Signal sticker pack using YOUR Signal account credentials.
Prints the signal.art share link.

Signal has no public upload API: publishing requires your Signal account's
`user` (uuid) and `password`, read once from a linked Signal Desktop (see
README.md). They are taken from the env vars SIGNAL_USER / SIGNAL_PASSWORD and
are never printed or stored by this script.

Usage:
    SIGNAL_USER=... SIGNAL_PASSWORD=... python make_signal_pack.py
    python make_signal_pack.py --dry-run --out ./out      # convert only, no upload
See `python make_signal_pack.py --help`.
"""
import argparse
import asyncio
import io
import os
import sys

import httpx
from PIL import Image

SIZE = 512
MAX_BYTES = 300 * 1024  # Signal's 300 KiB per-sticker limit
DEFAULT_URL = "https://koop.zero-solutions.solutions"


def make_webp(png_bytes: bytes) -> bytes:
    """A meme PNG -> a 512x512 WebP with transparent margins, <= 300 KiB."""
    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    scale = min(SIZE / im.width, SIZE / im.height)
    w, h = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    im = im.resize((w, h), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(im, ((SIZE - w) // 2, (SIZE - h) // 2), im)
    data = b""
    for q in (95, 90, 85, 80, 70, 60, 50, 40):
        buf = io.BytesIO()
        canvas.save(buf, "WEBP", quality=q, method=6)
        data = buf.getvalue()
        if len(data) <= MAX_BYTES:
            break
    return data


async def fetch_memes(base: str, limit: int):
    async with httpx.AsyncClient(timeout=30) as http:
        r = await http.get(f"{base}/api/memes")
        r.raise_for_status()
        memes = r.json().get("memes", [])
        if not memes:
            sys.exit("No memes in the gallery yet.")
        # API is newest-first; reverse so the pack is in chronological order.
        memes = list(reversed(memes))[:limit]
        out = []
        for m in memes:
            pr = await http.get(f"{base}/api/memes/{m['id']}/png")
            pr.raise_for_status()
            out.append((m["id"], pr.content))
        return out


async def main():
    ap = argparse.ArgumentParser(description="Create a Signal sticker pack from the koop meme gallery.")
    ap.add_argument("--url", default=os.environ.get("MEMES_URL", DEFAULT_URL), help="base URL of the meme tool")
    ap.add_argument("--title", default=os.environ.get("PACK_TITLE", "Koop Memes"))
    ap.add_argument("--author", default=os.environ.get("PACK_AUTHOR", "koop.zero-solutions.solutions"))
    ap.add_argument("--emoji", default=os.environ.get("PACK_EMOJI", "😂"), help="emoji assigned to every sticker")
    ap.add_argument("--limit", type=int, default=200, help="max stickers (Signal allows 200)")
    ap.add_argument("--dry-run", action="store_true", help="only convert; do not upload to Signal")
    ap.add_argument("--out", default=None, help="also write the .webp files to this folder")
    args = ap.parse_args()

    base = args.url.rstrip("/")
    print(f"Fetching memes from {base} ...")
    memes = await fetch_memes(base, args.limit)
    print(f"Converting {len(memes)} memes to 512x512 WebP ...")

    stickers = []
    for i, (mid, png) in enumerate(memes):
        webp = make_webp(png)
        stickers.append(webp)
        if args.out:
            os.makedirs(args.out, exist_ok=True)
            with open(os.path.join(args.out, f"sticker-{i + 1:03d}.webp"), "wb") as f:
                f.write(webp)
        over = "  !! still > 300 KiB" if len(webp) > MAX_BYTES else ""
        print(f"  [{i + 1}/{len(memes)}] {len(webp) // 1024} KiB{over}")

    if args.dry_run:
        print("\nDry run — not uploading. "
              + (f"WebP files written to {args.out}" if args.out else "Pass --out <dir> to also save the files."))
        return

    user = os.environ.get("SIGNAL_USER")
    password = os.environ.get("SIGNAL_PASSWORD")
    if not user or not password:
        sys.exit("\nSet SIGNAL_USER and SIGNAL_PASSWORD to upload (see README.md), "
                 "or pass --dry-run to just build the files.")

    # Imported here so --dry-run works without the Signal library installed.
    from signalstickers_client import StickersClient
    from signalstickers_client.models import LocalStickerPack, Sticker

    pack = LocalStickerPack()
    pack.title = args.title
    pack.author = args.author
    for i, webp in enumerate(stickers):
        st = Sticker()
        st.id = i
        st.emoji = args.emoji
        st.image_data = webp
        pack.stickers.append(st)
    # cover = None -> Signal uses the first sticker as the pack cover.

    print(f"\nUploading '{pack.title}' ({pack.nb_stickers} stickers) to Signal ...")
    async with StickersClient(user, password) as client:
        pack_id, pack_key = await client.upload_pack(pack)

    print("\n✅ Pack uploaded!")
    print(f"https://signal.art/addstickers/#pack_id={pack_id}&pack_key={pack_key}")


if __name__ == "__main__":
    asyncio.run(main())
