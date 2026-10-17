// "Vườn hoa của hai người" — nông trại hoa cho 2 người chơi từ xa (khoảng 1–2 giờ). Xem CLAUDE.md để hiểu toàn bộ game.
//   Chạm luống = tự làm việc cần làm (khai hoang, gieo, tưới, bắt sâu, nhổ cỏ, hái). Giữ tay = menu thao tác. Vuốt = một làn gió nhẹ.
// Trạng thái chung do máy chủ giữ (src/worker.js); trình duyệt dự đoán mượt bằng cùng luật (rules.js). URL: /<slug>, /play = chơi thử.
import { createBackdrop } from './lib/backdrops.js';
import { resolvePalette, hex2rgb } from './lib/palettes.js';
import { buildFlowerText, drawFlower, drawLeaf } from './lib/flower-text.js';
import { FLOWER_FONTS, TEXT_FONTS, SIGN_FONT, FONT_FILES, fontAt } from './lib/fonts.js';
import { hash, clamp, lerp, lerp3 } from './lib/math.js';
import { put, disc, drawHeart } from './lib/draw.js';
import { advance, other, weatherAt, starAt, isNight, canFinale, bookCount, SPECIES, SPECIES_ORDER, SHOP, ACTS, AUTO, EVENTS, WISHES, xpFor, levelGift, hybridName, FULL_BLOOM, BOOK_GOAL, COLS, ROWS, DAY, DIG_TAPS, HILL_MAX, MAX_PLOTS, LEAVE_GRACE, WEATHER, WEATHER_LEN, plotPrice, canExpand, ownedPlots, cdLeft, has } from './rules.js';
import { connectGarden, localGarden } from './net.js';
import { drawBed, drawPlant, drawStatus, drawSky, drawRain, nightTint, drawEvent, drawStar, drawLights, drawWeatherFx, skyColors, spColor } from './art.js';
import { drawYard, drawCritters } from './yard.js';
import { createRadio } from './radio.js';
import { toast, openSheet, refreshSheet, closeSheet, sheetOpen, showLetter, ICON } from './ui.js';
import { buildHill, drawHill, hillCount, hillColor } from './hill.js';
import { audio, scene as audioScene } from './audio.js';
import { createTour, tourDone } from './tour.js';

Object.assign(ICON, { lan: '🌺', xuongrong: '🌵', mai: '💛', bocongcanh: '🌬️', maudon: '🏵️', vantho: '🧡', muoigio: '🌸', daquy: '🌻', camchuong: '💐', thuocduoc: '🥀', ly: '🤍', hoagiay: '💜' });
ICON.quynh = '🌙';
const $ = id => document.getElementById(id);
// mọi thứ nằm trong #app (máy tính: khung dọc ở giữa màn hình; điện thoại: toàn màn hình) -> dùng kích thước & toạ độ của khung
const app = $('app'), VW = () => app.clientWidth, VH = () => app.clientHeight;
let appX = 0, appY = 0; const ex = e => e.clientX - appX, ey = e => e.clientY - appY;
const world = $('world'), wctx = world.getContext('2d'), words = $('words'), tctx = words.getContext('2d');
const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const easeInOut = u => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
const params = new URLSearchParams(location.search), DEMO = params.has('demo'), RESET = params.has('reset');
// ?perf: đo thời gian từng phần mỗi khung hình (ms cộng dồn, đọc qua window.__perf)
const PERF = params.has('perf') ? (window.__perf = { frames: 0 }) : null, now_ = () => performance.now();
let pt0 = 0; const pm = k => { if (!PERF) return; const n = now_(); PERF[k] = (PERF[k] || 0) + n - pt0; pt0 = n; };
if (RESET) { try { for (const k of Object.keys(localStorage)) if (k.startsWith('vuon-hoa')) localStorage.removeItem(k); } catch { } history.replaceState(null, '', location.pathname); }
const store = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };

// ---------- khu vườn của ai ----------
const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean)[0] || '');
let info = null;
if (slug && slug !== 'play') try { const r = await fetch('/api/card/' + encodeURIComponent(slug)); if (r.ok) info = await r.json(); } catch { }
const SOLO = !info;
if (info) try { localStorage.setItem('vuon-hoa-last', JSON.stringify({ slug, me: info.me, partner: info.partner, title: info.title })); } catch { }
const card = {
    mode: 'cam-on', flowerText: 'Cảm ơn bạn', message: 'Cảm ơn bạn đã ghé khu vườn nhỏ này\nvà gieo xuống đây một chút dịu dàng.', signature: '',
    palette: 'hong-phan', backdrop: 'sunset', flowerFont: 'script', textFont: 'lora', textColor: 'auto', seed: 7, ...(info?.card || {})
};
const DEMO_NOTES = ['Mỗi bông hoa ở đây là một lời cảm ơn nhỏ.', 'Cảm ơn bạn đã kiên nhẫn chăm khu vườn này.', 'Chúc bạn luôn có hoa — trong tay và trong lòng.'];
const ME = info?.role || 'nhan', THEM = other(ME), NAME = { [ME]: info?.me || 'Bạn', [THEM]: info?.partner || 'Người ấy' };
const ROLE_COL = { nhan: [255, 122, 168], gui: [96, 176, 255] }, css = c => `rgb(${c.join(',')})`;
const who = r => (r === ME ? 'Bạn' : NAME[THEM]);
const SPN = sp => SPECIES[sp]?.name || '';
const pal = resolvePalette(card);
const TITLE = `${info?.title || 'Vườn hoa của hai người'} 🌸`;
document.title = TITLE;
await Promise.all(FONT_FILES.map(f => document.fonts.load(`${f.style} ${f.weight} 40px "${f.family}"`, 'Aảơư'))).catch(() => { });

// ---------- trạng thái ----------
let st = null, online = [ME], srvOff = 0, notesText = [], knownNotes = null, t = 0;
const serverNow = () => Date.now() + srvOff, sinceServer = at => Math.max(0, (serverNow() - at) / 1000);
const rctx = () => ({ mode: card.mode, notesTotal: info?.notesTotal ?? DEMO_NOTES.length, online, cheats: SOLO || !!info?.cheats });
let seedSel = 'cuc', wind = { x: 0, y: 0 }, P = [], ripples = [], heads = [], sel = -1, selT = 0;
const LIFT_KEY = `vuon-hoa-lift-${slug || 'play'}`, SEEN_KEY = `vuon-hoa-seen-${slug || 'play'}`;
let seenLift = +(store.get(LIFT_KEY) || 0), fin = null; // fin: đoạn kết đang chiếu

// ---------- bố cục: trời thoáng ở trên, đồi hoa phía sau hàng rào, sân nhỏ (đồ trong vườn), các luống ở dưới ----------
let px, BW, BH, BH1, sc, L, GB, img, d, back, BK, bakeRow = 0, GAP, TRAVEL, dpr, HILL, hillKey = null;
// dáng đồi đổi theo mỗi lần trồng lại vườn (seed + round), dựng lại khi đổi
function ensureHill() { const key = st ? ((st.seed * 7919 + st.round * 104729) % 1000003) + 1 : 0; if (key !== hillKey) { hillKey = key; HILL = buildHill(BW, L.skyH - L.hillTop, key); } }
function layout() {
    const ar = app.getBoundingClientRect(); appX = ar.left; appY = ar.top;
    px = Math.max(2, Math.round(Math.min(VW(), VH()) / 190));
    BW = Math.ceil(VW() / px); BH = Math.ceil(VH() / px); BH1 = BH + 1; sc = Math.min(BW, BH) / 60;
    world.width = BW; world.height = BH1; world.style.width = BW * px + 'px'; world.style.height = BH1 * px + 'px';
    img = wctx.createImageData(BW, BH1); d = img.data;
    dpr = Math.min(2, devicePixelRatio || 1); words.width = VW() * dpr; words.height = VH() * dpr;
    const wide = BW > BH, bandH = Math.max(Math.round(BH * 0.06), 9), yardH = Math.max(3, Math.round(BH * 0.012)), y1 = BH - Math.ceil(128 / px) - 2; // chừa chỗ thanh dưới + thanh gắn kết + dòng gợi ý
    let skyH = Math.round(BH * (wide ? 0.47 : 0.45)), hillTop = Math.round(BH * (wide ? 0.2 : 0.19));
    const minG = Math.round(BH * 0.3); // màn thấp (điện thoại xoay ngang): bớt trời để vẫn thấy đủ 4 hàng luống
    if (y1 - skyH - yardH < minG) { const ns = Math.max(Math.round(BH * 0.2), y1 - minG - yardH); hillTop = Math.round(hillTop * ns / skyH); skyH = ns; }
    const y0 = skyH + yardH;
    let gw = BW * 0.85, x0 = BW * 0.075; const gh = y1 - y0; // hai bên chừa chỗ cho cây to, thùng ủ, hòm thư
    if (gw > gh * (wide ? 2.6 : 1.7)) { gw = gh * (wide ? 2.6 : 1.7); x0 = (BW - gw) / 2; } // màn ngang: luống rộng ra hai bên
    const cw = gw / COLS, ch = gh / ROWS, k = Math.min(cw / 12, ch / 9);
    const plots = Array.from({ length: COLS * ROWS }, (_, i) => {
        const c = i % COLS, r = Math.floor(i / COLS), cx = x0 + c * cw, cy = y0 + r * ch, x = cx + cw * 0.1, y = cy + ch * 0.56, w = cw * 0.8, h = ch * 0.34;
        return { cx, cy, cw, ch, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), bx: x + w / 2, by: y + h * 0.5, k };
    });
    L = { BW, BH, skyH, hillTop, bandY: skyH - bandH, bandH, yardH, H0: y1, k, plots, x0, gw };
    hillKey = null; ensureHill();
    GB = new Uint8ClampedArray(BW * BH * 4); // mặt cỏ của vườn vẽ sẵn
    for (let y = skyH; y < BH; y++) for (let x = 0; x < BW; x++) {
        const o = (y * BW + x) * 4;
        let c = lerp3([118, 190, 96], [78, 146, 66], (y - skyH) / (BH - skyH));
        const n = hash(x * 3.7 + y * 11.3); if (n > 0.88) c = lerp3(c, [160, 210, 110], 0.5); else if (n < 0.08) c = lerp3(c, [50, 110, 50], 0.3);
        GB[o] = c[0]; GB[o + 1] = c[1]; GB[o + 2] = c[2]; GB[o + 3] = 255;
    }
    back = createBackdrop(card.backdrop, { BW, BH, seed: +card.seed || 1 }); GAP = Math.round(BH * 0.7); TRAVEL = GAP + BH;
    BK = new Uint8ClampedArray(BW * (BH + GAP) * 4); bakeRow = 0;
    if (fin) buildFinale(fin.liftT);
}
function bakeRows(n) { // trời của đoạn kết vẽ dần từng hàng để không bị giật
    const c = [0, 0, 0];
    for (let k = 0; k < n && bakeRow < BH + GAP; k++, bakeRow++) for (let x = 0; x < BW; x++) { back.sky(x, bakeRow, 0, c); const o = (bakeRow * BW + x) * 4; BK[o] = c[0]; BK[o + 1] = c[1]; BK[o + 2] = c[2]; BK[o + 3] = 255; }
}
const plotCss = i => { const b = L.plots[i]; return { x: b.cx * px, y: b.cy * px, w: b.cw * px, h: b.ch * px }; };

// ---------- vẽ khu vườn (oy: lệch dọc khi máy quay lia) ----------
const gView = () => st.gt + st.acc;
let starPos = null, decorHits = [], evHit = null, links = [];
const itemReady = k => { if (k === 'radio') return !!st && !st.radio?.q?.length && !st.radio?.list && tourDone(); if (!st || !ACTS[k] || !has(st, k)) return k === 'giay' && st?.decor.giay && unreadMail(); const gt = gView(); return cdLeft(st, k, gt) <= 0 && (!ACTS[k].night || isNight(gt)) && (k !== 'thung' || st.inv.compost >= 3); };
function drawGarden(oy, extraLean = 0, headless = null) {
    const C = { d, BW, H: BH1, t, oy }, gt = gView(), weather = weatherAt(st, gt);
    pt0 = PERF ? now_() : 0;
    const sky = drawSky(C, L.skyH, gt, weather, st.decor, st.seed); pm('sky');
    const dark = sky.night ? 0.55 : sky.tod > 0.6 ? 1 - (sky.tod - 0.6) / 0.067 * 0.3 : 1, lean = clamp(wind.x * 0.25, -0.5, 0.5) + extraLean + (weather === 'wind' ? 0.15 : 0);
    drawHill({ ...C, oy: oy + L.hillTop }, HILL, st.hill || '', lean, dark, fin && (c => t >= fin.hillTd(c))); pm('hill'); // đồi hoa phía sau hàng rào
    for (let y = L.skyH; y < BH; y++) { const j = y + oy; if (j >= 0 && j < BH1) d.set(GB.subarray(y * BW * 4, (y + 1) * BW * 4), j * BW * 4); }
    const star = starAt(st, gt);
    if (star) { const x = star.dir > 0 ? BW * (0.12 + 0.76 * star.f) : BW * (0.88 - 0.76 * star.f), y = L.hillTop * (0.35 + star.y * 2) + star.f * L.hillTop * 0.35; drawStar(C, x, y, star.dir, star.f, sc); starPos = { x, y }; } else starPos = null;
    const both = online.includes('gui') && online.includes('nhan');
    decorHits = drawYard(C, L, st, { ready: itemReady, mail: unreadMail(), music: radio.playing, night: sky.night, dark }); pm('decor');
    heads = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c, b = L.plots[i], Pt = st.plots[i];
        drawBed(C, b, Pt, i, i === sel && t - selT < 0.4, Pt.st === 'locked' && !fin && canExpand(st, i));
        if (Pt.st === 'plant') { C.noHead = headless?.(i); const h = drawPlant(C, b, Pt, lean + 0.08 * Math.sin(t * 1.3 + i), sky.night); heads[i] = h && { ...h, P: Pt }; }
    }
    pm('plants');
    for (const ln of links) { // tưới nối tiếp: chuỗi trái tim nối hai luống
        const k = (t - ln.t) / 2.5; if (k > 1) continue;
        const [ax, ay] = plotXY(ln.a), [bx, by] = plotXY(ln.b), m = Math.max(3, Math.round(Math.hypot(bx - ax, by - ay) / (3 * sc)));
        for (let j = 0; j <= m; j++) { const u = j / m; if (u > k * 3) break; drawHeart(d, BW, BH1, ax + (bx - ax) * u, ay + (by - ay) * u - Math.sin(u * Math.PI) * 4 * sc + C.oy, sc * (0.5 + Math.min(0.5, ln.n * 0.08)), [255, 110 + (j % 2) * 50, 160], 1 - k); }
    }
    links = links.filter(ln => t - ln.t < 2.5);
    if (!headless) drawCritters(C, L, { night: sky.night, dark, blooms: heads.filter(h => h && h.P.bloom && !h.P.faded) }); // chim, sóc, thỏ, bướm, ong, cú
    for (const p of P) drawParticle(C, p);
    if (weather === 'rain' || weather === 'storm') drawRain(C, t, weather === 'storm');
    pm('fx1'); nightTint(C, L.skyH + oy, dark); pm('tint');
    if (sky.night) drawLights(C, L, st, heads, t);
    if (sky.night && st.done && !fin) drawSkyLanterns(C, L.H0); // sau Lễ hội: mỗi đêm đèn trời bay lên từ vườn
    evHit = headless ? null : drawEvent(C, L, st.ev, t); // sau lớp tối ban đêm để vẫn thấy rõ
    drawWeatherFx(C, weather, t, L.hillTop + oy);
    if (!headless) st.plots.forEach((Pt, i) => drawStatus(C, L.plots[i], Pt, heads[i]));
    for (const r of ripples) { const k = (t - r.t) / 0.5, rad = k * 5 * sc; if (k > 1) continue; for (let a = 0; a < 6.28; a += 0.4) put(d, BW, BH1, r.x + Math.cos(a) * rad, r.y + oy + Math.sin(a) * rad, r.col, 0.9 * (1 - k)); }
    ripples = ripples.filter(r => t - r.t < 0.5); pm('rest');
}

