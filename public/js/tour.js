// Hướng dẫn từng bước (tour): làm tối màn hình, khoét một "vùng sáng" quanh thứ cần chú ý, kèm thẻ lời dẫn.
// Người chơi thao tác thật ngay trên vùng sáng; bước có `wait` tự chuyển khi họ làm đúng việc đó — kể cả khi họ đã làm từ trước
// (mọi việc làm trong lúc hướng dẫn đều được ghi nhớ). Khi đang mở bảng / lá thư, hướng dẫn tạm ẩn rồi hiện lại khi đóng.
//   const tour = createTour(steps, { onEnd, onStep }); tour.start(); tour.notify('plant');
//   step = { title, text, target?: () => {x,y,w,h} (toạ độ trong khung #app) | Element | null, wait?: tên sự kiện }
const KEY = 'vuon-hoa-tour-v3';
export const tourDone = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

export function createTour(steps, { onEnd = () => { }, onStep = () => { } } = {}) {
    let i = -1, raf = 0, seen = new Set(), advancing = false;
    const host = document.getElementById('app') || document.body;
    const root = document.createElement('div');
    root.id = 'tour'; root.hidden = true;
    root.innerHTML = `<div class="spot"></div><div class="card"><p class="title"></p><p class="text"></p>
        <div class="row"><span class="dots"></span><button class="skip">Bỏ qua</button><button class="next">Tiếp →</button></div></div>`;
    host.appendChild(root);
    const spot = root.querySelector('.spot'), card = root.querySelector('.card');
    for (const ev of ['pointerdown', 'pointerup', 'pointermove']) card.addEventListener(ev, e => e.stopPropagation());
    root.querySelector('.next').onclick = () => go(i + 1);
    root.querySelector('.skip').onclick = () => end(false);

    const covered = () => !!document.querySelector('#sheet:not([hidden]), #letter:not([hidden]), #away:not([hidden]), #radio:not(.closed)');
    function rectOf(tg) {
        const r = typeof tg === 'function' ? tg() : tg;
        if (!r) return null;
        if (r instanceof Element) { const b = r.getBoundingClientRect(), a = host.getBoundingClientRect(); return { x: b.left - a.left, y: b.top - a.top, w: b.width, h: b.height }; }
        return r;
    }
    function place() {
        if (i < 0) return;
        root.style.visibility = covered() ? 'hidden' : 'visible';
        const s = steps[i], r = rectOf(s.target), pad = 8, W = host.clientWidth, H = host.clientHeight;
        if (r) Object.assign(spot.style, { left: r.x - pad + 'px', top: r.y - pad + 'px', width: r.w + pad * 2 + 'px', height: r.h + pad * 2 + 'px', borderRadius: '16px' });
        else Object.assign(spot.style, { left: W / 2 + 'px', top: H / 2 + 'px', width: '0px', height: '0px', borderRadius: '50%' });
        const ch = card.offsetHeight, cw = Math.min(W - 24, 360);
        let top = r ? (r.y + r.h / 2 > H / 2 ? r.y - pad - ch - 12 : r.y + r.h + pad + 12) : (H - ch) / 2;
        top = Math.max(12, Math.min(H - ch - 12, top));
        Object.assign(card.style, { width: cw + 'px', left: (W - cw) / 2 + 'px', top: top + 'px' });
        raf = requestAnimationFrame(place);
    }
    function go(n) {
        cancelAnimationFrame(raf); advancing = false;
        if (n >= steps.length) return end(true);
        i = n; const s = steps[i];
        root.querySelector('.title').textContent = s.title || '';
        root.querySelector('.text').innerHTML = s.text;
        root.querySelector('.next').textContent = i === steps.length - 1 ? 'Bắt đầu chơi 🌸' : s.wait ? 'Bỏ qua bước này' : 'Tiếp →';
        root.querySelector('.dots').textContent = `${i + 1}/${steps.length}`;
        root.hidden = false; onStep(s);
        place();
        if (s.wait && seen.has(s.wait)) later(1400); // đã làm việc này từ trước: khen một chút rồi sang bước sau
    }
    function later(ms) { if (advancing) return; advancing = true; const at = i; card.classList.add('done'); setTimeout(() => { card.classList.remove('done'); if (i === at) go(i + 1); }, ms); }
    function end(finished) {
        cancelAnimationFrame(raf); root.hidden = true; i = -1;
        try { localStorage.setItem(KEY, '1'); } catch { }
        onEnd(finished);
    }
    return {
        get active() { return i >= 0; },
        start() { seen = new Set(); go(0); },
        stop: () => end(false),
        notify(ev) { if (!ev || i < 0) return; seen.add(ev); if (steps[i].wait === ev) later(ev.startsWith('open:') ? 300 : 700); }
    };
}
