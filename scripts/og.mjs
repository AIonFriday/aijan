// Share images (Open Graph, 1200x630 PNG) drawn at build time with only Node built-ins.
//
// A small TrueType reader (glyf outlines + GPOS kerning), an anti-aliased path filler, and a PNG writer.
// Fonts live in scripts/fonts/ (SIL Open Font License). Bricolage Grotesque there is a static ExtraBold
// instance cut from the variable font; to remake it, see scripts/fonts/README.md.
//
//   import { renderHome, renderSession } from './og.mjs';
//   writeFileSync('x.png', renderSession({ title, kicker, when, where, month, day, scheduled }));

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
export const W = 1200, H = 630;

// Colors match the :root tokens in site/assets/site.css.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const C = {
  paper: hex('#F1EDF3'), card: hex('#FBF9FC'), ink: hex('#2A2035'), inkSoft: hex('#5E5469'),
  purple: hex('#6A4C8C'), green: hex('#4E7A5A'), gold: hex('#B08A2E'), btnInk: hex('#FFFDF6'),
};

// ---------- TrueType ----------
function loadFont(file) {
  const b = readFileSync(join(here, 'fonts', file));
  const u16 = (o) => b.readUInt16BE(o), i16 = (o) => b.readInt16BE(o), u32 = (o) => b.readUInt32BE(o);
  const tables = {};
  for (let i = 0, n = u16(4); i < n; i++) {
    const r = 12 + i * 16;
    tables[b.toString('latin1', r, r + 4)] = u32(r + 8);
  }
  const head = tables.head, upm = u16(head + 18), longLoca = i16(head + 50) === 1;
  const numH = u16(tables.hhea + 34);
  const ascent = i16(tables.hhea + 4);

  // cmap: format 4 (BMP) is all these fonts need.
  const cmap = new Map();
  for (let i = 0, n = u16(tables.cmap + 2); i < n; i++) {
    const r = tables.cmap + 4 + i * 8, st = tables.cmap + u32(r + 4);
    if (u16(r) !== 3 || u16(st) !== 4) continue;
    const segX2 = u16(st + 6), ends = st + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    for (let s = 0; s < segX2; s += 2) {
      const end = u16(ends + s), start = u16(starts + s), delta = i16(deltas + s), ro = u16(ranges + s);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let g;
        if (!ro) g = (c + delta) & 0xffff;
        else { g = u16(ranges + s + ro + (c - start) * 2); if (g) g = (g + delta) & 0xffff; }
        if (g) cmap.set(c, g);
      }
    }
    break;
  }

  const advance = (g) => u16(tables.hmtx + 4 * Math.min(g, numH - 1));
  const loca = (g) => (longLoca ? u32(tables.loca + g * 4) : u16(tables.loca + g * 2) * 2);

  // Outlines as contours of points [x, y, onCurve], in font units (y up).
  const outlines = new Map();
  function outline(g) {
    if (outlines.has(g)) return outlines.get(g);
    const start = loca(g), end = loca(g + 1), out = [];
    if (end > start) {
      const o = tables.glyf + start, nc = i16(o);
      if (nc >= 0) {
        const endPts = [];
        for (let i = 0; i < nc; i++) endPts.push(u16(o + 10 + i * 2));
        const np = nc ? endPts[nc - 1] + 1 : 0;
        let p = o + 10 + nc * 2;
        p += 2 + u16(p);
        const flags = [];
        while (flags.length < np) {
          const f = b[p++];
          flags.push(f);
          if (f & 8) for (let r = b[p++]; r > 0; r--) flags.push(f);
        }
        const coord = (short, same) => {
          const v = [];
          let c = 0;
          for (const f of flags) {
            if (f & short) { const d = b[p++]; c += f & same ? d : -d; }
            else if (!(f & same)) { c += i16(p); p += 2; }
            v.push(c);
          }
          return v;
        };
        const xs = coord(2, 16), ys = coord(4, 32);
        let s = 0;
        for (const e of endPts) {
          const c = [];
          for (let i = s; i <= e; i++) c.push([xs[i], ys[i], flags[i] & 1]);
          out.push(c);
          s = e + 1;
        }
      } else {
        // Composite glyph: place each component with its offset and (optional) scale.
        let p = o + 10, more = true;
        while (more) {
          const f = u16(p), cg = u16(p + 2);
          p += 4;
          let dx, dy;
          if (f & 1) { dx = i16(p); dy = i16(p + 2); p += 4; } else { dx = b.readInt8(p); dy = b.readInt8(p + 1); p += 2; }
          let a = 1, bb = 0, cc = 0, d = 1;
          const f2 = (q) => i16(q) / 16384;
          if (f & 8) { a = d = f2(p); p += 2; }
          else if (f & 0x40) { a = f2(p); d = f2(p + 2); p += 4; }
          else if (f & 0x80) { a = f2(p); bb = f2(p + 2); cc = f2(p + 4); d = f2(p + 6); p += 8; }
          if (!(f & 2)) dx = dy = 0; // point-matched anchors: not used by these fonts
          for (const c of outline(cg)) out.push(c.map(([x, y, on]) => [a * x + cc * y + dx, bb * x + d * y + dy, on]));
          more = !!(f & 0x20);
        }
      }
    }
    outlines.set(g, out);
    return out;
  }

  // Kerning from GPOS pair adjustment lookups (the fonts were cut down to only the kern feature).
  const kerns = new Map();
  const pairSubtables = [];
  if (tables.GPOS) {
    const gp = tables.GPOS, ll = gp + u16(gp + 8);
    for (let i = 0, n = u16(ll); i < n; i++) {
      const L = ll + u16(ll + 2 + i * 2);
      let type = u16(L);
      for (let j = 0, m = u16(L + 4); j < m; j++) {
        let st = L + u16(L + 6 + j * 2);
        if (type === 9) { if (u16(st + 2) !== 2) continue; st += u32(st + 4); }
        else if (type !== 2) continue;
        pairSubtables.push(st);
      }
    }
  }
  const coverage = (o, g) => {
    if (u16(o) === 1) {
      for (let i = 0, n = u16(o + 2); i < n; i++) if (u16(o + 4 + i * 2) === g) return i;
    } else {
      for (let i = 0, n = u16(o + 2); i < n; i++) {
        const r = o + 4 + i * 6;
        if (g >= u16(r) && g <= u16(r + 2)) return u16(r + 4) + g - u16(r);
      }
    }
    return -1;
  };
  const classOf = (o, g) => {
    if (u16(o) === 1) { const s = u16(o + 2); return g >= s && g < s + u16(o + 4) ? u16(o + 6 + (g - s) * 2) : 0; }
    for (let i = 0, n = u16(o + 2); i < n; i++) {
      const r = o + 4 + i * 6;
      if (g >= u16(r) && g <= u16(r + 2)) return u16(r + 4);
    }
    return 0;
  };
  const vsize = (vf) => { let n = 0; for (let v = vf; v; v >>= 1) n += v & 1; return n * 2; };
  const xAdv = (o, vf) => { if (!(vf & 4)) return 0; let off = 0; if (vf & 1) off += 2; if (vf & 2) off += 2; return i16(o + off); };
  function kern(g1, g2) {
    const key = g1 * 65536 + g2;
    if (kerns.has(key)) return kerns.get(key);
    let k = 0;
    for (const st of pairSubtables) {
      const ci = coverage(st + u16(st + 2), g1);
      if (ci < 0) continue;
      const vf1 = u16(st + 4), vf2 = u16(st + 6), s1 = vsize(vf1), s2 = vsize(vf2);
      if (u16(st) === 1) {
        const ps = st + u16(st + 10 + ci * 2);
        let found = false;
        for (let i = 0, n = u16(ps); i < n; i++) {
          const r = ps + 2 + i * (2 + s1 + s2);
          if (u16(r) === g2) { k = xAdv(r + 2, vf1); found = true; break; }
        }
        if (found) break;
      } else {
        const c1 = classOf(st + u16(st + 8), g1), c2 = classOf(st + u16(st + 10), g2);
        const n2 = u16(st + 14);
        k = xAdv(st + 16 + (c1 * n2 + c2) * (s1 + s2), vf1);
        break;
      }
    }
    kerns.set(key, k);
    return k;
  }

  const gid = (ch) => cmap.get(ch.codePointAt(0)) ?? cmap.get(0x3f) ?? 0;
  return { upm, ascent, gid, advance, outline, kern };
}

