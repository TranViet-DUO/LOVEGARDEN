// =====================================================================================================
//  LUẬT CHƠI "Vườn hoa của hai người" — dùng chung cho máy chủ (src/worker.js) và trình duyệt (dự đoán mượt + chơi thử một mình).
//  Mọi phép tính đều tất định (chỉ + - * /, hash số nguyên) nên máy chủ và hai trình duyệt mô phỏng ra cùng một khu vườn.
//
//  Thời gian vườn (gt, giây) trôi bằng thời gian thật khi có người trong vườn, chậm 80 lần khi cả hai vắng ("vườn ngủ": 4 giờ thật ≈ 3 phút vườn, nên mỗi 4 tiếng ghé một lần là đủ), tối đa bù 6 giờ vườn.
//  Một ngày trong vườn = 12 phút (8 phút ngày, 4 phút đêm; 05:00 -> 21:00 là ngày). Thời tiết đổi mỗi 4 phút (xem WEATHER).
// =====================================================================================================
export const ROLES = ['gui', 'nhan'];
export const other = role => (role === 'gui' ? 'nhan' : 'gui');
export const STEP = 2, DAY = 720, NIGHT_AT = 480, COLS = 5, ROWS = 5, DIG_TAPS = 3, SLEEP_RATE = 1 / 80, WEATHER_LEN = 240;
export const V = 9;                 // phiên bản trạng thái: đổi số này thì vườn cũ được trồng lại từ đầu
export const MAX_PLOTS = COLS * ROWS; // 25 luống
const START_OWN = [7, 12];          // 2 luống ở giữa lúc mới vào vườn
export const LEAVE_GRACE = 45;      // hái xong / dọn cây khô mà để trống quá 45 giây vườn -> cỏ hoang mọc lại

// ---------- 20 loài hoa ----------
// grow: phút để nở · dry: độ ẩm mất mỗi phút · reward: ✨ khi hái · bug: xác suất sâu/phút · wx: hệ số lớn theo thời tiết
export const SPECIES = {
    cuc: { name: 'Cúc hoạ mi', price: 4, grow: 3, dry: 0.25, reward: 8, bug: 0.05, tip: 'Dễ trồng, lớn nhanh — hợp để bắt đầu.' },
    huongduong: { name: 'Hướng dương', price: 8, grow: 5, dry: 0.3, reward: 15, bug: 0.05, dayOnly: true, wx: { sun: 1.3 }, tip: 'Chỉ lớn ban ngày, thích nắng.' },
    vantho: { name: 'Cúc vạn thọ', price: 10, grow: 4, dry: 0.25, reward: 16, bug: 0.01, repel: 2, tip: 'Mùi hăng xua sâu cho cả các luống xung quanh.' },
    bocongcanh: { name: 'Bồ công anh', price: 14, grow: 5, dry: 0.22, reward: 18, bug: 0.03, spread: true, wx: { wind: 1.8 }, tip: 'Gió nhẹ giúp lớn nhanh. Hái xong hạt bay theo gió: được thêm hạt và gieo 2 bông lên đồi.' },
    tulip: { name: 'Tulip', price: 14, grow: 6, dry: 0.35, reward: 24, bug: 0.06, tip: 'Mỗi bông một màu, bón phân sẽ rực rỡ hơn.' },
    muoigio: { name: 'Hoa mười giờ', price: 12, grow: 5, dry: 0.1, reward: 20, bug: 0.02, noonBloom: true, wx: { heat: 1.8, sun: 1.3 }, tip: 'Chịu nắng giỏi, nụ chỉ bung vào giữa trưa (10:00–14:00).' },
    oaihuong: { name: 'Oải hương', price: 18, grow: 8, dry: 0.18, reward: 30, bug: 0.02, repel: 1, tip: 'Ít uống nước, xua sâu cho các luống bên cạnh.' },
    xuongrong: { name: 'Xương rồng hoa', price: 22, grow: 8, dry: 0.07, reward: 34, bug: 0.01, wx: { heat: 2, sun: 1.3, rain: 0.4, storm: 0.3 }, tip: 'Chịu hạn giỏi, thích nắng gắt; mưa nhiều lại lớn chậm.' },
    daquy: { name: 'Dã quỳ', price: 20, grow: 7, dry: 0.28, reward: 30, bug: 0.03, hillX: 2, wx: { wind: 1.6, cloud: 1.2 }, tip: 'Hoa dại của cao nguyên: thích gió và mây, hái được gieo 2 bông lên đồi.' },
    camchuong: { name: 'Cẩm chướng', price: 24, grow: 8, dry: 0.3, reward: 36, bug: 0.05, perfectX: 2, tip: 'Hoa để tặng: bông hoàn hảo ⭐ được gấp đôi ✨ thay vì gấp rưỡi.' },
    camtucau: { name: 'Cẩm tú cầu', price: 26, grow: 10, dry: 0.45, reward: 40, bug: 0.06, wx: { rain: 1.3, fog: 1.3 }, tip: 'Rất khát nước — nhớ tưới thường xuyên.' },
    thuocduoc: { name: 'Thược dược', price: 32, grow: 9, dry: 0.4, reward: 50, bug: 0.05, minWater: 0.5, wx: { rain: 1.6, fog: 1.3, heat: 0.6 }, tip: 'Ưa ẩm: chỉ lớn khi đất ẩm trên 50%, mưa thì lớn rất nhanh.' },
    ly: { name: 'Hoa ly', price: 36, grow: 10, dry: 0.32, reward: 56, bug: 0.04, fragrance: true, tip: 'Hương thơm giúp các luống bên cạnh lớn nhanh hơn 15%.' },
    mai: { name: 'Hoa mai', price: 38, grow: 10, dry: 0.3, reward: 66, bug: 0.04, dawnBloom: true, tip: 'Nụ chỉ bung lúc bình minh (05:00–09:00).' },
    hong: { name: 'Hoa hồng', price: 40, grow: 12, dry: 0.4, reward: 62, bug: 0.12, tip: 'Kiêu kỳ: hay bị sâu, cần chăm kỹ.' },
    hoagiay: { name: 'Hoa giấy', price: 34, grow: 9, dry: 0.15, reward: 44, bug: 0.02, sturdy: true, life: 720, tip: 'Rất bền: chịu khát và nắng gắt, hoa giữ được lâu gấp đôi.' },
    lan: { name: 'Hoa lan', price: 45, grow: 11, dry: 0.3, reward: 72, bug: 0.05, heatHurt: true, wx: { cloud: 1.8, fog: 2, sun: 0.7, heat: 0.3 }, tip: 'Ưa râm mát: lớn nhanh khi trời mây hay sương mù; nắng gắt làm lan yếu đi.' },
    quynh: { name: 'Hoa quỳnh', price: 55, grow: 9, dry: 0.3, reward: 85, bug: 0.04, nightBloom: true, life: 180, tip: 'Chỉ nở về đêm và tàn rất nhanh — canh hái kịp nhé.' },
    maudon: { name: 'Mẫu đơn', price: 70, grow: 14, dry: 0.35, reward: 130, bug: 0.07, needFert: true, tip: 'Hoa vương giả: nụ chỉ lớn tiếp khi đã được bón phân ít nhất một lần.' },
    songtam: { name: 'Song Tâm', price: 0, grow: 6, dry: 0.3, reward: 50, bug: 0, together: true, note: true, tip: 'Không bán. Chỉ lớn khi cả hai cùng ở trong vườn. Hái sẽ mở một lá thư.' }
};
export const SPECIES_ORDER = Object.keys(SPECIES);
export const BOOK_GOAL = 14; // số loài cần sưu tập để mở Lễ hội hoa

