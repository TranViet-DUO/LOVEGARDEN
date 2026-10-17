// QUANH VƯỜN: hàng rào liền mạch, cây to hai bên + cây nhỏ trên đồi, thùng ủ phân, hòm thư, radio trên hàng rào,
// và các con vật nhỏ (chim sẻ trên hàng rào, sóc trên cây, thỏ chạy giữa các luống, bướm, ong quanh hoa, cú đêm).
//  - Mọi hình dùng CHUNG một bộ dựng (`build`): cùng bảng màu, cùng hướng sáng (trên-trái), không viền đen; dựng một lần rồi lưu cache.
//  - drawYard (vẽ trước các luống) trả về vùng chạm; drawCritters (vẽ sau các luống) chỉ để trang trí, không ảnh hưởng luật chơi.
import { put, line } from './lib/draw.js';
import { lerp3, hash } from './lib/math.js';

// ---------- bảng màu chung: [sáng, vừa, tối] ----------
const W = [[224, 172, 112], [190, 134, 82], [142, 96, 60]];      // gỗ
const BK = [[160, 112, 72], [124, 84, 54], [92, 60, 40]];        // vỏ cây
const RF = [[238, 124, 98], [206, 90, 74], [158, 64, 58]];       // đỏ
const G = [[150, 208, 108], [104, 170, 82], [66, 126, 62], [48, 98, 52]]; // lá
const PK = [[255, 222, 232], [248, 180, 204], [222, 132, 168], [190, 104, 140]]; // hoa anh đào
const TL = [[140, 214, 206], [96, 178, 174], [64, 136, 138]];    // radio xanh ngọc
const CR = [[252, 240, 222], [228, 202, 164], [180, 146, 108]];
const Y = [[255, 232, 134], [244, 192, 78], [202, 142, 46]];
const DK = [64, 44, 40];

// tối về đêm cho phần nằm trên đường chân trời (phần dưới đã có lớp tối chung của vườn), giống cách tô đồi hoa
let NT = null;
const dk = c => [c[0] * NT.k * 0.9, c[1] * NT.k * 0.95, c[2] * Math.min(1, NT.k * 1.25)];
const P = (C, x, y, c, a = 1) => put(C.d, C.BW, C.H, x, y, NT && y - C.oy < NT.sky ? dk(c) : c, a);

// ---------- bộ dựng hình ----------
const cache = new Map();
function build(key, w, h, fn) {
    let sp = cache.get(key); if (sp) return sp;
    const a = new Uint8ClampedArray(w * h * 4);
    const p = (x, y, c, al = 255) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= w || y >= h) return; const o = (y * w + x) * 4; a[o] = c[0]; a[o + 1] = c[1]; a[o + 2] = c[2]; a[o + 3] = al; };
    const g = {
        p, r: (x, y, ww, hh, c) => { for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) p(x + i, y + j, c); },
        e: (cx, cy, rx, ry, c) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) p(x, y, c); },
        l: (x0, y0, x1, y1, c) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5)); for (let k = 0; k <= n; k++) p(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, c); },
        str: (x, y, rows, pal) => rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') p(x + i, y + j, pal[ch]); }))
    };
    fn(g, w, h);
    sp = { w, h, a }; cache.set(key, sp); return sp;
}
/** Vẽ hình neo giữa-đáy tại (x, y). o.shadow: bóng đổ (tỉ lệ bề rộng); o.flip; o.alpha; o.tint(c) */
function blit(C, sp, x, y, o = {}) {
    const x0 = Math.round(x - sp.w / 2), y0 = Math.round(y - sp.h + 1), al = o.alpha ?? 1;
    if (o.shadow) { const rx = sp.w * o.shadow, ry = Math.max(1.2, rx * 0.18); for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) if ((xx / rx) ** 2 + (yy / ry) ** 2 <= 1) P(C, x + xx, y + yy + C.oy, [36, 60, 34], 0.2); }
    for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) {
        const q = (j * sp.w + (o.flip ? sp.w - 1 - i : i)) * 4, A = sp.a[q + 3]; if (!A) continue;
        const c = [sp.a[q], sp.a[q + 1], sp.a[q + 2]];
        P(C, x0 + i, y0 + j + C.oy, o.tint ? o.tint(c) : c, A / 255 * al);
    }
    return { x0, y0, x1: x0 + sp.w, y1: y0 + sp.h };
}

