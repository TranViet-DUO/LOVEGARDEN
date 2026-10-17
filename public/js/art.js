// Vẽ pixel art cho khu vườn: luống đất, 8 loài hoa qua từng giai đoạn, sâu, cỏ dại, bầu trời ngày/đêm/thời tiết, đồ trang trí.
// Mọi hàm nhận C = { d, BW, H, t, oy }: d = bộ đệm RGBA BW x H, oy = độ lệch dọc (khi máy quay đang lia).
import { put, disc, line, glow, drawHeart } from './lib/draw.js';
import { drawLeaf } from './lib/flower-text.js';
import { clamp, lerp, lerp3, hash } from './lib/math.js';
import { DAY, NIGHT_AT, SPECIES, LEAVE_GRACE } from './rules.js';

const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const lighten = (c, k) => lerp3(c, [255, 255, 255], k), darken = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const BROWN = [150, 112, 78];
export const TULIP = [[235, 60, 90], [255, 140, 190], [255, 210, 70], [170, 110, 230]];
// màu đại diện mỗi loài (dùng cho cánh hoa bay / chữ bằng hoa)
export const SP_COL = { cuc: [255, 255, 250], huongduong: [255, 206, 40], tulip: [235, 60, 90], oaihuong: [160, 120, 230], camtucau: [120, 160, 255], hong: [215, 35, 65], quynh: [250, 250, 255], songtam: [255, 100, 150], lan: [190, 110, 220], xuongrong: [255, 120, 170], mai: [255, 214, 40], bocongcanh: [250, 250, 240], maudon: [240, 80, 130], vantho: [255, 150, 30], muoigio: [240, 60, 160], daquy: [255, 200, 30], camchuong: [255, 120, 150], thuocduoc: [230, 70, 60], ly: [255, 240, 245], hoagiay: [210, 50, 150] };
const baseCol = (sp, hue) => (sp === 'tulip' ? TULIP[hue || 0] : SP_COL[sp] || [255, 200, 220]);
// hoa ghép đôi: hình của loài mình, màu của loài kia (cùng loài thì màu nhạt hơn, phớt hồng)
export const spColor = P => { if (!P.hy) return baseCol(P.sp, P.hue); const [a, b] = P.hy.split('+'), o = a === P.sp ? b : a; return o === P.sp ? lerp3(baseCol(o, P.hue), [255, 150, 190], 0.45) : baseCol(o, (P.hue + 1) % 4); };
const HEIGHT = { cuc: 7, huongduong: 11, tulip: 7, oaihuong: 7.5, camtucau: 7, hong: 8, quynh: 8.5, songtam: 7, lan: 8, xuongrong: 5, mai: 8, bocongcanh: 7, maudon: 7.5, vantho: 6, muoigio: 3.5, daquy: 9, camchuong: 7, thuocduoc: 8, ly: 9, hoagiay: 7.5 };

export function rect(C, x, y, w, h, col, a = 1) { for (let yy = Math.round(y); yy < Math.round(y + h); yy++) for (let xx = Math.round(x); xx < Math.round(x + w); xx++) put(C.d, C.BW, C.H, xx, yy + C.oy, col, a); }
function rrect(C, x, y, w, h, r, col, a = 1) {
    for (let yy = 0; yy < h; yy++) {
        const dy = yy < r ? r - yy : yy > h - r ? yy - (h - r) : 0, inset = dy ? r - Math.sqrt(Math.max(0, r * r - dy * dy)) : 0;
        for (let xx = Math.round(x + inset); xx < Math.round(x + w - inset); xx++) put(C.d, C.BW, C.H, xx, y + yy + C.oy, col, a);
    }
}
export function drawPetal(C, x, y, ang, len, wid, c1, c2, a = 1) {
    const n = Math.max(4, Math.ceil(len * 1.4)), ca = Math.cos(ang), sa = Math.sin(ang);
    for (let s = 0; s <= n; s++) { const u = s / n, w = wid * 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08 + 0.04)), 0.7); disc(C.d, C.BW, C.H, x + ca * len * u, y + C.oy + sa * len * u, Math.max(0.5, w), lerp3(c1, c2, u), a); }
}