const FONTS = {
  display: loadFont('BricolageGrotesque-ExtraBold.ttf'),
  body: loadFont('AtkinsonHyperlegible-Regular.ttf'),
  bold: loadFont('AtkinsonHyperlegible-Bold.ttf'),
  mono: loadFont('IBMPlexMono-SemiBold.ttf'),
};

// ---------- canvas ----------
class Canvas {
  constructor(w, h, bg) {
    this.w = w; this.h = h;
    this.px = new Float32Array(w * h * 3);
    for (let i = 0; i < w * h; i++) this.px.set(bg, i * 3);
  }
  clone() { const c = Object.create(Canvas.prototype); c.w = this.w; c.h = this.h; c.px = this.px.slice(); return c; }
  blend(i, col, a) {
    if (a <= 0) return;
    if (a > 1) a = 1;
    const p = i * 3, px = this.px;
    px[p] += (col[0] - px[p]) * a; px[p + 1] += (col[1] - px[p + 1]) * a; px[p + 2] += (col[2] - px[p + 2]) * a;
  }
  // Axis-aligned rectangle with exact pixel coverage (used for the 29,000 map dots).
  rect(x, y, w, h, col, alpha = 1) {
    const x1 = x + w, y1 = y + h;
    for (let py = Math.max(0, Math.floor(y)); py < Math.min(this.h, Math.ceil(y1)); py++) {
      const cy = Math.min(py + 1, y1) - Math.max(py, y);
      for (let pxx = Math.max(0, Math.floor(x)); pxx < Math.min(this.w, Math.ceil(x1)); pxx++) {
        const cx = Math.min(pxx + 1, x1) - Math.max(pxx, x);
        this.blend(py * this.w + pxx, col, cx * cy * alpha);
      }
    }
  }
  // Fills polygons (lists of [x, y], y down) with the non-zero rule and anti-aliasing.
  // Signed-area accumulation, after font-rs by Raph Levien.
  fill(polys, col, alpha = 1) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pl of polys) for (const [x, y] of pl) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    if (!(maxX > minX)) return;
    const ox = Math.floor(minX) - 1, oy = Math.floor(minY), mw = Math.ceil(maxX) - ox + 2, mh = Math.ceil(maxY) - oy + 1;
    const a = new Float32Array(mw * mh + 2);
    const line = (x0, y0, x1, y1) => {
      x0 -= ox; x1 -= ox; y0 -= oy; y1 -= oy;
      if (y0 === y1) return;
      let dir = 1;
      if (y0 > y1) { dir = -1; [x0, x1] = [x1, x0]; [y0, y1] = [y1, y0]; }
      const dxdy = (x1 - x0) / (y1 - y0);
      let x = x0;
      for (let y = Math.floor(y0); y < Math.min(mh, Math.ceil(y1)); y++) {
        const ls = y * mw, dy = Math.min(y + 1, y1) - Math.max(y, y0), xn = x + dxdy * dy, d = dy * dir;
        const xa = Math.min(x, xn), xb = Math.max(x, xn), xf = Math.floor(xa), xi = xf, xc = Math.ceil(xb), xi1 = xc;
        if (xi1 <= xi + 1) {
          const xm = 0.5 * (x + xn) - xf;
          a[ls + xi] += d - d * xm; a[ls + xi + 1] += d * xm;
        } else {
          const s = 1 / (xb - xa), x0f = xa - xf, a0 = 0.5 * s * (1 - x0f) * (1 - x0f), x1f = xb - xc + 1, am = 0.5 * s * x1f * x1f;
          a[ls + xi] += d * a0;
          if (xi1 === xi + 2) a[ls + xi + 1] += d * (1 - a0 - am);
          else {
            const a1 = s * (1.5 - x0f);
            a[ls + xi + 1] += d * (a1 - a0);
            for (let k = xi + 2; k < xi1 - 1; k++) a[ls + k] += d * s;
            const a2 = a1 + (xi1 - xi - 3) * s;
            a[ls + xi1 - 1] += d * (1 - a2 - am);
          }
          a[ls + xi1] += d * am;
        }
        x = xn;
      }
    };
    for (const pl of polys) for (let i = 0; i < pl.length; i++) { const p = pl[i], q = pl[(i + 1) % pl.length]; line(p[0], p[1], q[0], q[1]); }
    let acc = 0;
    for (let y = 0; y < mh; y++) {
      const cy = y + oy;
      for (let x = 0; x < mw; x++) {
        acc += a[y * mw + x];
        const cx = x + ox;
        if (cy < 0 || cy >= this.h || cx < 0 || cx >= this.w) continue;
        const cov = Math.min(1, Math.abs(acc));
        if (cov > 0.002) this.blend(cy * this.w + cx, col, cov * alpha);
      }
    }
  }
  circle(cx, cy, r, col, alpha = 1) { this.fill([ring(cx, cy, r)], col, alpha); }
  ringStroke(cx, cy, r, w, col, alpha = 1) { this.fill([ring(cx, cy, r + w / 2), ring(cx, cy, r - w / 2).reverse()], col, alpha); }
  png() {
    const { w, h, px } = this, n = w * 3, raw = Buffer.alloc((n + 1) * h);
    for (let y = 0; y < h; y++) {
      const r = y * (n + 1);
      raw[r] = 1; // "Sub" filter: small files for flat paper
      for (let x = 0; x < n; x++) raw[r + 1 + x] = (Math.round(px[y * n + x]) - (x >= 3 ? Math.round(px[y * n + x - 3]) : 0)) & 255;
    }
    const chunk = (type, data) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
      const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
      const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
      return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  }
}
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const v of buf) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const ring = (cx, cy, r, n = 72) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)]);
function roundRect(x, y, w, h, r) {
  const pts = [], arc = (cx, cy, a0) => { for (let i = 0; i <= 12; i++) { const t = a0 + (i / 12) * (Math.PI / 2); pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } };
  arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI);
  return pts;
}