// ---------- thời tiết ----------
export const WEATHER = {
    sun: { icon: '☀️', name: 'Nắng đẹp', tip: 'Thời tiết đẹp để chăm vườn.' },
    cloud: { icon: '⛅', name: 'Nhiều mây', tip: 'Đất lâu khô hơn. Hoa lan rất thích.' },
    rain: { icon: '🌧️', name: 'Mưa', tip: 'Cây tự uống nước. Thược dược lớn rất nhanh.' },
    heat: { icon: '🔥', name: 'Nắng gắt', tip: 'Đất mau khô gấp rưỡi! Xương rồng thích, hoa lan yếu đi.' },
    wind: { icon: '🍃', name: 'Gió nhẹ', tip: 'Gió thổi bay sâu, nhưng cỏ dại lan nhanh. Bồ công anh lớn nhanh.' },
    fog: { icon: '🌫️', name: 'Sương mù', tip: 'Đất giữ ẩm tốt, nhưng sâu bọ sinh sôi.' },
    storm: { icon: '⛈️', name: 'Giông', tip: 'Mưa to tự tưới, nhưng cây non bị quật yếu đi — mái che sẽ bảo vệ.' },
    rainbow: { icon: '🌈', name: 'Cầu vồng', tip: 'Sau mưa: hái hoa được thêm 50% ✨ và cây lớn nhanh hơn.' }
};
const isDawn = gt => gt % DAY < DAY / 6; // 05:00–09:00
const isNoon = gt => { const t = gt % DAY; return t >= DAY * 5 / 24 && t < DAY * 9 / 24; }; // 10:00–14:00
export const isNight = gt => gt % DAY >= NIGHT_AT;
function baseWeather(st, b) {
    const h = ihash(st.seed, b, 911, 7) * 100, night = isNight(b * WEATHER_LEN + 1);
    if (h < 12) return 'rain';
    if (h < 16) return 'storm';
    if (h < 24) return night ? 'cloud' : 'heat';
    if (h < 34) return 'wind';
    if (h < 42) return 'fog';
    if (h < 58) return 'cloud';
    return 'sun';
}
export function weatherAt(st, gt = st.gt) {
    if (st.wxo && gt >= st.wxo.from && gt < st.wxo.to) return st.wxo.w; // chuông gió vừa gọi gió
    const b = Math.floor(gt / WEATHER_LEN), prev = baseWeather(st, b - 1);
    if ((prev === 'rain' || prev === 'storm') && !isNight(gt) && ihash(st.seed, b, 912, 1) < 0.45) return 'rainbow';
    return baseWeather(st, b);
}

// ---------- đồi hoa phía sau hàng rào ----------
// st.hill là chuỗi mã loài, mỗi ký tự = một bông trên đồi (tối đa HILL_MAX).
// Mỗi bông hái được gieo 1 bông lên đồi; rồi theo thời gian, mỗi bông trên đồi thỉnh thoảng tự sinh thêm 1–3 bông cùng loài
// (lan nhanh hơn khi hai người cùng ở trong vườn). Cây chết / hoa tàn bỏ phí -> vài bông trên đồi héo đi.
export const HILL_MAX = 1500, HILL_SEED_RATE = 0.025; // HILL_SEED_RATE: xác suất mỗi bông trên đồi sinh sôi trong 1 phút
export const HILL_CODE = { cuc: 'c', huongduong: 'h', tulip: 't', oaihuong: 'o', camtucau: 'm', hong: 'r', quynh: 'q', songtam: 's', lan: 'l', xuongrong: 'x', mai: 'a', bocongcanh: 'b', maudon: 'd', vantho: 'v', muoigio: 'g', daquy: 'y', camchuong: 'k', thuocduoc: 'u', ly: 'i', hoagiay: 'z' };
export const HILL_SP = Object.fromEntries(Object.entries(HILL_CODE).map(([k, v]) => [v, k]));
function addHill(st, sp, n, fx, code = HILL_CODE[sp] || 'c') {
    const before = (st.hill || '').length;
    st.hill = ((st.hill || '') + code.repeat(Math.max(0, n))).slice(0, HILL_MAX);
    const q = k => Math.floor(k * 4 / HILL_MAX); // mốc 25% / 50% / 75% / 100%
    if (q(st.hill.length) > q(before)) fx.push({ k: 'hill', pct: q(st.hill.length) * 25 });
}
function loseHill(st, n, fx) { const h = st.hill || ''; if (!h.length) return; st.hill = h.slice(0, Math.max(0, h.length - n)); fx.push({ k: 'hillLoss', n: Math.min(n, h.length) }); }

// ---------- đồ dùng trong vườn: chỉ còn thùng ủ phân (bấm để ủ) và hòm thư ----------
export const ACTS = {
    thung: { icon: '🍂', name: 'Ủ phân', cd: 0, desc: '3 🍂 → 1 🧪 phân bón' }
};
export const AUTO = [];

// ---------- chợ ----------
// kind: 'use' = dùng dần (đếm trong túi), 'tool' = dụng cụ mua một lần, 'unlock' = mở khoá chức năng (đặt trong vườn, lưu ở st.decor)
export const SHOP = {
    fert: { kind: 'use', name: 'Phân bón', icon: '🧪', price: 12, desc: 'Cây lớn nhanh 60% trong 2,5 phút, hoa đẹp hơn' },
    phanvang: { kind: 'use', name: 'Phân vàng', icon: '🌟', price: 30, desc: 'Lớn nhanh 60% trong 4 phút, hoa đẹp gấp đôi phân thường' },
    tuihat: { kind: 'use', name: 'Túi hạt bí ẩn', icon: '🎁', price: 25, desc: '2 hạt ngẫu nhiên — có khi trúng hạt quý' },
    binhto: { kind: 'tool', name: 'Bình tưới lớn', icon: '🪣', price: 60, desc: 'Tưới một cây thì 4 luống bên cạnh cũng được tưới nhẹ' },
    keovang: { kind: 'tool', name: 'Kéo vàng', icon: '✂️', price: 90, desc: 'Hái hoa được thêm 20% ✨' },
    giay: { kind: 'unlock', name: 'Giấy ghi chú & hòm thư', icon: '📝', price: 20, desc: 'Mở khoá Lời nhắn: mỗi người gửi một tờ ghi chú, người kia đọc xong mới viết được tờ mới' },
    thung: { kind: 'unlock', name: 'Thùng ủ phân', icon: '🧺', price: 30, desc: 'Mở khoá Ủ phân: 3 🍂 (cỏ dại, cây khô, khai hoang) → 1 🧪 giúp cây lớn nhanh' }
};
// giá mở rộng thêm một luống (luống thứ owned+1), tăng dần
export const plotPrice = st => { const n = Math.max(0, ownedPlots(st) - START_OWN.length); return Math.round(6 + 4 * n + 0.4 * n * n); };
export const ownedPlots = st => st.plots.filter(P => P.st !== 'locked').length;
export const canExpand = (st, i) => st.plots[i]?.st === 'locked' && neighbors(i).some(n => st.plots[n].st !== 'locked');

// ---------- sự kiện ngẫu nhiên (mỗi phút vườn có ~30% xảy ra một sự kiện khi có người trong vườn) ----------
// tap: cần chạm để xử lý · plot: xảy ra trên một luống · dur: kéo dài (giây vườn)
export const EVENTS = {
    buom: { icon: '🦋', name: 'Đàn bướm ghé thăm', text: 'Bướm thụ phấn: cả vườn lớn nhanh hơn 30% trong 1 phút', dur: 60 },
    qua: { icon: '🐦‍⬛', name: 'Quạ rình hạt', text: 'Chạm vào con quạ để đuổi, kẻo nó ăn mất cây non!', dur: 40, tap: true, plot: true },
    goi: { icon: '🎁', name: 'Gói quà trước cổng', text: 'Ai đó để lại một gói quà — chạm để mở', dur: 60, tap: true },
    meo: { icon: '🐱', name: 'Mèo hoang', text: 'Một chú mèo nằm ngủ trên luống, cây ở đó không lớn được — chạm để vuốt ve', dur: 60, tap: true, plot: true },
    co4: { icon: '🍀', name: 'Cỏ bốn lá', text: 'Cỏ bốn lá mọc trong vườn — chạm để hái: lần hái hoa tới được gấp đôi ✨', dur: 45, tap: true, plot: true },
    domdom: { icon: '✨', name: 'Đom đóm tụ hội', text: 'Đàn đom đóm tụ lại giữa vườn — chạm để nhận 15 ✨', dur: 45, tap: true },
    sau: { icon: '🐛', name: 'Sâu kéo đến', text: 'Một đàn sâu vừa bò vào vườn!' },
    hat: { icon: '🌬️', name: 'Gió mang hạt lạ', text: 'Một hạt giống lạ theo gió bay vào túi bạn' },
    mua: { icon: '🌦️', name: 'Mưa bóng mây', text: 'Một đám mây nhỏ đi qua, tưới nhẹ cả vườn' }
};