// ---------- luống đất ----------
export function drawBed(C, b, P, i, sel, exp = false) {
    const { x, y, w, h, k } = b;
    if (P.st === 'locked') { // đất chưa mua: cỏ nền; ô mua được thì có viền chấm + dấu cộng nhấp nháy
        if (!exp) return;
        const a = 0.45 + 0.25 * Math.sin(C.t * 2.5 + i), col = [255, 250, 225];
        for (let xx = 0; xx < w; xx += 2) { put(C.d, C.BW, C.H, x + xx, y + C.oy, col, a); put(C.d, C.BW, C.H, x + xx, y + h - 1 + C.oy, col, a); }
        for (let yy = 0; yy < h; yy += 2) { put(C.d, C.BW, C.H, x, y + yy + C.oy, col, a); put(C.d, C.BW, C.H, x + w - 1, y + yy + C.oy, col, a); }
        const cx = x + w / 2, cy = y + h / 2, r = Math.max(2, Math.round(k * 0.9));
        for (let j = -r; j <= r; j++) { put(C.d, C.BW, C.H, cx + j, cy + C.oy, col, a + 0.2); put(C.d, C.BW, C.H, cx, cy + j + C.oy, col, a + 0.2); }
        if (sel) rrect(C, x - 1, y - 1, w + 2, h + 2, 3, [255, 255, 255], 0.25);
        return;
    }
    if (P.st === 'wild') { // cỏ hoang um tùm, đá; mỗi nhát cuốc để lại vệt đất
        rrect(C, x, y, w, h, 3, [74, 132, 62]);
        for (let n = 0; n < 14; n++) { const hx = x + hash(i * 31 + n) * w, hy = y + h * (0.3 + 0.7 * hash(i * 17 + n)), hh = k * (1.5 + 2 * hash(i * 7 + n)), sw = Math.sin(C.t * 1.5 + n) * 0.6; line(C.d, C.BW, C.H, hx, hy + C.oy, hx + sw, hy - hh + C.oy, n % 3 ? [96, 160, 72] : [130, 180, 80], 1); }
        for (let n = 0; n < 2; n++) disc(C.d, C.BW, C.H, x + w * (0.25 + 0.5 * hash(i * 13 + n)), y + h * (0.6 + 0.2 * hash(i + n * 5)) + C.oy, k * 0.7, [150, 150, 140]);
        for (let n = 0; n < (P.dig || 0); n++) rrect(C, x + w * (0.15 + 0.3 * n), y + h * 0.45, w * 0.3, h * 0.35, 2, [140, 98, 62]);
        if (sel) rrect(C, x - 1, y - 1, w + 2, h + 2, 3, [255, 255, 255], 0.25);
        return;
    }
    const soil = P.st === 'plant' ? lerp3([186, 138, 92], [92, 60, 38], clamp(P.w, 0, 1)) : P.st === 'dead' ? [150, 110, 76] : [140, 98, 64];
    rrect(C, x, y + 1, w, h, 3, darken(soil, 0.7));
    rrect(C, x, y, w, h - 1, 3, soil);
    for (let f = 1; f <= 3; f++) line(C.d, C.BW, C.H, x + 3, y + h * f / 4 + C.oy, x + w - 4, y + h * f / 4 + C.oy, darken(soil, 0.85), 1, 0.8); // luống cày
    if (sel) rrect(C, x - 1, y - 1, w + 2, h + 2, 3, [255, 255, 255], 0.3);
    if (P.weed > 0) { // cỏ dại mọc quanh luống, nở hoa dại khi um tùm
        const n = Math.ceil(P.weed * 7);
        for (let j = 0; j < n; j++) {
            const wx = x + 2 + hash(i * 41 + j) * (w - 4), wy = y + h * (0.2 + 0.75 * hash(i * 23 + j)), hh = k * (0.8 + 1.4 * P.weed);
            for (const s of [-1, 0, 1]) line(C.d, C.BW, C.H, wx, wy + C.oy, wx + s * hh * 0.4 + Math.sin(C.t * 2 + j) * 0.4, wy - hh * (s ? 0.8 : 1) + C.oy, [56, 110, 46], 1);
            if (P.weed > 0.5) put(C.d, C.BW, C.H, wx, wy - hh + C.oy, j % 2 ? [255, 240, 120] : [255, 255, 255]);
        }
    }
    if (P.st === 'soil' && P.left > 0) { // bỏ trống lâu: cỏ hoang lấn dần vào luống
        const f = 1 - P.left / LEAVE_GRACE, n = Math.ceil(f * 12);
        for (let j = 0; j < n; j++) { const hx = x + 2 + hash(i * 53 + j) * (w - 4), hy = y + h * (0.25 + 0.7 * hash(i * 29 + j)), hh = k * (0.6 + 1.6 * f); line(C.d, C.BW, C.H, hx, hy + C.oy, hx + Math.sin(C.t * 1.5 + j) * 0.5, hy - hh + C.oy, j % 3 ? [96, 160, 72] : [130, 180, 80], 1); }
    }
    if (P.st === 'dead') for (let j = 0; j < 3; j++) { const sx = x + w * (0.35 + 0.15 * j), sy = y + h * 0.7; line(C.d, C.BW, C.H, sx, sy + C.oy, sx + (j - 1) * k * 1.2, sy - k * (3 + j) + C.oy, [120, 90, 60], 1); }
    if (P.st === 'plant') { // thanh nước (xanh dương) + thanh lớn (xanh lá, vàng khi nở)
        const bw = w * 0.8, bx = x + w * 0.1, by = y + h + 1;
        rect(C, bx, by, bw, 1, [40, 30, 30], 0.5); rect(C, bx, by, bw * clamp(P.w, 0, 1), 1, P.w < 0.15 ? [255, 90, 90] : [90, 170, 255]);
        rect(C, bx, by + 1, bw, 1, [40, 30, 30], 0.5); rect(C, bx, by + 1, bw * (P.bloom ? 1 : P.g), 1, P.bloom ? (P.faded ? [180, 140, 90] : [255, 214, 80]) : [110, 210, 90]);
    }
}

