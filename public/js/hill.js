// Ngọn đồi hoa phía sau hàng rào — chuyển từ cảnh gốc legacy/src/backgrounds/flowerfield.js (cùng địa hình, cách dò tia, phối cảnh, mật độ hoa/cỏ).
//  - Địa hình: thung lũng giữa hai đồi lớn (trái gần/thấp, phải xa/cao), đồi xa mờ sương. Camera đứng yên trong thung lũng.
//  - Dải đồi trong game là PHẦN TRÊN của khung hình gốc (đường chân trời ở 44% khung), nên đồi, sương và cỡ hoa giống hệt cảnh cũ.
//  - Dò tia một lần khi đổi kích thước (nửa độ phân giải cho nhanh), tô sáng theo hướng nắng; cỏ (~1,25 ngọn/pixel) vẽ sẵn vào ảnh nền.
//  - Hoa: chỗ mọc rải theo chuỗi R2 với mật độ ~ 1/kích thước² (phủ đều khắp đồi). Số hoa hiện ra = tỉ lệ st.hill / HILL_MAX;
//    mỗi bông mới mọc có thân, lá, nụ, rồi nở 5 cánh (easeOutBack) như bản gốc, đung đưa theo gió.
import { fbm, hash, clamp, lerp3 } from './lib/math.js';
import { put, disc, line } from './lib/draw.js';
import { HILL_MAX, HILL_SP } from './rules.js';
import { TULIP, SP_COL } from './art.js';

const FOG = [176, 208, 232], CENTER = [255, 208, 60];
const G = (X, Z, cx, cz, sx, sz, a) => a * Math.exp(-((X - cx) * (X - cx) / (2 * sx * sx) + (Z - cz) * (Z - cz) / (2 * sz * sz)));
// địa hình gốc của flowerfield.js: 5 quả đồi gauss [cx, cz, sx, sz, cao]. Mỗi lần trồng lại vườn (seed khác) các đồi
// xê dịch, cao thấp, rộng hẹp khác đi và có thể lật trái/phải -> mỗi ván một dáng đồi riêng. seed = 0: đúng dáng gốc.
const HILLS = [[-50, 100, 32, 38, 15], [62, 150, 45, 55, 30], [-200, 340, 100, 90, 48], [180, 470, 130, 110, 66], [10, 900, 260, 120, 50]];
function terrain(seed) {
    const r = k => seed ? hash(seed * 0.618 + k * 7.31) : 0.5, flip = seed && r(99) < 0.5 ? -1 : 1;
    const hs = HILLS.map(([cx, cz, sx, sz, a], j) => [
        flip * (cx + (r(j * 5) - 0.5) * (j < 2 ? 70 : 220)), cz * (0.85 + 0.3 * r(j * 5 + 1)),
        sx * (0.7 + 0.6 * r(j * 5 + 2)), sz * (0.8 + 0.4 * r(j * 5 + 3)), a * (j < 2 ? 0.6 + 0.6 * r(j * 5 + 4) : 0.7 + 0.7 * r(j * 5 + 4))]);
    const ox = (r(50) - 0.5) * 60, oz = r(51) * 40; // gợn cỏ cũng khác đi
    const tC = (X, Z) => { let h = 0.0014 * X * X + 0.016 * Z; for (const [cx, cz, sx, sz, a] of hs) h += G(X, Z, cx, cz, sx, sz, a); return h; };
    return { tC, tF: (X, Z) => tC(X, Z) + 1.2 * (fbm((X + ox) * 0.035, (Z + oz) * 0.035, 3) - 0.5) };
}