// điểm gắn kết cần để lên cấp n (không giới hạn cấp) và phần thưởng mỗi cấp
const LV = [0, 30, 110, 225, 360, 510];
export const xpFor = n => n <= 5 ? LV[Math.max(0, n)] : 510 + (n - 5) * 170 + 15 * (n - 5) * (n - 4);
export const LEVELS = LV; // (giữ tên cũ) mốc cấp 0–5
const GIFTS = {
    1: { songtam: 1, text: 'Nhận 1 hạt Song Tâm 💞' },
    2: { phanvang: 2, note: true, text: '2 🌟 phân vàng + một lá thư 💌' },
    3: { dew: 60, songtam: 1, text: '+60 ✨ và 1 hạt Song Tâm · mở khoá Lễ hội hoa' },
    4: { songtam: 1, note: true, text: 'Thêm hạt Song Tâm + một lá thư 💌' },
    5: { decor: 'cauvong', dew: 100, text: 'Cầu vồng vĩnh viễn 🌈 + 100 ✨' }
};
// sau cấp 5: quà xoay vòng mãi
export const levelGift = n => GIFTS[n] || [
    { dew: 40 + 10 * n, hill: 20, text: `+${40 + 10 * n} ✨ và 20 bông trên đồi ⛰️` },
    { phanvang: 2, songtam: 1, note: true, text: '2 🌟 phân vàng + 1 hạt Song Tâm + một lá thư (nếu còn) 💌' },
    { seeds: 3, hill: 20, text: '3 hạt giống quý ngẫu nhiên 🎁 và 20 bông trên đồi ⛰️' }
][n % 3];
export const LEVEL_GIFTS = new Proxy({}, { get: (_, k) => levelGift(+k) });

// ---------- điều ước: 3 nhiệm vụ nhỏ, làm xong được thưởng; mỗi bình minh trong vườn, điều ước đã xong được thay mới ----------
export const WISHES = {
    harvest: { icon: '🌸', text: n => `Hái ${n} bông hoa`, n: [5, 9] },
    harvestSp: { icon: '💐', text: (n, sp) => `Hái ${n} bông ${SPECIES[sp].name}`, n: [2, 3] },
    water: { icon: '💧', text: n => `Tưới cây ${n} lần`, n: [10, 18] },
    combo: { icon: '💞', text: n => `Cùng nhau tưới chung một cây ${n} lần`, n: [2, 3], both: true },
    perfect: { icon: '⭐', text: n => `Hái ${n} bông hoàn hảo`, n: [2, 4] },
    plant: { icon: '🌱', text: n => `Gieo ${n} hạt giống`, n: [5, 8] },
    event: { icon: '🎈', text: n => `Giúp ${n} chuyện bất ngờ trong vườn`, n: [2, 3] },
    bug: { icon: '🐛', text: n => `Bắt ${n} con sâu`, n: [3, 5] },
    star: { icon: '🌠', text: n => `Ước ${n} lần với sao băng`, n: [1, 2] }
};

export const freshState = (seed = 1, keep = {}) => ({
    v: V, seed: seed | 0, gt: 40, real: 0, acc: 0, step: 0,
    plots: Array.from({ length: MAX_PLOTS }, (_, i) => START_OWN.includes(i) ? { st: 'soil', weed: 0 } : { st: 'locked' }),
    inv: { dew: 25, fert: 1, phanvang: 0, compost: 0, seeds: { cuc: 4, huongduong: 1 } },
    xp: 0, lvl: 0, bondT: 0, peak: 0, hill: '', book: {}, shiny: {}, decor: {}, tools: {}, notes: 0, wb: -1,
    cd: {}, until: {}, ev: null, evMin: -1, luck: 0, wxo: null, fstar: 0, wishes: [], wishDay: -1, wishDone: 0, busyAt: {},
    stats: { harvest: 0, died: 0, combos: 0, stars: 0, perfect: 0, events: 0 },
    // bộ đếm cộng dồn (để kể lại "trong lúc bạn vắng mặt")
    cnt: { bloom: 0, wilt: 0, die: 0, bug: 0, fade: 0, weed: 0, rewild: 0, dew: 0, w: {}, auto: { water: 0, weed: 0, plant: 0, harvest: 0, fert: 0 }, harvest: { gui: 0, nhan: 0 }, plant: { gui: 0, nhan: 0 }, water: { gui: 0, nhan: 0 } },
    // giấy ghi chú: mail[người viết] = tờ đang gửi; msgs = các tờ cũ (giữ khi trồng lại vườn)
    mail: keep.mail || {}, msgs: keep.msgs || [], radio: keep.radio || null,
    hybrids: {}, lastPlant: null, chain: null,
    joined: keep.joined || {}, answer: keep.answer || null, done: keep.done || false,
    lastWater: null, starCaught: -1, fw: false, swipes: { gui: 0, nhan: 0 }, liftAt: 0, round: (keep.round || 0) + 1
});

// ---------- tiện ích tất định ----------
export function ihash(a, b, c, d) {
    let h = (a | 0) ^ 0x9e3779b9;
    for (const v of [b, c, d]) { h = Math.imul(h ^ (v | 0), 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; }
    return (h >>> 0) / 4294967296;
}
const chance = (st, i, k, p) => ihash(st.seed, st.step, i, k) < p;
const pickOf = (st, arr, k) => arr[Math.floor(ihash(st.seed, st.step, 4242, k) * arr.length)];
// sao băng: vài phút đêm có một ngôi sao bay qua trong 6 giây — chạm kịp để ước. Đèn trời gọi được một ngôi sao (fstar).
export function starAt(st, gt = st.gt) {
    if (st.fstar && gt >= st.fstar && gt < st.fstar + 8 && st.starCaught !== -st.fstar) return { min: -st.fstar, f: (gt - st.fstar) / 8, y: 0.08, dir: ihash(st.seed, st.fstar, 77, 3) < 0.5 ? 1 : -1 };
    const min = Math.floor(gt / 60), s = gt - min * 60;
    if (!isNight(gt) || ihash(st.seed, min, 77, 1) >= 0.4 || s < 10 || s >= 16 || st.starCaught === min) return null;
    return { min, f: (s - 10) / 6, y: 0.06 + 0.14 * ihash(st.seed, min, 77, 2), dir: ihash(st.seed, min, 77, 3) < 0.5 ? 1 : -1 };
}
export const FULL_BLOOM = 10; // số bông cùng nở một lúc để đạt "Vườn nở rộ"
export const bookCount = st => SPECIES_ORDER.filter(s => st.book[s]).length;
export const canFinale = st => bookCount(st) >= BOOK_GOAL && st.lvl >= 3 && st.peak >= FULL_BLOOM;
export const around = i => { const r = Math.floor(i / COLS), c = i % COLS, out = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if ((dr || dc) && rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) out.push(rr * COLS + cc); } return out; };
export const neighbors = i => { const r = Math.floor(i / COLS), c = i % COLS, out = []; for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) out.push(rr * COLS + cc); } return out; };
const cnt = st => (st.cnt ||= freshState().cnt);
export const has = (st, k) => !!st.decor[k];
export const cdLeft = (st, k, gt = st.gt) => Math.max(0, ((st.cd || {})[k] || 0) - gt);
const active = (st, k) => ((st.until || {})[k] || 0) > st.gt;