// đèn trời (sau Lễ hội hoa): bay chậm từ vườn lên trời rồi tắt dần
function drawSkyLanterns(C, fromY) {
    for (let j = 0; j < 9; j++) {
        const u = (t * (0.018 + hash(j * 3.1) * 0.012) + hash(j * 7.7)) % 1, x = BW * (0.08 + 0.84 * hash(j * 1.9)) + Math.sin(t * 0.6 + j) * 3 * sc, y = fromY - u * fromY * 1.05, a = Math.min(1, u * 6) * (1 - u) * 1.3;
        if (a <= 0) continue;
        for (let r = 3; r >= 1; r--) disc(d, BW, BH1, x, y + C.oy, sc * 0.45 * r, [255, 170, 80], 0.1 * a);
        for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) put(d, BW, BH1, x + xx, y + yy + C.oy, yy < 1 ? [255, 214, 140] : [255, 150, 80], a);
    }
}

// ---------- hạt bay: lá, cánh hoa, giọt nước, tim ----------
function drawParticle(C, p) {
    const a = Math.min(1, (p.max - p.life) * 2), y = p.y + C.oy;
    if (p.kind === 'drop') put(d, BW, BH1, p.x, y, [140, 200, 255], 0.9);
    else if (p.kind === 'leaf') drawLeaf(d, BW, BH1, p.x, y, p.sz * 1.5, Math.cos(p.rot), Math.sin(p.rot), a);
    else if (p.kind === 'heart') drawHeart(d, BW, BH1, p.x, y, p.sz, p.col, a);
    else if (p.kind === 'spark') put(d, BW, BH1, p.x, y, p.col, a);
    else disc(d, BW, BH1, p.x, y, Math.max(0.5, p.sz * 0.6), p.col, a);
}
function updateParticles(dt, weather) {
    for (const p of P) {
        p.life += dt;
        if (p.kind === 'drop') p.vy += 60 * sc * dt;
        else if (p.kind === 'heart' || p.kind === 'spark') { p.vy -= 2 * sc * dt; p.vx = Math.sin(p.life * 2 + p.rot) * 3 * sc; }
        else { const tx = (wind.x + (weather === 'wind' ? 0.4 : 0)) * 12 * sc + Math.sin(p.life * 3 + p.rot) * 2 * sc, ty = wind.y * 6 * sc + Math.cos(p.life * 2.3 + p.rot) * 1.5 * sc; p.vx += (tx - p.vx) * dt * 1.5; p.vy += (ty - p.vy) * dt + 3 * sc * dt; p.rot += 2 * dt; }
        p.x += p.vx * dt; p.y += p.vy * dt;
    }
    P = P.filter(p => p.life < p.max && p.x > -30 && p.x < BW + 30 && p.y < BH + 10 && p.y > -BH);
    const w = Math.hypot(wind.x, wind.y) + (weather === 'wind' ? 0.35 : 0); // làn gió nhẹ: thỉnh thoảng một chiếc lá, một cánh hoa
    if (w > 0.15 && P.length < 80 && Math.random() < w * dt * 6) {
        const i = Math.floor(Math.random() * L.plots.length), b = L.plots[i], Pt = st.plots[i], petal = Pt.st === 'plant' && Pt.bloom;
        P.push({ kind: petal ? 'petal' : 'leaf', x: b.bx, y: b.by - b.k * 4, vx: wind.x * 6 * sc, vy: -2 * sc, rot: Math.random() * 6, life: 0, max: 4, col: petal ? spColor(Pt) : [96, 170, 80], sz: sc * 0.7 });
    }
}
const burst = (x, y, kind, col, n, sz = sc) => { for (let k = 0; k < n; k++) P.push({ kind, x: x + (Math.random() - 0.5) * 6 * sc, y, vx: 0, vy: -(4 + Math.random() * 6) * sc, rot: Math.random() * 6, life: 0, max: 1.6 + Math.random(), col, sz }); };
const plotXY = i => { const b = L.plots[i]; return b ? [b.bx, b.by - b.k * 3] : [BW / 2, L.skyH + L.yardH]; };

// ---------- ĐOẠN KẾT: Lễ hội hoa ----------
const R = (i, k) => hash(i * 12.37 + k * 3.71 + (+card.seed || 1) * 0.11);
const flyScreen = (p, tau) => {
    const e = 1 - Math.exp(-tau / 1.3), w = Math.min(1, tau);
    return [p.x0 + BW * (0.03 + 0.1 * p.r1) * e + Math.sin(tau * 1.3 + p.ph) * BW * 0.05 * w, p.y0 + (BH * (0.15 + 0.55 * p.r2) - p.y0) * smooth(tau / 4) + Math.sin(tau * 1.8 + p.ph * 1.3) * BH * 0.02 * w];
};
function buildFinale(liftT) {
    bakeRows(1e9);
    const ff = FLOWER_FONTS[card.flowerFont] || FLOWER_FONTS.script;
    const ft = buildFlowerText(card.flowerText, ff.font, { BW, BH, cx: BW / 2, cy: BH * 0.24, maxW: BW * 0.88, maxH: BH * 0.3, createCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }), seed: +card.seed || 1 });
    const src = [];
    st.plots.forEach((Pt, i) => { if (Pt.st === 'plant' && Pt.g > 0.5) { const b = L.plots[i]; for (let k = 0; k < 3; k++) src.push({ x: b.bx + (k - 1) * b.k, y: b.by - b.k * 6, col: spColor(Pt), i, td: liftT + 0.4 + (b.bx / BW) * 2.2 + R(i, k) * 0.5 }); } });
    const hillStr = st.hill || '', hillTd = c => liftT + 0.6 + (c.x / BW) * 2.4 + hash(c.rank * 1.7) * 0.8; // hoa trên đồi cũng theo gió bay lên
    const hn = hillCount(HILL, hillStr), every = Math.max(1, Math.ceil(hn / 600));
    for (const c of HILL.cands) if (c.rank < hn && c.rank % every === 0) src.push({ x: c.x, y: c.y + L.hillTop, col: hillColor(HILL, c, hillStr), i: -2, td: hillTd(c), r: c.r });
    for (let k = 0; src.length < 40; k++) { const b = L.plots[k % L.plots.length]; src.push({ x: b.bx + (R(k, 1) - 0.5) * b.w, y: b.by, col: pal.colors[k % pal.colors.length].rgb, i: -1, td: liftT + 0.4 + (b.bx / BW) * 2.2 + R(k, 2) * 0.5 }); }
    src.sort((a, b) => a.x - b.x);
    const order = ft.dots.map((p, i) => i).sort((a, b) => ft.dots[a].x - ft.dots[b].x), PAN1 = liftT + 1.8 + 6.5;
    let landAll = PAN1;
    const parts = order.map((di, n) => {
        const p = ft.dots[di], s = src[Math.min(src.length - 1, Math.floor((n + R(n, 9)) * src.length / order.length))];
        const ts = s.td, cs = Math.max(ts + 1.6, PAN1 - 2.4 + 2.4 * R(n, 4)), cd = 2.4 + R(n, 5);
        landAll = Math.max(landAll, cs + cd + 0.7);
        return { ...p, col: s.col, x0: s.x, y0: s.y, ts, cs, cd, r1: R(n, 7), r2: R(n, 8), sz: Math.max(0.8, sc * 0.6) };
    });
    const rise = src.map((s, n) => ({ ...s, x0: s.x, y0: s.y, r1: R(n, 11), r2: R(n, 12), ph: R(n, 13) * 6.28 }));
    const plotTd = {}; for (const s of src) if (s.i >= 0) plotTd[s.i] = Math.min(plotTd[s.i] ?? 1e9, s.td);
    fin = { liftT, ft, parts, rise, plotTd, landAll, MSG0: landAll + 0.2, ended: false, hillTd };
    document.body.classList.add('hide-ui'); closeSheet(); closeMenu();
}
function drawFinale() {
    const PAN0 = fin.liftT + 1.8, cf = TRAVEL * easeInOut((t - PAN0) / 6.5), c = Math.floor(cf), fr = cf - c, Y = ys => ys + 1 - fr;
    world.style.transform = `translateY(${(fr - 1) * px}px)`;
    const top = skyColors((gView() % DAY) / DAY)[0];
    for (let j = 0; j < BH1; j++) {
        const wy = j - c - 1, o = j * BW * 4; if (wy >= 0) continue;
        if (wy < -GAP) { const r = Math.max(0, wy + TRAVEL); d.set(BK.subarray(r * BW * 4, (r + 1) * BW * 4), o); }
        else { const f = smooth((wy + GAP) / GAP), r = wy + TRAVEL; for (let x = 0; x < BW; x++) { const q = (r * BW + x) * 4, p = o + x * 4; d[p] = lerp(BK[q], top[0], f); d[p + 1] = lerp(BK[q + 1], top[1], f); d[p + 2] = lerp(BK[q + 2], top[2], f); d[p + 3] = 255; } }
    }
    if (c >= GAP - 2) back.overlay(d, t, c + 1 - TRAVEL, BH1);
    const lean = 0.4 * (1 - smooth((t - fin.liftT - 4) / 3));
    if (c < BH + 2) drawGarden(c + 1, lean, i => fin.plotTd[i] !== undefined && t >= fin.plotTd[i]);
    for (const s of fin.rise) {
        if (t < s.td) continue;
        const a = 1 - smooth((t - Math.max(PAN0 + 5, s.td + 3)) / 1.2); if (a <= 0) continue;
        const [fx, fy] = flyScreen(s, t - s.td); disc(d, BW, BH1, fx, Y(fy), Math.max(0.6, Math.min(sc * 0.5, (s.r || 9) * 0.7)), s.col, a * 0.9);
    }
    const landed = [];
    for (const p of fin.parts) {
        if (t < p.ts) continue;
        const e = smooth((t - p.cs) / p.cd);
        if (e >= 1) { landed.push(p); continue; }
        const [fx, fy] = flyScreen(p, t - p.ts), x = lerp(fx, p.x, e) + Math.sin(Math.PI * e) * BW * 0.1 * (p.r1 - 0.5), y = Y(lerp(fy - cf, p.y - TRAVEL, e) + cf);
        disc(d, BW, BH1, x, y, Math.max(0.5, lerp(p.sz, p.r * 0.45, e)), p.col);
    }
    const oy = c + 1 - TRAVEL;
    for (const p of landed) disc(d, BW, BH1, p.x + 0.6, p.y + oy + 0.9, p.r * (back.light ? 1.45 : 1.25), [40, 20, 50], (back.light ? 0.42 : 0.18) * smooth((t - p.cs - p.cd) / 0.7));
    for (const p of landed) if (p.leaf) drawLeaf(d, BW, BH1, p.x, p.y + oy, p.r * 1.9, p.lx, p.ly, smooth((t - p.cs - p.cd) / 0.7));
    for (const p of landed) drawFlower(d, BW, BH1, p.x, p.y + oy, p.r * (1 + 0.04 * Math.sin(t * 1.3 + p.ph)), p.col, pal.center, p.ph + Math.sin(t * 0.8 + p.ph) * 0.25, 0.25 + 0.75 * smooth((t - p.cs - p.cd) / 0.7));
    if (c >= BH + 2) for (const p of P) if (p.kind === 'heart') drawParticle({ oy: 0 }, p);
}
function drawWords() {
    tctx.clearRect(0, 0, words.width, words.height);
    if (!fin || t < fin.MSG0 - 0.1) return;
    const W = words.width, H = words.height, tf = TEXT_FONTS[card.textFont] || TEXT_FONTS.lora;
    const color = card.textColor && card.textColor !== 'auto' ? card.textColor : back.text, [cr, cg, cb] = hex2rgb(color), darkTxt = 0.299 * cr + 0.587 * cg + 0.114 * cb < 128;
    const ft = fin.ft, top = ((ft.dots.length ? ft.bbox.y1 + ft.sp : BH * 0.12) * px + VH() * 0.03) * dpr, maxW = W * 0.86, u = Math.min(W, H * 0.5625);
    const wrap = text => { const res = []; for (const para of String(text || '').split('\n')) { let ln = ''; for (const w of para.split(/\s+/).filter(Boolean)) { const s = ln ? ln + ' ' + w : w; if (ln && tctx.measureText(s).width > maxW) { res.push(ln); ln = w; } else ln = s; } res.push(ln); } while (res.length && !res[res.length - 1]) res.pop(); return res; };
    const bottom = H * (card.mode === 'to-tinh' ? 0.66 : 0.86);
    let fs = u * 0.05 * tf.scale, lines, lh;
    tctx.font = fontAt(tf.font, fs);
    const widest = Math.max(1, ...String(card.message || '').split('\n').map(l => tctx.measureText(l.trim()).width));
    if (widest > maxW) fs *= Math.max(0.75, maxW / widest);
    for (let k = 0; k < 12; k++) { tctx.font = fontAt(tf.font, fs); lines = wrap(card.message); lh = fs * 1.5; if (top + lines.length * lh + (card.signature ? fs * 2.5 : 0) <= bottom) break; fs *= 0.92; }
    tctx.save(); tctx.textAlign = 'center'; tctx.fillStyle = color; tctx.shadowColor = darkTxt ? 'rgba(255,255,255,0.75)' : 'rgba(20,10,40,0.65)';
    let y = top, vi = 0;
    for (const l of lines) {
        y += lh; if (!l) continue;
        const a = smooth((t - fin.MSG0 - vi * 1.45) / 1.2); vi++;
        if (a <= 0) continue;
        tctx.font = fontAt(tf.font, fs); tctx.globalAlpha = a; tctx.shadowBlur = fs * 0.35;
        tctx.fillText(l, W / 2, y - fs * 0.32 + (1 - a) * fs * 0.4);
    }
    const SIG = fin.MSG0 + Math.max(0, vi - 1) * 1.45 + 1.4;
    if (card.signature) { const a = smooth((t - SIG) / 1.4); if (a > 0) { const sf = fs * 1.55; tctx.font = fontAt(SIGN_FONT, sf); tctx.globalAlpha = a; tctx.shadowBlur = sf * 0.3; tctx.fillText(card.signature, W / 2, y + sf * 1.25); } }
    tctx.restore();
    if (!fin.ended && t > SIG + 2) { fin.ended = true; $('end').hidden = false; showAnswer(); }
}
function showAnswer() {
    if (card.mode !== 'to-tinh' || !fin?.ended) { $('ask').hidden = $('reply').hidden = true; return; }
    const ans = st.answer?.v;
    $('ask').hidden = !(ME === 'nhan' && !ans);
    $('askQ').textContent = card.question || 'Làm người yêu nhé?';
    $('reply').hidden = ME === 'nhan' && !ans;
    $('reply').textContent = ME === 'gui' ? (ans === 'yes' ? `${NAME[THEM]} đã đồng ý! 💗` : ans === 'think' ? `${NAME[THEM]} muốn suy nghĩ thêm một chút 🌙` : `Đang chờ ${NAME[THEM]} trả lời… 🌷`)
        : ans === 'yes' ? `💗 ${NAME[THEM]} sẽ rất hạnh phúc đấy` : `🌙 Cảm ơn bạn đã thành thật với ${NAME[THEM]}`;
    if (ans === 'yes' && !fin.hearts) { fin.hearts = true; audio.sfx('level'); for (let k = 0; k < 40; k++) P.push({ kind: 'heart', x: Math.random() * BW, y: BH + Math.random() * BH * 0.3, vx: 0, vy: -(10 + Math.random() * 12) * sc, rot: Math.random() * 6, life: 0, max: 9, col: [[255, 110, 150], [255, 160, 190], [240, 70, 110]][k % 3], sz: sc * (1 + Math.random() * 1.2) }); }
}
const AFTER_KEY = `vuon-hoa-after-${slug || 'play'}`;
function leaveFinale() {
    seenLift = st.liftAt; store.set(LIFT_KEY, seenLift);
    fin = null; document.body.classList.remove('hide-ui');
    for (const id of ['end', 'ask', 'reply']) $(id).hidden = true; tctx.clearRect(0, 0, words.width, words.height);
    if (st.done && store.get(AFTER_KEY) !== st.round) { // lần đầu về lại vườn sau lễ hội: vườn vẫn còn nhiều điều để làm
        store.set(AFTER_KEY, st.round);
        showLetter('Hành trình tiếp theo 🌱', 'Lễ hội đã qua, nhưng khu vườn của hai bạn vẫn tiếp tục nở hoa:\n'
            + '🌠 Mỗi bình minh có điều ước mới — làm xong, đồi hoa nở thêm 25 bông\n✨ Săn hoa lấp lánh (1 trên 20 hạt) cho bộ sưu tập\n'
            + '💞 Gắn kết không còn giới hạn cấp, mỗi cấp một món quà\n⛰️ Phủ kín 100% ngọn đồi\n🏮 Đêm nào cũng có đèn trời bay lên\n📸 Gửi bưu thiếp khu vườn cho nhau (trong Sổ tay)');
    }
}

