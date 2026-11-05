/* Minimal dependency-free ZIP writer (STORE / no compression).
 * PNGs/WebPs are already compressed, so storing them is fine and keeps the
 * app zero-dependency. Exposes window.buildZip(files) -> Blob.
 * files: [{ name: string, data: Uint8Array }]
 */
'use strict';
(function () {
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const enc = new TextEncoder();

  function buildZip(files) {
    const chunks = [];
    const central = [];
    let offset = 0;
    const push = (arr) => { chunks.push(arr); offset += arr.length; };

    for (const f of files) {
      const name = enc.encode(f.name);
      const data = f.data;
      const crc = crc32(data);

      const lh = new Uint8Array(30 + name.length);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true); // local file header sig
      dv.setUint16(4, 20, true);         // version needed
      dv.setUint16(6, 0, true);          // flags
      dv.setUint16(8, 0, true);          // method: store
      dv.setUint16(10, 0, true);         // mod time
      dv.setUint16(12, 0x21, true);      // mod date (1980-01-01)
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, name.length, true);
      dv.setUint16(28, 0, true);
      lh.set(name, 30);

      const localOffset = offset;
      push(lh);
      push(data);

      const ch = new Uint8Array(46 + name.length);
      const cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true); // central dir sig
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0x21, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, localOffset, true);
      ch.set(name, 46);
      central.push(ch);
    }

    const cdStart = offset;
    let cdSize = 0;
    for (const ch of central) { push(ch); cdSize += ch.length; }

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, central.length, true);
    ev.setUint16(10, central.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, cdStart, true);
    push(eocd);

    return new Blob(chunks, { type: 'application/zip' });
  }

  window.buildZip = buildZip;
})();