// tán cây: nhiều khối tròn chồng nhau, tô sáng theo hướng trên-trái, lấm tấm cho có kết cấu lá
function canopy(g, blobs, pal, seed) {
    const L = [-0.6, -0.8];
    for (const [cx, cy, rx, ry] of blobs) for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, q = dx * dx + dy * dy; if (q > 1) continue;
        let l = dx * L[0] + dy * L[1] + (hash(x * 3.7 + y * 9.1 + seed) - 0.5) * 0.55;
        if (q > 0.8 && dy > 0.2) l -= 0.5; // mép dưới tối
        g.p(x, y, l > 0.5 ? pal[0] : l > -0.05 ? pal[1] : l > -0.55 ? pal[2] : pal[3]);
    }
}
function trunk(g, cx, top, bottom, w0, w1) {
    for (let y = top; y <= bottom; y++) { const f = (y - top) / (bottom - top), hw = (w0 + (w1 - w0) * f * f) / 2; for (let x = Math.floor(cx - hw); x < cx + hw; x++) g.p(x, y, x < cx - hw + 1.5 ? BK[0] : x > cx + hw - 1.5 ? BK[2] : (hash(x + y * 0.37) > 0.8 ? BK[2] : BK[1])); }
}

const SPR = {
    bigTree: () => build('bigTree', 46, 72, g => { // cây lá to (bên trái)
        trunk(g, 23, 30, 71, 5, 9);
        g.l(23, 44, 14, 34, BK[1]); g.l(23, 40, 32, 31, BK[1]); g.l(14, 34, 12, 31, BK[2]);
        canopy(g, [[23, 22, 18, 15], [11, 28, 10, 9], [35, 28, 10, 9], [22, 9, 13, 9], [13, 16, 10, 8], [33, 15, 10, 8]], G, 1);
    }),
    blossom: () => build('blossom', 46, 72, g => { // cây hoa hồng nhạt (bên phải)
        trunk(g, 23, 30, 71, 5, 9);
        g.l(23, 45, 33, 35, BK[1]); g.l(23, 42, 13, 32, BK[1]);
        canopy(g, [[23, 23, 18, 14], [10, 29, 10, 8], [36, 29, 10, 8], [24, 10, 13, 9], [14, 16, 9, 8], [33, 16, 9, 8]], PK, 5);
        for (let k = 0; k < 26; k++) { const x = 6 + hash(k * 3.3) * 34, y = 4 + hash(k * 7.1) * 32; g.p(x, y, k % 3 ? [255, 250, 252] : G[1]); }
    }),
    hillTree: v => build('hillTree' + v, 18, 26, g => { trunk(g, 9, 13, 25, 2, 3); canopy(g, v ? [[9, 9, 8, 8], [5, 13, 4, 4], [13, 13, 4, 4]] : [[9, 8, 6, 8], [9, 14, 7, 5]], G, 3 + v); }),
    mailbox: () => build('mailbox', 9, 17, g => { g.r(3, 7, 2, 10, W[2]); g.r(3, 7, 1, 10, W[1]); g.r(0, 1, 9, 6, RF[1]); g.r(1, 0, 7, 1, RF[1]); g.r(0, 1, 2, 6, RF[0]); g.r(7, 1, 2, 6, RF[2]); g.r(3, 3, 3, 1, DK); }),
    bin: () => build('bin', 13, 11, g => { for (let y = 0; y < 11; y++) g.r(1, y, 11, 1, y % 3 === 2 ? W[2] : y % 3 === 0 ? W[0] : W[1]); g.r(0, 0, 1, 11, W[2]); g.r(12, 0, 1, 11, W[2]); }),
    radio: () => build('radio', 15, 14, g => { // radio cổ xanh ngọc: ăng-ten, loa, mặt số
        g.l(11, 0, 9, 5, [200, 206, 214]); g.p(11, 0, [240, 240, 244]);
        g.r(0, 6, 15, 8, TL[1]); g.r(1, 5, 13, 1, TL[1]); g.r(0, 6, 2, 8, TL[0]); g.r(13, 6, 2, 8, TL[2]); g.r(1, 13, 13, 1, TL[2]);
        for (let y = 7; y < 12; y += 2) for (let x = 2; x < 7; x += 2) g.p(x, y, TL[2]);
        g.r(8, 7, 5, 3, CR[0]); g.p(10, 8, RF[1]); g.e(9.5, 11.5, 1.2, 1.2, CR[1]); g.e(12, 11.5, 1.2, 1.2, CR[1]);
    }),
    sparrow: f => build('sparrow' + f, 6, 5, g => g.str(0, 0, f ? ['b....b', '.bBBb.', '..bbbo', '..ff..', '......'] : ['..bb..', '.bBbbo', 'bbbff.', '.bff..', '..y...'], { b: [150, 110, 80], B: [112, 80, 56], o: [250, 170, 60], f: [240, 222, 194], y: [200, 150, 70] })),
    rabbit: f => build('rabbit' + f, 9, 7, g => g.str(0, 0, f ? ['.......ww', '......ww.', '..wwwwwwe', 'twwwwwwwp', '.wW....Ww', '.........', '.........'] : ['.....w.w.', '.....w.w.', '..wwwwwwe', '.wwwwwwwp', 'twwwwwww.', '.wWWwwW..', '..w..w...'], { w: [246, 242, 236], W: [212, 204, 196], e: DK, p: [255, 160, 180], t: [255, 255, 255] })),
    squirrel: f => build('squirrel' + f, 6, 8, g => g.str(0, 0, f ? ['..tt..', '.tttt.', 'tt.ss.', 't.sses', '..sss.', '..s.s.', '..s...', '......'] : ['.tt...', 'tttt..', 'tt.ss.', 't..sse', '...ss.', '..sss.', '..s.s.', '.....'], { t: [222, 142, 72], s: [190, 108, 54], e: DK })),
    owl: f => build('owl' + f, 7, 8, g => g.str(0, 0, ['.b...b.', 'bbbbbbb', f ? 'bfDfDfb' : 'bfEfEfb', 'bfffffb', 'bbbobbb', 'bBbbbBb', '.bbbbb.', '..y.y..'], { b: [150, 112, 82], B: [118, 86, 62], f: [232, 212, 176], E: [255, 214, 70], D: [118, 86, 62], o: [240, 170, 60], y: [220, 170, 70] }))
};