// ---------- tin từ khu vườn chung ----------
let firstState = true;
function onMessage(m) {
    const sp = $('splash'); if (sp && !sp.classList.contains('out')) { sp.classList.add('out'); setTimeout(() => sp.remove(), 900); }
    if (m.type === 'wind') { wind.x = clamp(wind.x + m.wx, -0.9, 0.9); wind.y = clamp(wind.y + m.wy, -0.5, 0.5); return; }
    if (m.type === 'cur') return showPartner(m.x, m.y);
    if (m.type !== 'state') return;
    srvOff = m.now - Date.now(); st = m.st; online = m.online || [ME]; notesText = m.notes || []; ensureHill();
    if (firstState) { firstState = false; if (RESET && rctx().cheats && !SOLO) net.send({ type: 'restart' }); showAway(); }
    for (const f of m.fx || []) onFx(f);
    if (knownNotes === null) knownNotes = notesText.length;
    while (knownNotes < notesText.length) { showLetter(`Lá thư số ${knownNotes + 1}${SOLO ? '' : ` · từ ${info.sender}`}`, notesText[knownNotes]); audio.sfx('letter'); knownNotes++; }
    if (st.liftAt && st.liftAt !== seenLift && !fin) buildFinale(t - Math.min(sinceServer(st.liftAt), 0.5)); // lần đầu thấy đoạn kết: chiếu từ đầu
    radio.update(st.radio || null);
    showAnswer(); hud();
    if (sheetOpen()) refreshOpenSheet();
}
// hiệu ứng / thông báo cho từng sự kiện (từ máy chủ, hoặc do máy mình tự mô phỏng thời gian trôi)
function onFx(f) {
    const mine = f.role === ME, [x, y] = f.i >= 0 ? plotXY(f.i) : [BW / 2, BH / 2];
    if (f.role === THEM && f.i >= 0) ripples.push({ x, y, t, col: ROLE_COL[THEM] });
    if (mine) { tour?.notify({ plant: 'plant', water: 'water', combo: 'water', dig: 'dig', cleared: 'dig', pull: 'dig', expand: 'expand' }[f.k]); if (touched && ['plant', 'water', 'harvest', 'dig', 'cleared', 'bugged', 'combo'].includes(f.k)) navigator.vibrate?.(f.k === 'harvest' || f.k === 'combo' ? 25 : 8); }
    switch (f.k) {
        case 'cleared': burst(x, y, 'leaf', [96, 170, 80], 6); toast(`${who(f.role)} đã khai hoang xong một luống 🪓 +${f.compost || 1} 🍂`, 'good', 'clr' + f.i); audio.sfx('dig'); break;
        case 'dig': case 'pull': burst(x, y, 'leaf', [70, 130, 60], 3); audio.sfx('dig'); break;
        case 'plant': audio.sfx('plant'); if (!mine) toast(`${NAME[THEM]} vừa gieo ${SPN(f.sp)} ${ICON[f.sp]}`, '', 'pl' + f.i); break;
        case 'water': audio.sfx('water'); for (let k = 0; k < 6; k++) P.push({ kind: 'drop', x: x + (Math.random() - 0.5) * 4 * sc, y: y - 6 * sc - Math.random() * 3 * sc, vx: 0, vy: 0, life: 0, max: 0.5, col: [140, 200, 255], sz: 1 }); break;
        case 'combo': audio.sfx('level'); burst(x, y, 'heart', [255, 120, 160], 6, sc * 0.9); toast('💞 Cùng tưới! Hoa đẹp hơn · +5 gắn kết', 'love', 'combo' + f.i); break;
        case 'fert': audio.sfx('plant'); burst(x, y, 'spark', f.gold ? [255, 220, 90] : [150, 255, 150], 10); break;
        case 'bugged': audio.sfx('bug'); burst(x, y, 'spark', [255, 230, 120], 5); toast(`${who(f.role)} bắt được sâu +2 ✨`, 'good', 'bug' + f.i, 2000); break;
        case 'bugGone': toast(f.by === 'wind' ? '🍃 Gió nhẹ đã thổi bay một con sâu' : f.by === 'bird' ? '🐦 Chim sẻ vừa bắt giúp một con sâu' : '🌧️ Mưa to cuốn trôi một con sâu', 'good', 'bg' + f.by, 6000); break;
        case 'harvest': audio.sfx('harvest'); burst(x, y, 'petal', spColor({ sp: f.sp, hue: 0 }), 10); if (f.shiny) burst(x, y, 'spark', [255, 240, 150], 14); toast(`${f.by === 'cun' ? '🐕 Cún hái giúp ' : mine ? '' : NAME[THEM] + ' hái '}+${f.dew} ✨ ${ICON[f.sp]} ${SPN(f.sp)}${f.perfect ? ' · Hoàn hảo ⭐' : ''}${f.shiny ? ' · Lấp lánh ✨×2,5' : ''}${f.hy ? ` · 💞 ${hybridName(f.hy)}` : ''}${f.rainbow ? ' · 🌈' : ''}${f.gift ? ` · +2 hạt ${SPN(f.gift)}` : ''}`, 'good', 'hv' + f.i + f.dew, 1500); break;
        case 'buy': audio.sfx('coin'); if (mine && f.item === 'giay') toast('📝 Đã có giấy ghi chú! Chạm 💌 hoặc hòm thư trong vườn để viết', 'love', 'unl', 0); else if (mine && f.item === 'thung') toast('🧺 Đã có thùng ủ phân! Đủ 3 🍂 thì chạm thùng (hoặc nút 🍂) để ủ', 'good', 'unl', 0); else if (mine && SHOP[f.item]?.kind === 'decor' && ACTS[f.item]) toast(`${SHOP[f.item].icon} ${SHOP[f.item].name} đã đặt trong sân — chạm vào để ${ACTS[f.item].name.toLowerCase()}`, 'good', 'unl', 0); else if (f.got && mine) toast(`🎁 Túi hạt có: ${f.got.map(s => ICON[s] + ' ' + SPN(s)).join(', ')}`, 'good', 'got' + t, 0); else if (!mine) toast(`${NAME[THEM]} vừa mua ${f.item.startsWith('seed:') ? 'hạt ' + SPN(f.item.slice(5)) : SHOP[f.item]?.name}`, '', 'buy' + f.item, 3000); break;
        case 'star': audio.sfx('star'); toast(`🌠 ${who(f.role)} đã ước! ${f.gift === 'songtam' ? '+1 hạt Song Tâm 💞' : '+25 ✨'}`, 'love', 'star'); break;
        case 'level': audio.sfx('level'); toast(`💞 Gắn kết cấp ${f.lvl}! ${f.text}`, 'love', 'lv' + f.lvl, 60000); burst(BW / 2, BH * 0.6, 'heart', [255, 120, 160], 14, sc); break;
        case 'finale': audio.sfx('star'); toast('🎆 Lễ hội hoa! Cùng vuốt nhẹ trên màn hình để gọi gió', 'love', 'fin'); break;
        case 'restart': toast(`${who(f.role)} đã trồng lại khu vườn từ đầu 🌱`, '', 'rs'); break;
        case 'cheat': if (!mine) toast(`${NAME[THEM]} vừa dùng cheat 🎮`, '', 'cheat', 3000); break;
        case 'letter': audio.sfx('letter'); if (mine) toast(`📮 Đã gửi giấy ghi chú — chờ ${NAME[THEM]} đọc nhé`, 'love', 'lt', 0); else { toast(`💌 ${NAME[THEM]} vừa gửi bạn một tờ giấy ghi chú — chạm 💌 để đọc`, 'love', 'lt', 0); if (touched) navigator.vibrate?.([20, 60, 20]); } break;
        case 'read': if (!mine) toast(`📭 ${NAME[THEM]} đã đọc giấy ghi chú của bạn — giờ bạn có thể viết tờ mới`, 'love', 'rd', 0); break;
        case 'expand': audio.sfx('dig'); burst(x, y, 'leaf', [120, 190, 90], 8); toast(`${who(f.role)} đã mở rộng vườn: ${f.n}/${MAX_PLOTS} luống 🌱 — chạm 3 lần để khai hoang`, 'good', 'ex' + f.i); break;
        case 'rewild': toast('🌾 Một luống bỏ trống lâu đã thành cỏ hoang — nhớ gieo ngay sau khi hái nhé', 'bad', 'rw' + f.i, 4000); break;
        case 'use': onUse(f, mine); break;
        case 'radio': if (!mine && ['add', 'list'].includes(f.op)) toast(`📻 ${NAME[THEM]} vừa bật radio — hai bạn đang nghe chung một bài`, 'love', 'radio' + (f.v || ''), 0); break;
        case 'wish': audio.sfx('level'); burst(BW / 2, BH * 0.55, 'heart', [255, 170, 200], 10, sc * 0.8); toast(`🌠 Điều ước thành sự thật: ${wishText(f.w)} · +${f.w.dew} ✨ +3 💞${f.after ? ' · đồi nở thêm 25 bông' : ''}`, 'love', 'wish' + f.w.k + f.w.n, 0); break;
        case 'shinyBloom': audio.sfx('star'); toast(`✨ Một bông ${SPN(f.sp)} LẤP LÁNH vừa nở! Hái được gấp 2,5 ✨`, 'love', 'sb' + f.i, 0); break;
        case 'ev': case 'evDone': case 'evFail': case 'evEnd': case 'evNo': onEvent(f, mine, x, y); break;
        case 'join': if (f.role === THEM) { toast(`${NAME[THEM]} đã vào vườn 💞`, 'love', 'join'); setTimeout(() => toast('Mẹo chơi đôi: gieo cùng lúc vào 2 luống kề nhau → hoa ghép đôi 💞 · thay phiên tưới các luống kề nhau → tưới nối tiếp 💧', 'sky', 'tipduo', 600000), 2500); } break;
        case 'hybrid': { audio.sfx('level'); const [ax, ay] = plotXY(f.i), [bx, by] = plotXY(f.j); burst(ax, ay, 'heart', [255, 130, 180], 6, sc * 0.8); burst(bx, by, 'heart', [255, 130, 180], 6, sc * 0.8); links.push({ a: f.j, b: f.i, t, n: 3 }); toast(`💞 Hoa ghép đôi! Hai luống này sẽ nở thành “${hybridName(f.hy)}” · +3 💞`, 'love', 'hy' + f.i, 0); break; }
        case 'newHybrid': audio.sfx('star'); toast(`📖 Giống lai mới nở: ${hybridName(f.hy)} 💞`, 'love', 'nh' + f.hy, 0); break;
        case 'chain': audio.sfx(f.n % 5 === 0 ? 'level' : 'water'); links.push({ a: f.from, b: f.i, t, n: f.n }); toast(`💧💞 Tưới nối tiếp ×${f.n}! +${f.bonus} ✨${f.n % 5 === 0 ? ' · thưởng thêm' : ''}`, 'love', 'chain', 0); break;
        case 'leave': if (f.role === THEM) toast(`${NAME[THEM]} vừa rời vườn — vườn sẽ lớn chậm hơn`, '', 'leave'); break;
        case 'weather': { const W = WEATHER[f.w]; if (W && f.w !== 'sun') toast(`${W.icon} ${W.name} — ${W.tip}`, 'sky', 'wx' + Math.floor(gView() / WEATHER_LEN), 60000); break; }
        case 'newsp': toast(`📖 Loài mới trong sổ tay: ${ICON[f.sp]} ${SPN(f.sp)}!`, 'love', 'new' + f.sp, 60000); audio.sfx('level'); break;
        case 'bloom': if (!['cuc', 'huongduong', 'bocongcanh'].includes(f.sp)) toast(`${ICON[f.sp]} ${SPN(f.sp)} đã nở — hái thôi!`, 'good', 'bl' + f.i); break;
        case 'bug': toast(`🐛 Sâu đang gặm ${SPN(f.sp)}!`, 'bad', 'bg' + f.i); break;
        case 'wilt': audio.sfx('bad'); toast(`🥀 ${SPN(f.sp)} đang héo!`, 'bad', 'wl' + f.i); break;
        case 'die': audio.sfx('bad'); toast(`💀 ${SPN(f.sp)} đã chết khô… −2 💞`, 'bad', 'die' + f.i); break;
        case 'fade': toast(`🍂 ${SPN(f.sp)} sắp tàn — hái nhanh kẻo phí!`, 'bad', 'fd' + f.i); break;
        case 'hill': audio.sfx('level'); toast(`⛰️ Đồi hoa đã phủ ${f.pct}%!${f.pct >= 100 ? ' Kín cả ngọn đồi rồi 💐' : ''}`, 'love', 'hill' + f.pct, 600000); break;
        case 'hillLoss': toast(`🥀 ${f.n} bông trên đồi héo theo…`, 'bad', 'hl', 4000); break;
        case 'fullbloom': audio.sfx('level'); toast('🌸 VƯỜN NỞ RỘ! +50 ✨ +15 💞', 'love', 'full', 600000); burst(BW / 2, BH * 0.7, 'heart', [255, 150, 190], 20, sc); break;
    }
}