// ---------- cây & hoa ----------
export function drawPlant(C, b, P, lean, night) {
    const k = b.k, bx = b.bx, by = b.by + C.oy, g = P.g, H = HEIGHT[P.sp] * k, col = spColor(P);
    if (g < 0.05) { disc(C.d, C.BW, C.H, bx, by, k * 0.6, [110, 76, 50]); put(C.d, C.BW, C.H, bx, by - 1, [240, 220, 160]); return null; } // hạt vừa gieo
    const droop = P.hp < 0.6 ? (0.6 - P.hp) * 2 : 0, faded = P.faded, bloomShrink = faded ? 0.85 : 1;
    if (P.sp === 'muoigio') for (let j = 0; j < 7; j++) { const a = j * 0.9; line(C.d, C.BW, C.H, bx, by, bx + Math.cos(a) * k * 1.8 * Math.min(1, 0.3 + g), by - Math.abs(Math.sin(a)) * k * 0.8, [90, 160, 70], 1); } // thân mọng bò sát đất
    if (P.sp === 'xuongrong') { // thân mọng có gai, hoa nở trên đỉnh
        const ch = H * (0.3 + 0.7 * Math.min(1, g / 0.75)), cw = k * 1.5, cc = droop ? [150, 150, 80] : [70, 150, 80];
        for (let yy = 0; yy < ch; yy++) { const w = cw * (yy > ch - cw ? Math.sqrt(Math.max(0, 1 - ((yy - (ch - cw)) / cw) ** 2)) : 1); for (let xx = -w; xx <= w; xx++) put(C.d, C.BW, C.H, bx + xx, by - yy, xx < -w * 0.3 ? cc : lighten(cc, 0.15)); }
        if (g > 0.45) for (const sd of [-1, 1]) { const ay = by - ch * 0.45; for (let yy = 0; yy < k * 2; yy++) put(C.d, C.BW, C.H, bx + sd * (cw + k * 0.8), ay - yy, cc); line(C.d, C.BW, C.H, bx + sd * cw, ay, bx + sd * (cw + k * 0.8), ay, cc, 1); }
        for (let j = 0; j < 6; j++) put(C.d, C.BW, C.H, bx + (j % 2 ? cw : -cw), by - ch * (0.15 + j * 0.13), [240, 240, 200]);
        const tx = bx, ty = by - ch;
        if (C.noHead) return { x: tx, y: ty - C.oy };
        if (!P.bloom) { if (g > 0.6) disc(C.d, C.BW, C.H, tx, ty - k * 0.4, k * (0.4 + 0.6 * smooth((g - 0.6) / 0.4)), lerp3([110, 170, 90], col, 0.5)); return { x: tx, y: ty - C.oy }; }
        const fc = faded ? lerp3(col, BROWN, 0.55) : col;
        for (let j = 0; j < 6; j++) { const a = j * 1.047 + C.t * 0.2; disc(C.d, C.BW, C.H, tx + Math.cos(a) * k * 0.9, ty - k * 0.5 + Math.sin(a) * k * 0.6, k * 0.6, fc); }
        disc(C.d, C.BW, C.H, tx, ty - k * 0.5, k * 0.4, [255, 230, 120]);
        return { x: tx, y: ty - C.oy };
    }
    const h = H * (0.15 + 0.85 * Math.min(1, g / 0.75)), stemCol = droop ? lerp3([80, 150, 60], [150, 130, 70], droop) : [80, 150, 60];
    const sway = lean * 0.35 + Math.sin(C.t * 1.3 + bx) * 0.05;
    const tx = bx + (sway + droop * 0.7) * h, ty = by - h * (1 - droop * 0.4);
    const mx = bx + sway * h * 0.2, my = by - h * 0.5;
    const pt = u => [(1 - u) ** 2 * bx + 2 * u * (1 - u) * mx + u * u * tx, (1 - u) ** 2 * by + 2 * u * (1 - u) * my + u * u * ty];
    let [lx, ly] = pt(0);
    for (let s = 1, n = Math.max(2, Math.ceil(h)); s <= n; s++) { const [x, y] = pt(s / n); line(C.d, C.BW, C.H, lx, ly, x, y, stemCol, P.sp === 'huongduong' && g > 0.5 ? 2 : 1); lx = x; ly = y; }
    if (P.sp === 'oaihuong') for (const s of [-1, 1]) line(C.d, C.BW, C.H, bx, by, bx + s * k * 1.5 + sway * h, by - h * 0.85, stemCol, 1); // khóm oải hương
    // lá
    const leafN = g < 0.2 ? 1 : 2, ls = k * (P.sp === 'huongduong' ? 2.2 : 1.4) * Math.min(1, 0.4 + g);
    for (let j = 0; j < leafN; j++) {
        const [x, y] = pt(0.25 + 0.25 * j), s = j % 2 ? 1 : -1;
        if (P.sp === 'songtam') drawHeart(C.d, C.BW, C.H, x + s * ls * 0.6, y, ls * 0.45, droop ? [140, 150, 80] : [96, 176, 80]);
        else drawLeaf(C.d, C.BW, C.H, x, y, ls * (P.sp === 'oaihuong' ? 0.7 : 1), s * 0.9, -0.35 + droop * 0.6);
    }
    if (P.sp === 'huongduong' && g > 0.4) drawLeaf(C.d, C.BW, C.H, ...pt(0.6), ls, 0.9, -0.2);
    if (!P.bloom) { // nụ
        if (g > 0.6) {
            const bs = k * (0.4 + 0.9 * smooth((g - 0.6) / 0.4));
            if (P.sp === 'quynh' && g >= 0.85 && !night) { disc(C.d, C.BW, C.H, tx + k * 0.5, ty + k * 0.6, bs, [245, 240, 225]); line(C.d, C.BW, C.H, tx, ty, tx + k * 0.5, ty + k * 0.4, stemCol, 1); } // nụ quỳnh rủ xuống chờ đêm
            else { disc(C.d, C.BW, C.H, tx, ty - bs * 0.5, bs, lerp3([96, 170, 80], P.sp === 'bocongcanh' ? [255, 214, 60] : col, smooth((g - 0.75) / 0.25) * 0.8)); disc(C.d, C.BW, C.H, tx, ty, bs * 0.6, [86, 150, 66]); }
        }
        return { x: tx, y: ty - C.oy };
    }
    if (C.noHead) return { x: tx, y: ty - C.oy }; // đoạn kết: cánh hoa đã bay đi
    // hoa nở
    const s = k * 2.3 * bloomShrink, c = faded ? lerp3(col, BROWN, 0.55) : col, rot = C.t * 0.2 + bx;
    const hx = tx, hy = ty + (faded ? k * 0.8 : 0);
    switch (P.sp) {
        case 'cuc': for (let j = 0; j < 10; j++) { const a = j * 0.628 + rot * 0.2; line(C.d, C.BW, C.H, hx, hy, hx + Math.cos(a) * s, hy + Math.sin(a) * s * 0.85, c, 1); } disc(C.d, C.BW, C.H, hx, hy, s * 0.35, faded ? BROWN : [255, 200, 50]); break;
        case 'huongduong': for (let j = 0; j < 12; j++) { const a = j * 0.5236; disc(C.d, C.BW, C.H, hx + Math.cos(a) * s * 0.85, hy + Math.sin(a) * s * 0.85, s * 0.36, c); } disc(C.d, C.BW, C.H, hx, hy, s * 0.55, [110, 66, 30]); for (let j = 0; j < 6; j++) put(C.d, C.BW, C.H, hx + Math.cos(j) * s * 0.3, hy + Math.sin(j) * s * 0.3, [70, 40, 20]); break;
        case 'tulip': disc(C.d, C.BW, C.H, hx, hy, s * 0.62, darken(c, 0.85)); for (const sx of [-1, 1]) disc(C.d, C.BW, C.H, hx + sx * s * 0.38, hy - s * 0.25, s * 0.42, c); disc(C.d, C.BW, C.H, hx, hy - s * 0.35, s * 0.4, lighten(c, 0.2)); break;
        case 'oaihuong': for (const sx of [-1, 0, 1]) for (let j = 0; j < 5; j++) { const px = hx + sx * k * 1.5 * (1 - j * 0.1), py = hy - j * k * 0.7 + (sx ? k * 0.8 : 0); disc(C.d, C.BW, C.H, px, py, Math.max(0.6, k * 0.45), j % 2 ? c : lighten(c, 0.25)); } break;
        case 'camtucau': for (let j = 0; j < 16; j++) { const a = j * 2.4, r = s * 0.85 * Math.sqrt((j + 0.5) / 16); disc(C.d, C.BW, C.H, hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.85, s * 0.3, faded ? c : [[120, 160, 255], [160, 130, 245], [200, 160, 255], [140, 200, 255]][j % 4]); } break;
        case 'hong': for (const sx of [-1, 1]) drawLeaf(C.d, C.BW, C.H, hx, hy + s * 0.5, s * 0.6, sx, 0.4); disc(C.d, C.BW, C.H, hx, hy, s * 0.72, darken(c, 0.8)); disc(C.d, C.BW, C.H, hx - s * 0.08, hy - s * 0.06, s * 0.52, c); disc(C.d, C.BW, C.H, hx + s * 0.06, hy - s * 0.1, s * 0.3, lighten(c, 0.25)); put(C.d, C.BW, C.H, hx, hy - s * 0.1, darken(c, 0.6)); break;
        case 'quynh': for (let j = 0; j < 8; j++) drawPetal(C, hx, hy - C.oy, j * 0.785 + rot * 0.1, s * 1.3, s * 0.5, faded ? c : [235, 240, 230], faded ? c : [255, 255, 255]); disc(C.d, C.BW, C.H, hx, hy, s * 0.25, [255, 245, 190]); break;
        case 'songtam': { const pulse = 1 + 0.08 * Math.sin(C.t * 3 + bx); drawHeart(C.d, C.BW, C.H, hx, hy, s * 0.95 * pulse, c); put(C.d, C.BW, C.H, hx - s * 0.35, hy - s * 0.3, [255, 255, 255], 0.9); break; }
        case 'vantho': for (let j = 0; j < 26; j++) { const a = j * 2.4, r = s * 0.8 * Math.sqrt((j + 0.5) / 26); disc(C.d, C.BW, C.H, hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.85, s * 0.22, j % 3 ? c : faded ? c : [255, 190, 60]); } break;
        case 'muoigio': for (const [ox, oy2] of [[0, 0], [-0.9, 0.35], [0.9, 0.3]]) { const fx2 = hx + ox * s, fy2 = hy + oy2 * s + s * 0.4; for (let q = 0; q < 5; q++) { const a = q * 1.2566 + ox; disc(C.d, C.BW, C.H, fx2 + Math.cos(a) * s * 0.28, fy2 + Math.sin(a) * s * 0.28, s * 0.24, c); } put(C.d, C.BW, C.H, fx2, fy2, [255, 230, 120]); } break;
        case 'daquy': for (let j = 0; j < 10; j++) { const a = j * 0.628 + rot * 0.1; drawPetal(C, hx, hy - C.oy, a, s * 0.95, s * 0.38, c, lighten(c, 0.2)); } disc(C.d, C.BW, C.H, hx, hy, s * 0.32, faded ? BROWN : [190, 120, 30]); break;
        case 'camchuong': { disc(C.d, C.BW, C.H, hx, hy, s * 0.7, darken(c, 0.85)); for (let j = 0; j < 14; j++) { const a = j * 0.449, r = s * (0.62 + 0.12 * (j % 2)); disc(C.d, C.BW, C.H, hx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.8, s * 0.2, j % 2 ? c : lighten(c, 0.35)); } disc(C.d, C.BW, C.H, hx, hy, s * 0.4, lighten(c, 0.2)); break; }
        case 'thuocduoc': for (let ring = 0; ring < 3; ring++) { const n = 12 - ring * 3, rr = s * (1 - ring * 0.28); for (let j = 0; j < n; j++) drawPetal(C, hx, hy - C.oy, j * 6.283 / n + ring * 0.3, rr, rr * 0.38, ring === 2 ? lighten(c, 0.3) : ring ? c : darken(c, 0.8), ring === 2 ? lighten(c, 0.5) : lighten(c, 0.15)); } disc(C.d, C.BW, C.H, hx, hy, s * 0.15, [255, 210, 80]); break;
        case 'ly': for (let j = 0; j < 6; j++) { const a = j * 1.047 - Math.PI / 2 + 0.2; drawPetal(C, hx, hy - C.oy, a, s * 1.15, s * 0.45, faded ? c : [255, 200, 215], faded ? c : c); } for (let j = 0; j < 6; j++) { const a = j * 1.047 - 1.3; put(C.d, C.BW, C.H, hx + Math.cos(a) * s * 0.45, hy + Math.sin(a) * s * 0.45, [200, 60, 90]); } for (let j = 0; j < 3; j++) put(C.d, C.BW, C.H, hx + (j - 1) * s * 0.2, hy - s * 0.3, [200, 120, 40]); break;
        case 'hoagiay': for (const [ox, oy2] of [[0, 0], [-0.8, 0.4], [0.8, 0.35], [-0.2, -0.75], [0.55, -0.55], [0.1, 0.8]]) { const fx2 = hx + ox * s, fy2 = hy + oy2 * s; for (let q = 0; q < 3; q++) { const a = q * 2.094 + ox * 2; disc(C.d, C.BW, C.H, fx2 + Math.cos(a) * s * 0.18, fy2 + Math.sin(a) * s * 0.18, s * 0.22, q ? c : lighten(c, 0.2)); } put(C.d, C.BW, C.H, fx2, fy2, [255, 250, 230]); } break;
        case 'lan': for (let j = 0; j < 3; j++) { const fx2 = hx + (j - 1) * s * 0.75, fy2 = hy + Math.abs(j - 1) * s * 0.45; for (let q = 0; q < 5; q++) { const a = q * 1.2566 - Math.PI / 2; disc(C.d, C.BW, C.H, fx2 + Math.cos(a) * s * 0.32, fy2 + Math.sin(a) * s * 0.32, s * 0.24, q === 2 ? darken(c, 0.7) : c); } put(C.d, C.BW, C.H, fx2, fy2, [255, 240, 150]); } break;
        case 'mai': line(C.d, C.BW, C.H, hx - s, hy + s * 0.6, hx + s, hy - s * 0.6, [110, 76, 50], 1); for (const [ox, oy2] of [[0, 0], [-0.9, 0.5], [0.85, 0.35], [-0.3, 1.1], [0.5, -0.7]]) { const fx2 = hx + ox * s, fy2 = hy + oy2 * s; for (let q = 0; q < 5; q++) { const a = q * 1.2566 + ox; disc(C.d, C.BW, C.H, fx2 + Math.cos(a) * s * 0.25, fy2 + Math.sin(a) * s * 0.25, s * 0.2, c); } put(C.d, C.BW, C.H, fx2, fy2, [200, 120, 30]); } break;
        case 'bocongcanh': for (let j = 0; j < 22; j++) { const a = j * 2.4, r = s * 0.85 * Math.sqrt((j + 0.5) / 22); put(C.d, C.BW, C.H, hx + Math.cos(a) * r, hy + Math.sin(a) * r, faded ? c : [255, 255, 255], 0.9); } disc(C.d, C.BW, C.H, hx, hy, s * 0.2, [220, 220, 200]); if (!faded && Math.sin(C.t * 0.7 + bx) > 0.8) { const f = (C.t * 0.7 + bx) % 1; put(C.d, C.BW, C.H, hx + f * s * 3, hy - f * s * 2, [255, 255, 255], 1 - f); } break;
        case 'maudon': for (let ring = 0; ring < 3; ring++) { const n = 8 - ring * 2, rr = s * (0.8 - ring * 0.25); for (let j = 0; j < n; j++) { const a = j * 6.283 / n + ring * 0.4; disc(C.d, C.BW, C.H, hx + Math.cos(a) * rr * 0.7, hy + Math.sin(a) * rr * 0.6, rr * 0.45, ring === 2 ? lighten(c, 0.35) : ring ? lighten(c, 0.15) : darken(c, 0.85)); } } disc(C.d, C.BW, C.H, hx, hy, s * 0.15, [255, 220, 120]); break;
    }
    return { x: hx, y: hy - C.oy };
}

