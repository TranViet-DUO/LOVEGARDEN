// Nền trời cho CẢNH 2 (nơi hoa xếp thành chữ). Máy quay ngước từ đồng hoa lên trời rồi dừng ở đây.
// createBackdrop(id, { BW, BH, seed }) -> {
//   sky(x, y, t, out)   màu trời tại (x, y) — tính được cả y >= BH (phía dưới khung) để nối liền với khoảng chuyển cảnh
//   overlay(d, t, oy)   vật thể vẽ đè (sao, mặt trời/trăng, đèn trời, cánh đào, bokeh...) — oy: lệch dọc khi đang lia máy
//   render(d, t)        = sky cho cả khung + overlay
//   name, text (màu chữ gợi ý), light (nền sáng?) }
import { fbm, hash, clamp, lerp3 } from './math.js';
import { glow, disc, put, line } from './draw.js';

const DEFS = {
    sunset: {
        name: 'Hoàng hôn hồng', text: '#fff7f2',
        stops: [[0, [58, 46, 112]], [0.45, [150, 86, 156]], [0.78, [238, 132, 150]], [1, [255, 186, 152]]],
        cloud: { col: [255, 200, 208], shade: [150, 86, 140], th: 0.54, speed: 0.006 },
        sun: { x: 0.8, y: 0.86, r: 0.085, col: [255, 236, 190], glow: [255, 170, 120] }, stars: 0.25, motes: [255, 220, 200]
    },
    night: {
        name: 'Đêm trăng sao', text: '#fffaf0',
        stops: [[0, [6, 10, 34]], [0.55, [22, 30, 80]], [1, [62, 60, 124]]],
        cloud: { col: [92, 98, 156], shade: [36, 40, 88], th: 0.6, speed: 0.004 },
        moon: { x: 0.8, y: 0.84, r: 0.06 }, stars: 1, motes: [255, 240, 150]
    },
    dawn: {
        name: 'Bình minh pastel', text: '#6b2f57',
        stops: [[0, [116, 164, 232]], [0.55, [190, 190, 238]], [1, [255, 214, 214]]],
        cloud: { col: [255, 255, 255], shade: [212, 192, 228], th: 0.52, speed: 0.008 },
        sun: { x: 0.2, y: 0.86, r: 0.09, col: [255, 244, 220], glow: [255, 210, 200] }, motes: [255, 255, 255]
    },
    golden: {
        name: 'Chiều nắng vàng', text: '#5a2a1c',
        stops: [[0, [84, 118, 196]], [0.5, [214, 164, 150]], [1, [255, 204, 128]]],
        cloud: { col: [255, 234, 196], shade: [196, 136, 120], th: 0.53, speed: 0.006 },
        sun: { x: 0.8, y: 0.86, r: 0.09, col: [255, 244, 196], glow: [255, 196, 110] }, motes: [255, 236, 170]
    },
    twilight: {
        name: 'Chạng vạng tím', text: '#fff4fb',
        stops: [[0, [34, 26, 84]], [0.5, [112, 66, 148]], [0.85, [226, 132, 168]], [1, [250, 168, 160]]],
        cloud: { col: [236, 170, 214], shade: [96, 60, 130], th: 0.57, speed: 0.005 },
        moon: { x: 0.18, y: 0.8, r: 0.045, crescent: true }, stars: 0.6, motes: [255, 210, 240]
    },
    aurora: {
        name: 'Cực quang huyền ảo', text: '#f2fffb',
        stops: [[0, [4, 10, 28]], [0.6, [10, 32, 58]], [1, [24, 56, 84]]],
        cloud: { col: [40, 70, 100], shade: [10, 24, 44], th: 0.64, speed: 0.003 },
        aurora: true, stars: 1.2, motes: [170, 255, 220]
    },
    galaxy: {
        name: 'Dải ngân hà', text: '#fff6ff',
        stops: [[0, [6, 4, 22]], [0.6, [24, 16, 54]], [1, [52, 34, 86]]],
        milky: true, stars: 2.2, motes: [220, 200, 255]
    },
    rainbow: {
        name: 'Cầu vồng sau mưa', text: '#3e3a6e',
        stops: [[0, [112, 172, 236]], [0.6, [190, 222, 250]], [1, [232, 242, 252]]],
        cloud: { col: [255, 255, 255], shade: [196, 212, 236], th: 0.5, speed: 0.007 },
        rainbow: true, sun: { x: 0.82, y: 0.12, r: 0.07, col: [255, 252, 230], glow: [255, 250, 220] }, motes: [255, 255, 255]
    },
    lanterns: {
        name: 'Đèn trời lung linh', text: '#fff3e0',
        stops: [[0, [14, 16, 52]], [0.55, [52, 40, 96]], [0.9, [150, 86, 108]], [1, [196, 110, 96]]],
        cloud: { col: [120, 90, 130], shade: [40, 34, 80], th: 0.6, speed: 0.004 },
        lanterns: 46, stars: 0.6
    },
    sakura: {
        name: 'Trời xuân hoa đào', text: '#7a2e4f',
        stops: [[0, [150, 196, 244]], [0.6, [222, 220, 248]], [1, [255, 226, 236]]],
        cloud: { col: [255, 255, 255], shade: [236, 210, 230], th: 0.53, speed: 0.006 },
        sakura: true, motes: [255, 255, 255]
    },
    bokeh: {
        name: 'Ánh nến bokeh', text: '#fff6e8',
        stops: [[0, [22, 12, 26]], [0.6, [52, 26, 44]], [1, [86, 46, 58]]],
        bokeh: 26
    },
    cotton: {
        name: 'Mây kẹo bông', text: '#7a3566',
        stops: [[0, [196, 210, 255]], [0.5, [246, 206, 236]], [1, [255, 228, 214]]],
        cloud: { col: [255, 246, 252], shade: [240, 180, 220], th: 0.46, speed: 0.006 },
        motes: [255, 255, 255], sparkle: true
    }
};
export const BACKDROPS = Object.fromEntries(Object.entries(DEFS).map(([k, v]) => [k, v.name]));