function addXp(st, n, fx, ctx) {
    st.xp = Math.max(xpFor(st.lvl), Math.round((st.xp + n) * 10) / 10);
    while (st.xp >= xpFor(st.lvl + 1)) {
        st.lvl++;
        const g = levelGift(st.lvl);
        if (g.songtam) giveSeed(st, 'songtam', g.songtam);
        if (g.decor) st.decor[g.decor] = true;
        if (g.dew) st.inv.dew += g.dew;
        if (g.phanvang) st.inv.phanvang = (st.inv.phanvang || 0) + g.phanvang;
        if (g.seeds) for (let k = 0; k < g.seeds; k++) giveSeed(st, randomSeed(st, 20 + k, st.lvl, true));
        if (g.hill) growHill(st, g.hill, fx);
        fx.push({ k: 'level', lvl: st.lvl, text: g.text });
        if (g.note) unlockNote(st, fx, ctx);
    }
}
// thêm n bông trên đồi theo loài đang có trên đồi (hoặc cúc nếu đồi trống)
function growHill(st, n, fx) { for (let k = 0; k < n; k++) { const h = st.hill || ''; addHill(st, null, 1, fx, h.length ? h[Math.floor(ihash(st.seed, st.step, 880 + k, n) * h.length)] : 'c'); } }
function unlockNote(st, fx, ctx) { if (st.notes < (ctx.notesTotal || 0)) { st.notes++; fx.push({ k: 'note', n: st.notes }); } }
const reset = (P, extra = {}) => { for (const k of Object.keys(P)) delete P[k]; Object.assign(P, { st: 'soil', weed: 0 }, extra); };
const randomSeed = (st, k, salt, rare = false) => { // hạt ngẫu nhiên, nghiêng về loài rẻ (rare: nghiêng về loài quý)
    const pool = SPECIES_ORDER.filter(s => SPECIES[s].price), u = ihash(st.seed, st.step, 333 + k, salt);
    return pool[Math.floor((rare ? 1 - Math.pow(1 - u, 1.6) : Math.pow(u, 1.6)) * pool.length)];
};
const giveSeed = (st, s, n = 1) => { st.inv.seeds[s] = (st.inv.seeds[s] || 0) + n; };

// ---------- HOA GHÉP ĐÔI: hai người gieo vào hai luống kề nhau trong 5 giây -> cả hai cây thành giống lai ----------
export const HYBRID_MS = 5000;
const SHORT = { cuc: 'Cúc', huongduong: 'Hướng Dương', vantho: 'Vạn Thọ', bocongcanh: 'Bồ Công Anh', tulip: 'Tulip', muoigio: 'Mười Giờ', oaihuong: 'Oải Hương', xuongrong: 'Xương Rồng', daquy: 'Dã Quỳ', camchuong: 'Cẩm Chướng', camtucau: 'Cẩm Tú', thuocduoc: 'Thược Dược', ly: 'Ly', mai: 'Mai', hong: 'Hồng', hoagiay: 'Giấy', lan: 'Lan', quynh: 'Quỳnh', maudon: 'Mẫu Đơn', songtam: 'Song Tâm' };
export const hybridKey = (a, b) => [a, b].sort((x, y) => SPECIES_ORDER.indexOf(x) - SPECIES_ORDER.indexOf(y)).join('+');
export const hybridName = key => { const [a, b] = key.split('+'); return a === b ? `${SHORT[a]} Song Sinh` : `${SHORT[a]} ${SHORT[b]}`; };

// ---------- TƯỚI NỐI TIẾP: hai người thay phiên tưới các luống kề nhau, mỗi lần cách nhau dưới 3 giây -> chuỗi tăng dần ----------
export const CHAIN_MS = 3000;

// ---------- điều ước ----------
function newWish(st, slot) {
    const day = Math.floor(st.gt / DAY), r = k => ihash(st.seed, day * 7 + slot, 650 + k, st.wishDone || 0);
    const bothJoined = st.joined.gui && st.joined.nhan;
    const kinds = Object.keys(WISHES).filter(k => (!WISHES[k].both || bothJoined) && !(st.wishes || []).some(w => w && !w.done && w.k === k));
    const k = kinds[Math.floor(r(1) * kinds.length)], W = WISHES[k], n = W.n[0] + Math.floor(r(2) * (W.n[1] - W.n[0] + 1));
    let sp;
    if (k === 'harvestSp') { const pool = SPECIES_ORDER.filter(x => SPECIES[x].price && (st.book[x] || (st.inv.seeds[x] || 0) > 0)); sp = pool.length ? pool[Math.floor(r(3) * pool.length)] : 'cuc'; }
    const dew = Math.round((k === 'harvestSp' ? 14 : k === 'water' ? 1.6 : k === 'star' ? 30 : k === 'combo' || k === 'perfect' ? 12 : 7) * n + 10);
    return { k, n, sp, have: 0, dew, done: false };
}
function refreshWishes(st) {
    const day = Math.floor(st.gt / DAY);
    st.wishes ||= [];
    if (day === st.wishDay && st.wishes.length === 3) return;
    st.wishDay = day;
    for (let j = 0; j < 3; j++) if (!st.wishes[j] || st.wishes[j].done) st.wishes[j] = newWish(st, j);
}
function wishTick(st, k, sp, fx, ctx, n = 1) {
    for (const w of st.wishes || []) {
        if (!w || w.done) continue;
        if (!(w.k === k || (w.k === 'harvestSp' && k === 'harvest' && sp === w.sp))) continue;
        w.have = Math.min(w.n, w.have + n);
        if (w.have >= w.n) {
            w.done = true; st.wishDone = (st.wishDone || 0) + 1; st.inv.dew += w.dew; cnt(st).dew += w.dew; addXp(st, 3, fx, ctx);
            if (st.done) growHill(st, 25, fx); // sau Lễ hội: điều ước còn làm đồi nở thêm
            fx.push({ k: 'wish', w: { ...w }, after: !!st.done });
        }
    }
}

// ---------- hái hoa (người hái, hoặc cún hái giúp: role = null) ----------
function harvestPlot(st, i, role, together, fx, ctx) {
    const P = st.plots[i], C = cnt(st), bothJoined = st.joined.gui && st.joined.nhan;
    const S = SPECIES[P.sp], perfect = P.perfect && P.q >= 1.3 && !P.faded, W = weatherAt(st), lucky = role && st.luck > 0;
    const dew = Math.round(S.reward * P.q * (P.faded ? 0.3 : 1) * (together ? 1.1 : 1) * (perfect ? (S.perfectX || 1.5) : 1) * (W === 'rainbow' ? 1.5 : 1) * (st.tools.keovang ? 1.2 : 1) * (lucky ? 2 : 1) * (P.shiny ? 2.5 : 1) * (P.hy ? 1.5 : 1));
    const sp = P.sp, shiny = !!P.shiny; st.inv.dew += dew; C.dew += dew; st.stats.harvest++; if (perfect) st.stats.perfect++;
    if (role) C.harvest[role]++; else C.auto.harvest++;
    if (lucky) st.luck = 0;
    if (P.faded) st.inv.compost++;
    if (shiny) { st.shiny ||= {}; st.shiny[sp] = (st.shiny[sp] || 0) + 1; }
    addHill(st, P.sp, (S.spread ? 2 : S.hillX || 1) + (shiny ? 5 : 0), fx); // mỗi bông hái được gieo 1 bông lên đồi
    const hy = P.hy; if (hy) { const other = hy.split('+').find(x => x !== P.sp) || P.sp; addHill(st, other, 1, fx); }
    let gift = null;
    if (S.spread) { gift = ['cuc', 'bocongcanh', 'huongduong'][Math.floor(ihash(st.seed, st.step, i, 55) * 3)]; giveSeed(st, gift, 2); }
    if (role && (together || !bothJoined)) addXp(st, W === 'rainbow' ? 2 : 1, fx, ctx);
    reset(P, { weed: P.weed, left: LEAVE_GRACE });
    fx.push({ k: 'harvest', i, sp, dew, perfect, gift, rainbow: W === 'rainbow', lucky, shiny, hy, role: role || undefined, by: role ? undefined : 'cun' });
    if (role) { wishTick(st, 'harvest', sp, fx, ctx); if (perfect) wishTick(st, 'perfect', sp, fx, ctx); }
    if (S.note) unlockNote(st, fx, ctx);
}
// chọn hạt để gieo tự động: ưu tiên loài chưa có trong sổ, rồi loài có nhiều hạt nhất (không tự gieo Song Tâm)
function autoSeed(st) {
    const own = SPECIES_ORDER.filter(s => s !== 'songtam' && (st.inv.seeds[s] || 0) > 0);
    if (!own.length) return null;
    return own.find(s => !st.book[s] && !st.plots.some(P => P.sp === s)) || own.sort((a, b) => st.inv.seeds[b] - st.inv.seeds[a])[0];
}
function plantAt(st, i, sp) {
    const P = st.plots[i];
    st.inv.seeds[sp]--;
    reset(P, { weed: P.weed });
    Object.assign(P, { st: 'plant', sp, g: 0, w: 0.6, hp: 1, f: 0, q: 1, bug: 0, bloom: false, age: 0, faded: false, wilted: false, perfect: true, fed: false, hue: Math.floor(ihash(st.seed, st.step, i, 99) * 4), shiny: sp !== 'songtam' && ihash(st.seed, st.step, i, 777) < 0.05 });
}

