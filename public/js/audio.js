// Âm thanh lofi tự tạo bằng Web Audio (không cần file nhạc):
//   - nhạc nền: "bài hát" tự soạn liên tục — mỗi đoạn 8 ô nhịp đổi vòng hợp âm (5 vòng), kiểu đoạn (mở đầu / nhịp / giai điệu / nghỉ trống),
//     nhịp độ 66–78 BPM, mẫu trống, tiếng đàn (piano điện / đàn rải), giai điệu là một motif 4 nốt lặp có biến tấu;
//     ban đêm nhạc nhẹ và trầm hơn. Tiếng đĩa than rè rè, cả bản đi qua bộ lọc thấp cho "chill"
//   - âm thanh cảnh: mưa (khi mưa/giông), dế kêu ban đêm, gió thoảng (theo độ mạnh của gió)
//   - hiệu ứng nhỏ: chạm, tưới, gieo, hái, lên cấp, sao băng, lá thư
// Trình duyệt chỉ cho phát âm thanh sau lần chạm đầu tiên -> gọi audio.unlock() trong sự kiện chạm.
const KEY = 'vuon-hoa-sound';
let ctx = null, master, music, sfxBus, amb, noiseBuf, nextBar = 0, bar = 0, timer = 0, on = true;
let sfxOn = true, musicVol = 1, ducked = false; // ducked: radio đang phát -> tắt nhạc lofi, hiệu ứng & âm thanh cảnh còn 50%
try { on = localStorage.getItem(KEY) !== 'off'; sfxOn = localStorage.getItem(KEY + '-sfx') !== 'off'; musicVol = +(localStorage.getItem(KEY + '-music') ?? 1); } catch { }
const amb3 = {}; // nguồn âm cảnh
const PROGS = [ // vòng hợp âm (MIDI)
    [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],   // Fmaj7 Em7 Dm7 Cmaj7
    [[57, 60, 64, 67], [50, 54, 57, 60], [55, 59, 62, 66], [48, 52, 55, 59]],   // Am7 D7 Gmaj7 Cmaj7
    [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [57, 60, 64, 67]],   // Dm7 G7 Cmaj7 Am7
    [[55, 59, 62, 66], [47, 50, 54, 57], [52, 55, 59, 62], [48, 52, 55, 59]],   // Gmaj7 Bm7 Em7 Cmaj7
    [[52, 55, 59, 62], [57, 60, 64, 67], [50, 53, 57, 60], [55, 59, 62, 65]]    // Em7 Am7 Dm7 G7
];
const PENTA = [72, 74, 76, 79, 81, 84];
let night = false, sec = null, secBar = 0, secN = 0, BEAT = 60 / 72, BAR = BEAT * 4;
const KINDS = ['intro', 'groove', 'melody', 'groove', 'break', 'melody', 'arp'];
function newSection() { // chọn đoạn nhạc tiếp theo
    const prev = sec;
    const prog = (() => { let k; do k = Math.floor(rnd() * PROGS.length); while (prev && k === prev.prog); return k; })();
    const kind = secN === 0 ? 'intro' : KINDS[1 + Math.floor(rnd() * (KINDS.length - 1))];
    const bpm = 66 + Math.floor(rnd() * 12) - (night ? 6 : 0);
    const motif = Array.from({ length: 4 }, () => [Math.floor(rnd() * 5), [0, 0.5, 1, 1.5, 2, 2.5, 3][Math.floor(rnd() * 7)]]); // [bậc ngũ cung, phách]
    sec = { prog, kind, bpm, motif, drums: Math.floor(rnd() * 3), tone: rnd() };
    BEAT = 60 / bpm; BAR = BEAT * 4; secBar = 0; secN++;
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
let rng = (Date.now() % 2147483646) + 1; const rnd = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);