// công trình trong vườn vừa được dùng
function onUse(f, mine) {
    const by = mine ? '' : `${NAME[THEM]} `, [cx, cy] = [BW / 2, L.skyH + L.yardH];
    audio.sfx(f.item === 'thung' ? 'coin' : 'level');
    const msg = {
        thung: '🍂 → 🧪 Ủ được 1 phân bón', gieng: `🪣 ${by}múc nước giếng tưới đẫm cả vườn`, maybom: '💦 Máy bơm chạy hết công suất — 1 phút cả vườn không mất nước', vit: `🦆 Cạp cạp… đàn vịt dọn ${f.n} đám cỏ dại${f.n ? ` · +${f.n} 🍂` : ''}`,
        maygieo: `🛒 Xe gieo hạt gieo ${f.n} luống`, cun: f.n ? `🐕 Cún đào đất: khai hoang ${f.n} chỗ · +${f.n} 🍂` : '🐕 Cún đào đất… nhưng vườn sạch rồi, cún vẫy đuôi vui vẻ', nhachim: `🐦 Chim sẻ bắt ${f.n} con sâu${f.n ? ` · +${2 * f.n} ✨` : ''}`,
        bunhin: '🌾 Bù nhìn lắc lư — 3 phút không sâu nào dám tới', chuong: '🎐 Leng keng… gió nhẹ đã tới', hoca: `🐟 Cá vàng tặng 1 hạt ${ICON[f.sp] || ''} ${SPN(f.sp)}`, tong: `🍯 Lấy mật được +${f.n} ✨`,
        den: '🏮 Đèn trời bay lên… nhìn kìa, sao băng! Chạm để ước', choi: '🌸 Ngồi trong chòi ngắm hoa — hoa tươi lâu thêm 1 phút', coixay: f.n ? `🌀 Cối xay xay ${f.n} mẻ: +${f.n} 🧪 +${5 * f.n} ✨` : '🌀 Cối xay quay tít… nhưng chưa đủ 3 🍂', maiche: '🛡️ Kéo lưới che cả vườn trong 3 phút', xichdu: '💞 Đẩy xích đu… gắn kết tăng'
    }[f.item];
    if (msg) toast(msg, f.item === 'xichdu' ? 'love' : 'good', 'use' + f.item, 1500);
    if (f.item === 'gieng' || f.item === 'maybom') for (let k = 0; k < 30; k++) P.push({ kind: 'drop', x: L.x0 + Math.random() * L.gw, y: L.skyH + L.yardH + Math.random() * (L.H0 - L.skyH - L.yardH) * 0.5, vx: 0, vy: 0, life: 0, max: 0.6, col: [140, 200, 255], sz: 1 });
    else if (f.item === 'xichdu') burst(cx, cy, 'heart', [255, 120, 160], 8, sc * 0.8);
    else burst(cx, cy, 'spark', [255, 240, 150], 8);
}
// sự kiện ngẫu nhiên
function onEvent(f, mine, x, y) {
    const E = EVENTS[f.ev]; if (!E) return;
    if (f.k === 'ev') {
        audio.sfx(f.ev === 'sau' ? 'bad' : 'star');
        if (f.auto === 'bunhin') return toast('🌾 Một con quạ định sà xuống… bù nhìn đã doạ nó bay mất!', 'good', 'ev' + f.id, 0);
        if (f.auto === 'cun') return toast('🐕 Một con quạ định sà xuống… cún sủa vang, quạ bay mất!', 'good', 'ev' + f.id, 0);
        if (f.auto === 'nhachim') return toast('🐛 Sâu kéo đến… chim sẻ từ nhà chim đã bắt sạch!', 'good', 'ev' + f.id, 0);
        if (f.ev === 'hat') return toast(`🌬️ Gió mang tới 1 hạt lạ: ${ICON[f.sp]} ${SPN(f.sp)}!`, 'love', 'ev' + f.id, 0);
        return toast(`${E.icon} ${E.name} — ${E.text}`, f.ev === 'sau' || f.ev === 'qua' ? 'bad' : 'love', 'ev' + f.id, 0);
    }
    if (f.k === 'evNo') return toast(`Chưa thể có "${E.name}" lúc này (cần đúng điều kiện trong vườn)`, 'bad', 'evno', 0);
    if (f.k === 'evFail') { audio.sfx('bad'); return toast(`🐦‍⬛ Quạ đã ăn mất cây ${SPN(f.sp)} non…`, 'bad', 'evf', 0); }
    if (f.k === 'evEnd') { if (f.ev === 'meo') toast('🐱 Chú mèo vươn vai rồi bỏ đi', '', 'eve'); if (f.ev === 'goi' || f.ev === 'domdom') toast(`${E.icon} ${E.name} đã biến mất…`, '', 'eve'); return; }
    // evDone: ai đó vừa xử lý
    const by = f.by === 'cun' ? '🐕 Cún' : mine ? 'Bạn' : NAME[THEM];
    audio.sfx(f.ev === 'qua' ? 'bug' : 'coin');
    const [ex2, ey2] = f.i >= 0 ? plotXY(f.i) : [BW / 2, L.skyH + L.yardH];
    burst(ex2, ey2, f.ev === 'meo' ? 'heart' : 'spark', f.ev === 'meo' ? [255, 150, 180] : [255, 240, 150], 8, sc * 0.8);
    toast({ qua: `🐦‍⬛ ${by} đã đuổi con quạ đi!`, meo: `🐱 ${by} vuốt ve chú mèo… gừ gừ 💞`, co4: `🍀 ${by} hái được cỏ bốn lá: lần hái hoa tới được gấp đôi ✨`, domdom: `✨ Đom đóm tặng +${f.dew} ✨`, goi: `🎁 ${f.by === 'cun' ? 'Cún tha gói quà về: ' : 'Trong gói quà có: '} ${f.sp ? `2 hạt ${ICON[f.sp]} ${SPN(f.sp)}` : f.fert ? '1 🧪 phân bón' : `+${f.dew} ✨`}` }[f.ev] || '', 'love', 'evd' + f.id, 0);
}

// ---------- "Trong lúc bạn vắng mặt" ----------
const fmtDur = s => s < 90 ? `${Math.round(s)} giây` : s < 5400 ? `${Math.round(s / 60)} phút` : s < 172800 ? `${(s / 3600).toFixed(1).replace('.0', '')} giờ` : `${Math.round(s / 86400)} ngày`;
function snapshot() { if (st) store.set(SEEN_KEY, { real: serverNow(), gt: st.gt, cnt: st.cnt, hill: (st.hill || '').length, dew: st.inv.dew, round: st.round }); }
let snapTimer = 0;
function showAway() {
    const s = store.get(SEEN_KEY); snapshot(); clearInterval(snapTimer); snapTimer = setInterval(snapshot, 5000);
    if (!s || s.round !== st.round || serverNow() - s.real < 90000) return;
    const c0 = s.cnt || {}, c1 = st.cnt || {}, dc = k => (c1[k] || 0) - (c0[k] || 0), dr = (k, r) => ((c1[k] || {})[r] || 0) - ((c0[k] || {})[r] || 0);
    const away = (serverNow() - s.real) / 1000, gtPassed = st.gt - s.gt, lines = [];
    lines.push(`⏳ Bạn đã rời vườn <b>${fmtDur(away)}</b>. Trong vườn đã trôi qua <b>${fmtDur(gtPassed)}</b>${gtPassed < away * 0.6 ? ' (lúc không ai ở đây, vườn ngủ nên thời gian trôi chậm lại)' : ''}.`);
    const wx = Object.entries(c1.w || {}).map(([w, n]) => [w, n - ((c0.w || {})[w] || 0)]).filter(([w, n]) => n > 0 && w !== 'sun');
    if (wx.length) lines.push(`🌦️ Trời đã: ${wx.map(([w, n]) => `${WEATHER[w].icon} ${WEATHER[w].name.toLowerCase()}${n > 1 ? ` ${n} lần` : ''}`).join(', ')}.`);
    if (!SOLO) { const h = dr('harvest', THEM), p = dr('plant', THEM), w = dr('water', THEM); if (h + p + w) lines.push(`💞 ${NAME[THEM]} đã ghé vườn: ${[p && `gieo ${p} hạt`, w && `tưới ${w} lần`, h && `hái ${h} bông`].filter(Boolean).join(', ')}.`); }
    const note = st.mail?.[THEM]; if (note && !note.read && note.at > s.real) lines.push(`💌 ${NAME[THEM]} để lại cho bạn một tờ giấy ghi chú — chạm 💌 để đọc.`);
    if (dc('bloom')) lines.push(`🌸 ${dc('bloom')} bông đã nở.`);
    if (dc('fade')) lines.push(`🍂 ${dc('fade')} bông tàn vì chưa ai hái.`);
    if (dc('bug')) lines.push(`🐛 Sâu xuất hiện ${dc('bug')} lần.`);
    if (dc('weed')) lines.push(`🌿 Cỏ dại mọc thêm ${dc('weed')} chỗ.`);
    if (dc('wilt')) lines.push(`🥀 Cây bị héo ${dc('wilt')} lần.`);
    if (dc('die')) lines.push(`💀 ${dc('die')} cây đã chết khô.`);
    if (dc('rewild')) lines.push(`🌾 ${dc('rewild')} luống bỏ trống đã thành cỏ hoang.`);
    { const a0 = c0.auto || {}, a1 = c1.auto || {}, da = k => (a1[k] || 0) - (a0[k] || 0), parts = [da('water') && `tưới ${da('water')} lần`, da('weed') && `ăn ${da('weed')} đám cỏ`, da('plant') && `gieo ${da('plant')} hạt`, da('harvest') && `hái ${da('harvest')} bông`, da('fert') && `xay ${da('fert')} 🧪`].filter(Boolean); if (parts.length) lines.push(`🤖 Đồ tự động đã giúp: ${parts.join(', ')}.`); }
    const hl = (st.hill || '').length; if (hl !== s.hill) lines.push(`⛰️ Đồi hoa: ${Math.floor(s.hill / HILL_MAX * 100)}% → ${Math.floor(hl / HILL_MAX * 100)}%.`);
    const thirsty = st.plots.filter(p => p.st === 'plant' && p.w < 0.2).length; if (thirsty) lines.push(`💧 Có ${thirsty} cây đang khát — tưới ngay nhé!`);
    lines.push(`🕰️ Bây giờ trong vườn là <b>${HHMM(st.gt)}</b>, ${WEATHER[weatherAt(st)].name.toLowerCase()}.`);
    $('awayList').innerHTML = lines.map(l => `<li>${l}</li>`).join('');
    $('away').hidden = false;
}
$('awayClose').onclick = () => { $('away').hidden = true; };
addEventListener('pagehide', snapshot);

