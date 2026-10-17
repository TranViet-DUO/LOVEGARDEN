export const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const lerp3 = (A, B, f) => [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, f) => a + (b - a) * f;

// Value noise 2D mượt + fractal (nhiều tầng) -> dùng cho mây, khói
export function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const h = (a, b) => hash(a * 57.3 + b * 131.7);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
// Value noise 3D + fractal -> dùng cho bề mặt hành tinh (không bị méo ở cực)
export function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const h = (a, b, c) => hash(a * 57.3 + b * 131.7 + c * 197.9);
    return lerp(
        lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
        lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
}
export function fbm3(x, y, z, octaves = 4) {
    let s = 0, a = 0.5;
    for (let i = 0; i < octaves; i++) { s += a * noise3(x, y, z); x *= 2; y *= 2; z *= 2; a *= 0.5; }
    return s;
}
export function fbm(x, y, octaves = 4) {
    let s = 0, a = 0.5;
    for (let i = 0; i < octaves; i++) { s += a * noise2(x, y); x *= 2; y *= 2; a *= 0.5; }
    return s;
}

// Bộ sinh số ngẫu nhiên có hạt giống (mulberry32): cùng seed -> cùng chuỗi số trong [0,1)
export function mulberry32(seed) {
    let s = seed | 0;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