// ---------- bố cục ----------
// cây to đứng ở hai góc, sát hàng rào; thùng ủ và hòm thư dưới gốc cây; radio ngồi trên đỉnh hàng rào ở giữa
const fenceH = L => Math.max(5, Math.round(L.k * 2.4));
export const SPOTS = {
    treeL: L => [Math.round(L.BW * 0.02), L.skyH + 9], treeR: L => [Math.round(L.BW * 0.98), L.skyH + 9],
    thung: L => [Math.round(L.BW * 0.05), L.skyH + 15], giay: L => [Math.round(L.BW * 0.955), L.skyH + 16],
    radio: L => [Math.round(L.BW * 0.5), L.skyH - fenceH(L) + 1]
};

function drawFence(C, L) { // hàng rào cọc nhọn liền mạch, hai thanh ngang
    const yb = L.skyH, BW = L.BW, fh = fenceH(L);
    for (let x = 1; x < BW; x += 4) {
        for (let yy = 0; yy < fh; yy++) { P(C, x, yb - yy + C.oy, [222, 176, 120]); P(C, x + 1, yb - yy + C.oy, [186, 138, 88]); P(C, x + 2, yb - yy + C.oy, [120, 150, 80], 0.25); }
        P(C, x, yb - fh + C.oy, [222, 176, 120]); P(C, x + 1, yb - fh - 1 + C.oy, [186, 138, 88]);
    }
    for (const fy of [0.35, 0.75]) for (let x = 0; x < BW; x++) { P(C, x, yb - fh * fy + C.oy, [176, 128, 82]); P(C, x, yb - fh * fy + 1 + C.oy, [120, 84, 56], 0.4); }
}
function twinkle(C, x, y, t) {
    const a = 0.6 + 0.4 * Math.sin(t * 5 + x);
    for (let j = -2; j <= 2; j++) { const f = 1 - Math.abs(j) / 3; P(C, x + j, y + C.oy, [255, 246, 170], a * f); P(C, x, y + j + C.oy, [255, 246, 170], a * f); }
}

