import { hash, clamp } from './math.js';

// Hàm vẽ dùng chung cho các nền (d = ImageData.data của lưới BW x BH)

// Đặt 1 pixel (có kiểm tra biên), a = độ đậm 0..1 (trộn với màu cũ)
export function put(d, BW, BH, x, y, c, a = 1) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= BW || y >= BH) return;
    const o = (y * BW + x) * 4;
    d[o] += (c[0] - d[o]) * a; d[o + 1] += (c[1] - d[o + 1]) * a; d[o + 2] += (c[2] - d[o + 2]) * a; d[o + 3] = 255;
}

// Cộng sáng (additive) - dùng cho ánh sáng, bokeh
export function glow(d, BW, BH, x, y, c, a) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= BW || y >= BH) return;
    const o = (y * BW + x) * 4;
    d[o] += c[0] * a; d[o + 1] += c[1] * a; d[o + 2] += c[2] * a; d[o + 3] = 255;
}

// Nền chuyển màu dọc từ top xuống bot
export function gradient(d, BW, BH, top, bot) {
    let i = 0;
    for (let y = 0; y < BH; y++) {
        const f = y / Math.max(1, BH - 1), r = top[0] + (bot[0] - top[0]) * f, g = top[1] + (bot[1] - top[1]) * f, b = top[2] + (bot[2] - top[2]) * f;
        for (let x = 0; x < BW; x++) { d[i++] = r; d[i++] = g; d[i++] = b; d[i++] = 255; }
    }
}

export function fill(d, c) {
    for (let i = 0; i < d.length; i += 4) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
}

export function disc(d, BW, BH, cx, cy, r, c, a = 1) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) put(d, BW, BH, x, y, c, a);
    }
}

// Đoạn thẳng dày th pixel
export function line(d, BW, BH, x0, y0, x1, y1, c, th = 1, a = 1) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
    for (let k = 0; k <= n; k++) {
        const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
        for (let j = 0; j < th; j++) for (let i = 0; i < th; i++) put(d, BW, BH, x + i - (th >> 1), y + j - (th >> 1), c, a);
    }
}

// Trái tim bán kính ~s tâm (cx, cy), có điểm sáng/tối cho giống pixel art
export function drawHeart(d, BW, BH, cx, cy, s, c, a = 1) {
    const hi = [c[0] + (255 - c[0]) * 0.4, c[1] + (255 - c[1]) * 0.4, c[2] + (255 - c[2]) * 0.4];
    const lo = [c[0] * 0.72, c[1] * 0.72, c[2] * 0.72];
    for (let dy = Math.floor(-s * 1.2); dy <= s * 1.2; dy++) for (let dx = Math.floor(-s * 1.2); dx <= s * 1.2; dx++) {
        const x = dx / s * 1.15, y = -dy / s * 1.15 + 0.12, q = x * x + y * y - 1;
        if (q * q * q - x * x * y * y * y > 0) continue;
        put(d, BW, BH, cx + dx, cy + dy, (x < -0.2 && y > 0.35) ? hi : y < -0.45 ? lo : c, a);
    }
}

// Tạo n hạt mưa (x, ph: 0..1; sp: hàng/giây; len: độ dài; a: độ đậm)
export function makeDrops(n, { sp = [50, 90], len = [3, 7], a = [0.4, 0.9] } = {}) {
    const r = ([lo, hi]) => lo + Math.random() * (hi - lo);
    return Array.from({ length: n }, () => ({ x: Math.random(), ph: Math.random(), sp: r(sp), len: r(len), a: r(a) }));
}

export function drawDrops(d, BW, BH, drops, t, { slant = 0.25, color = [160, 190, 230], sc = 1 } = {}) {
    for (const p of drops) {
        const len = Math.max(2, Math.round(p.len * sc)), head = (p.ph * BH + t * p.sp * sc) % (BH + len);
        for (let k = 0; k < len; k++) {
            const yy = head - k;
            if (yy < 0 || yy >= BH) continue;
            put(d, BW, BH, (p.x * BW + yy * slant) % BW, yy, color, p.a * (1 - k / len));
        }
    }
}

// Sao băng không trạng thái: mỗi `period` giây có 1 lần, kéo dài `dur` giây; trả về cường độ 0..1 (để làm sáng cảnh)
export function shootingStar(d, BW, BH, t, { period = 5, seed = 0, sc = 1, dur = 0.55, color = [255, 255, 255], tail = 10 } = {}) {
    const slot = Math.floor(t / period), f = (t - slot * period) / dur;
    if (f < 0 || f > 1) return 0;
    const h = k => hash(slot * 7.13 + seed * 3.7 + k);
    const ang = 2.25 + h(3) * 0.35, dx = Math.cos(ang), dy = Math.sin(ang), dist = BH * (0.45 + h(4) * 0.4);
    const hx = BW * (0.4 + h(1) * 0.7) + dx * dist * f, hy = -2 + h(2) * BH * 0.25 + dy * dist * f, len = tail * sc;
    for (let k = 0; k < len; k++) put(d, BW, BH, hx - dx * k, hy - dy * k, color, (1 - k / len) * (1 - f * 0.5));
    return 1 - f;
}

// Quả bóng pixel 4 mức sáng (sáng góc trên trái); eyes = thêm đôi mắt nhìn theo hướng `look` (-1..1)
export function drawBall(d, BW, BH, x, y, rx, ry, col, { eyes = false, look = 0 } = {}) {
    const dark = [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5], light = [col[0] + (255 - col[0]) * 0.55, col[1] + (255 - col[1]) * 0.55, col[2] + (255 - col[2]) * 0.55];
    for (let yy = Math.floor(-ry); yy <= ry; yy++) for (let xx = Math.floor(-rx); xx <= rx; xx++) {
        const nx = xx / rx, ny = yy / ry;
        if (nx * nx + ny * ny > 1) continue;
        const l = Math.floor(clamp(-0.5 * nx - 0.6 * ny + 0.55, 0, 1) * 3.99) / 3;
        put(d, BW, BH, x + xx, y + yy, l < 0.34 ? dark : l < 0.67 ? col : light);
    }
    if (eyes && rx >= 2) {
        const ex = Math.max(1, rx * 0.4), ey = y - ry * 0.1, lx = look * rx * 0.25;
        for (const s of [-1, 1]) { put(d, BW, BH, x + s * ex + lx, ey, [255, 255, 255]); put(d, BW, BH, x + s * ex + lx + 0.9, ey + 0.4, [20, 20, 50]); }
    }
}

// Hình chữ nhật đặc (toạ độ thực, tối thiểu 1 pixel mỗi chiều)
export function rect(d, BW, BH, x, y, w, h, c, a = 1) {
    const x0 = Math.round(x), y0 = Math.round(y), x1 = Math.max(x0 + 1, Math.round(x + w)), y1 = Math.max(y0 + 1, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) put(d, BW, BH, xx, yy, c, a);
}