// xử lý sự kiện đang diễn ra (người chạm, hoặc cún: role = null)
function resolveEvent(st, role, together, fx, ctx) {
    const e = st.ev, C = cnt(st);
    const f = { k: 'evDone', ev: e.k, i: e.i, id: e.id, role: role || undefined, by: role ? undefined : 'cun' };
    if (e.k === 'goi') { const r = ihash(st.seed, e.id, 61, 1); if (r < 0.4) { const s = randomSeed(st, 9, e.id); giveSeed(st, s, 2); f.sp = s; } else if (r < 0.7) { st.inv.fert++; f.fert = 1; } else { st.inv.dew += 30; C.dew += 30; f.dew = 30; } }
    if (e.k === 'domdom') { st.inv.dew += 15; C.dew += 15; f.dew = 15; }
    if (e.k === 'meo') addXp(st, together ? 4 : 2, fx, ctx);
    if (e.k === 'co4') st.luck = 1;
    st.ev = null; fx.push(f);
    if (role) wishTick(st, 'event', null, fx, ctx);
}

// ---------- sự kiện ngẫu nhiên ----------
function rollEvent(st, ctx, fx, force = null) {
    const P = st.plots, D = st.decor, night = isNight(st.gt), W = weatherAt(st);
    const idx = f => P.map((p, i) => [p, i]).filter(([p, i]) => f(p, i)).map(([, i]) => i);
    const young = idx(p => p.st === 'plant' && !p.bloom && p.g < 0.35), growing = idx(p => p.st === 'plant' && !p.bloom), owned = idx(p => p.st === 'soil' || p.st === 'plant');
    const opts = [];
    if (growing.length >= 2) opts.push('buom', 'sau');
    if (young.length) opts.push('qua');
    if (growing.length) opts.push('meo');
    if (owned.length >= 3) opts.push('co4');
    opts.push('goi', 'hat');
    if (night) opts.push('domdom', 'domdom');
    if (W !== 'rain' && W !== 'storm' && growing.length) opts.push('mua');
    if (force && !opts.includes(force)) return false;
    const k = force || pickOf(st, opts, 1), E = EVENTS[k];
    st.stats.events = (st.stats.events || 0) + 1;
    const id = st.step;
    switch (k) {
        case 'qua': {
            const i = pickOf(st, young, 2);
            st.ev = { k, i, end: st.gt + E.dur, id }; break;
        }
        case 'meo': st.ev = { k, i: pickOf(st, growing, 3), end: st.gt + E.dur, id }; break;
        case 'co4': st.ev = { k, i: pickOf(st, owned, 4), end: st.gt + E.dur, id }; break;
        case 'buom': st.until.buom = st.gt + E.dur; st.ev = { k, i: -1, end: st.gt + E.dur, id }; break;
        case 'goi': case 'domdom': st.ev = { k, i: -1, end: st.gt + E.dur, id }; break;
        case 'sau': {
            let n = 0;
            for (let j = 0; j < 3; j++) { const i = pickOf(st, growing, 10 + j), Q = P[i]; if (!Q.bug && !active(st, 'nobug')) { Q.bug = 1; Q.perfect = false; n++; } }
            if (!n) return;
            break;
        }
        case 'hat': {
            const want = SPECIES_ORDER.filter(s => SPECIES[s].price && !st.book[s]), s = want.length ? pickOf(st, want, 5) : randomSeed(st, 0, 5);
            giveSeed(st, s); fx.push({ k: 'ev', ev: k, sp: s, id }); return;
        }
        case 'mua': for (const Q of P) if (Q.st === 'plant') Q.w = Math.min(1, Q.w + 0.5); break;
    }
    fx.push({ k: 'ev', ev: k, i: st.ev?.id === id ? st.ev.i : undefined, id });
}
function endEvent(st, fx) {
    const e = st.ev; st.ev = null;
    if (e.k === 'qua') { // quạ chưa bị đuổi: ăn mất cây non
        const Q = st.plots[e.i];
        if (Q && Q.st === 'plant' && !Q.bloom && Q.g < 0.5) { const sp = Q.sp; reset(Q, { weed: Q.weed }); fx.push({ k: 'evFail', ev: 'qua', i: e.i, sp }); return; }
    }
    fx.push({ k: 'evEnd', ev: e.k, i: e.i });
}