/** Dựng đồi cho dải hàng [0, H) rộng BW cột. seed: dáng đồi (đổi mỗi lần trồng lại vườn). */
export function buildHill(BW, H, seed = 0) {
    const { tC, tF } = terrain(seed);
    const BHv = Math.round(H / 0.54), sc = Math.min(BW, BHv) / 60;         // khung ảo của cảnh gốc; dải đồi = 54% phía trên (đồi thấp, lộ nhiều trời)
    const CAM_H = 2, CAM_Y = tC(0, 0) + CAM_H, F = BW * 0.95, CY = BHv * 0.44, HMAX = 260;
    const LD = (() => { const v = [0.78, 0.45, -0.25], l = Math.hypot(...v); return v.map(c => c / l); })();
    const march = (x, y) => {
        const dx = (x + 0.5 - BW / 2) / F, dy = -(y + 0.5 - CY) / F;
        let t = 0.6, prev = t;
        for (; t < 2600; prev = t, t += Math.max(0.12, t * 0.016)) {
            const py = CAM_Y + dy * t;
            if (py < tC(dx * t, t) + 0.6 && py < tF(dx * t, t)) break;
            if (dy > 0 && py > HMAX) return 0;
        }
        if (t >= 2600) return 0;
        let lo = prev, hi = t; for (let k = 0; k < 8; k++) { const m = (lo + hi) / 2; if (CAM_Y + dy * m < tF(dx * m, m)) hi = m; else lo = m; }
        return hi;
    };
    // khoảng cách mặt đất ở hàng dưới cùng của khung gốc -> cỡ hoa theo phối cảnh (hàng dưới cùng ~5·sc như bản gốc)
    let zb = 0, nb = 0; for (let x = 0; x < BW; x += 4) { const z = march(x, BHv - 1); if (z) { zb += z; nb++; } }
    zb = nb ? zb / nb : 6;
    const HR_NEAR = 5 * sc, rW = HR_NEAR * zb / F, hrAt = z => Math.min(6 * sc, Math.max(0.45, rW * F / z));

    // dò tia nửa độ phân giải, tô màu từng pixel
    const HW = Math.ceil(BW / 2), HH = Math.ceil(H / 2), hz = new Float32Array(HW * HH);
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) hz[y * HW + x] = march(x * 2 + 0.5, y * 2 + 0.5);
    const N = BW * H, mask = new Uint8Array(N), gz = new Float32Array(N), gfog = new Float32Array(N), img = new Float32Array(N * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < BW; x++) {
        const z = hz[(y >> 1) * HW + (x >> 1)]; if (!z) continue;
        const i = y * BW + x, dx = (x + 0.5 - BW / 2) / F, dy = -(y + 0.5 - CY) / F, X = dx * z, Y = CAM_Y + dy * z, e = Math.max(0.3, z * 0.004);
        const hx = tF(X + e, z) - tF(X - e, z), hzz = tF(X, z + e) - tF(X, z - e), nl = Math.hypot(hx / (2 * e), 1, hzz / (2 * e));
        const lit = clamp((-hx / (2 * e) * LD[0] + LD[1] - hzz / (2 * e) * LD[2]) / nl, 0, 1), sh = 0.16 + 1.1 * Math.pow(lit, 1.2);
        const macro = fbm(X * 0.022 + 7, z * 0.022, 3), n = fbm(X * 0.12 + 3, z * 0.12, 4) * 0.5 + macro * 0.9 - 0.25, n2 = fbm(X * 0.9, z * 0.9, 2), hgt = clamp((Y - CAM_Y + CAM_H + 4) / 80, 0, 1);
        let c = lerp3(lerp3([40, 104, 30], [128, 176, 48], clamp(n * 1.9 - 0.3, 0, 1)), [150, 186, 62], hgt * 0.5);   // đậm ở chân, vàng nhạt lên đỉnh
        c = lerp3(c, [c[0] * 0.8, c[1] * 0.86, c[2] * 0.7], clamp(n2 * 1.4 - 0.3, 0, 1) * 0.5);                     // hạt cỏ li ti
        const fg = 1 - Math.exp(-z / 650);
        c = lerp3([c[0] * sh, c[1] * sh, c[2] * sh], FOG, fg * 0.85);
        mask[i] = 1; gz[i] = z; gfog[i] = fg; img[i * 3] = c[0]; img[i * 3 + 1] = c[1]; img[i * 3 + 2] = c[2];
    }
    // chỗ mọc hoa + ngọn cỏ (vẽ sẵn): chuỗi R2, mật độ hoa ~ 1/kích thước²
    const A1 = 0.7548776662, A2 = 0.569840291, wMap = new Float32Array(N);
    let tot = 0; for (let i = 0; i < N; i++) if (mask[i]) { const hr = Math.max(0.75, hrAt(gz[i])); wMap[i] = 1 / (2.2 * hr * hr); tot += wMap[i]; }
    const wScale = Math.min(1, 9000 * 0.6 / Math.max(1, tot)), cands = [], blades = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < BW; x++) {
        const i = y * BW + x; if (!mask[i]) continue;
        const z = gz[i], hr0 = hrAt(z), d = clamp(hr0 / HR_NEAR, 0, 1);
        if (((x * A1 + y * A2) % 1) < wMap[i] * wScale) {
            const r = hash(i * 1.93 + 5), hr = hr0 * (0.8 + 0.4 * r);
            cands.push({ z, x: x + hash(i * 3.7), by: y + hash(i * 5.1), d, r, ph: hash(i * 7.9) * 6.28, hr, h: Math.max(0.9, hr * 1.4) * (0.8 + 0.5 * hash(r * 17)), fog: gfog[i], u: hash(i * 2.71 + 3.3) });
        }
        const cnt = 1 + (((x * A2 + y * A1 + 0.37) % 1) < 0.25 ? 1 : 0); // ~1,25 ngọn cỏ mỗi pixel
        for (let k = 0; k < cnt; k++) { const r = hash(i * 9.7 + k * 3.1); blades.push({ z: z + 1e-3 * k, x: x + hash(i * 4.3 + k), by: y + 0.7 + 0.3 * hash(i * 6.1 + k), h: Math.max(1.2, hr0 * (0.45 + 0.75 * r)), r, d, fog: gfog[i] }); }
    }
    // cỏ vẽ sẵn vào ảnh nền (xa -> gần), hơi nghiêng như gió nhẹ của bản gốc
    blades.sort((a, b) => b.z - a.z);
    const base = new Uint8ClampedArray(N * 4);
    for (let i = 0; i < N; i++) { base[i * 4] = img[i * 3]; base[i * 4 + 1] = img[i * 3 + 1]; base[i * 4 + 2] = img[i * 3 + 2]; base[i * 4 + 3] = mask[i] ? 255 : 0; }
    for (const b of blades) {
        const L = (0.28 + 0.1 * Math.sin(b.x / (14 * sc))) * 0.55 * b.h, c = lerp3(lerp3([58, 108, 40], [150, 190, 80], b.r * 0.7 + b.d * 0.3), FOG, b.fog * 0.8);
        line(base, BW, H, b.x, b.by, b.x + L, b.by - b.h * (1 - 0.18 * clamp(L / b.h, 0, 1)), c, Math.max(1, Math.round(b.h * 0.11)), 0.95);
    }
    for (let i = 0; i < N; i++) if (!mask[i]) base[i * 4 + 3] = 0; // giữ trời trong suốt
    // thứ tự mọc ngẫu nhiên khắp đồi; vẽ xa -> gần
    cands.sort((a, b) => a.u - b.u).forEach((c, j) => { c.rank = j; c.y = c.by - c.h; c.r = c.hr; });
    cands.sort((a, b) => b.z - a.z);
    return { H, BW, base, cands, sc, HR_NEAR, born: new Float32Array(cands.length).fill(NaN) };
}

