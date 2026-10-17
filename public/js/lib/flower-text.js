// "Font chữ bằng hoa": vẽ dòng chữ bằng một font thật lên mặt nạ (canvas phóng to 4 lần), rồi rải các bông hoa
// phủ kín nét chữ theo kiểu blue-noise (đều, không thành hàng lối) — kể cả dấu thanh tiếng Việt nhỏ cũng có hoa.
// Kích thước hoa tự co theo cỡ chữ: chữ to -> hoa to, chữ nhỏ -> hoa li ti.
import { hash, clamp } from './math.js';
import { disc, put } from './draw.js';
import { fontAt } from './fonts.js';

const SS = 4; // siêu lấy mẫu mặt nạ

/**
 * buildFlowerText(text, fontTpl, { BW, BH, cx, cy, maxW, maxH, createCanvas, seed })
 * -> { dots: [{ x, y, r, ph, u, leaf, lx, ly }], bbox: { x0, y0, x1, y1 } (toạ độ lưới), px: cỡ chữ (lưới) }
 */
export function buildFlowerText(text, fontTpl, { BW, BH, cx, cy, maxW, maxH, createCanvas, seed = 0 }) {
    const lines = String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) return { dots: [], bbox: { x0: cx, y0: cy, x1: cx, y1: cy }, px: 0 };
    const cw = BW * SS, ch = BH * SS, c = createCanvas(cw, ch), ctx = c.getContext('2d');
    const LH = 1.08;
    let px = (maxH * SS) / (lines.length * LH);
    ctx.font = fontAt(fontTpl, px);
    const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
    if (widest > maxW * SS) px *= (maxW * SS) / widest;
    ctx.font = fontAt(fontTpl, px);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * px * LH));
    const a = ctx.getImageData(0, 0, cw, ch).data;

    // khung bao thật của nét chữ (gồm cả dấu) -> căn giữa vào (cx, cy)
    let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (a[(y * cw + x) * 4 + 3] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return { dots: [], bbox: { x0: cx, y0: cy, x1: cx, y1: cy }, px: 0 };
    const offX = cx - (x0 + x1) / 2 / SS, offY = cy - (y0 + y1) / 2 / SS;
    const inside = (gx, gy) => { const x = Math.floor(gx * SS), y = Math.floor(gy * SS); return x >= 0 && y >= 0 && x < cw && y < ch && a[(y * cw + x) * 4 + 3] > 127; };

    // rải hoa: ứng viên trên lưới mịn (bước sp/3), xáo trộn, nhận nếu cách các hoa đã có >= sp*0.9
    const pxGrid = px / SS, sp = clamp(pxGrid * 0.068, 1.8, 9), minD = sp * 0.9, cell = minD;
    const cand = [];
    for (let gy = y0 / SS; gy <= y1 / SS; gy += sp / 3) for (let gx = x0 / SS; gx <= x1 / SS; gx += sp / 3) if (inside(gx, gy)) cand.push([gx, gy, hash(gx * 13.7 + gy * 71.3 + seed)]);
    cand.sort((p, q) => p[2] - q[2]);
    const buckets = new Map(), dots = [];
    const key = (i, j) => i * 100003 + j;
    for (const [gx, gy] of cand) {
        const i = Math.floor(gx / cell), j = Math.floor(gy / cell);
        let ok = true;
        for (let di = -1; di <= 1 && ok; di++) for (let dj = -1; dj <= 1 && ok; dj++) for (const p of buckets.get(key(i + di, j + dj)) || []) if (Math.hypot(p.gx - gx, p.gy - gy) < minD) { ok = false; break; }
        if (!ok) continue;
        const p = { gx, gy }; dots.push(p);
        const k = key(i, j); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(p);
    }
    // hoa ở mép nét chữ: thỉnh thoảng mọc thêm một chiếc lá hướng ra ngoài
    const out = dots.map((p, n) => {
        let sx = 0, sy = 0, cnt = 0;
        for (const q of dots) { const dd = Math.hypot(q.gx - p.gx, q.gy - p.gy); if (dd > 0 && dd < sp * 1.7) { sx += q.gx - p.gx; sy += q.gy - p.gy; cnt++; } }
        const u = hash(n * 3.17 + seed * 0.7), edge = cnt < 4, len = Math.hypot(sx, sy) || 1;
        return {
            x: p.gx + offX, y: p.gy + offY, r: sp * (0.56 + 0.16 * hash(n * 7.3 + seed)), ph: hash(n * 5.1 + 2) * 6.283, u,
            leaf: edge && u < 0.35, lx: -sx / len, ly: -sy / len
        };
    });
    return { dots: out, bbox: { x0: x0 / SS + offX, y0: y0 / SS + offY, x1: x1 / SS + offX, y1: y1 / SS + offY }, px: pxGrid, sp };
}

const lighten = (c, k) => [c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k];
const darken = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// Một bông hoa 5 cánh pixel art; open: 0 (nụ) -> 1 (nở hẳn)
export function drawFlower(d, BW, BH, x, y, r, col, center, rot, open = 1, a = 1) {
    if (open <= 0.02) return;
    const R = r * (0.35 + 0.65 * open);
    if (R < 1.3) { disc(d, BW, BH, x, y, Math.max(0.6, R), col, a); put(d, BW, BH, x, y, center, a * 0.9); return; }
    const pr = R * 0.5, hi = lighten(col, 0.35), lo = darken(col, 0.82);
    for (let k = 0; k < 5; k++) {
        const ang = rot + k * 1.2566, px = x + Math.cos(ang) * R * 0.55, py = y + Math.sin(ang) * R * 0.55;
        disc(d, BW, BH, px, py, pr, Math.sin(ang) > 0.3 ? lo : col, a);
        if (pr >= 1.6) disc(d, BW, BH, px - pr * 0.25, py - pr * 0.25, pr * 0.4, hi, a * 0.7);
    }
    disc(d, BW, BH, x, y, Math.max(0.7, R * 0.3), center, a);
    if (R >= 3) put(d, BW, BH, x - R * 0.1, y - R * 0.1, lighten(center, 0.5), a);
}

// Chiếc lá nhỏ hướng (dx, dy) từ gốc (x, y)
export function drawLeaf(d, BW, BH, x, y, len, dx, dy, a = 1) {
    const n = Math.max(2, Math.round(len * 1.5));
    for (let k = 0; k <= n; k++) {
        const f = k / n, w = Math.sin(f * Math.PI) * len * 0.28;
        disc(d, BW, BH, x + dx * len * f, y + dy * len * f, Math.max(0.5, w), f < 0.5 ? [70, 140, 70] : [104, 172, 84], a);
    }
}