// ---------- mô phỏng một bước 2 giây ----------
function stepSim(st, together, awake, ctx, fx) {
    st.gt += STEP; st.step++;
    st.until ||= {}; st.cd ||= {};
    const night = isNight(st.gt), W = weatherAt(st), C = cnt(st), D = st.decor;
    const b = Math.floor(st.gt / WEATHER_LEN); if (b !== st.wb) { st.wb = b; C.w[W] = (C.w[W] || 0) + 1; fx.push({ k: 'weather', w: W }); }
    const weedK = 1, bugK = (W === 'fog' ? 1.6 : 1) * (active(st, 'nobug') ? 0 : 1), bothJoined = st.joined.gui && st.joined.nhan;
    const dryW = W === 'heat' ? 1.7 : W === 'fog' ? 0.5 : W === 'cloud' ? 0.8 : 1, mist = active(st, 'mist'), shield = active(st, 'shield');
    const spreadK = W === 'wind' ? 2 : 1, cat = st.ev && st.ev.k === 'meo' ? st.ev.i : -1;
    st.plots.forEach((P, i) => {
        if (P.st === 'wild' || P.st === 'locked') return;
        // luống trống bỏ không sau khi hái: cỏ hoang mọc lại
        if (P.st === 'soil' && P.left > 0) { P.left -= STEP; if (P.left <= 0) { reset(P, { st: 'wild', dig: 1 }); C.rewild++; fx.push({ k: 'rewild', i }); return; } }
        // cỏ dại: tự mọc, lớn dần, lan sang ô bên (gió làm lan nhanh)
        if (P.weed > 0) P.weed = Math.min(1, P.weed + STEP / 300 * weedK);
        else if (chance(st, i, 1, (P.st === 'soil' ? 0.1 : 0.05) / 60 * STEP * weedK)) { P.weed = 0.05; C.weed++; }
        if (P.weed > 0.6 && chance(st, i, 2, 0.06 * spreadK / 60 * STEP)) { const nb = neighbors(i), Q = st.plots[nb[Math.floor(ihash(st.seed, st.step, i, 3) * nb.length)]]; if (Q && (Q.st === 'soil' || Q.st === 'plant' || Q.st === 'dead') && !Q.weed) { Q.weed = 0.05; C.weed++; } }
        if (P.st !== 'plant') return;
        const S = SPECIES[P.sp];
        // nước
        if (W === 'rain') P.w = Math.min(1, P.w + 0.6 / 60 * STEP);
        else if (W === 'storm') P.w = Math.min(1, P.w + 1 / 60 * STEP);
        else if (!mist) P.w = Math.max(0, P.w - S.dry / 60 * STEP * dryW * (1 + 0.5 * P.weed) * (night ? 0.7 : 1));
        // nở rồi: hoa tươi một lúc, không hái thì tàn rồi khô
        if (P.bloom) {
            P.age += STEP;
            const life = S.life || 360;
            if (!P.faded && P.age > life) { P.faded = true; C.fade++; fx.push({ k: 'fade', i, sp: P.sp }); }
            if (P.faded && P.age > life + 240) { reset(P, { st: 'dead', weed: P.weed }); fx.push({ k: 'wither', i }); loseHill(st, 2, fx); return; }
        }
        // sức khoẻ: khát lâu thì héo rồi chết; giông quật cây chưa nở; nắng gắt làm lan yếu (mái che "che chắn" thì không sao)
        if (P.w <= 0) {
            if (!shield) P.hp -= STEP / 150 * (S.sturdy ? 0.4 : 1);
            P.perfect = false;
        } else P.hp = Math.min(1, P.hp + STEP / 200);
        if (!shield) {
            if (W === 'storm' && !P.bloom) P.hp -= STEP / 260;
            if (W === 'heat' && S.heatHurt) P.hp -= STEP / 300;
            if (P.bug) P.hp -= STEP / 400;
        }
        if (!P.wilted && P.hp < 0.6) { P.wilted = true; P.q = Math.max(0.5, P.q - 0.3); C.wilt++; fx.push({ k: 'wilt', i, sp: P.sp }); }
        if (P.hp <= 0) { const sp = P.sp; reset(P, { st: 'dead', weed: P.weed }); st.stats.died++; C.die++; addXp(st, -2, fx, ctx); fx.push({ k: 'die', i, sp }); loseHill(st, 4, fx); return; }
        // sâu: sương mù sinh sâu; gió nhẹ thổi bay sâu; chim sẻ bắt sâu
        if (P.bug && ((W === 'wind' && chance(st, i, 6, 0.25 / 60 * STEP)) || (W === 'storm' && chance(st, i, 8, 0.4 / 60 * STEP)))) { P.bug = 0; fx.push({ k: 'bugGone', i, by: W === 'wind' ? 'wind' : 'rain' }); }
        const repel = around(i).some(n => st.plots[n].st === 'plant' && SPECIES[st.plots[n].sp]?.repel >= (neighbors(i).includes(n) ? 1 : 2)) ? 0.4 : 1;
        if (!P.bug && !P.bloom && P.g > 0.15 && chance(st, i, 4, S.bug * bugK * repel / 60 * STEP)) { P.bug = 1; P.perfect = false; C.bug++; fx.push({ k: 'bug', i, sp: P.sp }); }
        // lớn lên
        if (!P.bloom && P.w > (S.minWater || 0)) {
            let m = (S.wx && S.wx[W]) || 1;
            if (P.f > 0) { m *= 1.6; P.f = Math.max(0, P.f - STEP); }
            if (together) m *= 1.25;
            if (D.cauvong) m *= 1.1;
            if (W === 'rainbow') m *= 1.15;
            if (active(st, 'buom')) m *= 1.3;
            if (neighbors(i).some(n => st.plots[n].sp === 'ly' && st.plots[n].st === 'plant' && st.plots[n].g > 0.3)) m *= 1.15; // hương hoa ly
            m *= 1 - 0.5 * P.weed;
            if (P.bug) m *= 0.5;
            if (P.hp < 0.6) m *= 0.3;
            if (night) m *= 0.8;
            if (S.dayOnly && night) m = 0;
            if (S.together && bothJoined && !together) m = 0;
            if (i === cat) m = 0; // mèo đang nằm ngủ trên luống
            let g = P.g + STEP / (S.grow * 60) * m;
            if (S.nightBloom && !night) g = Math.min(g, 0.85);  // nụ quỳnh chờ đêm xuống
            if (S.dawnBloom && !isDawn(st.gt)) g = Math.min(g, 0.85); // nụ mai chờ bình minh
            if (S.noonBloom && !isNoon(st.gt)) g = Math.min(g, 0.85); // nụ mười giờ chờ giữa trưa
            if (S.needFert && !P.fed) g = Math.min(g, 0.6);        // mẫu đơn cần bón phân
            P.g = Math.min(1, g);
            if (P.g >= 1) {
                P.bloom = true; P.age = 0; C.bloom++;
                if (P.shiny) fx.push({ k: 'shinyBloom', i, sp: P.sp });
                if (P.hy) { st.hybrids ||= {}; if (!st.hybrids[P.hy]) fx.push({ k: 'newHybrid', i, hy: P.hy }); st.hybrids[P.hy] = (st.hybrids[P.hy] || 0) + 1; }
                if (!st.book[P.sp]) fx.push({ k: 'newsp', i, sp: P.sp });
                st.book[P.sp] = (st.book[P.sp] || 0) + 1;
                fx.push({ k: 'bloom', i, sp: P.sp });
            }
        }
    });
    // vườn nở rộ: nhiều bông cùng khoe sắc một lúc
    const open = st.plots.filter(P => P.bloom && !P.faded).length;
    if (open > (st.peak || 0)) { st.peak = open; if (open === FULL_BLOOM) { st.inv.dew += 50; addXp(st, 15, fx, ctx); fx.push({ k: 'fullbloom' }); unlockNote(st, fx, ctx); for (const P of st.plots) if (P.bloom) addHill(st, P.sp, 2, fx); } }
    // đồi hoa tự sinh sôi: mỗi bông thỉnh thoảng gieo thêm 1–3 bông cùng loài (khi có người trong vườn; hai người thì nhanh hơn)
    const hl = (st.hill || '').length;
    if (awake && hl && hl < HILL_MAX) {
        const x = hl * HILL_SEED_RATE * (together ? 1.5 : 1) / 60 * STEP;
        let n = Math.floor(x) + (chance(st, 97, 1, x - Math.floor(x)) ? 1 : 0);
        for (let e = 0; e < Math.min(n, 30); e++) {
            const code = st.hill[Math.floor(ihash(st.seed, st.step, 700 + e, 1) * st.hill.length)];
            addHill(st, null, 1 + Math.floor(ihash(st.seed, st.step, 700 + e, 2) * 3), fx, code);
        }
    }
    // điều ước
    if (st.gt > 120) refreshWishes(st);
    // ở cùng nhau thì gắn kết tăng dần (2 điểm/phút); người kia chưa từng vào vườn thì một mình cũng tăng, nhưng chậm một nửa
    const bond = together ? 1 : awake && !bothJoined ? 0.5 : 0;
    if (bond) { st.bondT += STEP * bond; while (st.bondT >= 30) { st.bondT -= 30; addXp(st, 1, fx, ctx); } }
    // sự kiện ngẫu nhiên: hết hạn thì kết thúc; mỗi phút mới có thể xảy ra một sự kiện
    if (st.ev && st.gt >= st.ev.end) endEvent(st, fx);
    const mn = Math.floor(st.gt / 60);
    if (mn !== st.evMin) { st.evMin = mn; if (awake && !st.ev && !st.fw && !st.liftAt && st.gt > 150 && ihash(st.seed, mn, 501, 1) < 0.3) rollEvent(st, ctx, fx); }
}

/** Cho thời gian trôi tới `nowMs`. online: các vai đang trong vườn. Trả về các sự kiện (nở, héo, sâu...). */
export function advance(st, nowMs, online, ctx = {}) {
    const fx = [];
    if (!st.real) { st.real = nowMs; return fx; }
    const dt = (nowMs - st.real) / 1000;
    if (dt <= 0) return fx;
    st.real = nowMs;
    st.acc = Math.min(6 * 3600, st.acc + dt * (online.length ? 1 : SLEEP_RATE) * (st.speed || 1)); // speed: chỉ đổi qua menu cheat
    const together = online.includes('gui') && online.includes('nhan');
    let n = 0;
    while (st.acc >= STEP && n++ < 20000) { st.acc -= STEP; stepSim(st, together, online.length > 0, ctx, fx); }
    return fx;
}

// dùng một công trình trong vườn (ACTS). Trả về fx hoặc null nếu không dùng được.
function useItem(st, role, k, together, fx, ctx) {
    const A = ACTS[k], C = cnt(st), P = st.plots; st.busyAt ||= {};
    if (!A || !has(st, k) || cdLeft(st, k) > 0) return null;
    if (A.night && !isNight(st.gt)) return null;
    let info = {};
    switch (k) {
        case 'thung': if (st.inv.compost < 3) return null; st.inv.compost -= 3; st.inv.fert++; break;
    }
    if (A.cd) st.cd[k] = st.gt + A.cd;
    st.busyAt ||= {}; st.busyAt[k] = st.gt;
    wishTick(st, 'use', null, fx, ctx);
    return { k: 'use', item: k, ...info };
}

/**
 * Hành động của người chơi `role` (sau khi đã advance tới hiện tại).
 * ctx: { mode, notesTotal, online, cheats }. Trả về { changed, fx: [hiệu ứng], others: [tin chỉ chuyển cho người kia] }
 */