// ---------- chỉ báo trên đầu cây: khát nước, sâu, sẵn sàng hái, đang bón ----------
export function drawStatus(C, b, P, head) {
    if (P.st !== 'plant' || !head) return;
    const k = b.k, bx = head.x, by = head.y + C.oy - k * 3.2, t = C.t;
    if (P.bug) { // con sâu xanh bò trên thân
        const sx = b.bx + Math.sin(t * 2) * k * 0.6, sy = b.by + C.oy - k * 2.5;
        for (let j = 0; j < 3; j++) disc(C.d, C.BW, C.H, sx + j * k * 0.55, sy + Math.sin(t * 6 + j) * 0.5, k * 0.38, j === 2 ? [70, 130, 40] : [140, 210, 70]);
        put(C.d, C.BW, C.H, sx + k * 1.2, sy - 0.5, [20, 20, 20]);
    }
    if (P.w < Math.max(0.15, SPECIES[P.sp]?.minWater || 0)) { // bong bóng "khát nước" (sen: dưới 50% đã cần tưới)
        const yy = by + Math.sin(t * 4) * 0.8;
        disc(C.d, C.BW, C.H, bx, yy, k * 1.15, [255, 255, 255], 0.95); put(C.d, C.BW, C.H, bx - k * 0.4, yy + k * 1.2, [255, 255, 255]);
        disc(C.d, C.BW, C.H, bx, yy + k * 0.15, k * 0.5, [80, 160, 255]); put(C.d, C.BW, C.H, bx, yy - k * 0.45, [80, 160, 255]);
    } else if (P.bloom && !P.faded && Math.sin(t * 3 + b.bx) > 0.6) { // lấp lánh: hái được rồi
        const s = Math.max(1, Math.round(k * 0.8));
        for (let j = -s; j <= s; j++) { put(C.d, C.BW, C.H, bx + k * 1.6 + j, by + k * 1.2, [255, 255, 200], 1 - Math.abs(j) / (s + 1)); put(C.d, C.BW, C.H, bx + k * 1.6, by + k * 1.2 + j, [255, 255, 200], 1 - Math.abs(j) / (s + 1)); }
    }
    if (SPECIES[P.sp]?.needFert && !P.fed && !P.bloom && P.g >= 0.55) { const yy = by + Math.sin(t * 4) * 0.8; disc(C.d, C.BW, C.H, bx, yy, k * 1.15, [255, 255, 255], 0.95); disc(C.d, C.BW, C.H, bx, yy, k * 0.55, [120, 220, 120]); } // mẫu đơn chờ bón phân
    if (P.hy && !P.bloom) drawHeart(C.d, C.BW, C.H, b.bx + k * 1.6, b.by + C.oy - k * 1.2 - Math.abs(Math.sin(t * 2)) * 0.8, k * 0.55, [255, 120, 170]); // dấu hoa ghép đôi
    if (P.shiny && P.g > 0.3) for (let j = 0; j < 4; j++) { // cây lấp lánh: các đốm sáng xoay quanh đầu cây
        const an = t * 1.6 + j * 1.571, r = k * (P.bloom ? 2.6 : 1.6), x = head.x + Math.cos(an) * r, y = head.y + C.oy + Math.sin(an) * r * 0.7, a = 0.55 + 0.45 * Math.sin(t * 6 + j);
        put(C.d, C.BW, C.H, x, y, [255, 246, 170], a); put(C.d, C.BW, C.H, x + 1, y, [255, 255, 255], a * 0.6); put(C.d, C.BW, C.H, x, y - 1, [255, 255, 255], a * 0.4);
    }
    if (P.f > 0) for (let j = 0; j < 2; j++) { const f = (t * 0.8 + j * 0.5 + b.bx * 0.1) % 1; put(C.d, C.BW, C.H, b.bx + (j ? 1 : -1) * k * 1.4, b.by + C.oy - f * k * 5, [140, 255, 140], 1 - f); }
}