/**
 * Hàng rào, cây, thùng ủ, hòm thư, radio. o.ready(k): món dùng được (ngôi sao lấp lánh) · o.mail: có thư chưa đọc · o.music: radio đang phát
 * o.night: ban đêm (cây trên đồi mờ hơn). Trả về vùng chạm [{k, x0, y0, x1, y1}].
 */
export function drawYard(C, L, st, o = {}) {
    NT = (o.dark ?? 1) < 1 ? { k: o.dark, sky: L.skyH } : null;
    const D = st.decor, t = C.t, BW = L.BW, hits = [];
    // cây nhỏ trên đồi (xa, nhạt màu như có sương)
    const far = c => lerp3(c, [176, 208, 232], 0.35);
    blit(C, SPR.hillTree(0), BW * 0.27, L.skyH - 4, { tint: far }); blit(C, SPR.hillTree(1), BW * 0.73, L.skyH - 6, { tint: far });
    drawFence(C, L);
    // radio ngồi trên hàng rào; đang phát thì nốt nhạc bay lên
    { const [x, y] = SPOTS.radio(L), sw = o.music ? Math.round(Math.sin(t * 8)) * 0.5 : 0, b = blit(C, SPR.radio(), x + sw, y);
        if (o.music) for (let j = 0; j < 3; j++) { const f = (t * 0.45 + j / 3) % 1, nx = x - 2 + j * 4 + Math.sin(f * 6 + j) * 3, ny = b.y0 + 2 - f * 22, c = [[255, 140, 180], [255, 214, 90], [130, 190, 255]][j], a = Math.sin(f * Math.PI);
            for (let k = 0; k < 4; k++) P(C, nx + 2, ny + k + C.oy, c, a); P(C, nx, ny + 3 + C.oy, c, a); P(C, nx + 1, ny + 3 + C.oy, c, a); P(C, nx, ny + 4 + C.oy, c, a); P(C, nx + 1, ny + 4 + C.oy, c, a); P(C, nx + 3, ny + C.oy, c, a); }
        hits.push({ k: 'radio', x0: b.x0 - 3, y0: b.y0 - 3, x1: b.x1 + 3, y1: b.y1 + 2 }); if (o.ready?.('radio')) twinkle(C, x, b.y0 - 4, t); }
    // cây to hai góc
    { const [x, y] = SPOTS.treeL(L); blit(C, SPR.bigTree(), x, y, { shadow: 0.35 }); }
    { const [x, y] = SPOTS.treeR(L); blit(C, SPR.blossom(), x, y, { shadow: 0.35 }); }
    // thùng ủ phân, hòm thư dưới gốc cây
    if (D.thung) { const [x, y] = SPOTS.thung(L), b = blit(C, SPR.bin(), x, y, { shadow: 0.45 }); for (let j = 0; j < Math.min(5, st.inv.compost); j++) { const lx = b.x0 + 2 + j * 1.8, ly = b.y0 - (j % 2); P(C, lx, ly + C.oy, j % 3 ? G[1] : [196, 150, 70]); P(C, lx + 1, ly + C.oy, G[0]); } hits.push({ k: 'thung', x0: b.x0 - 2, y0: b.y0 - 3, x1: b.x1 + 2, y1: b.y1 + 1 }); if (o.ready?.('thung')) twinkle(C, x, b.y0 - 5, t); }
    if (D.giay) { const [x, y] = SPOTS.giay(L), b = blit(C, SPR.mailbox(), x, y, { shadow: 0.5 }); const up = o.mail; line(C.d, BW, C.H, b.x0, b.y0 + 4 + C.oy, b.x0, b.y0 + (up ? -2 : 3) + C.oy, W[2], 1); for (let j = 0; j < 2; j++) P(C, b.x0 - 1 - j, b.y0 + (up ? -2 : 3) + C.oy, [232, 50, 60]); hits.push({ k: 'giay', x0: b.x0 - 3, y0: b.y0 - 3, x1: b.x1 + 2, y1: b.y1 + 1 }); if (up) twinkle(C, x, b.y0 - 5, t); }
    return hits;
}