// ---------- text ----------
// Glyph runs with kerning and tracking (em fraction, like CSS letter-spacing in em).
function run(font, size, text, tracking = 0) {
  const s = size / font.upm, out = [];
  let x = 0, prev = null;
  for (const ch of text) {
    const g = font.gid(ch);
    if (prev !== null) x += font.kern(prev, g) * s;
    out.push({ g, x });
    x += font.advance(g) * s + tracking * size;
    prev = g;
  }
  return { glyphs: out, width: out.length ? x - tracking * size : 0 };
}
const measure = (f, size, text, tr) => run(f, size, text, tr).width;
function text(cv, font, size, str, x, baseline, col, { tracking = 0, alpha = 1 } = {}) {
  const s = size / font.upm, polys = [];
  for (const { g, x: gx } of run(font, size, str, tracking).glyphs) {
    for (const c of font.outline(g)) polys.push(flatten(c, x + gx, baseline, s));
  }
  if (polys.length) cv.fill(polys, col, alpha);
  return measure(font, size, str, tracking);
}
// TrueType contours are quadratic B-splines: on-curve points with off-curve controls (implied midpoints between two offs).
function flatten(c, ox, oy, s) {
  const P = c.map(([x, y, on]) => [ox + x * s, oy - y * s, on]), n = P.length, out = [];
  let start = P.findIndex((p) => p[2]);
  let first;
  if (start < 0) { first = [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2]; start = 0; }
  else { first = P[start]; start++; }
  out.push([first[0], first[1]]);
  let cur = first, ctrl = null;
  const quad = (p0, c1, p1) => {
    const steps = Math.max(2, Math.min(16, Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 3)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * c1[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c1[1] + t * t * p1[1]]);
    }
  };
  for (let k = 0; k < n; k++) {
    const p = P[(start + k) % n];
    if (p[2]) {
      if (ctrl) { quad(cur, ctrl, p); ctrl = null; } else out.push([p[0], p[1]]);
      cur = p;
    } else if (ctrl) {
      const mid = [(ctrl[0] + p[0]) / 2, (ctrl[1] + p[1]) / 2];
      quad(cur, ctrl, mid);
      cur = mid; ctrl = p;
    } else ctrl = p;
  }
  if (ctrl) quad(cur, ctrl, first);
  return out;
}
// Greedy word wrap, then narrow the box until the line count would grow, so lines come out even (like text-wrap: balance).
function wrap(font, size, str, maxW, tracking) {
  const words = str.split(/\s+/).filter(Boolean);
  const lay = (w) => {
    const lines = [];
    let cur = '';
    for (const word of words) {
      const t = cur ? cur + ' ' + word : word;
      if (cur && measure(font, size, t, tracking) > w) { lines.push(cur); cur = word; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const base = lay(maxW);
  let lo = maxW * 0.5, hi = maxW;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (lay(mid).length > base.length) lo = mid; else hi = mid; }
  return lay(hi);
}

// ---------- the map ----------
// Same data and coloring as the hero map (site/assets/map.js): street intersections lit from The Nieux.
let base = null;
function mapLayer() {
  if (base) return base;
  const win = {};
  new Function('window', readFileSync(join(here, '..', 'site/assets/nola-points.js'), 'utf8'))(win);
  const D = win.NOLA_POINTS, N = D.nieux;
  const hash = (i) => { let h = i * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const cv = new Canvas(W, H, C.paper);
  const sc = 0.86, ox = 850 - N[0] * sc, oy = 350 - N[1] * sc, dot = 2;
  for (let i = 0; i < D.p.length; i += 2) {
    const x = ox + D.p[i] * sc, y = oy + D.p[i + 1] * sc;
    if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue;
    const r = hash(i), col = r < 0.5 ? C.purple : r < 0.8 ? C.green : C.gold;
    cv.rect(Math.round(x - dot / 2), Math.round(y - dot / 2), dot, dot, col, 0.85); // whole pixels: crisp dots, smaller PNG
  }
  // Paper wash from the left so the words stay easy to read; the map stays clear on the right.
  for (let x = 0; x < W; x++) {
    const t = Math.min(1, Math.max(0, (x - 330) / 560)), a = 0.9 - 0.9 * (t * t * (3 - 2 * t));
    if (a <= 0) continue;
    for (let y = 0; y < H; y++) cv.blend(y * W + x, C.paper, a);
  }
  // The Nieux, 2040 St. Charles
  const px = ox + N[0] * sc, py = oy + N[1] * sc;
  cv.ringStroke(px, py, 15, 2, C.purple, 0.45);
  cv.circle(px, py, 8.5, C.ink);
  cv.circle(px, py, 7, C.gold);
  const credit = 'Streets © OpenStreetMap contributors', cw = measure(FONTS.mono, 13, credit);
  cv.fill([roundRect(W - 32 - cw, H - 36, cw + 16, 24, 5)], C.paper, 0.9);
  text(cv, FONTS.mono, 13, credit, W - 24 - cw, H - 19, C.inkSoft);
  base = cv;
  return cv;
}

const PAD = 64;
function mark(cv) {
  const f = FONTS.display, w = text(cv, f, 30, 'AI ', PAD, 72, C.ink, { tracking: -0.01 });
  text(cv, f, 30, 'January', PAD + w, 72, C.purple, { tracking: -0.01 });
}
function kickerLine(cv, str, y) { text(cv, FONTS.mono, 19, str.toUpperCase(), PAD, y, C.purple, { tracking: 0.08 }); }

// Biggest title size (down to a floor) that fits in `maxLines` lines.
function fitTitle(str, maxW, sizes, maxLines) {
  for (const size of sizes) {
    const lines = wrap(FONTS.display, size, str, maxW, -0.025);
    if (lines.length <= maxLines) return { size, lines };
  }
  // Still too long at the smallest size: keep the first lines and end with an ellipsis.
  const size = sizes[sizes.length - 1], lines = wrap(FONTS.display, size, str, maxW, -0.025).slice(0, maxLines);
  let last = lines[maxLines - 1].split(' ');
  while (last.length > 1 && measure(FONTS.display, size, last.join(' ') + '…', -0.025) > maxW) last.pop();
  lines[maxLines - 1] = last.join(' ').replace(/[,:;.]$/, '') + '…';
  return { size, lines };
}
function titleBlock(cv, str, top, maxW, sizes, maxLines) {
  const { size, lines } = fitTitle(str, maxW, sizes, maxLines), lh = size * 1.02;
  lines.forEach((l, i) => text(cv, FONTS.display, size, l, PAD - size * 0.04, top + size * 0.8 + i * lh, C.ink, { tracking: -0.025 }));
  return top + lines.length * lh;
}

export function renderHome() {
  const cv = mapLayer().clone();
  mark(cv);
  kickerLine(cv, 'Jan 8–28, 2027 · New Orleans', 150);
  const end = titleBlock(cv, 'You’re invited to learn AI.', 178, 700, [100, 92, 84], 2);
  ['Three weeks of free workshops, office hours,', 'and conversations. Beginners welcome.'].forEach((l, i) =>
    text(cv, FONTS.body, 28, l, PAD, end + 62 + i * 40, C.ink));
  return cv.png();
}

// s: { title, scheduled, month ("JAN"), day ("8"), when ("Fri, Jan 8, 9 – 10:30 AM"), where }
export function renderSession(s) {
  const cv = mapLayer().clone();
  mark(cv);
  kickerLine(cv, 'Free AI session · New Orleans', 150);
  titleBlock(cv, s.title, 172, 700, [84, 76, 68, 60, 54], 3);

  // Date tile, like .tile on the session page: purple when scheduled, green while it's still an idea.
  const tx = PAD, ty = 470, tw = 96, th = 104, accent = s.scheduled ? C.purple : C.green;
  cv.fill([roundRect(tx, ty, tw, th, 15)], accent);
  cv.fill([roundRect(tx + 2.5, ty + 32, tw - 5, th - 34.5, 13)], C.card);
  cv.rect(tx + 2.5, ty + 32, tw - 5, 14, C.card);
  const m = s.month || 'JAN';
  text(cv, FONTS.mono, 18, m, tx + (tw - measure(FONTS.mono, 18, m, 0.08)) / 2, ty + 23, C.btnInk, { tracking: 0.08 });
  const d = s.scheduled ? s.day : '?';
  text(cv, FONTS.display, 50, d, tx + (tw - measure(FONTS.display, 50, d)) / 2, ty + 88, s.scheduled ? C.ink : C.green);

  // Lines shrink to fit when a time or a place is long.
  const lx = tx + tw + 26, room = W - lx - 48;
  const line = (font, size, str, y, col) => text(cv, font, Math.min(size, (size * room) / measure(font, size, str)), str, lx, y, col);
  if (s.scheduled) {
    line(FONTS.bold, 34, s.when, ty + 44, C.ink);
    line(FONTS.body, 26, `${s.where} · Free`, ty + 86, C.inkSoft);
  } else {
    line(FONTS.bold, 34, 'Not scheduled yet', ty + 44, C.green);
    line(FONTS.body, 26, 'When five people say “I want this,” we pick a date.', ty + 86, C.inkSoft);
  }
  return cv.png();
}