// ---------- bầu trời theo giờ trong ngày + thời tiết ----------
const SKY_KEYS = [ // [tod, đỉnh, chân trời]
    [0, [60, 70, 140], [255, 170, 150]], [0.06, [110, 170, 245], [255, 214, 190]], [0.12, [110, 175, 245], [210, 235, 255]],
    [0.56, [120, 170, 240], [220, 236, 255]], [0.63, [90, 90, 170], [255, 160, 120]], [NIGHT_AT / DAY, [20, 24, 64], [70, 60, 120]],
    [0.75, [12, 16, 44], [40, 44, 92]], [0.97, [20, 26, 70], [80, 70, 130]], [1, [60, 70, 140], [255, 170, 150]]
];
export function skyColors(tod) {
    for (let j = 1; j < SKY_KEYS.length; j++) if (tod <= SKY_KEYS[j][0]) { const [a, t0, b0] = SKY_KEYS[j - 1], [b, t1, b1] = SKY_KEYS[j], f = (tod - a) / (b - a); return [lerp3(t0, t1, f), lerp3(b0, b1, f)]; }
    return [SKY_KEYS[0][1], SKY_KEYS[0][2]];
}
export function drawSky(C, skyH, gt, weather, decor, seed) {
    const tod = (gt % DAY) / DAY, night = tod >= NIGHT_AT / DAY;
    let [top, bot] = skyColors(tod);
    const gray = weather === 'storm' ? 0.72 : weather === 'rain' ? 0.5 : weather === 'cloud' ? 0.3 : weather === 'fog' ? 0.35 : 0, warm = weather === 'heat' ? 0.25 : 0;
    if (gray) { const gt0 = (top[0] + top[1] + top[2]) / 3, gb = (bot[0] + bot[1] + bot[2]) / 3; top = lerp3(top, [gt0, gt0, gt0 + 8], gray); bot = lerp3(bot, [gb, gb, gb + 8], gray); }
    if (warm) { top = lerp3(top, [255, 190, 120], warm * 0.5); bot = lerp3(bot, [255, 200, 140], warm); }
    for (let y = 0; y < skyH + 2; y++) { const yy = y + C.oy; if (yy < 0 || yy >= C.H) continue; const c = lerp3(top, bot, y / skyH), r = c[0], g = c[1], b = c[2]; for (let x = 0, o = yy * C.BW * 4; x < C.BW; x++, o += 4) { C.d[o] = r; C.d[o + 1] = g; C.d[o + 2] = b; C.d[o + 3] = 255; } }
    const U = Math.min(C.BW, skyH * 2.2);
    if (night) for (let j = 0; j < 40; j++) { const x = hash(j * 7.1 + seed) * C.BW, y = hash(j * 3.3) * skyH * 0.9, a = 0.5 + 0.5 * Math.sin(C.t * (1 + hash(j)) * 2 + j); put(C.d, C.BW, C.H, x, y + C.oy, [255, 250, 230], a * (1 - gray)); }
    if ((decor.cauvong || weather === 'rainbow') && !night) { const cx = C.BW / 2, cy = skyH * 1.6, R = skyH * 1.15; for (let y = 0; y < skyH; y++) for (let x = 0; x < C.BW; x++) { const q = (Math.hypot(x - cx, y - cy) - R) / (skyH * 0.12); if (q > 0 && q < 1) put(C.d, C.BW, C.H, x, y + C.oy, [[255, 90, 90], [255, 160, 80], [255, 230, 100], [120, 220, 120], [100, 180, 255], [150, 110, 230]][Math.min(5, Math.floor(q * 6))], 0.35 * (1 - gray)); } }
    // mặt trời / mặt trăng đi theo vòng cung
    const dayF = clamp(tod / (NIGHT_AT / DAY), 0, 1), nightF = clamp((tod - NIGHT_AT / DAY) / (1 - NIGHT_AT / DAY), 0, 1);
    if (!night) { const sx = C.BW * (0.08 + 0.84 * dayF), sy = skyH * (0.85 - 0.65 * Math.sin(dayF * Math.PI)), r = U * (warm ? 0.07 : 0.055); for (let k = 3; k >= 1; k--) disc(C.d, C.BW, C.H, sx, sy + C.oy, r * (1 + k * 0.4), [255, 230, 150], 0.08 * (1 - gray)); disc(C.d, C.BW, C.H, sx, sy + C.oy, r, [255, 226, 110], 1 - gray * 0.6); }
    else { const mx = C.BW * (0.1 + 0.8 * nightF), my = skyH * (0.8 - 0.6 * Math.sin(nightF * Math.PI)), r = U * 0.045; disc(C.d, C.BW, C.H, mx, my + C.oy, r * 1.6, [200, 210, 255], 0.1); disc(C.d, C.BW, C.H, mx, my + C.oy, r, [250, 246, 226]); disc(C.d, C.BW, C.H, mx + r * 0.4, my - r * 0.2 + C.oy, r * 0.8, top); }
    // mây
    const nCloud = weather === 'sun' || weather === 'rainbow' ? 2 : weather === 'heat' ? 1 : weather === 'storm' ? 7 : 5, cc = weather === 'storm' ? [100, 104, 120] : weather === 'rain' ? [150, 156, 170] : night ? [80, 86, 120] : [255, 255, 255], cs = weather === 'wind' ? 4 : weather === 'storm' ? 3 : 1;
    for (let j = 0; j < nCloud; j++) { const x = ((hash(j * 3.3 + seed) * C.BW + C.t * (1.2 + j * 0.3) * cs) % (C.BW + 40)) - 20, y = skyH * (0.15 + 0.13 * j % 0.7), s = U * (0.035 + hash(j * 7.7) * 0.02); for (const [dx, dy, r] of [[0, 0, 1], [1.1, 0.25, 0.8], [-1.1, 0.3, 0.75], [0.4, -0.5, 0.75]]) disc(C.d, C.BW, C.H, x + dx * s * 1.4, y + dy * s + C.oy, r * s * 1.2, cc, 0.92); }
    return { night, tod };
}
export function drawRain(C, t, heavy = false) { for (let j = 0; j < Math.round(C.BW * (heavy ? 1.3 : 0.6)); j++) { const x = (hash(j * 1.7) * C.BW + t * 30) % C.BW, y = (hash(j * 3.1) * C.H + t * (90 + 40 * hash(j))) % C.H; line(C.d, C.BW, C.H, x, y, x - 1, y + 3, [190, 210, 240], 1, 0.55); } }