function init() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = on ? 0.9 : 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.3;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = ducked ? 0 : 0.32 * musicVol; music.connect(lp); lp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = ducked ? 0.225 : 0.45; sfxBus.connect(master);
    amb = ctx.createGain(); amb.gain.value = ducked ? 0.25 : 0.5; amb.connect(master);
    // nhiễu trắng dùng chung (trống, mưa, gió, đĩa than)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    vinyl();
    for (const k of ['rain', 'wind', 'night']) amb3[k] = ambience(k);
    nextBar = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 120);
    return true;
}
function noise(dur, t0, filterType, freq, gain, dest = music, q = 1) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest); src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
}
function tone(freq, t0, dur, { type = 'sine', gain = 0.2, attack = 0.01, dest = music, detune = 0, glide = 0 } = {}) {
    if (dest === sfxBus) detune += (Math.random() - 0.5) * 120; // hiệu ứng: lệch cao độ một chút mỗi lần
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + dur); o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
}
// piano điện: sine + triangle hơi lệch tông (tạo cảm giác băng từ cũ)
function ep(m, t0, dur, gain, tone2 = 0.5) { const w = (rnd() - 0.5) * 14; tone(hz(m), t0, dur, { gain, attack: 0.02, detune: w }); tone(hz(m), t0, dur * 0.7, { type: 'triangle', gain: gain * (0.15 + tone2 * 0.4), attack: 0.01, detune: w - 6 }); tone(hz(m + 12), t0, dur * 0.3, { gain: gain * 0.12, attack: 0.005 }); }
function schedule() {
    while (nextBar < ctx.currentTime + 0.5) {
        if (!sec || secBar >= 8) newSection();
        const t = nextBar, chord = PROGS[sec.prog][secBar % 4], sw = BEAT * 0.18, K = sec.kind, soft = night ? 0.6 : 1; // swing
        const drums = K !== 'intro' && K !== 'break', dv = (night ? 0.55 : 1);
        // hợp âm
        if (K === 'arp') chord.concat(chord.map(m => m + 12)).forEach((m, i) => tone(hz(m), t + i * BEAT / 2 + (i % 2 ? sw : 0), BEAT * 1.2, { type: 'triangle', gain: 0.035 * soft, attack: 0.005 })); // đàn rải
        else { chord.forEach((m, i) => ep(m, t + i * 0.025, BAR * 0.9, 0.05 * soft, sec.tone)); if (K !== 'intro') chord.slice(1).forEach((m, i) => ep(m + 12, t + BEAT * 2 + sw + i * 0.02, BEAT * 1.5, 0.022 * soft, sec.tone)); }
        // bass
        if (K !== 'intro') { tone(hz(chord[0] - 12), t, BEAT * 1.8, { gain: 0.15 * soft, attack: 0.02 }); if (rnd() < 0.7) tone(hz((rnd() < 0.5 ? chord[2] : chord[0]) - 12), t + BEAT * 2.5 + sw, BEAT * 1.2, { gain: 0.1 * soft, attack: 0.02 }); }
        // trống: 3 kiểu, ô nhịp cuối đoạn có đoạn chuyển
        if (drums) {
            const kicks = [[0, 2.5], [0, 1.5, 2.5], [0, 2]][sec.drums], fill = secBar === 7;
            for (const b of kicks) tone(110, t + b * BEAT + (b % 1 ? sw : 0), 0.32, { gain: 0.3 * dv, attack: 0.002, glide: 42 });
            for (const b of fill ? [1, 3, 3.5] : [1, 3]) noise(0.18, t + b * BEAT + (b % 1 ? sw : 0), 'bandpass', 1800, 0.085 * dv, music, 0.8);
            for (let b = 0; b < 8; b++) if (sec.drums !== 2 || b % 2 === 0) noise(0.04, t + b * BEAT / 2 + (b % 2 ? sw : 0), 'highpass', 7000, (b % 2 ? 0.018 : 0.03) * dv);
        }
        // giai điệu: motif 4 nốt theo hợp âm, lặp với biến tấu; đoạn khác thì thưa thớt
        if (K === 'melody' || K === 'break') for (const [deg, b] of sec.motif) { if (rnd() < (K === 'break' ? 0.45 : 0.85)) { const shift = secBar % 4 === 3 ? 2 : 0; tone(hz(PENTA[(deg + shift) % PENTA.length] - (night ? 12 : 0)), t + b * BEAT + ((b * 2) % 2 ? sw : 0), BEAT * 1.4, { gain: 0.04 * soft, attack: 0.03 }); } }
        else if (K === 'groove') for (let b = 0; b < 8; b++) if (rnd() < 0.08) tone(hz(PENTA[Math.floor(rnd() * PENTA.length)]), t + b * BEAT / 2, BEAT, { gain: 0.03 * soft, attack: 0.03 });
        nextBar += BAR; bar++; secBar++;
    }
}
function vinyl() { // rè rè + tiếng lách tách
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0.012; src.connect(f); f.connect(g); g.connect(music); src.start();
    setInterval(() => { if (ctx && on && Math.random() < 0.5) noise(0.012, ctx.currentTime + Math.random() * 0.3, 'highpass', 2500, 0.05 + Math.random() * 0.05); }, 350);
}
function ambience(kind) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(), g = ctx.createGain(); g.gain.value = 0;
    if (kind === 'rain') { f.type = 'lowpass'; f.frequency.value = 1400; }
    if (kind === 'wind') { f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.7; }
    if (kind === 'night') { f.type = 'highpass'; f.frequency.value = 9000; }
    src.connect(f); f.connect(g); g.connect(amb); src.start();
    return { g, f };
}
let crick = 0;
/** Cập nhật âm thanh cảnh theo khung hình: weather, night (bool), wind (0..1) */
export function scene({ weather, night: isNightNow, wind }) {
    night = !!isNightNow;
    if (!ctx) return;
    const t = ctx.currentTime, set = (k, v) => amb3[k].g.gain.setTargetAtTime(v, t, 0.8);
    set('rain', weather === 'storm' ? 0.5 : weather === 'rain' ? 0.28 : 0);
    set('wind', Math.min(0.25, 0.04 + wind * 0.25) * (weather === 'wind' || weather === 'storm' ? 1.8 : 1));
    amb3.wind.f.frequency.setTargetAtTime(400 + wind * 600, t, 0.5);
    set('night', 0);
    if (night && performance.now() - crick > 900 && Math.random() < 0.5) { // dế kêu
        crick = performance.now();
        for (let k = 0; k < 3; k++) tone(4300 + Math.random() * 300, t + k * 0.07, 0.05, { gain: 0.012, attack: 0.005, dest: amb });
    }
}
const SFX = {
    tap: t => tone(880, t, 0.12, { gain: 0.08, dest: sfxBus }),
    water: t => { for (let k = 0; k < 4; k++) tone(900 - k * 120 + Math.random() * 60, t + k * 0.05, 0.08, { gain: 0.07, dest: sfxBus, glide: 500 }); },
    plant: t => { noise(0.05, t, 'bandpass', 900, 0.15, sfxBus); tone(523, t + 0.03, 0.25, { gain: 0.08, dest: sfxBus }); },
    dig: t => noise(0.09, t, 'lowpass', 600, 0.25, sfxBus),
    harvest: t => [659, 784, 988].forEach((f, k) => tone(f, t + k * 0.07, 0.35, { gain: 0.08, dest: sfxBus })),
    coin: t => { tone(1319, t, 0.15, { gain: 0.06, dest: sfxBus }); tone(1760, t + 0.07, 0.25, { gain: 0.06, dest: sfxBus }); },
    level: t => [523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, t + k * 0.09, 0.5, { gain: 0.07, dest: sfxBus })),
    star: t => { for (let k = 0; k < 6; k++) tone(1568 + k * 220, t + k * 0.05, 0.3, { gain: 0.04, dest: sfxBus }); },
    letter: t => [784, 988, 1175, 988, 1319].forEach((f, k) => tone(f, t + k * 0.16, 0.6, { type: 'triangle', gain: 0.05, dest: sfxBus })),
    bad: t => tone(220, t, 0.3, { type: 'triangle', gain: 0.06, dest: sfxBus, glide: 180 }),
    bug: t => tone(1200, t, 0.08, { type: 'square', gain: 0.02, dest: sfxBus, glide: 1800 }),
    open: t => tone(660, t, 0.1, { type: 'triangle', gain: 0.05, dest: sfxBus }),
    wind: t => noise(0.9, t, 'bandpass', 700, 0.05, sfxBus, 0.6)
};
export const audio = {
    get on() { return on; },
    unlock() { if (!ctx) init(); else if (ctx.state === 'suspended') ctx.resume(); },
    toggle() { on = !on; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { } if (!ctx && on) init(); if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.2); return on; },
    sfx(name) { if (ctx && on && sfxOn && SFX[name]) { SFX[name](ctx.currentTime + 0.01); } },
    get sfxOn() { return sfxOn; },
    duck(v) { v = !!v; if (v === ducked) return; ducked = v; if (!ctx) return; const t = ctx.currentTime; music.gain.setTargetAtTime(v ? 0 : 0.32 * musicVol, t, 0.6); sfxBus.gain.setTargetAtTime(v ? 0.225 : 0.45, t, 0.3); amb.gain.setTargetAtTime(v ? 0.25 : 0.5, t, 0.3); },
    get ducked() { return ducked; },
    setMusic(v) { musicVol = v; if (music && !ducked) music.gain.setTargetAtTime(0.32 * v, ctx.currentTime, 0.3); try { localStorage.setItem(KEY + '-music', v); } catch { } },
    get music() { return musicVol; },
    toggleSfx() { sfxOn = !sfxOn; try { localStorage.setItem(KEY + '-sfx', sfxOn ? 'on' : 'off'); } catch { } return sfxOn; }
};
addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (on) ctx.resume(); });