/** Con vật nhỏ (vẽ sau các luống). o.night, o.blooms: [{x, y}] đầu các bông đang nở (ong bay quanh) */
export function drawCritters(C, L, o = {}) {
    NT = (o.dark ?? 1) < 1 ? { k: o.dark, sky: L.skyH } : null;
    const t = C.t, BW = L.BW, night = o.night, fy = L.skyH - fenceH(L) - 1;
    // chim sẻ trên hàng rào: nhảy lách chách, mổ mổ, thỉnh thoảng bay lên cây rồi quay lại
    if (!night) for (let j = 0; j < 2; j++) {
        const per = 26 + j * 7, ph = ((t + j * 11) % per) / per, hx = BW * (j ? 0.63 : 0.36) + Math.floor(Math.sin(t * 0.7 + j) * 3);
        if (ph < 0.8) { const hop = (Math.floor(t * 2 + j) % 5 === 0) ? 1 : 0; blit(C, SPR.sparrow(0), hx, fy - hop, { flip: Math.sin(t * 0.3 + j * 2) > 0 }); }
        else { const u = (ph - 0.8) / 0.2, tx = j ? BW * 0.95 : BW * 0.05, a = Math.sin(u * Math.PI), x = hx + (tx - hx) * a, y = fy - a * (L.skyH * 0.35) - Math.sin(u * Math.PI * 2) * 4; blit(C, SPR.sparrow(Math.floor(t * 10) % 2), x, y, { flip: (u < 0.5) === (tx < hx) }); }
    }
    // sóc leo lên xuống thân cây trái
    if (!night) { const [tx, ty] = SPOTS.treeL(L), ph = (t * 0.08) % 1, u = ph < 0.5 ? Math.min(1, ph * 4) : Math.max(0, 1 - (ph - 0.5) * 4), y = ty - 4 - u * 26, moving = (ph < 0.25 || (ph > 0.5 && ph < 0.75)); blit(C, SPR.squirrel(moving ? Math.floor(t * 8) % 2 : 0), tx + 4, y, { flip: ph >= 0.5 }); }
    // cú đậu trên cành cây phải lúc đêm, chớp mắt
    if (night) { const [tx, ty] = SPOTS.treeR(L); blit(C, SPR.owl((t % 4) < 0.15 ? 1 : 0), tx - 7, ty - 36); }
    // thỏ: thỉnh thoảng nhảy ngang qua khe giữa hai hàng luống
    if (!night) {
        const per = 34, cyc = Math.floor(t / per), ph = (t % per) / per, rows = L.plots.length / 5;
        if (ph < 0.45) {
            const r = 1 + Math.floor(hash(cyc * 1.7) * (rows - 1)), b = L.plots[r * 5], dir = hash(cyc * 3.1) < 0.5 ? 1 : -1, u = ph / 0.45;
            const x = dir > 0 ? -8 + u * (BW + 16) : BW + 8 - u * (BW + 16), hopU = (u * 14) % 1, air = hopU < 0.5, y = b.cy + 2 - (air ? Math.sin(hopU * 2 * Math.PI) * 3 : 0);
            blit(C, SPR.rabbit(air ? 1 : 0), x, y, { shadow: air ? 0 : 0.35, flip: dir < 0 });
        }
    }
    // bướm bay lượn ban ngày
    if (!night) for (let j = 0; j < 2; j++) {
        const x = L.x0 + L.gw * (0.5 + 0.48 * Math.sin(t * (0.21 + j * 0.07) + j * 3)), y = L.skyH + (L.H0 - L.skyH) * (0.35 + 0.3 * Math.sin(t * (0.33 + j * 0.05) + j)), f = Math.abs(Math.sin(t * 10 + j)), c = j ? [255, 214, 110] : [190, 200, 255];
        for (const sd of [-1, 1]) { P(C, x + sd * (1 + f), y - 1 + C.oy, c); P(C, x + sd * (1 + f), y + C.oy, c); P(C, x + sd, y + 1 + C.oy, c); }
        P(C, x, y + C.oy, [60, 40, 40]);
    }
    // ong bay quanh hoa đang nở
    if (!night) (o.blooms || []).slice(0, 3).forEach((h, j) => { for (let k = 0; k < 2; k++) { const a = t * (3 + k) + j * 2 + k * 3, x = h.x + Math.cos(a) * 4, y = h.y + Math.sin(a * 1.3) * 2.5 - 2; P(C, x, y + C.oy, [40, 30, 20]); P(C, x + 1, y + C.oy, Y[0]); } });
}