// tối đi về đêm (chỉ phần đất), sau đó mới vẽ các nguồn sáng
export function nightTint(C, fromY, k) { if (k >= 1) return; const d = C.d; for (let y = Math.max(0, Math.round(fromY)); y < C.H; y++) for (let x = 0; x < C.BW; x++) { const o = (y * C.BW + x) * 4; d[o] *= k * 0.9; d[o + 1] *= k * 0.95; d[o + 2] *= Math.min(1, k * 1.25); } }

// ---------- sprite pixel art cho sự kiện (mỗi ký tự = 1 điểm ảnh, '.' = trong suốt) ----------
const SPR = { // (đồ trang trí trong sân nay nằm ở yard.js)
    qua: { p: { k: [40, 40, 52], K: [84, 84, 108], b: [150, 140, 110], e: [240, 240, 240], y: [200, 160, 60] }, r: [
        '....kk..', '...kkekb', 'k.kkkkk.', 'kkKKkkk.', '.kkkkk..', '...y.y..'] },
    meo: { p: { o: [240, 162, 84], O: [206, 118, 52], w: [255, 236, 210], p: [255, 160, 170] }, r: [
        '.o.o......', 'oooo....oo', 'opoowwooOo', 'ooOoooOooo', '.wwoooooo.'] },
    goi: { p: { p: [255, 150, 190], P: [228, 112, 160], r: [255, 230, 110] }, r: [
        '.r...r.', '..r.r..', '...r...', 'ppprppp', 'PPPrPPP', 'ppprppp', 'PPPrPPP'] }
};
// vẽ sprite, neo ở giữa đáy (x, y), mỗi điểm ảnh sprite = s điểm ảnh lưới; trả về khung bao (toạ độ lưới)
export function spr(C, name, x, y, s = 1, flip = false, tint = null, outline = 0.4) {
    const S = SPR[name], h = S.r.length, w = S.r[0].length, x0 = Math.round(x - w * s / 2), y0 = Math.round(y - h * s);
    if (outline) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { // viền tối mờ để nổi trên nền đồi hoa
        if (S.r[j][flip ? w - 1 - i : i] === '.') continue;
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const ii = i + ox, jj = j + oy; if (ii >= 0 && ii < w && jj >= 0 && jj < h && S.r[jj][flip ? w - 1 - ii : ii] !== '.') continue; put(C.d, C.BW, C.H, x0 + i * s + (ox > 0 ? s : ox), y0 + j * s + (oy > 0 ? s : oy) + C.oy, [46, 34, 40], outline); }
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const ch = S.r[j][flip ? w - 1 - i : i]; if (ch === '.') continue;
        let c = S.p[ch]; if (tint) c = tint(c);
        for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) put(C.d, C.BW, C.H, x0 + i * s + xx, y0 + j * s + yy + C.oy, c);
    }
    return { x0, y0, x1: x0 + w * s, y1: y0 + h * s };
}
const box = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
// ngôi sao lấp lánh nhỏ (báo "bấm dùng được rồi")
function twinkle(C, x, y, s, t, col = [255, 250, 190]) {
    const a = 0.55 + 0.45 * Math.sin(t * 5 + x), r = Math.max(1, Math.round(s * 1.2));
    for (let j = -r; j <= r; j++) { const f = 1 - Math.abs(j) / (r + 1); put(C.d, C.BW, C.H, x + j, y + C.oy, col, a * f); put(C.d, C.BW, C.H, x, y + j + C.oy, col, a * f); }
    put(C.d, C.BW, C.H, x, y + C.oy, [255, 255, 255], a);
}