// số bông đang mọc trên đồi và loài của từng bông (theo chuỗi st.hill)
export const hillCount = (Hh, spStr) => Math.round(Math.min(1, (spStr || '').length / HILL_MAX) * Hh.cands.length);
export const hillSpecies = (Hh, c, spStr) => HILL_SP[spStr[Math.min(spStr.length - 1, Math.floor(c.rank * HILL_MAX / Hh.cands.length))]] || 'cuc';
export const hillColor = (Hh, c, spStr) => { const sp = hillSpecies(Hh, c, spStr); return sp === 'tulip' ? TULIP[c.rank % 4] : SP_COL[sp]; };

/** Vẽ đồi + hoa. lean: gió (âm = trái), dark: hệ số tối về đêm, hide(c): ẩn bông (đoạn kết: cánh đã bay đi). */
export function drawHill(C, Hh, spStr, lean, dark, hide = null) {
    const { d, BW, oy, t } = C, sc = Hh.sc, b = Hh.base, nb = Math.min(1, dark * 1.2);
    for (let y = 0; y < Hh.H; y++) {
        const j = y + oy; if (j < 0 || j >= C.H) continue;
        for (let x = 0, q = y * BW * 4, o = j * BW * 4; x < BW; x++, q += 4, o += 4) if (b[q + 3]) { d[o] = b[q] * dark; d[o + 1] = b[q + 1] * dark; d[o + 2] = b[q + 2] * nb; d[o + 3] = 255; }
    }
    const n = hillCount(Hh, spStr || ''); if (!n) return;
    if (Hh.firstT === undefined) Hh.firstT = t;
    for (let k = 0; k < Hh.cands.length; k++) {
        const f = Hh.cands[k];
        if (f.rank >= n || (hide && hide(f))) continue;
        if (Number.isNaN(Hh.born[f.rank])) Hh.born[f.rank] = t - Hh.firstT < 0.5 ? -100 : t + hash(f.rank * 3.1) * 1.5; // bông có sẵn lúc mở trang thì nở luôn
        const g = (t - Hh.born[f.rank]) / 1.6; if (g < 0) continue;
        const stemU = 1 - Math.pow(1 - clamp(g / 0.6, 0, 1), 2), bu = clamp((g - 0.5) / 0.5, 0, 1), bloom = bu <= 0 ? 0 : 1 + 2.70158 * Math.pow(bu - 1, 3) + 1.70158 * Math.pow(bu - 1, 2);
        const lf = 0.2 + 0.16 * (0.5 + 0.5 * Math.sin(f.x / (14 * sc) - t * 1.1)) + lean, sh = f.h * stemU, by = f.by + oy;
        const lx = f.x + lf * 0.62 * sh, ly = by - sh * (1 - 0.15 * clamp(lf, 0, 1.2)), midx = f.x + lf * 0.2 * sh + Math.sin(t * 1.6 + f.ph) * 0.15 * sc * f.d;
        if (f.hr >= 2.2) {
            const stemC = lerp3([74, 130, 52], FOG, 0.3 * (1 - f.d)).map(v => v * dark);
            line(d, BW, C.H, f.x, by, midx, by - sh * 0.5, stemC, 1); line(d, BW, C.H, midx, by - sh * 0.5, lx, ly, stemC, 1);
            if (stemU > 0.55 && f.hr > 2) { const lw = f.hr * 0.6 * stemU; line(d, BW, C.H, midx, by - sh * 0.35, midx + lw, by - sh * 0.35 - lw * 0.5, [96 * dark, 156 * dark, 64 * dark], 1); }
        }
        if (bloom <= 0) { disc(d, BW, C.H, lx, ly, Math.max(0.6, f.hr * 0.3 * stemU), [120 * dark, 176 * dark, 80 * dark]); continue; } // nụ xanh
        const colH = lerp3(hillColor(Hh, f, spStr), FOG, 0.55 * f.fog).map(v => v * Math.max(dark, 0.65)), cen = CENTER.map(v => v * Math.max(dark, 0.65));
        const hr = f.hr * bloom, rot = Math.sin(t * 0.9 + f.ph) * 0.3 + lf * 0.5 + f.ph, pr = Math.max(0.5, hr * 0.5), cr = Math.max(0.5, hr * 0.38);
        if (hr < 0.9) { put(d, BW, C.H, lx, ly, colH, clamp(hr / 0.9, 0.45, 1)); continue; }
        if (hr < 1.5) { disc(d, BW, C.H, lx, ly, Math.max(0.7, hr * 0.85), colH); put(d, BW, C.H, lx, ly, cen, 0.8); continue; }
        for (let p = 0; p < 5; p++) { const a = rot + p * 1.2566; disc(d, BW, C.H, lx + Math.cos(a) * hr * 0.68, ly + Math.sin(a) * hr * 0.68, pr, colH); }
        disc(d, BW, C.H, lx, ly, cr, cen);
    }
}