const stopColor = (stops, f) => {
    if (f <= 0) return stops[0][1];
    for (let i = 1; i < stops.length; i++) if (f <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; return lerp3(ca, cb, (f - a) / (b - a)); }
    return stops[stops.length - 1][1];
};
const RAINBOW = [[255, 90, 90], [255, 160, 80], [255, 230, 100], [120, 220, 120], [100, 180, 255], [120, 110, 230], [190, 120, 230]];

export function createBackdrop(id, { BW, BH, seed = 0 }) {
    const D = DEFS[id] || DEFS.sunset, U = Math.min(BW, BH), sc = U / 60, so = (seed % 997) * 1.37;
    const rows = Array.from({ length: BH }, (_, y) => stopColor(D.stops, y / Math.max(1, BH - 1))), last = rows[BH - 1];
    const sun = D.sun, sx = sun ? sun.x * BW : 0, sy = sun ? sun.y * BH : 0, sr = sun ? sun.r * U : 0;
    const R = k => hash(k * 7.31 + so);

    // vật thể (vị trí cố định theo seed)
    const stars = [];
    if (D.stars) for (let i = 0, n = Math.round(BW * BH * 0.004 * D.stars); i < n; i++) stars.push({ x: R(i * 3) * BW, y: Math.pow(R(i * 3 + 1), 1.4) * BH, b: 0.4 + 0.6 * R(i * 3 + 2), ph: R(i + 99) * 6.28, sp: 1.5 + 3 * R(i + 7) });
    const motes = D.motes ? Array.from({ length: 34 }, (_, k) => ({ x: R(k + 300), y: R(k + 400), sp: 0.4 + R(k + 500), ph: R(k + 600) * 6.28, s: R(k + 700) })) : [];
    const lanterns = Array.from({ length: D.lanterns || 0 }, (_, k) => ({ x: R(k + 800), y: R(k + 900), z: 0.3 + 0.7 * Math.pow(R(k + 1000), 2), ph: R(k + 1100) * 6.28 }));
    const petals = D.sakura ? Array.from({ length: 70 }, (_, k) => ({ x: R(k + 1200), y: R(k + 1300), sp: 0.5 + R(k + 1400), ph: R(k + 1500) * 6.28, c: R(k + 1600) < 0.5 ? [255, 190, 210] : [255, 220, 232] })) : [];
    const bokeh = Array.from({ length: D.bokeh || 0 }, (_, k) => ({ x: R(k + 1700), y: R(k + 1800), r: (2 + 5 * R(k + 1900)) * sc, c: [[255, 190, 110], [255, 140, 120], [255, 220, 150], [240, 150, 200]][Math.floor(R(k + 2000) * 4)], ph: R(k + 2100) * 6.28, sp: 0.3 + 0.7 * R(k + 2200) }));

    function sky(x, y, t, out = [0, 0, 0]) {
        const base = y < 0 ? rows[0] : y < BH ? rows[y | 0] : last;
        let r = base[0], g = base[1], b = base[2];
        if (sun) { // quầng sáng mặt trời
            const q = Math.hypot(x - sx, (y - sy) * 1.2) / (U * 0.9), k = Math.exp(-q * q * 3) * 0.55;
            r += (sun.glow[0] - r) * k; g += (sun.glow[1] - g) * k; b += (sun.glow[2] - b) * k;
        }
        if (D.aurora) { // dải cực quang: rèm sáng uốn lượn, tia dọc
            const yc = BH * (0.66 + 0.07 * Math.sin(x / U * 2.6 + t * 0.15 + so) + 0.04 * Math.sin(x / U * 6.3 - t * 0.22)), dy = (y - yc) / (BH * 0.16);
            if (dy > -2.5 && dy < 1.5) {
                const rays = 0.55 + 0.45 * fbm(x / U * 9 + t * 0.05 + so, 3.3, 3), k = Math.exp(-dy * dy * (dy > 0 ? 3 : 0.8)) * rays * 1.1;
                const c = lerp3([90, 255, 170], [170, 110, 255], clamp(-dy * 0.4, 0, 1));
                r += c[0] * k; g += c[1] * k; b += c[2] * k;
            }
        }
        if (D.milky) { // dải ngân hà chéo + vệt bụi tối
            const u = (x - BW * 0.5) * 0.8 + (y - BH * 0.55) * 0.6, dd = u / (U * 0.42), n = fbm(x / U * 3 + so, y / U * 3, 4), dust = fbm(x / U * 6 + 9 + so, y / U * 6, 3);
            const k = Math.exp(-dd * dd) * (0.4 + 0.8 * n) * (1 - 0.7 * clamp((dust - 0.5) * 4, 0, 1));
            const c = lerp3([150, 110, 220], [255, 220, 240], clamp(n * 1.5 - 0.4, 0, 1));
            r += c[0] * k * 0.95; g += c[1] * k * 0.95; b += c[2] * k * 0.95;
        }
        if (D.rainbow) { // cầu vồng mờ
            const rr = Math.hypot(x - BW * 0.5, (y - BH * 1.02) * 0.95), w = U * 0.12, q = (rr - BH * 0.66) / w;
            if (q > 0 && q < 1) { const c = RAINBOW[Math.min(6, Math.floor(q * 7))], k = 0.38 * Math.sin(q * Math.PI) * clamp(1 - Math.abs(x - BW * 0.5) / (BW * 0.9), 0, 1); r += (c[0] - r) * k; g += (c[1] - g) * k; b += (c[2] - b) * k; }
        }
        if (D.cloud) { // mây dải ngang
            const n = fbm(x / U * 1.1 - t * D.cloud.speed + so, y / U * 3.4 + 7, 4);
            if (n > D.cloud.th) {
                const a = clamp((n - D.cloud.th) * 5, 0, 0.9), sh = clamp((n - fbm(x / U * 1.1 - t * D.cloud.speed + so, y / U * 3.4 + 7.15, 4)) * 7, 0, 1);
                const c = lerp3(D.cloud.col, D.cloud.shade, 0.15 + 0.6 * sh);
                r += (c[0] - r) * a; g += (c[1] - g) * a; b += (c[2] - b) * a;
            }
        }
        out[0] = r; out[1] = g; out[2] = b;
        return out;
    }

    // H: số hàng của bộ đệm d (có thể lớn hơn BH khi ghép cảnh)
    function overlay(d, t, oy = 0, H = BH) {
        for (const s of stars) { const a = s.b * (0.55 + 0.45 * Math.sin(t * s.sp + s.ph)); put(d, BW, H, s.x, s.y + oy, [255, 250, 235], a); if (s.b > 0.93) { glow(d, BW, H, s.x + 1, s.y + oy, [255, 250, 235], a * 0.25); glow(d, BW, H, s.x - 1, s.y + oy, [255, 250, 235], a * 0.25); } }
        if (sun) disc(d, BW, H, sx, sy + oy, sr, sun.col, 0.95);
        if (D.moon) {
            const mx = D.moon.x * BW, my = D.moon.y * BH + oy, mr = D.moon.r * U;
            for (let k = 3; k >= 1; k--) disc(d, BW, H, mx, my, mr * (1 + k * 0.35), [200, 210, 255], 0.07);
            disc(d, BW, H, mx, my, mr, [250, 246, 226]);
            if (D.moon.crescent) disc(d, BW, H, mx + mr * 0.45, my - mr * 0.2, mr * 0.9, sky(mx + mr * 0.45, my - oy - mr * 0.2, t));
            else { disc(d, BW, H, mx - mr * 0.3, my - mr * 0.2, mr * 0.22, [222, 216, 196]); disc(d, BW, H, mx + mr * 0.35, my + mr * 0.3, mr * 0.16, [228, 222, 200]); }
        }
        for (const L of lanterns) { // đèn trời bay lên chậm, lập loè
            const y = ((L.y - t * 0.01 * (0.4 + L.z)) % 1 + 1) % 1 * BH * 1.1 - BH * 0.05 + oy, x = L.x * BW + Math.sin(t * 0.4 + L.ph) * 2 * sc * L.z, s = Math.max(1, L.z * 2.2 * sc), fl = 0.8 + 0.2 * Math.sin(t * 6 + L.ph * 3);
            for (let k = 3; k >= 1; k--) disc(d, BW, H, x, y, s * (0.9 + k * 0.7), [255, 150, 60], 0.06 * fl * L.z);
            for (let yy = -s; yy <= s * 0.7; yy++) for (let xx = -s * 0.6; xx <= s * 0.6; xx++) put(d, BW, H, x + xx, y + yy, yy > s * 0.3 ? [255, 236, 170] : [255, 170, 80], 0.9 * fl);
        }
        for (const P of petals) { // cánh đào rơi chéo
            const y = ((P.y + t * 0.03 * P.sp) % 1 + 1) % 1 * BH * 1.1 - BH * 0.05 + oy, x = ((P.x + t * 0.012 * P.sp) % 1) * BW + Math.sin(t * 1.6 * P.sp + P.ph) * 2.5 * sc;
            put(d, BW, H, x, y, P.c, 0.9); if (sc > 2) { put(d, BW, H, x + 1, y, P.c, 0.7); put(d, BW, H, x, y + 1, P.c, 0.5); }
        }
        if (D.sakura) { // cành đào ở góc trên trái
            const bx = BW + 2 * sc, by = BH * 0.92 + oy; // cành đào chìa vào từ góc dưới phải
            line(d, BW, H, bx, by, bx - 26 * sc, by - 10 * sc, [96, 60, 60], Math.max(1, Math.round(sc * 0.8)));
            line(d, BW, H, bx - 12 * sc, by - 5 * sc, bx - 18 * sc, by - 15 * sc, [96, 60, 60], Math.max(1, Math.round(sc * 0.5)));
            for (let k = 0; k < 16; k++) { const f = R(k + 2300), x = bx - 26 * sc * f + (R(k + 2400) - 0.5) * 4 * sc, y = by - 10 * sc * f + (R(k + 2500) - 0.5) * 4 * sc; disc(d, BW, H, x, y, sc * (0.8 + 0.6 * R(k + 2600)), [255, 196, 214]); put(d, BW, H, x, y, [230, 90, 130]); }
        }
        for (const B of bokeh) { // đốm sáng mờ trôi chậm
            const x = B.x * BW + Math.sin(t * 0.2 * B.sp + B.ph) * 4 * sc, y = B.y * BH + Math.cos(t * 0.15 * B.sp + B.ph) * 3 * sc + oy, a = 0.5 + 0.5 * Math.sin(t * 0.7 * B.sp + B.ph);
            for (let yy = -B.r; yy <= B.r; yy++) for (let xx = -B.r; xx <= B.r; xx++) { const q = (xx * xx + yy * yy) / (B.r * B.r); if (q <= 1) glow(d, BW, H, x + xx, y + yy, B.c, (0.12 + 0.1 * q) * a); }
        }
        for (const m of motes) { // bụi sáng / đom đóm bay lên chậm
            const y = ((m.y - t * 0.012 * m.sp) % 1 + 1) % 1 * BH + oy, x = m.x * BW + Math.sin(t * 0.6 * m.sp + m.ph) * 3 * sc, a = 0.35 + 0.35 * Math.sin(t * 2 * m.sp + m.ph);
            glow(d, BW, H, x, y, D.motes, a * 0.5);
            if (m.s > 0.6) { glow(d, BW, H, x + 1, y, D.motes, a * 0.2); glow(d, BW, H, x, y + 1, D.motes, a * 0.2); }
        }
        if (D.sparkle) for (let k = 0; k < 8; k++) { // lấp lánh
            const slot = Math.floor(t * 0.8 + k * 0.4), f = (t * 0.8 + k * 0.4) % 1, a = Math.sin(f * Math.PI), x = hash(slot * 3.3 + k + so) * BW, y = hash(slot * 5.1 + k) * BH + oy, s = Math.max(1, Math.round(sc));
            for (let j = -s; j <= s; j++) { put(d, BW, H, x + j, y, [255, 255, 255], a * (1 - Math.abs(j) / (s + 1))); put(d, BW, H, x, y + j, [255, 255, 255], a * (1 - Math.abs(j) / (s + 1))); }
        }
    }

    const px3 = [0, 0, 0];
    function render(d, t) {
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
            const o = (y * BW + x) * 4;
            sky(x, y, t, px3);
            d[o] = px3[0]; d[o + 1] = px3[1]; d[o + 2] = px3[2]; d[o + 3] = 255;
        }
        overlay(d, t, 0);
    }
    const top = rows[0], lum = 0.299 * top[0] + 0.587 * top[1] + 0.114 * top[2];
    return { render, sky, overlay, name: D.name, text: D.text, light: lum > 110 };
}