// ---------- sự kiện ngẫu nhiên: quạ, mèo, cỏ bốn lá, gói quà, đom đóm, bướm. Trả về vùng chạm (hoặc null) ----------
export function drawEvent(C, L, ev, t) {
    if (!ev) return null;
    const k = L.k, s = Math.max(1, Math.round(k * 0.4)) + 1, b = ev.i >= 0 ? L.plots[ev.i] : null; // to hơn đồ trang trí một chút cho dễ thấy, dễ chạm
    switch (ev.k) {
        case 'qua': { const hop = Math.abs(Math.sin(t * 4)) * s * 1.5, x = b.bx + b.w * 0.28, y = b.by + b.h * 0.2 - hop, r = spr(C, 'qua', x, y, s, Math.sin(t * 0.8) > 0); return box(r.x0 - s * 3, r.y0 - s * 3, r.x1 + s * 3, r.y1 + s * 3); }
        case 'meo': { const x = b.bx + b.w * 0.15, y = b.by + b.h * 0.25, r = spr(C, 'meo', x, y, s); for (let j = 0; j < 2; j++) { const f = (t * 0.5 + j * 0.5) % 1; put(C.d, C.BW, C.H, r.x1 + f * s * 4, r.y0 - f * s * 6 + C.oy, [255, 255, 255], 1 - f); } return box(r.x0 - s * 2, r.y0 - s * 3, r.x1 + s * 2, r.y1 + s); }
        case 'co4': { const x = b.x + b.w * 0.85, y = b.y + b.h * 0.6; line(C.d, C.BW, C.H, x, y + C.oy, x, y - s * 2 + C.oy, [70, 140, 60], 1); for (let j = 0; j < 4; j++) { const a = j * 1.5708 + 0.785; drawHeart(C.d, C.BW, C.H, x + Math.cos(a) * s * 1.1, y - s * 2.5 + Math.sin(a) * s * 1.1 + C.oy, s * 0.9, [90, 200, 90]); } twinkle(C, x + s * 2, y - s * 4, s, t); return box(x - s * 4, y - s * 6, x + s * 4, y + s * 2); }
        case 'goi': { const x = L.BW * 0.5, y = L.skyH + L.yardH - 1 - Math.abs(Math.sin(t * 2.5)) * s * 2, r = spr(C, 'goi', x, y, s); twinkle(C, r.x1 + s, r.y0, s, t); return box(r.x0 - s * 3, r.y0 - s * 3, r.x1 + s * 3, r.y1 + s * 2); }
        case 'domdom': { const P = L.plots[7], cx = L.BW * 0.5, cy = P.cy + P.ch * 0.2; for (let j = 0; j < 12; j++) { const a = t * (0.6 + hash(j) * 0.6) + j, r = k * (1.5 + 2.5 * hash(j * 3.3)), x = cx + Math.cos(a) * r * 1.4, y = cy + Math.sin(a * 1.3) * r * 0.7, al = 0.6 + 0.4 * Math.sin(t * 4 + j); glow(C.d, C.BW, C.H, x, y + C.oy, [210, 255, 120], al); glow(C.d, C.BW, C.H, x + 1, y + C.oy, [210, 255, 120], al * 0.3); glow(C.d, C.BW, C.H, x, y + 1 + C.oy, [210, 255, 120], al * 0.3); } return box(cx - k * 6, cy - k * 4, cx + k * 6, cy + k * 4); }
        case 'buom': for (let j = 0; j < 6; j++) { // bướm bay lượn khắp vườn
            const x = L.x0 + L.gw * (0.5 + 0.45 * Math.sin(t * (0.3 + hash(j) * 0.3) + j * 2)), y = L.skyH + L.yardH + (L.H0 - L.skyH - L.yardH) * (0.4 + 0.4 * Math.sin(t * (0.4 + hash(j * 2) * 0.3) + j)), f = Math.abs(Math.sin(t * 9 + j)), c = [[255, 170, 210], [255, 220, 110], [170, 200, 255]][j % 3];
            for (const sd of [-1, 1]) { disc(C.d, C.BW, C.H, x + sd * (0.6 + f) * s, y - s * 0.4 + C.oy, s * (0.5 + 0.4 * f), c); disc(C.d, C.BW, C.H, x + sd * 0.6 * s, y + s * 0.5 + C.oy, s * 0.45, lighten(c, 0.3)); }
            put(C.d, C.BW, C.H, x, y + C.oy, [60, 40, 40]); put(C.d, C.BW, C.H, x, y - 1 + C.oy, [60, 40, 40]);
        } return null;
    }
    return null;
}