// ---------- HUD ----------
// chỉ ghi lại HTML khi nội dung đổi: ghi đè liên tục làm mất cú chạm (nút bị thay giữa lúc nhấn và nhả)
const htmlCache = {}; const setHTML = (id, h) => { if (htmlCache[id] !== h) { htmlCache[id] = h; $(id).innerHTML = h; } };
const HHMM = gt => { const m = ((gt % DAY) / DAY * 24 * 60 + 5 * 60) % (24 * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`; };
let lastHint = 0;
function hud() {
    if (!st) return;
    const gt = gView(), w = weatherAt(st, gt), night = isNight(gt), nb = Math.floor(gt / WEATHER_LEN) + 1, wn = weatherAt(st, nb * WEATHER_LEN + 1), left = Math.ceil((nb * WEATHER_LEN - gt) / 60);
    $('dew').textContent = st.inv.dew; $('fert').textContent = st.inv.fert + (st.inv.phanvang ? `+${st.inv.phanvang}🌟` : ''); $('cmp').textContent = st.inv.compost;
    const helped = tourDone() && !tour?.active; // xong hướng dẫn: nút ❓ thành nút ủ phân (hướng dẫn xem lại trong Sổ tay)
    $('helpIcon').textContent = helped ? '🧰' : '❓'; $('helpName').textContent = helped ? 'Vật dụng' : 'Hướng dẫn';
    const nReady = helped ? toolList().filter(x => x.ready).length : 0; $('toolBadge').hidden = !nReady; $('toolBadge').textContent = nReady;
    $('helpBtn').classList.toggle('ready', nReady > 0);
    if (!$('tools').hidden) refreshTools();
    const unread = unreadMail() ? 1 : 0; $('chatBadge').hidden = !unread; $('chatBadge').textContent = unread;
    setHTML('chatName', st.decor.giay ? 'Lời nhắn' : 'Lời nhắn 🔒');
    const icon = night && !['rain', 'storm', 'fog'].includes(w) ? '🌙' : WEATHER[w].icon;
    setHTML('clock', `${icon} ${HHMM(gt)}<span class="w"> ${night ? 'Đêm' : WEATHER[w].name}</span> → ${WEATHER[wn].icon}`);
    $('clock').title = `${WEATHER[w].name}: ${WEATHER[w].tip}\nKhoảng ${left} phút nữa: ${WEATHER[wn].name}`;
    const x0 = xpFor(st.lvl), x1 = xpFor(st.lvl + 1); $('lvl').textContent = st.lvl; $('bondTx').textContent = `${Math.max(0, Math.floor(st.xp - x0))}/${x1 - x0}`;
    $('xpbar').style.width = `${clamp((st.xp - x0) / (x1 - x0), 0, 1) * 100}%`;
    $('finBtn').hidden = !(canFinale(st) && !st.fw && !st.liftAt);
    setHTML('who', SOLO ? '' : [ME, THEM].map(r => `<span class="${online.includes(r) ? '' : 'off'}" style="--c:${css(ROLE_COL[r])}"><i></i>${r === ME ? NAME[ME] : `${NAME[r]} · ${online.includes(r) ? 'đang ở đây' : st.joined[r] ? 'vắng' : 'chưa vào'}`}</span>`).join(''));
    const sCount = st.inv.seeds[seedSel] || 0;
    $('seedIcon').textContent = sCount ? ICON[seedSel] : '🌱'; $('seedName').textContent = sCount ? `${SPN(seedSel)} ×${sCount}` : 'Hạt giống';
    if (t - lastHint > 1) { lastHint = t; const h = tour?.active ? '' : contextHint(); $('hint').hidden = !h; $('hint').textContent = h; }
    const need = st.plots.some(p => p.st === 'plant' && (p.w < 0.15 || p.bug)); // nhắc khi đang ở tab khác
    document.title = document.hidden && need ? (Math.floor(t) % 2 ? '💧 Vườn đang cần bạn!' : TITLE) : TITLE;
}
function contextHint() {
    const ps = st.plots, plants = ps.filter(p => p.st === 'plant'), hasSeed = SPECIES_ORDER.some(s => st.inv.seeds[s] > 0);
    if (st.ev && EVENTS[st.ev.k].tap) return `${EVENTS[st.ev.k].icon} ${EVENTS[st.ev.k].text}`;
    if (st.fw) return st.joined.gui && st.joined.nhan && !(st.swipes.gui && st.swipes.nhan) && st.swipes[ME] ? `Chờ ${NAME[THEM]} cùng vuốt một lần nhé 🍃` : `Vuốt nhẹ trên màn hình để gọi gió lễ hội 🌬️ (${st.swipes.gui + st.swipes.nhan}/6)`;
    if (!plants.length && ps.some(p => p.st === 'soil')) return hasSeed ? 'Chạm vào luống đất nâu để gieo hạt 🌱' : 'Hết hạt rồi — ghé 🛒 Chợ mua hạt nhé';
    if (plants.some(p => p.w < Math.max(0.15, SPECIES[p.sp].minWater || 0))) return 'Có cây đang khát! Chạm vào cây để tưới 💧';
    if (ps.some(p => p.st === 'soil' && p.left > 0 && p.left < LEAVE_GRACE * 0.6)) return hasSeed ? 'Luống trống sắp mọc cỏ hoang — gieo hạt ngay nhé 🌱' : 'Luống trống sắp mọc cỏ hoang — mua hạt ở 🛒 Chợ rồi gieo ngay';
    if (plants.some(p => p.bug)) return 'Có sâu! Chạm vào cây để bắt 🐛';
    if (plants.some(p => SPECIES[p.sp].needFert && !p.fed && !p.bloom && p.g >= 0.55)) return 'Mẫu đơn đang chờ bón phân 🧪 — chạm để bón';
    if (plants.some(p => p.bloom && !p.faded)) return bookCount(st) >= BOOK_GOAL && (st.peak || 0) < FULL_BLOOM ? `Giữ hoa lại để ${FULL_BLOOM} bông cùng nở một lúc 🌸` : 'Hoa nở rồi — chạm để hái lấy ✨';
    if (ps.some(p => p.st === 'dead')) return 'Chạm cây khô để dọn, được 🍂 phân ủ';
    if (ps.some(p => p.weed > 0.4)) return 'Cỏ dại đang lan — chạm để nhổ';
    if (st.inv.compost >= 3 && st.decor.thung) return 'Đủ 3 🍂 — chạm thùng ủ phân (hoặc nút 🍂) để ủ thành phân bón';
    if (!ps.some(p => p.st === 'soil' || p.st === 'wild') && ownedPlots(st) < MAX_PLOTS) return st.inv.dew >= plotPrice(st) ? `Vườn kín chỗ rồi — chạm ô có dấu ＋ để mở rộng (${plotPrice(st)} ✨)` : '';
    if (ps.some(p => p.st === 'soil') && !hasSeed) return 'Còn luống trống — mua hạt ở 🛒 Chợ';
    if (!SOLO && !st.joined[THEM]) return `Gửi đường dẫn cho ${NAME[THEM]} để cùng chăm vườn 💞`;
    return '';
}
let curHide = 0;
function showPartner(x, y) {
    const el = $('partner'); el.hidden = false; el.style.opacity = 1;
    el.style.setProperty('--c', css(ROLE_COL[THEM])); el.querySelector('.name').textContent = NAME[THEM];
    el.style.transform = `translate(${x * VW()}px, ${y * VH()}px)`;
    clearTimeout(curHide); curHide = setTimeout(() => { el.style.opacity = 0; }, 2500);
}

// ---------- chợ / hạt giống / sổ tay ----------
const itemRow = (ic, name, desc, act, cls = '') => `<div class="item ${cls}"><div class="ic">${ic}</div><div><b>${name}</b><small>${desc}</small></div><div class="act">${act}</div></div>`;
const have = n => `<small style="display:inline"> · có ${n}</small>`;
let shopTab = 'seed';
function shopHTML() {
    const dew = st.inv.dew, btn = (item, price, n = 1, label = `Mua · ${price}✨`) => `<button data-act="buy" data-item="${item}" data-n="${n}" ${dew < price * n ? 'disabled' : ''}>${label}</button>`;
    const tabs = `<div class="tabs">${[['seed', '🌱 Hạt'], ['care', '🧪 Chăm'], ['decor', '🏡 Vườn']].map(([k, l]) => `<button data-act="tab" data-tab="${k}" class="${shopTab === k ? 'on' : ''}">${l}</button>`).join('')}</div><p style="text-align:center;font-weight:800;margin:4px 0">Đang có ${dew} ✨</p>`;
    let body = '';
    if (shopTab === 'seed') body = SPECIES_ORDER.filter(s => SPECIES[s].price).map(s => { const S = SPECIES[s]; return itemRow(ICON[s], S.name + have(st.inv.seeds[s] || 0), `${S.price} ✨ · nở ~${S.grow} phút · hái ${S.reward} ✨<br>${S.tip}`, btn('seed:' + s, S.price, 1, `Mua · ${S.price}✨`)); }).join('');
    if (shopTab === 'care') body = ['fert', 'phanvang', 'tuihat'].map(k => itemRow(SHOP[k].icon, SHOP[k].name + (k === 'tuihat' ? '' : have(st.inv[k] || 0)), `${SHOP[k].price} ✨ · ${SHOP[k].desc}`, btn(k, SHOP[k].price))).join('')
        + itemRow('🍂', 'Ủ phân' + have(st.inv.compost + ' 🍂'), st.decor.thung ? '3 🍂 (từ cỏ dại, cây khô, khai hoang) → 1 🧪' : 'Cần 🧺 Thùng ủ phân (thẻ 🏡 Vườn)', `<button data-act="compost" ${st.inv.compost < 3 || !st.decor.thung ? 'disabled' : ''}>Ủ</button>`)
        + ['binhto', 'keovang'].map(k => itemRow(SHOP[k].icon, SHOP[k].name, `${SHOP[k].price} ✨ · ${SHOP[k].desc}`, st.tools?.[k] ? '✓ Đã có' : btn(k, SHOP[k].price))).join('');
    if (shopTab === 'decor') {
        const own = ownedPlots(st), price = plotPrice(st), actTx = k => ACTS[k] ? `<br><b style="display:inline;font-size:12px">Chạm để dùng:</b> ${ACTS[k].icon} ${ACTS[k].name} — ${ACTS[k].desc}${ACTS[k].cd ? ` · hồi ${Math.round(ACTS[k].cd / 60)} phút` : ''}` : '';
        body = `<div class="sec">Mở rộng vườn</div>` + itemRow('🌱', `Luống đất ${own}/${MAX_PLOTS}`, own >= MAX_PLOTS ? 'Vườn đã rộng hết cỡ 🌸' : `Luống tiếp theo ${price} ✨ (giá tăng dần). Chạm ô có dấu ＋ cạnh vườn để mua.`, '')
            + `<div class="sec">Mở khoá</div>` + Object.keys(SHOP).filter(k => SHOP[k].kind === 'unlock').map(k => itemRow(SHOP[k].icon, SHOP[k].name, `${SHOP[k].price} ✨ · ${SHOP[k].desc}${actTx(k)}`, st.decor[k] ? '✓ Đã có' : btn(k, SHOP[k].price))).join('')
;
    }
    return tabs + body;
}
function seedsHTML() {
    const own = SPECIES_ORDER.filter(s => st.inv.seeds[s] > 0);
    if (!own.length) return `<p style="text-align:center">Túi hạt trống rỗng 🥲</p><button class="soft" data-act="toShop">🛒 Ra chợ mua hạt</button>`;
    return '<p style="font-size:12px;color:#8d6b80;text-align:center;margin:0 0 4px">Chọn hạt rồi chạm vào luống đất trống để gieo.</p>'
        + own.map(s => itemRow(ICON[s], `${SPECIES[s].name} ×${st.inv.seeds[s]}`, SPECIES[s].tip, `<button data-act="pick" data-sp="${s}">${s === seedSel ? '✓ Đang chọn' : 'Chọn'}</button>`, s === seedSel ? 'sel' : '')).join('')
        + `<button class="soft" data-act="toShop">🛒 Mua thêm hạt</button>`;
}
function bookHTML() {
    const nb = bookCount(st), book = SPECIES_ORDER.map(s => `<div class="${st.book[s] ? '' : 'no'}"><i>${ICON[s]}</i>${st.book[s] ? SPECIES[s].name : '???'}${st.book[s] ? `<br><small>nở ${st.book[s]} lần</small>` : ''}</div>`).join('');
    const nxt = `Cấp ${st.lvl + 1}: ${levelGift(st.lvl + 1).text} (${Math.floor(st.xp)}/${xpFor(st.lvl + 1)} 💞)`;
    const shinyN = Object.keys(st.shiny || {}).length, shinyGrid = SPECIES_ORDER.filter(x => SPECIES[x].price).map(x => `<div class="${st.shiny?.[x] ? 'shiny' : 'no'}"><i>${ICON[x]}</i>${st.shiny?.[x] ? SPECIES[x].name : '???'}</div>`).join('');
    const notes = notesText.length ? notesText.map((n, i) => `<div class="note">💌 ${i + 1}. ${n.replace(/</g, '&lt;')}</div>`).join('') : '<p style="font-size:13px;color:#8d6b80">Chưa có lá thư nào. Hái hoa Song Tâm 💞, lên cấp gắn kết hoặc làm vườn nở rộ để mở thư.</p>';
    const replay = st.done ? `<button class="soft" data-act="replay">${card.mode === 'to-tinh' && ME === 'nhan' && !st.answer ? '💌 Xem lại lời nhắn và trả lời' : '🎆 Xem lại Lễ hội hoa'}</button>` : '';
    const wx = Object.entries(WEATHER).map(([k, w]) => `<div><i>${w.icon}</i>${w.name}<br><small style="font-weight:500">${w.tip}</small></div>`).join('');
    return `<div class="sec">Điều ước hôm nay 🌠</div>${wishesHTML()}
        <button class="soft" data-act="postcard">📸 Tạo bưu thiếp khu vườn</button>
        <div class="sec">${st.done ? 'Lễ hội hoa ✓ — vườn vẫn tiếp tục' : 'Mục tiêu Lễ hội hoa'}</div>
        ${itemRow('📖', `Sưu tập ${BOOK_GOAL} loài hoa`, `${nb}/${SPECIES_ORDER.length} loài đã nở`, nb >= BOOK_GOAL ? '✅' : '')}
        ${itemRow('💞', 'Gắn kết cấp 3', `${nxt}<br>Tăng khi hai người cùng ở trong vườn, cùng tưới, hái hoa, ước sao băng, làm điều ước. Không giới hạn cấp.`, st.lvl >= 3 ? '✅' : '')}
        ${itemRow('🌸', 'Vườn nở rộ', `${FULL_BLOOM} bông cùng nở một lúc · cao nhất: ${st.peak || 0}`, st.peak >= FULL_BLOOM ? '✅' : '')}
        ${replay}
        <div class="sec">Đồi hoa</div>${itemRow('⛰️', `${(st.hill || '').length}/${HILL_MAX} bông trên đồi`, 'Mỗi bông hái được gieo 1 bông lên đồi; hoa trên đồi tự sinh thêm 1–3 bông cùng loài theo thời gian (nhanh hơn khi hai người cùng ở đây). Cây chết, hoa tàn bỏ phí → hoa trên đồi héo theo.', Math.floor((st.hill || '').length / HILL_MAX * 100) + '%')}
        <div class="sec">Bộ sưu tập (${nb}/${SPECIES_ORDER.length})</div><div class="grid8">${book}</div>
        <div class="sec">Giống lai 💞 (${Object.keys(st.hybrids || {}).length})</div><p style="font-size:12px;color:#8d6b80;margin:0 0 6px">Hai người gieo vào hai luống kề nhau trong 5 giây → hai cây thành giống lai: hình của loài này, màu của loài kia, hái được thêm 50% ✨. Chuỗi tưới nối tiếp dài nhất: ${st.stats.chain || 0}.</p>${Object.entries(st.hybrids || {}).map(([k, n]) => `<span class="chip">💞 ${hybridName(k)} ×${n}</span>`).join('') || '<p class="empty">Chưa có giống lai nào.</p>'}
        <div class="sec">Hoa lấp lánh ✨ (${shinyN}/${SPECIES_ORDER.length - 1})</div><p style="font-size:12px;color:#8d6b80;margin:0 0 6px">Cứ khoảng 20 hạt gieo xuống lại có 1 cây lấp lánh: hái được gấp 2,5 ✨ và gieo 5 bông lên đồi.</p><div class="grid8">${shinyGrid}</div>
        <div class="sec">Lá thư (${notesText.length}/${info?.notesTotal ?? DEMO_NOTES.length})</div>${notes}
        <div class="sec">Thời tiết</div><div class="grid8" style="grid-template-columns:repeat(2,1fr)">${wx}</div>
        <div class="sec">Thành tích</div><p style="font-size:13px;line-height:1.6">🌸 Đã hái ${st.stats.harvest} bông · ⭐ ${st.stats.perfect} bông hoàn hảo · 💞 ${st.stats.combos} lần cùng tưới · 🌠 ${st.stats.stars} điều ước · 💀 ${st.stats.died} cây bị bỏ quên</p>
        <div class="sec">Cách chơi</div><p style="font-size:13px;line-height:1.6"><b>Chạm</b> vào luống: tự làm việc cần làm (khai hoang, gieo, tưới, bắt sâu, nhổ cỏ, hái). <b>Giữ tay</b> trên luống: chọn việc khác (bón phân, xem chi tiết…). <b>Vuốt</b>: một làn gió nhẹ. Chạm ô có dấu ＋ để mở rộng vườn. Chạm 📻 radio trên hàng rào để nghe nhạc YouTube cùng nhau.<br>
        <b>Chơi đôi:</b> gieo cùng lúc vào 2 luống kề nhau → hoa ghép đôi; thay phiên tưới các luống kề nhau (mỗi lần dưới 3 giây) → tưới nối tiếp;<br>
        <b>Thưởng:</b> hoa chăm kỹ được ⭐ ×1,5; hai người cùng tưới một cây trong 3 giây được 💞; ở cùng nhau cây lớn nhanh hơn 25%; cầu vồng: hái được thêm 50%.<br>
        <b>Phạt nếu quên:</b> khát lâu → héo → chết khô (−2 💞); sâu gặm, cỏ dại lan; hoa nở 6 phút không hái thì tàn; hái xong để trống luống 45 giây thì cỏ hoang mọc lại; giông quật cây non. Khi cả hai vắng, vườn ngủ — thời gian chậm 80 lần (4 tiếng ngoài đời ≈ 3 phút trong vườn) nhưng vẫn trôi.</p>
        <div class="sec">Cài đặt</div>
        ${itemRow('🔊', 'Âm thanh', audio.on ? 'Đang bật' : 'Đang tắt', `<button data-act="snd">${audio.on ? 'Tắt' : 'Bật'}</button>`)}
        ${itemRow('🎵', 'Nhạc nền', `Âm lượng ${Math.round(audio.music * 100)}%`, `<button data-act="vol" data-d="-0.25">−</button><button data-act="vol" data-d="0.25">+</button>`)}
        ${itemRow('🔔', 'Hiệu ứng (tưới, hái…)', audio.sfxOn ? 'Đang bật' : 'Đang tắt', `<button data-act="sfx">${audio.sfxOn ? 'Tắt' : 'Bật'}</button>`)}
        <button class="soft" data-act="tour">❓ Xem lại hướng dẫn</button>
        <button class="danger" data-act="restart">Trồng lại khu vườn từ đầu</button>`;
}
function refreshOpenSheet() { if (sheetOpen('chat')) return refreshLetters(); if (sheetOpen('shop')) refreshSheet(shopHTML()); else if (sheetOpen('seeds')) refreshSheet(seedsHTML()); else if (sheetOpen('book')) refreshSheet(bookHTML()); }
function onSheet(act, ds) {
    if (act === 'buy') net.send({ type: 'buy', item: ds.item, n: +ds.n || 1 });
    else if (act === 'tab') { shopTab = ds.tab; refreshSheet(shopHTML()); }
    else if (act === 'compost') net.send({ type: 'compost' });
    else if (act === 'pick') { seedSel = ds.sp; closeSheet(); toast(`Đã chọn ${ICON[ds.sp]} ${SPN(ds.sp)} — chạm luống trống để gieo`, '', 'pick'); hud(); }
    else if (act === 'toShop') { shopTab = 'seed'; openSheet('shop', 'Chợ hoa', shopHTML(), onSheet); }
    else if (act === 'toDecor') { shopTab = 'decor'; openSheet('shop', 'Chợ hoa', shopHTML(), onSheet); }
    else if (act === 'replay') { closeSheet(); buildFinale(t); }
    else if (act === 'postcard') makePostcard();
    else if (act === 'tour') { closeSheet(); tour.start(); }
    else if (act === 'snd') { audio.unlock(); audio.toggle(); refreshSheet(bookHTML()); }
    else if (act === 'vol') { audio.setMusic(clamp(audio.music + +ds.d, 0, 1)); refreshSheet(bookHTML()); }
    else if (act === 'sfx') { audio.toggleSfx(); refreshSheet(bookHTML()); }
    else if (act === 'restart' && confirm('Trồng lại cả khu vườn từ đầu? Mọi cây, ✨ và đồ trang trí sẽ mất (cho cả hai người).')) { net.send({ type: 'restart' }); closeSheet(); }
}
const openShop = () => { if (st) { audio.sfx('open'); openSheet('shop', 'Chợ hoa', shopHTML(), onSheet); tour?.notify('open:shop'); } };
$('shopBtn').onclick = openShop;
$('bookBtn').onclick = () => { if (st) { audio.sfx('open'); openSheet('book', 'Sổ tay vườn', bookHTML(), onSheet); tour?.notify('open:book'); } };
$('chatBtn').onclick = () => openLetters();
$('seedBtn').onclick = () => { if (st) { audio.sfx('open'); openSheet('seeds', 'Túi hạt giống', seedsHTML(), onSheet); tour?.notify('open:seeds'); } };
$('helpBtn').onclick = () => tourDone() && !tour.active ? toggleTools() : tour.start();
// ---------- bảng vật dụng: mở từ nút 🧰, bấm thẳng để dùng (nút to, khỏi phải chạm đồ nhỏ trong sân) ----------
const ITEM_NAME = k => SHOP[k]?.name || (k === 'xichdu' ? 'Xích đu đôi' : k);
const ITEM_ICON = k => SHOP[k]?.icon || (k === 'xichdu' ? '💞' : '✨');
function toolList() {
    if (!st) return [];
    const gt = gView();
    return Object.keys(ACTS).filter(k => has(st, k)).map(k => {
        const A = ACTS[k], left = cdLeft(st, k, gt), night = A.night && !isNight(gt), noC = k === 'thung' && st.inv.compost < 3;
        return { k, A, left, ready: left <= 0 && !night && !noC, why: left > 0 ? `còn ${fmtCd(left)}` : night ? 'chờ trời tối' : noC ? `cần 3 🍂 (có ${st.inv.compost})` : 'Sẵn sàng' };
    });
}
function toolsHTML() {
    const list = toolList();
    let h = list.map(x => `<button class="tool ${x.ready ? 'on' : ''}" data-k="${x.k}" ${x.ready ? '' : 'disabled'}><i>${x.A.icon}</i><span><b>${x.A.name}</b><small>${ITEM_ICON(x.k)} ${ITEM_NAME(x.k)} · ${x.A.desc}</small></span><em>${x.why}</em></button>`).join('');
    h += `<button class="tool ${radio.playing ? 'on' : ''}" data-k="radio"><i>📻</i><span><b>Radio</b><small>${radio.playing ? `Đang phát: ${esc(radio.title || '…')}` : 'Nghe nhạc YouTube cùng nhau'}</small></span><em></em></button>`;
    if (st.decor.giay) h += `<button class="tool" data-k="giay"><i>💌</i><span><b>Hòm thư</b><small>${unreadMail() ? 'Có thư chưa đọc!' : 'Viết giấy ghi chú'}</small></span><em></em></button>`;
    if (!st.decor.thung || !st.decor.giay) h += `<button class="tool shop" data-k="shop"><i>🛒</i><span><b>Mua thùng ủ phân, hòm thư</b></span><em></em></button>`;
    return h;
}
function refreshTools() { const el = $('tools'), h = toolsHTML(); if (el.dataset.h === h) return; const y = el.scrollTop; el.innerHTML = h; el.dataset.h = h; el.scrollTop = y; }
function toggleTools(open = $('tools').hidden) { if (!st) return; $('tools').hidden = !open; if (open) { refreshTools(); audio.sfx('open'); closeMenu(); } }
$('tools').addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b || b.disabled) return;
    const k = b.dataset.k;
    if (k === 'shop') { toggleTools(false); return toDecorShop(); }
    if (k === 'giay') { toggleTools(false); return openLetters(); }
    if (k === 'radio') { toggleTools(false); return openRadio(); }
    net.send(k === 'thung' ? { type: 'compost' } : { type: 'use', item: k }); navigator.vibrate?.(10);
    setTimeout(refreshTools, 150);
});
for (const ev of ['pointerdown', 'pointerup', 'pointermove']) $('tools').addEventListener(ev, e => e.stopPropagation());
const toDecorShop = () => { shopTab = 'decor'; openShop(); };
$('clock').onclick = () => { // chạm đồng hồ: xem thời tiết + dự báo
    if (!st) return; tour?.notify('clock');
    const gt = gView(), w = weatherAt(st, gt), nb = Math.floor(gt / WEATHER_LEN) + 1, wn = weatherAt(st, nb * WEATHER_LEN + 1), left = Math.max(1, Math.ceil((nb * WEATHER_LEN - gt) / 60));
    toast(`${WEATHER[w].icon} ${WEATHER[w].name}: ${WEATHER[w].tip}`, 'sky', 'cw', 0); setTimeout(() => toast(`Khoảng ${left} phút nữa: ${WEATHER[wn].icon} ${WEATHER[wn].name}`, 'sky', 'cn', 0), 250);
};
$('bond').onclick = () => { if (!st) return; tour?.notify('bond'); toast(`💞 Cấp ${st.lvl} · ${Math.floor(st.xp)}/${xpFor(st.lvl + 1)} điểm — cùng ở trong vườn, cùng tưới, hái hoa để tăng. Cấp sau: ${levelGift(st.lvl + 1).text}`, 'love', 'bd', 0); };
const doCompost = () => !st ? 0 : !st.decor.thung ? (toast('🧺 Mua Thùng ủ phân ở Chợ → Vườn để ủ phân', '', 'cmpneed'), toDecorShop()) : st.inv.compost >= 3 ? net.send({ type: 'compost' }) : toast('Cần 3 🍂 phân ủ — nhổ cỏ, dọn cây khô, khai hoang để có thêm', '', 'cmpneed');
$('finBtn').onclick = () => net.send({ type: 'finale' });

// ---------- điều ước ----------
const wishText = w => WISHES[w.k].text(w.n, w.sp);
function wishesHTML() {
    const ws = st.wishes || [];
    if (!ws.length) return '<p class="empty">Điều ước đầu tiên sẽ xuất hiện sau vài phút chăm vườn 🌱</p>';
    return ws.map(w => itemRow(WISHES[w.k].icon, wishText(w), w.done ? 'Đã thành sự thật — điều ước mới sẽ đến lúc bình minh 🌅' : `${w.have}/${w.n} · thưởng ${w.dew} ✨ + 3 💞${st.done ? ' + 25 bông trên đồi' : ''}<div class="wbar"><i style="width:${w.have / w.n * 100}%"></i></div>`, w.done ? '🌟' : '')).join('');
}
// ---------- bưu thiếp: chụp khu vườn lên một tấm thiệp (logo, tên hai người, ngày, thành tích) để tải về / chia sẻ ----------
const LOGO = Object.assign(new Image(), { src: '/img/logo.png' });
async function makePostcard() {
    const Wc = 1080, Hc = 1440, cv = Object.assign(document.createElement('canvas'), { width: Wc, height: Hc }), g = cv.getContext('2d');
    g.fillStyle = '#fff6ec'; g.fillRect(0, 0, Wc, Hc);
    for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(255,${180 + (k % 3) * 20},${200 + (k % 2) * 30},0.35)`; g.beginPath(); g.arc(hash(k * 3.1) * Wc, hash(k * 7.3) * Hc, 3 + hash(k) * 5, 0, 7); g.fill(); }
    const y0 = Math.round(L.hillTop * 0.25), y1 = L.H0, ch = y1 - y0, box = { x: 70, y: 250, w: Wc - 140, h: 880 }, k = Math.min(box.w / BW, box.h / ch);
    const dw = BW * k, dh = ch * k, dx = (Wc - dw) / 2, dy = box.y + (box.h - dh) / 2;
    g.save(); g.shadowColor = 'rgba(80,40,60,0.35)'; g.shadowBlur = 30; g.fillStyle = '#fff'; g.fillRect(dx - 18, dy - 18, dw + 36, dh + 36); g.restore();
    g.imageSmoothingEnabled = false; g.drawImage(world, 0, y0 + 1, BW, ch, dx, dy, dw, dh);
    if (LOGO.complete && LOGO.naturalWidth) { g.save(); g.translate(150, 140); g.rotate(-0.12); g.drawImage(LOGO, -110, -108, 220, 214); g.restore(); }
    g.fillStyle = '#6b3a5c'; g.textAlign = 'center';
    g.font = '400 64px Pacifico, cursive'; g.fillText(SOLO ? 'Khu vườn của mình' : `${NAME[ME]} & ${NAME[THEM]}`, Wc / 2 + 70, 135);
    g.font = '600 32px "Be Vietnam Pro", sans-serif'; g.fillStyle = '#b0708f'; const dt = new Date(); g.fillText(`Vườn hoa · ${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`, Wc / 2 + 70, 190);
    g.fillStyle = '#6b3a5c'; g.font = '700 34px "Be Vietnam Pro", sans-serif';
    g.fillText(`🌸 ${bookCount(st)} loài · ⛰️ ${Math.floor((st.hill || '').length / HILL_MAX * 100)}% đồi hoa · 💞 cấp ${st.lvl} · 🌼 ${st.stats.harvest} bông đã hái`, Wc / 2, box.y + box.h + 90);
    g.font = '700 46px "Dancing Script", cursive'; g.fillStyle = '#c2457a';
    g.fillText(st.done ? (card.flowerText || 'Cảm ơn') + ' 💐' : 'Mỗi bông hoa là một lần mình nghĩ về nhau 🌷', Wc / 2, box.y + box.h + 170);
    const url = cv.toDataURL('image/png'), name = `vuon-hoa-${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}.png`;
    openSheet('postcard', 'Bưu thiếp 📸', `<img class="postcard" src="${url}" alt="Bưu thiếp khu vườn"><div class="row2"><a class="soft" href="${url}" download="${name}">⬇️ Tải về</a>${navigator.canShare ? '<button class="soft" data-act="share">📤 Chia sẻ</button>' : ''}</div>`, async act => {
        if (act !== 'share') return;
        try { const blob = await (await fetch(url)).blob(), file = new File([blob], name, { type: 'image/png' }); if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: TITLE }); } catch { }
    });
    audio.sfx('star');
}

