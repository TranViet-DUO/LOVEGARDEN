// Kết nối khu vườn chung.
//  - Online: WebSocket tới /ws/<slug> (máy chủ Durable Object giữ trạng thái, tự kết nối lại khi rớt mạng, đồng bộ lại mỗi 15 giây).
//  - Chơi thử (/play): "khu vườn ảo" chạy cùng luật chơi ngay trong trình duyệt, lưu tạm trong máy (localStorage).
// Cả hai có dạng { send(msg), get live() } và gọi onMessage(msg) cho mọi tin từ "máy chủ".
import { advance, apply, freshState, V } from './rules.js';

export function connectGarden(slug, onMessage, onStatus = () => { }) {
    let ws = null, live = false, wait = 500, queue = [], timer = 0;
    const open = () => {
        ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/${encodeURIComponent(slug)}`);
        ws.onopen = () => { live = true; wait = 500; onStatus(true); for (const m of queue.splice(0)) ws.send(m); clearInterval(timer); timer = setInterval(() => ws.readyState === 1 && ws.send('{"type":"sync"}'), 15000); };
        ws.onmessage = e => { try { const m = JSON.parse(e.data); if (m.type !== 'pong') onMessage(m); } catch { } };
        ws.onclose = () => { live = false; onStatus(false); clearInterval(timer); setTimeout(open, wait); wait = Math.min(8000, wait * 1.8); };
    };
    open();
    addEventListener('visibilitychange', () => { if (!document.hidden && ws.readyState === 1) ws.send('{"type":"sync"}'); });
    return {
        get live() { return live; },
        send(m) { const s = JSON.stringify(m); if (live) ws.send(s); else if (!['cur', 'wind', 'sync'].includes(m.type) && queue.length < 50) queue.push(s); }
    };
}

export function localGarden(role, card, notes, onMessage) {
    const KEY = 'vuon-hoa-thu', ctx = { mode: card.mode, notesTotal: notes.length, online: [role], cheats: true };
    let st = null;
    try { st = JSON.parse(localStorage.getItem(KEY)); } catch { }
    if (!st || st.v !== V) st = freshState(+card.seed || 1);
    st.joined = { [role]: true };
    const emit = fx => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { } onMessage(JSON.parse(JSON.stringify({ type: 'state', st, now: Date.now(), online: [role], fx, notes: notes.slice(0, st.notes) }))); };
    advance(st, Date.now(), [], ctx); // thời gian vắng mặt trôi chậm (vườn ngủ)
    setTimeout(() => emit([]));
    addEventListener('pagehide', () => { advance(st, Date.now(), [role], ctx); try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { } });
    return {
        live: true,
        send(m) {
            if (m.type === 'cur' || m.type === 'wind') return;
            const fx = advance(st, Date.now(), [role], ctx);
            if (m.type === 'sync') return emit([]);
            const r = apply(st, role, m, Date.now(), ctx);
            if (r.changed || fx.length) emit(r.fx);
        }
    };
}