// ---------- sao băng: đầu sáng lấp lánh, đuôi thon dài chuyển màu (trắng → vàng → hồng → tím), bụi sao rơi lại phía sau ----------
export function drawStar(C, x, y, dir, f, sc) {
    const len = 26 * sc, dx = -dir * 0.92, dy = -0.38, fade = Math.min(1, f * 6) * Math.min(1, (1 - f) * 5); // hiện dần rồi tắt
    for (let j = Math.ceil(len); j >= 0; j--) {
        const u = j / len, c = u < 0.2 ? lerp3([255, 255, 240], [255, 236, 170], u / 0.2) : u < 0.55 ? lerp3([255, 236, 170], [255, 170, 210], (u - 0.2) / 0.35) : lerp3([255, 170, 210], [150, 160, 255], (u - 0.55) / 0.45);
        const px = x + dx * j, py = y + dy * j - u * u * 2 * sc, a = (1 - u) ** 1.6 * fade, w = (1 - u) * sc * 0.9;
        put(C.d, C.BW, C.H, px, py + C.oy, c, a);
        if (w > 0.5) { put(C.d, C.BW, C.H, px, py - 1 + C.oy, c, a * 0.5); put(C.d, C.BW, C.H, px, py + 1 + C.oy, c, a * 0.35); }
    }
    for (let j = 0; j < 7; j++) { const u = hash(j * 3.7 + Math.floor(f * 30) * 0.13), px = x + dx * len * u + (hash(j * 5.3) - 0.5) * 3 * sc, py = y + dy * len * u + hash(j * 7.1 + f) * 2.5 * sc; put(C.d, C.BW, C.H, px, py + C.oy, [255, 250, 220], (1 - u) * 0.8 * fade); } // bụi sao
    for (let r = 3; r >= 1; r--) disc(C.d, C.BW, C.H, x, y + C.oy, sc * 0.55 * r, [255, 240, 200], 0.12 * fade); // quầng sáng
    const tw = Math.round(sc * (1.4 + 0.5 * Math.sin(f * 40)));
    for (let j = -tw; j <= tw; j++) { const a = (1 - Math.abs(j) / (tw + 1)) * fade; put(C.d, C.BW, C.H, x + j, y + C.oy, [255, 255, 255], a); put(C.d, C.BW, C.H, x, y + j + C.oy, [255, 255, 255], a); }
    disc(C.d, C.BW, C.H, x, y + C.oy, Math.max(0.8, sc * 0.45), [255, 255, 255], fade);
}
// nguồn sáng ban đêm: đèn lồng, đom đóm, hoa quỳnh toả sáng
export function drawLights(C, L, st, plotsHead, t) {
    const k = L.k;
    if (st.decor.den) { // quầng sáng quanh 7 chiếc đèn lồng trên dây (cùng vị trí với drawDecor)
        const s = Math.max(1, Math.round(k * 0.42)), ry = L.bandY + k * 0.5, sag = k * 2.2;
        for (let j = 0; j < 7; j++) { const f = (j + 0.5) / 7, x = L.BW * f, y = ry + Math.sin(f * Math.PI * 3) ** 2 * sag * 0.6 + sag * 4 * f * (1 - f) * 0.4 + 4 * s + C.oy; for (let r = 3; r >= 1; r--) disc(C.d, C.BW, C.H, x, y, s * r * 2.2, [255, 160, 60], 0.08); }
    }
    for (let j = 0; j < 14; j++) { const x = L.BW * hash(j * 2.3) + Math.sin(t * 0.7 + j) * k * 4, y = L.bandY + (L.H0 - L.bandY) * hash(j * 5.1) + Math.cos(t * 0.5 + j * 2) * k * 3, a = 0.5 + 0.5 * Math.sin(t * 3 + j); glow(C.d, C.BW, C.H, x, y + C.oy, [200, 255, 120], a * 0.7); glow(C.d, C.BW, C.H, x + 1, y + C.oy, [200, 255, 120], a * 0.25); }
    for (const h of plotsHead) if (h && h.P.sp === 'quynh' && h.P.bloom && !h.P.faded) for (let r = 4; r >= 1; r--) disc(C.d, C.BW, C.H, h.x, h.y + C.oy, k * r * 0.9, [220, 230, 255], 0.07);
}

// hiệu ứng thời tiết phủ lên cả khung: gió nhẹ (vệt gió), sương mù, giông (chớp)
export function drawWeatherFx(C, w, t, fromY) {
    const { d, BW, H } = C;
    if (w === 'wind') for (let j = 0; j < 9; j++) { const y = H * hash(j * 3.7), x = ((t * (40 + 25 * hash(j)) + hash(j * 5.1) * BW * 2) % (BW * 1.6)) - BW * 0.3, len = 8 + 10 * hash(j * 2.2); for (let k = 0; k < len; k++) put(d, BW, H, x + k, y + Math.sin((x + k) * 0.15 + j) * 1.2, [255, 255, 255], 0.35 * Math.sin(k / len * Math.PI)); }
    if (w === 'fog') for (let y = Math.max(0, Math.round(fromY)); y < H; y++) { const a = 0.18 + 0.12 * Math.sin(y * 0.08 + t * 0.3); for (let x = 0; x < BW; x++) { const o = (y * BW + x) * 4, k = a * (0.7 + 0.3 * Math.sin(x * 0.05 + t * 0.2 + y * 0.02)); d[o] += (235 - d[o]) * k; d[o + 1] += (238 - d[o + 1]) * k; d[o + 2] += (242 - d[o + 2]) * k; } }
    if (w === 'storm') { const f = (t * 0.37) % 1, flash = f < 0.02 ? 0.55 : f > 0.06 && f < 0.075 ? 0.3 : 0; if (flash) for (let o = 0; o < BW * H * 4; o += 4) { d[o] += (255 - d[o]) * flash; d[o + 1] += (255 - d[o + 1]) * flash; d[o + 2] += (255 - d[o + 2]) * flash; } }
}