// ---------- giấy ghi chú: mỗi người một tờ, người kia đọc xong mới viết được tờ mới ----------
const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const unreadMail = () => { const m = st?.mail?.[THEM]; return !!(m && !m.read); };
const QUICK = ['Mình vào vườn rồi 🌸', 'Nhớ tưới cây giúp mình nhé 💧', 'Tối nay cùng chăm vườn nhé 🌙', 'Cảm ơn vì đã ở đây 🥰'];
const when = at => { const d = new Date(at); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · ${d.getDate()}/${d.getMonth() + 1}`; };
const memo = (m, cls, foot) => `<div class="memo ${cls}"><p>${esc(m.tx)}</p><small>${foot}</small></div>`;
function lettersHTML() {
    if (!st.decor.giay) return `<p class="empty">Để gửi lời nhắn, hãy mua 📝 <b>Giấy ghi chú & hòm thư</b> (${SHOP.giay.price} ✨) ở Chợ → 🏡 Vườn.<br>Mỗi người chỉ gửi được một tờ một lúc — người kia đọc xong mới viết được tờ mới, như những bức thư tay.</p><button class="soft" data-act="toDecor">🛒 Ra chợ</button>`;
    const theirs = st.mail[THEM], mine = st.mail[ME], partner = SOLO ? 'người ấy' : esc(NAME[THEM]);
    let h = `<div class="sec">Từ ${partner}</div>` + (theirs ? memo(theirs, 'them', `${partner} · ${when(theirs.at)}`) : `<p class="empty">Hòm thư đang trống. Khi ${partner} gửi, tờ ghi chú sẽ nằm ở đây.</p>`);
    h += `<div class="sec">Của bạn</div>`;
    if (mine && !mine.read) h += memo(mine, 'me', `Đã gửi ${when(mine.at)} · đang chờ ${partner} đọc… ✉️`) + `<p class="empty">Khi ${partner} đọc xong, bạn sẽ viết được tờ mới.</p>`;
    else h += (mine ? `<p class="empty">${partner} đã đọc tờ trước của bạn ✓</p>` : '')
        + `<div class="quick">${QUICK.map((q, i) => `<button data-act="quick" data-i="${i}">${q}</button>`).join('')}</div>`
        + `<form class="note-form" id="noteForm"><textarea id="noteIn" maxlength="240" rows="4" placeholder="Viết vài dòng cho ${partner}…"></textarea><button>Gấp lại & gửi 💌</button></form>`;
    const old = (st.msgs || []).filter(m => !(theirs && m.at === theirs.at && m.r === THEM) && !(mine && m.at === mine.at && m.r === ME)).reverse();
    if (old.length) h += `<details class="old"><summary>Những tờ cũ (${old.length})</summary>${old.map(m => memo(m, m.r === ME ? 'me' : 'them', `${m.r === ME ? 'Bạn' : partner} · ${when(m.at)}`)).join('')}</details>`;
    return h;
}
function bindLetters() { const f = $('noteForm'); if (f) f.onsubmit = e => { e.preventDefault(); const tx = $('noteIn').value.trim(); if (tx) net.send({ type: 'letter', tx }); }; }
function openLetters() {
    if (!st) return;
    audio.sfx('open'); tour?.notify('open:chat');
    openSheet('chat', 'Hòm thư 💌', lettersHTML(), (act, ds) => { if (act === 'quick') { const el = $('noteIn'); if (el) { el.value = (el.value ? el.value.trimEnd() + ' ' : '') + QUICK[+ds.i]; el.focus(); } } else onSheet(act, ds); });
    bindLetters();
    if (unreadMail()) net.send({ type: 'read' });
}
function refreshLetters() { // giữ nguyên chữ đang viết dở
    const el = $('noteIn'), draft = el?.value || '', focus = document.activeElement === el;
    refreshSheet(lettersHTML()); bindLetters();
    const el2 = $('noteIn'); if (el2) { el2.value = draft; if (focus) el2.focus(); }
    if (unreadMail()) net.send({ type: 'read' });
}

// ---------- chạm vào vườn ----------
function plotInfo(i) {
    const p = st.plots[i];
    if (p.st === 'locked') return canExpand(st, i) ? `🌱 Đất cạnh vườn — mở thành luống mới: <b>${plotPrice(st)} ✨</b><br><small>Đang có ${ownedPlots(st)}/${MAX_PLOTS} luống. Đất mới là cỏ hoang, cần khai hoang.</small>` : 'Đất ngoài vườn — mở rộng dần từ các luống bên cạnh';
    if (p.st === 'wild') return `Bãi cỏ hoang — chạm thêm ${DIG_TAPS - (p.dig || 0)} lần để khai hoang`;
    if (p.st === 'soil') return `Luống trống${p.weed > 0.3 ? ' · cỏ dại đang mọc' : ''}${p.left > 0 ? `<br><small>Gieo hạt trong ${Math.ceil(p.left)} giây nữa, kẻo cỏ hoang mọc lại 🌾</small>` : ''}`;
    if (p.st === 'dead') return 'Cây đã chết khô — chạm để dọn';
    const S = SPECIES[p.sp], state = p.bloom ? (p.faded ? 'đang tàn' : 'đang nở') : `lớn ${Math.round(p.g * 100)}%`;
    return `${ICON[p.sp]} <b>${S.name}</b> · ${state}<br>💧 ${Math.round(p.w * 100)}% · ❤️ ${Math.round(clamp(p.hp, 0, 1) * 100)}% · ${'★'.repeat(Math.max(1, Math.round(p.q * 2)))}${p.bug ? ' · 🐛' : ''}${p.weed > 0.3 ? ' · 🌿' : ''}${p.f > 0 ? ' · 🧪' : ''}<br><small>${S.tip}</small>`;
}
const send = (type, i, extra = {}) => net.send({ type, i, ...extra });
function tapPlot(i) { // việc phù hợp nhất cho luống này
    const p = st.plots[i]; sel = i; selT = t;
    if (st.ev && st.ev.i === i && EVENTS[st.ev.k].tap) return net.send({ type: 'ev' });
    if (p.st === 'locked') { if (canExpand(st, i)) { audio.sfx('tap'); return openMenu(i); } return toast('Chỉ mở rộng được ô nằm sát vườn (ô có dấu ＋)', '', 'lock'); }
    if (p.st === 'wild' || p.st === 'dead') return send('dig', i);
    if (p.st === 'plant') {
        if (p.bug) return send('bug', i);
        if (p.bloom) return send('harvest', i);
        if (p.weed > 0.3) return send('dig', i);
        if (SPECIES[p.sp].needFert && !p.fed && p.g >= 0.55 && (st.inv.fert || st.inv.phanvang)) return send('fert', i, { kind: st.inv.fert ? 'fert' : 'phanvang' });
        if (p.w < 0.85) return send('water', i);
        audio.sfx('tap'); return toast('Cây đã đủ nước 💧 — giữ tay hoặc chạm 2 lần để xem chi tiết', '', 'fullw');
    }
    if (p.weed > 0.3) return send('dig', i);
    if ((st.inv.seeds[seedSel] || 0) < 1) { const any = SPECIES_ORDER.find(s => st.inv.seeds[s] > 0); if (any) seedSel = any; else return openShop(); }
    send('plant', i, { sp: seedSel });
}
// menu khi giữ tay: mọi việc làm được trên luống
function openMenu(i) {
    const p = st.plots[i], acts = [];
    if (p.st === 'locked') { if (!canExpand(st, i)) return; const price = plotPrice(st); acts.push(['🌱', `Mở rộng luống (${price} ✨)`, () => send('expand', i), st.inv.dew < price]); if (st.inv.dew < price) acts.push(['🛒', 'Chưa đủ ✨ — hái hoa để có thêm', () => { }, true]); }
    if (p.st === 'wild') acts.push(['⛏️', `Khai hoang (${(p.dig || 0)}/${DIG_TAPS})`, () => send('dig', i)]);
    if (p.st === 'dead') acts.push(['🧹', 'Dọn cây khô (+2 🍂)', () => send('dig', i)]);
    if (p.st === 'soil') {
        const s = st.inv.seeds[seedSel] > 0 ? seedSel : SPECIES_ORDER.find(x => st.inv.seeds[x] > 0);
        if (s) acts.push([ICON[s], `Gieo ${SPN(s)} (còn ${st.inv.seeds[s]})`, () => send('plant', i, { sp: s })]);
        acts.push(['🌱', 'Chọn hạt khác…', () => $('seedBtn').onclick()]);
    }
    if (p.st === 'plant') {
        if (p.bloom) acts.push(['✂️', 'Hái hoa', () => send('harvest', i)]);
        if (p.bug) acts.push(['🐛', 'Bắt sâu', () => send('bug', i)]);
        acts.push(['💧', 'Tưới nước', () => send('water', i)]);
        if (!p.bloom) acts.push(['🧪', `Bón phân (còn ${st.inv.fert})`, () => send('fert', i, { kind: 'fert' }), !st.inv.fert]);
        if (!p.bloom && st.inv.phanvang) acts.push(['🌟', `Phân vàng (còn ${st.inv.phanvang})`, () => send('fert', i, { kind: 'phanvang' })]);
    }
    if (p.weed > 0 && p.st !== 'wild') acts.push(['🌿', 'Nhổ cỏ dại (+1 🍂)', () => send('dig', i)]);
    showMenu(plotInfo(i), acts, plotCss(i));
    audio.sfx('open'); tour?.notify('hold');
}
function showMenu(info, acts, r) {
    const m = $('menu');
    m.innerHTML = `<div class="info">${info}</div>` + acts.map(([ic, l, , dis], k) => `<button data-k="${k}" ${dis ? 'disabled' : ''}>${ic} ${l}</button>`).join('');
    m.querySelectorAll('button').forEach(b => { b.onclick = () => { closeMenu(); acts[+b.dataset.k][2](); }; });
    m.hidden = false;
    const mw = 210, mh = m.offsetHeight;
    m.style.left = clamp(r.x + r.w / 2 - mw / 2, 8, VW() - mw - 8) + 'px';
    m.style.top = clamp(r.y - mh - 6 > 60 ? r.y - mh - 6 : r.y + r.h + 6, 8, VH() - mh - 8) + 'px';
}
// chạm vào một công trình trong sân: xem tác dụng + nút dùng (có thời gian hồi)
const fmtCd = s => s >= 60 ? `${Math.floor(s / 60)} phút ${Math.round(s % 60)} giây` : `${Math.ceil(s)} giây`;
function openItem(k, hb) {
    if (k === 'giay') return openLetters();
    if (k === 'radio') return openRadio();
    if (k === 'thung' && st.inv.compost >= 3) return net.send({ type: 'compost' });
    const I = SHOP[k] || { icon: k === 'xichdu' ? '💞' : '🌈', name: k === 'xichdu' ? 'Xích đu đôi' : 'Cầu vồng', desc: k === 'xichdu' ? 'Quà gắn kết cấp 2' : '' }, A = ACTS[k], gt = gView(), left = cdLeft(st, k, gt);
    const acts = [];
    if (A) {
        const night = A.night && !isNight(gt), noCompost = k === 'thung' && st.inv.compost < 3;
        acts.push([A.icon, `${A.name}${left > 0 ? ` · còn ${fmtCd(left)}` : night ? ' · chờ trời tối' : noCompost ? ` · cần 3 🍂 (có ${st.inv.compost})` : ''}`, () => net.send({ type: 'use', item: k }), left > 0 || night || noCompost]);
    }
    showMenu(`${I.icon} <b>${I.name}</b><br><small>${I.desc}${A ? `<br>${A.icon} ${A.name}: ${A.desc}` : ''}</small>`, acts, { x: hb.x0 * px, y: hb.y0 * px, w: (hb.x1 - hb.x0) * px, h: (hb.y1 - hb.y0) * px });
    audio.sfx('open');
}
function closeMenu() { $('menu').hidden = true; }
for (const ev of ['pointerdown', 'pointerup', 'pointermove']) for (const id of ['menu', 'away', 'top', 'bar', 'bond', 'finBtn', 'nowPlaying']) $(id).addEventListener(ev, e => e.stopPropagation());
const plotAt = (x, y) => L.plots.findIndex(b => x >= b.cx && x < b.cx + b.cw && y >= b.cy && y < b.cy + b.ch);
function tapAt(x, y) { // toạ độ lưới
    if (!st || fin) return;
    if (!$('menu').hidden) return closeMenu();
    if (starPos && Math.hypot(x - starPos.x, y - starPos.y) < 12 * sc) return net.send({ type: 'star' });
    const inB = b => b && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
    if (inB(evHit) && st.ev && EVENTS[st.ev.k].tap) { ripples.push({ x, y, t, col: ROLE_COL[ME] }); return net.send({ type: 'ev' }); }
    const hb = decorHits.slice().reverse().find(inB); // món vẽ sau (ở trước) được chạm trước
    if (hb && plotAt(x, y) < 0) { ripples.push({ x, y, t, col: ROLE_COL[ME] }); return openItem(hb.k, hb); }
    const i = plotAt(x, y);
    ripples.push({ x, y, t, col: ROLE_COL[ME] });
    if (i < 0) return;
    // chạm 2 lần (hoặc nhấp đúp) = mở chi tiết cây; bãi cỏ hoang thì không, vì cần chạm liền 3 lần để khai hoang
    const now = performance.now(), dbl = lastTap && lastTap.i === i && now - lastTap.t < 350 && st.plots[i].st !== 'wild';
    lastTap = dbl ? null : { i, t: now };
    if (dbl) return openMenu(i);
    tapPlot(i);
}
let lastTap = null;
// đang mở bảng / lá thư / báo cáo / radio thì không chạm xuyên xuống vườn
const popupUp = () => !$('sheet').hidden || !$('letter').hidden || !$('away').hidden || radio.shown;
let drag = null, windAcc = [0, 0], lastCur = 0;
let touched = false; // trình duyệt chỉ cho rung sau khi người dùng đã chạm
addEventListener('pointerdown', e => {
    audio.unlock(); touched = true; radio.kick();
    const toolsOpen = !$('tools').hidden;
    if (toolsOpen && !e.target.closest('#tools, #helpBtn')) toggleTools(false);
    if (e.target.closest('button, #sheet, #letter, #away, #radio, #ask, #reply, #end, #menu, #tools, #tour .card') || popupUp()) return;
    if (toolsOpen || !$('menu').hidden) return closeMenu(); // chạm ra ngoài chỉ để đóng menu, không làm gì với cây bên dưới
    drag = { x: ex(e), y: ey(e), x0: ex(e), y0: ey(e), t0: performance.now(), lt: performance.now(), path: 0, counted: false, long: false };
    drag.timer = setTimeout(() => { if (drag && drag.path < 6 && st && !fin && !popupUp()) { const i = plotAt(drag.x0 / px, drag.y0 / px); if (i >= 0) { drag.long = true; openMenu(i); } } }, 420);
});
addEventListener('contextmenu', e => {
    e.preventDefault();
    if (!st || fin || popupUp() || e.target.closest('#menu, #tools, #top, #bar, #tour .card')) return;
    const i = plotAt(ex(e) / px, ey(e) / px); if (i >= 0) openMenu(i);
});
addEventListener('pointermove', e => {
    const now = performance.now();
    if (!SOLO && now - lastCur > 70) { lastCur = now; net.send({ type: 'cur', x: ex(e) / VW(), y: ey(e) / VH() }); }
    if (!drag) return;
    const dt = Math.max(0.008, (now - drag.lt) / 1000), dx = (ex(e) - drag.x) / px, dy = (ey(e) - drag.y) / px;
    drag.x = ex(e); drag.y = ey(e); drag.lt = now; drag.path += Math.hypot(dx, dy);
    if (drag.path > 6) clearTimeout(drag.timer);
    const ix = clamp(dx / dt * 0.0011, -0.12, 0.12), iy = clamp(dy / dt * 0.0006, -0.06, 0.06); // vuốt = làn gió nhẹ
    wind.x = clamp(wind.x + ix, -0.9, 0.9); wind.y = clamp(wind.y + iy, -0.5, 0.5); windAcc[0] += ix; windAcc[1] += iy;
    if (st?.fw && !drag.counted && drag.path > Math.min(BW, BH) * 0.25) { drag.counted = true; audio.sfx('wind'); net.send({ type: 'swipe' }); }
});
setInterval(() => { if (windAcc[0] || windAcc[1]) { net.send({ type: 'wind', wx: windAcc[0], wy: windAcc[1] }); windAcc = [0, 0]; } }, 100);
addEventListener('pointerup', e => {
    if (!drag) return; clearTimeout(drag.timer);
    const tap = drag.path < 6 && !drag.long && performance.now() - drag.t0 < 420, dx = ex(e) - drag.x0, dy = ey(e) - drag.y0;
    drag = null;
    if (popupUp()) return; // bảng vừa bật lên giữa lúc đang chạm (lá thư, báo cáo…)
    if (tap) {
        const dirs = KONAMI.slice(0, 8).join(); // trên điện thoại: 2 lần chạm sau 8 lần vuốt thay cho phím B, A
        konamiPush(konami.slice(-8).join() === dirs ? 'b' : konami.at(-1) === 'b' && konami.slice(-9, -1).join() === dirs ? 'a' : 'tap');
        tapAt(ex(e) / px, ey(e) / px);
    } else if (Math.hypot(dx, dy) > 40) konamiPush(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
addEventListener('pointercancel', () => { if (drag) clearTimeout(drag.timer); drag = null; });
$('home').onclick = leaveFinale;
$('yes').onclick = () => net.send({ type: 'answer', v: 'yes' });
$('think').onclick = () => net.send({ type: 'answer', v: 'think' });
addEventListener('resize', () => { layout(); P = []; closeMenu(); });

// ---------- hướng dẫn từng bước ----------
const firstOf = f => { const i = st ? st.plots.findIndex(f) : -1; return i >= 0 ? i : 7; };
let tourPlot = 7;
const tour = createTour([
    { title: 'Chào mừng 🌸', text: SOLO ? 'Đây là khu vườn nhỏ của bạn. Hãy cùng trồng thật nhiều hoa — cuối cùng sẽ có một điều bất ngờ đang chờ!' : `Đây là khu vườn chung của <b>${NAME[ME]}</b> và <b>${NAME[THEM]}</b>. Hai bạn cùng chăm từ xa — làm cùng lúc thì hoa lớn nhanh hơn và có nhiều phần thưởng hơn. Cuối cùng sẽ có một điều bất ngờ 💌` },
    { title: 'Gieo hạt', text: '<b>Chạm</b> vào luống đất nâu để gieo hạt 🌱', target: () => plotCss(tourPlot = firstOf(p => p.st === 'soil')), wait: 'plant' },
    { title: 'Tưới nước', text: '<b>Chạm</b> vào cây vừa gieo để tưới 💧. Thanh xanh dưới luống là độ ẩm, thanh lá là độ lớn. Bong bóng 💧 trên cây = đang khát!', target: () => plotCss(tourPlot = firstOf(p => p.st === 'plant')), wait: 'water' },
    { title: 'Nhiều việc hơn', text: '<b>Giữ ngón tay</b> trên cây hoặc <b>chạm 2 lần</b> (chuột phải) để mở menu: bón phân, hái, nhổ cỏ, xem chi tiết…', target: () => plotCss(tourPlot), wait: 'hold' },
    { title: 'Mở rộng vườn 🌱', text: `Vườn mới có 2 luống. <b>Chạm</b> ô có dấu ＋ cạnh vườn để mua thêm luống (tối đa ${MAX_PLOTS}, giá tăng dần).`, target: () => plotCss(firstOf((p, i) => canExpand(st, i))), wait: 'expand' },
    { title: 'Khai hoang', text: 'Đất mới là cỏ hoang: <b>chạm 3 lần</b> để khai hoang. Hái hoa xong mà bỏ trống luống lâu, cỏ hoang cũng mọc lại đấy!', target: () => plotCss(firstOf(p => p.st === 'wild')), wait: 'dig' },
    { title: 'Hạt giống', text: '<b>Chạm</b> vào đây để chọn loại hạt muốn gieo. Mỗi loài hoa có tính cách riêng.', target: () => $('seedBtn'), wait: 'open:seeds' },
    { title: 'Chợ hoa 🛒', text: 'Hái hoa được ✨ để mua hạt quý, phân bón và đồ cho vườn. <b>Chạm</b> để xem thử.', target: () => $('shopBtn'), wait: 'open:shop' },
    { title: 'Lời nhắn 💌', text: `Mua 📝 Giấy ghi chú ở chợ để gửi lời nhắn${SOLO ? '' : ` cho <b>${NAME[THEM]}</b>`}: mỗi người một tờ, người kia đọc xong mới viết được tờ mới — như thư tay. <b>Chạm</b> để xem.`, target: () => $('chatBtn'), wait: 'open:chat' },
    { title: 'Radio 📻', text: `Chiếc radio trên hàng rào phát nhạc YouTube làm nhạc nền${SOLO ? '' : ` — bạn và <b>${NAME[THEM]}</b> nghe chung một bài`}. <b>Chạm</b> vào radio để mở.`, target: () => radioCss(), wait: 'open:radio' },
    { title: 'Giờ & thời tiết', text: 'Một ngày trong vườn dài 12 phút. Mũi tên → là thời tiết sắp tới. <b>Chạm</b> để xem thời tiết có ảnh hưởng gì.', target: () => $('clock'), wait: 'clock' },
    { title: 'Ngọn đồi hoa ⛰️', text: 'Mỗi bông bạn hái sẽ gieo một bông lên ngọn đồi phía sau, rồi hoa trên đồi tự sinh sôi theo thời gian. Bỏ quên cây chết thì hoa trên đồi cũng héo theo.', target: () => ({ x: 0, y: L.hillTop * px, w: VW(), h: (L.skyH - L.hillTop) * px }) },
    { title: 'Gắn kết 💞', text: 'Thanh này tăng khi hai người cùng ở trong vườn, cùng tưới một cây, hái hoa… Mỗi cấp có quà và lá thư bí mật. <b>Chạm</b> để xem.', target: () => $('bond'), wait: 'bond' },
    { title: 'Sổ tay 📖', text: `Mục tiêu Lễ hội hoa, bộ sưu tập, lá thư và cài đặt âm thanh đều ở đây. <b>Chạm</b> để mở — chúc hai bạn vui vẻ!`, target: () => $('bookBtn'), wait: 'open:book' }
], { onStep: () => closeMenu(), onEnd: () => setTimeout(() => toast('Nút ❓ giờ là 🧰 Vật dụng: bấm thẳng để dùng đồ trong vườn (hướng dẫn xem lại trong Sổ tay)', 'sky', 'tourend', 0), 400) });

// ---------- menu cheat: mã Konami ↑ ↑ ↓ ↓ ← → ← → B A (điện thoại: vuốt theo thứ tự đó rồi chạm 2 lần) ----------
const CHEATS = SOLO || !!info?.cheats, KONAMI = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
let konami = [];
function konamiPush(k) {
    konami = [...konami, k].slice(-KONAMI.length);
    if (konami.join() !== KONAMI.join()) return;
    konami = [];
    if (!CHEATS) return toast('Menu cheat đang tắt — đặt cheats: true trong config.js', 'bad', 'cheatoff');
    openCheats();
}
addEventListener('keydown', e => { const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key] || e.key.toLowerCase(); konamiPush(k); });
const CHEAT_LIST = [
    ['Tài nguyên', [['dew', '✨ +500 hạt sương'], ['items', '🧪 +10 phân, +5 phân vàng, +30 🍂'], ['seeds', '🌱 +5 hạt mỗi loài']]],
    ['Khu vườn', [['land', '🧱 Mở hết 25 luống'], ['clear', '🪓 Khai hoang & dọn hết'], ['care', '💧 Tưới, bắt sâu, nhổ cỏ tất cả'], ['grow', '🌸 Mọi cây nở ngay'], ['unlock', '📝 Giấy ghi chú + thùng ủ'], ['wish', '🌠 Điều ước sắp xong'], ['shiny', '✨ Mọi cây thành lấp lánh']]],
    ['Sự kiện ngẫu nhiên', Object.entries(EVENTS).map(([k, e]) => ['event:' + k, `${e.icon} ${e.name}`])],
    ['Đồi hoa', [['hill', '⛰️ +300 bông trên đồi'], ['hillfull', '💐 Phủ kín đồi'], ['hillclear', '🌱 Đồi trống lại']]],
    ['Thời gian', [['time:60', '⏩ Tua 1 phút'], ['time:300', '⏩ Tua 5 phút'], ['night', '🌙 Sang đêm'], ['day', '☀️ Sang ngày'], ['speed:1', '🐢 ×1'], ['speed:5', '🐇 ×5'], ['speed:20', '🚀 ×20']]],
    ['Thời tiết (nhảy tới lần gần nhất)', Object.entries(WEATHER).map(([k, w]) => ['weather:' + k, `${w.icon} ${w.name}`])],
    ['Tiến trình', [['xp', '💞 +50 gắn kết'], ['book', '📖 Đủ mọi loài'], ['peak', '🌸 Đạt vườn nở rộ'], ['note', '💌 Mở lá thư tiếp theo'], ['finale', '🎆 Đủ điều kiện Lễ hội hoa']]],
    ['Khác', [['away', '📜 Xem thử "trong lúc vắng mặt"'], ['tour', '❓ Chạy lại hướng dẫn'], ['replay', '🎬 Chiếu lại đoạn kết'], ['unlift', '↩️ Huỷ đã xong lễ hội'], ['unanswer', '💗 Xoá câu trả lời']]]
];
const cheatHTML = () => `<p style="font-size:12px;color:#8d6b80;text-align:center">Tác dụng lên cả khu vườn chung${SOLO ? '' : ' (người kia cũng thấy)'} · tốc độ thời gian ×${st.speed || 1}</p>`
    + CHEAT_LIST.map(([s, items]) => `<div class="sec">${s}</div><div style="display:flex;flex-wrap:wrap;gap:6px">${items.map(([w, l]) => `<button class="cheat" data-act="cheat" data-w="${w}">${l}</button>`).join('')}</div>`).join('');
function openCheats() {
    if (!st) return;
    openSheet('cheat', '🎮 Menu cheat', cheatHTML(), (act, ds) => {
        const [what, n] = ds.w.split(':');
        if (what === 'replay') { closeSheet(); return buildFinale(t); }
        if (what === 'tour') { closeSheet(); return tour.start(); }
        if (what === 'away') { closeSheet(); store.set(SEEN_KEY, { real: serverNow() - 3 * 3600e3, gt: Math.max(0, st.gt - 2700), cnt: { bloom: 0, bug: 0, weed: 0, wilt: 0, fade: 0, die: 0, w: {}, harvest: {}, plant: {}, water: {} }, hill: Math.max(0, (st.hill || '').length - 120), round: st.round }); return showAway(); }
        net.send({ type: 'cheat', what, n: isNaN(+n) ? n : +n || undefined });
        setTimeout(() => sheetOpen('cheat') && refreshSheet(cheatHTML()), 300);
    });
}

// ---------- radio YouTube nghe chung ----------
const radio = createRadio({ send: m => net?.send(m), serverNow: () => serverNow(), audio, toast, names: { [ME]: 'Bạn', [THEM]: NAME[THEM] } });
function openRadio() { if (!st) return; audio.sfx('open'); closeMenu(); radio.open(); tour?.notify('open:radio'); }
const radioCss = () => { const h = decorHits.find(b => b.k === 'radio'); return h ? { x: h.x0 * px - 6, y: h.y0 * px - 6, w: (h.x1 - h.x0) * px + 12, h: (h.y1 - h.y0) * px + 12 } : { x: VW() / 2 - 30, y: L.skyH * px - 40, w: 60, h: 40 }; };
$('nowPlaying').onclick = openRadio;
setInterval(() => { const on = radio.playing && !fin; $('nowPlaying').hidden = !on; if (on) $('nowPlaying').querySelector('span').textContent = radio.title || 'Radio đang phát'; }, 1000);

// ---------- vòng lặp ----------
let last = performance.now(), hudT = 0, demoT = 0, tourStarted = false;
let loopErr = 0, lastSync = 0, fno = 0, slow = false, cost = 0;
function loop(now) {
    requestAnimationFrame(loop); // đặt khung sau trước tiên: một lỗi lẻ không bao giờ làm đứng cả game
    const c0 = performance.now();
    try { frame(now); } catch (e) { if (loopErr++ < 5) console.error(e); }
    cost = cost * 0.95 + (performance.now() - c0) * 0.05; slow = cost > (slow ? 9 : 13); // đo thời gian vẽ trung bình
}
function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (st) {
        pt0 = PERF ? now_() : 0; if (PERF) PERF.frames++;
        const lag = serverNow() - st.real, fxs = advance(st, serverNow(), online, rctx()); // dự đoán thời gian trôi giữa hai lần máy chủ gửi
        if (lag < 4000) for (const f of fxs) onFx(f); else if (now - lastSync > 2000) { lastSync = now; net.send({ type: 'sync' }); } // vừa quay lại sau lúc ẩn tab
        pm('advance');
        if (slow && (fno++ & 1)) return; // máy yếu: vẽ 30 khung/giây
        wind.x *= Math.exp(-dt * 1.6); wind.y *= Math.exp(-dt * 1.6);
        const w = weatherAt(st, gView());
        updateParticles(dt, w);
        if (canFinale(st) || st.fw) bakeRows(4);
        if (fin) drawFinale(); else { world.style.transform = `translateY(${-px}px)`; drawGarden(1); }
        pt0 = PERF ? now_() : 0; wctx.putImageData(img, 0, 0); pm('put');
        drawWords();
        audioScene({ weather: w, night: isNight(gView()), wind: Math.min(1, Math.hypot(wind.x, wind.y)) });
        pt0 = PERF ? now_() : 0; if ((hudT += dt) > 0.25) { hudT = 0; hud(); } pm('hud');
        if (DEMO && (demoT += dt) > 0.4) { demoT = 0; demoStep(); }
        if (!tourStarted && !DEMO) { tourStarted = true; if (!tourDone()) setTimeout(() => { if ($('away').hidden) tour.start(); }, 600); }
    }
}
function demoStep() { // ?demo: tự chăm vườn (để xem trước)
    if (fin) return;
    const ps = st.plots, idx = f => ps.findIndex(f);
    let i;
    if ((i = idx(p => p.bug)) >= 0 || (i = idx(p => p.bloom)) >= 0 || (i = idx(p => p.st === 'plant' && p.w < 0.55)) >= 0 || (i = idx(p => p.st === 'dead' || p.weed > 0.3)) >= 0) return tapPlot(i);
    if ((i = idx(p => p.st === 'soil')) >= 0) { if (!SPECIES_ORDER.some(s => st.inv.seeds[s] > 0)) { const s = SPECIES_ORDER.filter(s => SPECIES[s].price && SPECIES[s].price <= st.inv.dew).pop(); if (s) return net.send({ type: 'buy', item: 'seed:' + s }); } return tapPlot(i); }
    if ((i = idx(p => p.st === 'wild')) >= 0) return tapPlot(i);
    if (ownedPlots(st) < MAX_PLOTS && st.inv.dew >= plotPrice(st) + 20 && (i = st.plots.findIndex((p, j) => canExpand(st, j))) >= 0) return net.send({ type: 'expand', i });
}

layout();
const net = SOLO ? localGarden(ME, card, DEMO_NOTES, onMessage) : connectGarden(slug, onMessage, ok => { if (!ok && st) toast('Mất kết nối, đang nối lại… 🌧️', 'bad', 'net'); });
requestAnimationFrame(loop);
