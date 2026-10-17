// Cân bằng game: cho "bot" chăm vườn theo luật thật (public/js/rules.js) và đo thời gian tới Lễ hội hoa.
//   npm run balance            -> so sánh 1 người / 2 người
// Bot chơi khá chăm (mỗi người 1 thao tác mỗi `gap` giây) nhưng không hoàn hảo: thỉnh thoảng "đi vắng".
import { freshState, advance, apply, starAt, canFinale, bookCount, plotPrice, ownedPlots, canExpand, cdLeft, has, SPECIES, SPECIES_ORDER, SHOP, ACTS, EVENTS, FULL_BLOOM, BOOK_GOAL, HILL_MAX } from '../public/js/rules.js';

function play(players, { gap = 2.5, away = 0.12, seed = 7, limitMin = 240 } = {}) {
    const st = freshState(seed), roles = players === 2 ? ['nhan', 'gui'] : ['nhan'];
    for (const r of roles) st.joined[r] = true;
    let now = 1e12; advance(st, now, roles);
    const ctx = { mode: 'cam-on', notesTotal: 5 };
    const log = { died: 0, rewild: 0, ev: 0 }, next = Object.fromEntries(roles.map(r => [r, now]));
    let lastLvl = 0;
    for (let sec = 0; sec < limitMin * 60; sec += 0.5) {
        now += 500;
        for (const f of advance(st, now, roles, ctx)) { if (f.k === 'die') log.died++; if (f.k === 'rewild') log.rewild++; if (f.k === 'ev') log.ev++; }
        if (!log.book && bookCount(st) >= BOOK_GOAL) log.book = Math.round(sec / 60);
        if (!log.ro && st.peak >= FULL_BLOOM) log.ro = Math.round(sec / 60);
        if (!log.p10 && ownedPlots(st) >= 10) log.p10 = Math.round(sec / 60);
        if (st.lvl !== lastLvl) { lastLvl = st.lvl; log['lv' + st.lvl] = Math.round(sec / 60); }
        if (!log.h30 && sec % 60 === 0 && sec / 60 === 30) log.h30 = Math.round((st.hill || '').length / HILL_MAX * 100) + '%';
        if (canFinale(st)) return { min: Math.round(sec / 60), ...log, plots: ownedPlots(st), hill: Math.round((st.hill || '').length / HILL_MAX * 100) + '%', dew: st.inv.dew, harvest: st.stats.harvest, combos: st.stats.combos };
        for (const r of roles) {
            if (now < next[r]) continue;
            next[r] = now + gap * 1000 * (Math.random() < away ? 12 : 1); // thỉnh thoảng bận việc khác
            const act = m => apply(st, r, m, now, { ...ctx, online: roles }).changed;
            const plants = st.plots.map((P, i) => [P, i]);
            const pick = f => plants.find(([P, i]) => f(P, i));
            let p;
            if (starAt(st) && act({ type: 'star' })) continue;
            if (st.inv.compost >= 3 && st.decor.thung && act({ type: 'compost' })) continue;
            if (st.ev && EVENTS[st.ev.k].tap && Math.random() < 0.6 && act({ type: 'ev' })) continue;
            if ((p = pick(P => P.bug)) && act({ type: 'bug', i: p[1] })) continue;
            const hoard = bookCount(st) >= BOOK_GOAL && st.peak < FULL_BLOOM; // đủ bộ sưu tập rồi: giữ hoa lại cho vườn nở rộ
            if ((p = pick(P => P.bloom && (!hoard || P.faded))) && act({ type: 'harvest', i: p[1] })) continue;
            // nước: cây khát nhất; hai người cố tưới cùng cây để ăn combo
            const thirsty = plants.filter(([P]) => P.st === 'plant' && P.w < Math.max(0.4, (SPECIES[P.sp].minWater || 0) + 0.15)).sort((a, b) => a[0].w - b[0].w)[0];
            if (thirsty && act({ type: 'water', i: thirsty[1] })) continue;
            if ((p = pick(P => P.st === 'dead' || P.weed > 0.3)) && act({ type: 'dig', i: p[1] })) continue;
            const soil = pick(P => P.st === 'soil');
            // mở rộng vườn: ưu tiên khi vườn còn nhỏ hoặc hết chỗ trống
            if ((!soil || ownedPlots(st) < (bookCount(st) >= BOOK_GOAL ? 16 : 12)) && ownedPlots(st) < 25 && st.inv.dew >= plotPrice(st) + (soil ? 15 : 5)) { const i = st.plots.findIndex((_, i) => canExpand(st, i)); if (i >= 0 && act({ type: 'expand', i })) continue; }
            if (soil) {
                const need = SPECIES_ORDER.filter(s => !st.book[s] && !st.plots.some(P => P.sp === s));
                const owned = Object.keys(st.inv.seeds).filter(s => st.inv.seeds[s] > 0 && !(hoard && SPECIES[s].grow > 8)).sort((a, b) => (need.includes(b) - need.includes(a)) || SPECIES[b].reward - SPECIES[a].reward);
                if (owned.length && act({ type: 'plant', i: soil[1], sp: owned[0] })) continue;
                const buy = hoard ? ['cuc', 'vantho', 'tulip'].find(s => SPECIES[s].price <= st.inv.dew) : need.find(s => SPECIES[s].price && SPECIES[s].price <= st.inv.dew) || SPECIES_ORDER.filter(s => SPECIES[s].price && SPECIES[s].price <= st.inv.dew).sort((a, b) => SPECIES[b].reward / SPECIES[b].grow - SPECIES[a].reward / SPECIES[a].grow)[0];
                if (buy && act({ type: 'buy', item: 'seed:' + buy })) continue;
            }
            if ((p = pick(P => P.st === 'wild')) && act({ type: 'dig', i: p[1] })) continue;
            if (st.inv.fert > 0 && (p = pick(P => P.st === 'plant' && !P.bloom && P.f <= 0 && P.g < 0.7)) && act({ type: 'fert', i: p[1] })) continue;
            if (ownedPlots(st) >= 6) for (const it of ['thung', 'binhto', 'keovang']) if (!st.decor[it] && !(st.tools || {})[it] && st.inv.dew > SHOP[it].price + 60 && act({ type: 'buy', item: it })) break;
        }
    }
    return { min: '>' + limitMin, ...log, dewEnd: st.inv.dew, price: plotPrice(st), states: st.plots.map(P => P.st === 'plant' ? (P.bloom ? (P.faded ? 'F' : 'B') : P.sp.slice(0,2)) : P.st[0]).join(''), plots: ownedPlots(st), book: bookCount(st), lvl: st.lvl, peak: st.peak, hill: Math.round((st.hill || '').length / HILL_MAX * 100) + '%' };
}

for (const players of [2, 1]) {
    const runs = Array.from({ length: 5 }, (_, k) => play(players, { seed: 11 + k }));
    console.log(`\n${players} người:`);
    for (const r of runs) console.log('  ', JSON.stringify(r));
}