export function apply(st, role, m, now, ctx = {}) {
    const fx = [], others = [], R = { changed: false, fx, others };
    if (!m || typeof m.type !== 'string' || !ROLES.includes(role)) return R;
    const online = ctx.online || [role], together = online.includes('gui') && online.includes('nhan'), bothJoined = st.joined.gui && st.joined.nhan;
    const P = Number.isInteger(m.i) && m.i >= 0 && m.i < st.plots.length ? st.plots[m.i] : null, i = m.i, C = cnt(st);
    st.tools ||= {}; st.inv.phanvang ||= 0; st.cd ||= {}; st.until ||= {}; st.mail ||= {};
    const ok = (f) => { R.changed = true; f.role = role; fx.push(f); };
    const busy = st.fw || st.liftAt;
    switch (m.type) {
        case 'expand': { // mua thêm một luống (phải nằm cạnh luống đã có)
            if (!P || busy || !canExpand(st, i)) break;
            const price = plotPrice(st); if (st.inv.dew < price) break;
            st.inv.dew -= price; reset(P, { st: 'wild', dig: 0 }); ok({ k: 'expand', i, price, n: ownedPlots(st) });
            break;
        }
        case 'dig':
            if (!P || busy) break;
            if (P.st === 'wild') { P.dig = (P.dig || 0) + 1; if (P.dig >= DIG_TAPS) { reset(P); st.inv.compost++; ok({ k: 'cleared', i }); } else ok({ k: 'dig', i, n: P.dig }); }
            else if (P.st === 'dead') { reset(P, { left: LEAVE_GRACE }); st.inv.compost += 2; ok({ k: 'cleared', i, compost: 2 }); }
            else if (P.weed > 0 && P.st !== 'locked') { P.weed = 0; st.inv.compost++; ok({ k: 'pull', i }); }
            break;
        case 'plant':
            if (!P || busy || P.st !== 'soil' || !SPECIES[m.sp] || !(st.inv.seeds[m.sp] > 0)) break;
            C.plant[role]++; plantAt(st, i, m.sp);
            ok({ k: 'plant', i, sp: m.sp, shiny: P.shiny || undefined }); wishTick(st, 'plant', m.sp, fx, ctx);
            { // hoa ghép đôi: người kia vừa gieo ở luống kề bên trong 5 giây
                const L = st.lastPlant, Q = L && st.plots[L.i];
                if (L && L.role !== role && now - L.at < HYBRID_MS && neighbors(i).includes(L.i) && Q.st === 'plant' && Q.sp === L.sp && !Q.hy && Q.g < 0.2 && m.sp !== 'songtam' && L.sp !== 'songtam') {
                    const key = hybridKey(m.sp, L.sp); P.hy = Q.hy = key; st.lastPlant = null;
                    addXp(st, 3, fx, ctx); fx.push({ k: 'hybrid', i, j: L.i, hy: key, role });
                } else st.lastPlant = { i, role, sp: m.sp, at: now };
            }
            break;
        case 'water':
            if (!P || busy || P.st !== 'plant') break;
            P.w = Math.min(1, P.w + 0.7); C.water[role]++;
            if (st.tools.binhto) for (const n of neighbors(i)) { const Q = st.plots[n]; if (Q.st === 'plant') Q.w = Math.min(1, Q.w + 0.4); }
            if (st.lastWater && st.lastWater.i === i && st.lastWater.role !== role && now - st.lastWater.at < 3000) { // hai người cùng tưới một cây
                P.q = Math.min(2, P.q + 0.15); st.stats.combos++; st.lastWater = null; addXp(st, 5, fx, ctx); addHill(st, P.sp, 1, fx); ok({ k: 'combo', i }); wishTick(st, 'combo', null, fx, ctx);
            } else { st.lastWater = { i, role, at: now }; ok({ k: 'water', i }); }
            wishTick(st, 'water', null, fx, ctx);
            { // tưới nối tiếp: người kia vừa tưới luống kề bên (lần trước) dưới 3 giây
                const c = st.chain;
                if (c && c.role !== role && now - c.at < CHAIN_MS && neighbors(i).includes(c.i)) {
                    const n = c.n + 1; st.chain = { i, role, at: now, n };
                    const bonus = Math.min(12, n * 2); st.inv.dew += bonus; C.dew += bonus; if (n >= 3) addXp(st, 1, fx, ctx); if (n >= 4) addHill(st, P.sp, 1, fx);
                    if (n % 5 === 0) st.inv.dew += 10 * n / 5;
                    st.stats.chain = Math.max(st.stats.chain || 0, n);
                    fx.push({ k: 'chain', i, from: c.i, n, bonus, role });
                } else st.chain = { i, role, at: now, n: 1 };
            }
            break;
        case 'fert': { // m.kind: 'fert' (mặc định) hoặc 'phanvang'
            const gold = m.kind === 'phanvang';
            if (!P || busy || P.st !== 'plant' || P.bloom || (gold ? st.inv.phanvang : st.inv.fert) < 1) break;
            if (gold) { st.inv.phanvang--; P.f += 240; P.q = Math.min(2, P.q + 0.6); } else { st.inv.fert--; P.f += 150; P.q = Math.min(2, P.q + 0.3); }
            P.fed = true;
            ok({ k: 'fert', i, gold });
            break;
        }
        case 'bug':
            if (!P || !P.bug) break;
            P.bug = 0; st.inv.dew += 2; C.dew += 2;
            ok({ k: 'bugged', i }); wishTick(st, 'bug', null, fx, ctx);
            break;
        case 'harvest':
            if (!P || busy || P.st !== 'plant' || !P.bloom) break;
            R.changed = true; harvestPlot(st, i, role, together, fx, ctx);
            break;
        case 'buy': {
            const it = m.item || '', n = Math.max(1, Math.min(10, m.n | 0 || 1)), I = SHOP[it];
            if (it.startsWith('seed:')) {
                const sp = it.slice(5), S = SPECIES[sp];
                if (!S || !S.price || st.inv.dew < S.price * n) break;
                st.inv.dew -= S.price * n; giveSeed(st, sp, n); ok({ k: 'buy', item: it, n });
            } else if (!I) break;
            else if (it === 'tuihat') { // 2 hạt ngẫu nhiên, nghiêng về loài rẻ
                if (st.inv.dew < I.price) break;
                st.inv.dew -= I.price;
                const got = [0, 1].map(k => randomSeed(st, k, now % 100000)); got.forEach(s => giveSeed(st, s));
                ok({ k: 'buy', item: it, got });
            } else if (I.kind === 'use') { if (st.inv.dew < I.price * n) break; st.inv.dew -= I.price * n; st.inv[it] = (st.inv[it] || 0) + n; ok({ k: 'buy', item: it, n }); }
            else if (I.kind === 'tool') { if (st.tools[it] || st.inv.dew < I.price) break; st.inv.dew -= I.price; st.tools[it] = true; ok({ k: 'buy', item: it }); }
            else { if (st.decor[it] || st.inv.dew < I.price || (I.need && !st.decor[I.need])) break; st.inv.dew -= I.price; st.decor[it] = true; ok({ k: 'buy', item: it }); }
            break;
        }
        case 'use': { // bấm vào công trình trong vườn
            if (busy) break;
            const f = useItem(st, role, m.item, together, fx, ctx);
            if (f) ok(f);
            break;
        }
        case 'compost': { const f = useItem(st, role, 'thung', together, fx, ctx); if (f) ok(f); break; }
        case 'letter': { // giấy ghi chú: mỗi người một tờ; người kia đọc xong mới viết được tờ mới
            const tx = String(m.tx || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 240);
            const mine = st.mail[role];
            if (!tx || !st.decor.giay || (mine && !mine.read)) break;
            st.mail[role] = { tx, at: now, read: 0 };
            st.msgs ||= []; st.msgs.push({ r: role, tx, at: now }); if (st.msgs.length > 30) st.msgs.splice(0, st.msgs.length - 30);
            ok({ k: 'letter' });
            break;
        }
        case 'read': { // đọc tờ ghi chú người kia gửi
            const L = st.mail[other(role)];
            if (!L || L.read) break;
            L.read = now; ok({ k: 'read' });
            break;
        }
        case 'ev': // chạm vào sự kiện đang diễn ra
            if (!st.ev || !EVENTS[st.ev.k].tap) break;
            R.changed = true; resolveEvent(st, role, together, fx, ctx);
            break;
        case 'star': {
            const s = starAt(st);
            if (!s) break;
            st.starCaught = s.min; st.stats.stars++;
            const seedGift = ihash(st.seed, s.min, 78, 1) < 0.3;
            if (seedGift) giveSeed(st, 'songtam'); else { st.inv.dew += 25; C.dew += 25; }
            addXp(st, 5, fx, ctx); ok({ k: 'star', gift: seedGift ? 'songtam' : 'dew' }); wishTick(st, 'star', null, fx, ctx);
            break;
        }
        case 'finale':
            if (!canFinale(st) || st.fw) break;
            st.fw = true; st.swipes = { gui: 0, nhan: 0 }; st.liftAt = 0; st.ev = null; ok({ k: 'finale' });
            break;
        case 'swipe':
            if (!st.fw || st.liftAt) break;
            st.swipes[role]++; R.changed = true; fx.push({ k: 'swipe', role });
            if (st.swipes.gui + st.swipes.nhan >= 6 && (!bothJoined || (st.swipes.gui > 0 && st.swipes.nhan > 0))) { st.liftAt = now; st.fw = false; st.done = true; fx.push({ k: 'lift' }); }
            break;
        case 'answer':
            if (ctx.mode !== 'to-tinh' || role !== 'nhan' || !st.done || !['yes', 'think'].includes(m.v)) break;
            st.answer = { v: m.v, at: now }; R.changed = true; fx.push({ k: 'answer', role });
            break;
        case 'cheat': { // menu thử nghiệm (mã Konami) — chỉ khi config.js bật cheats, hoặc chơi thử /play
            if (!ctx.cheats) break;
            const plants = st.plots.filter(p => p.st === 'plant');
            switch (m.what) {
                case 'dew': st.inv.dew += 500; break;
                case 'items': st.inv.fert += 10; st.inv.phanvang += 5; st.inv.compost += 30; break;
                case 'seeds': for (const s of SPECIES_ORDER) giveSeed(st, s, 5); break;
                case 'care': for (const p of st.plots) { if (p.st === 'plant') { p.w = 1; p.bug = 0; p.hp = 1; p.fed = true; } if (p.st !== 'locked') p.weed = 0; } break;
                case 'clear': for (const p of st.plots) if (p.st === 'wild' || p.st === 'dead') reset(p); break;
                case 'land': for (const p of st.plots) if (p.st === 'locked' || p.st === 'wild') reset(p); break;
                case 'unlock': st.decor.giay = st.decor.thung = true; break;
                case 'wish': refreshWishes(st); for (const w of st.wishes) if (!w.done) { w.have = w.n - 1; } break;
                case 'shiny': for (const p of plants) p.shiny = true; break;
                case 'cooldown': st.cd = {}; break;
                case 'event': if (st.ev) endEvent(st, fx); if (rollEvent(st, ctx, fx, EVENTS[m.n] ? m.n : null) === false) fx.push({ k: 'evNo', ev: m.n }); break;
                case 'grow': for (const p of plants) if (!p.bloom) { Object.assign(p, { g: 1, bloom: true, age: 0, w: Math.max(p.w, 0.5) }); if (!st.book[p.sp]) fx.push({ k: 'newsp', sp: p.sp }); st.book[p.sp] = (st.book[p.sp] || 0) + 1; } break;
                case 'time': st.acc += +m.n > 0 ? Math.min(3600, +m.n) : 60; break;
                case 'night': st.gt = Math.floor(st.gt / DAY) * DAY + (isNight(st.gt) ? DAY : NIGHT_AT); break;
                case 'day': st.gt = Math.floor(st.gt / DAY) * DAY + (isNight(st.gt) ? DAY : 0) + 30; break;
                case 'weather': { const want = m.n; st.wxo = null; for (let k = 1; k < 400; k++) { const g = st.gt + k * WEATHER_LEN; if (weatherAt(st, g) === want) { st.gt = Math.floor(g / WEATHER_LEN) * WEATHER_LEN + 2; break; } } break; }
                case 'speed': st.speed = [1, 5, 20].includes(+m.n) ? +m.n : 1; break;
                case 'xp': addXp(st, Math.max(50, Math.round((xpFor(st.lvl + 1) - xpFor(st.lvl)) * 0.6)), fx, ctx); break;
                case 'book': for (const s of SPECIES_ORDER) st.book[s] = st.book[s] || 1; break;
                case 'peak': st.peak = Math.max(st.peak || 0, FULL_BLOOM); break;
                case 'note': unlockNote(st, fx, ctx); break;
                case 'hill': for (let k = 0; k < 100; k++) addHill(st, SPECIES_ORDER[k % 19], 3, fx); break;
                case 'hillfull': while ((st.hill || '').length < HILL_MAX) addHill(st, SPECIES_ORDER[st.hill.length % 19], 1, fx); break;
                case 'hillclear': st.hill = ''; break;
                case 'finale': for (const s of SPECIES_ORDER) st.book[s] = st.book[s] || 1; st.peak = Math.max(st.peak || 0, FULL_BLOOM); if (st.lvl < 3) addXp(st, xpFor(3) - st.xp, fx, ctx); break;
                case 'unanswer': st.answer = null; break;
                case 'unlift': st.liftAt = 0; st.fw = false; st.done = false; break;
                default: return R;
            }
            R.changed = true; fx.push({ k: 'cheat', what: m.what, role });
            break;
        }
        case 'restart': { // trồng lại từ đầu (giữ câu trả lời, giấy ghi chú và việc đã từng vào vườn)
            const f = freshState(st.seed, st); Object.keys(st).forEach(k => delete st[k]); Object.assign(st, f, { real: now }); R.changed = true; fx.push({ k: 'restart', role });
            break;
        }
        case 'radio': { // radio YouTube nghe chung: hàng chờ q (mã video), bài i, đang phát, vị trí pos (giây) đo lúc `at` (giờ máy chủ)
            const r = st.radio ||= { q: [], i: 0, play: false, pos: 0, at: now, list: '', start: '', rev: 0, by: '' };
            const idOk = x => typeof x === 'string' && /^[\w-]{11}$/.test(x), n = r.q.length, posNow = () => r.play ? r.pos + (now - r.at) / 1000 : r.pos;
            const go = j => { r.i = j; r.pos = 0; r.play = true; r.at = now; }, t = Math.max(0, Math.min(36000, +m.t || 0));
            switch (m.op) {
                case 'add': if (!idOk(m.v) || n >= 200) return R; if (r.list) { r.q = []; r.list = ''; } r.q.push(m.v); if (r.q.length === 1 || m.now) go(r.q.length - 1); break;
                case 'list': if (!/^[\w-]{10,64}$/.test(m.list || '')) return R; Object.assign(r, { list: m.list, start: idOk(m.v) ? m.v : '', q: [], i: 0, pos: 0, play: true, at: now }); break;
                case 'items': if (!r.list || n || !Array.isArray(m.ids)) return R; r.q = m.ids.filter(idOk).slice(0, 200); if (!r.q.length) return R; go(Math.max(0, r.q.indexOf(r.start))); break;
                case 'play': if (!n) return R; r.pos = m.t !== undefined ? t : posNow(); r.play = true; r.at = now; break;
                case 'pause': r.pos = m.t !== undefined ? t : posNow(); r.play = false; r.at = now; break;
                case 'seek': r.pos = t; r.at = now; break;
                case 'go': if (!(m.i >= 0 && m.i < n)) return R; go(m.i | 0); break;
                case 'next': case 'prev': if (!n) return R; go((r.i + (m.op === 'next' ? 1 : -1) + n) % n); break;
                case 'end': if (m.i !== r.i || !n) return R; go((r.i + 1) % n); break; // hết bài (hoặc bài lỗi): sang bài sau, hết danh sách thì quay vòng
                case 'remove': { const j = m.i | 0; if (!(j >= 0 && j < n)) return R; r.q.splice(j, 1); if (!r.q.length) { r.play = false; r.i = 0; r.list = ''; } else if (j < r.i) r.i--; else if (j === r.i) go(Math.min(j, r.q.length - 1)); break; }
                case 'clear': Object.assign(r, { q: [], i: 0, play: false, pos: 0, list: '', start: '' }); break;
                default: return R;
            }
            r.rev++; if (m.op !== 'end' && m.op !== 'items') r.by = role; R.changed = true; fx.push({ k: 'radio', op: m.op, role, v: m.v });
            break;
        }
        case 'wind': { const wx = +m.wx, wy = +m.wy; if (isFinite(wx) && isFinite(wy)) others.push({ type: 'wind', role, wx: Math.max(-1, Math.min(1, wx)), wy: Math.max(-1, Math.min(1, wy)) }); break; }
        case 'cur': { const x = +m.x, y = +m.y; if (x >= 0 && x <= 1 && y >= 0 && y <= 1) others.push({ type: 'cur', role, x, y }); break; }
    }
    return R;
}
