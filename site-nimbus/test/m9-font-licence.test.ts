// The shipped LINE Seed subset (openspec docs-shell-interfaces "Reading layout and page header") is served to
// every reader, so under SIL OFL 1.1 condition 2 each copy must carry the copyright notice and the licence.
// They live in the font's own name records; this reads them out of the WOFF2 (brotli, untransformed `name`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const fonts = path.resolve(import.meta.dirname, '../src/fonts');
// WOFF2 known-table index (spec section 5.1): only the tags this font uses matter, `name` is index 5.
const KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB'];

function nameRecords(file: string): Map<number, string> {
  const b = fs.readFileSync(file);
  assert.equal(b.toString('latin1', 0, 4), 'wOF2');
  let p = 48;
  const u128 = () => { let v = 0; for (;;) { const c = b[p++]; v = v * 128 + (c & 0x7f); if (!(c & 0x80)) return v; } };
  const tables: { tag: string; length: number }[] = [];
  for (let i = 0, n = b.readUInt16BE(12); i < n; i++) {
    const flags = b[p++];
    const tag = (flags & 0x3f) === 0x3f ? b.toString('latin1', p, (p += 4)) : KNOWN[flags & 0x3f];
    const glyf = tag === 'glyf' || tag === 'loca';
    let length = u128();
    if (glyf === (flags >> 6 === 0)) length = u128(); // transformed: the stored length follows
    tables.push({ tag, length });
  }
  const data = zlib.brotliDecompressSync(b.subarray(p, p + b.readUInt32BE(20)));
  let offset = 0;
  for (const t of tables) {
    if (t.tag === 'name') {
      const s = data.subarray(offset, offset + t.length);
      const strings = s.readUInt16BE(4);
      const out = new Map<number, string>();
      for (let j = 0; j < s.readUInt16BE(2); j++) {
        const r = s.subarray(6 + 12 * j);
        if (r.readUInt16BE(0) !== 3) continue; // Windows, UTF-16BE
        const raw = Buffer.from(s.subarray(strings + r.readUInt16BE(10), strings + r.readUInt16BE(10) + r.readUInt16BE(8)));
        out.set(r.readUInt16BE(6), raw.swap16().toString('utf16le'));
      }
      return out;
    }
    offset += t.length;
  }
  throw new Error('no name table');
}

test('the shipped LINE Seed subset carries its copyright notice and the SIL OFL 1.1 licence', () => {
  const names = nameRecords(path.join(fonts, 'LINESeedTW_Rg-latin.woff2'));
  assert.equal(names.get(0), '© LY Corporation');
  assert.match(names.get(13) ?? '', /^This Font Software is licensed under the SIL Open Font License, Version 1\.1\./);
  assert.equal(names.get(14), 'https://scripts.sil.org/OFL');
  const ofl = fs.readFileSync(path.join(fonts, 'LINESeed-OFL.txt'), 'utf8');
  assert.match(ofl, /^© LY Corporation/);
  assert.match(ofl, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.doesNotMatch(ofl, /with Reserved Font Name/, 'no Reserved Font Name, so the subset may keep the family name');
});
