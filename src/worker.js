// Cloudflare Worker: phục vụ game (public/) + mỗi khu vườn là một Durable Object giữ trạng thái chung của 2 người, đồng bộ qua WebSocket.
//   /<slug>            -> trang game (public/play.html) của người có slug đó
//   /api/card/<slug>   -> thông tin khu vườn dành cho người đó (không lộ khu vườn khác, không lộ thư chưa mở)
//   /ws/<slug>         -> WebSocket vào khu vườn chung
import { DurableObject } from 'cloudflare:workers';
import CONFIG from '../config.js';
import { advance, apply, freshState, V } from '../public/js/rules.js';

const SLUGS = new Map(), GARDENS = new Map();
for (const g of CONFIG.gardens) {
    if (GARDENS.has(g.id)) throw new Error(`config.js: id "${g.id}" bị trùng`);
    GARDENS.set(g.id, g);
    for (const [role, p] of [['gui', g.sender], ['nhan', g.receiver]]) {
        if (!/^[a-z0-9][a-z0-9-]*$/.test(p.slug)) throw new Error(`config.js: slug "${p.slug}" chỉ được gồm chữ thường không dấu, số, dấu gạch ngang`);
        if (SLUGS.has(p.slug)) throw new Error(`config.js: slug "${p.slug}" bị trùng`);
        SLUGS.set(p.slug, { garden: g, role });
    }
}
const CARD_KEYS = ['mode', 'flowerText', 'message', 'signature', 'question', 'palette', 'customColors', 'center', 'backdrop', 'flowerFont', 'textFont', 'textColor', 'seed'];

export default {
    async fetch(req, env) {
        const url = new URL(req.url), parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
        if (parts[0] === 'api' && parts[1] === 'card') {
            const hit = SLUGS.get(parts[2]);
            if (!hit) return Response.json({ error: 'không có khu vườn này' }, { status: 404 });
            const { garden: g, role } = hit, me = role === 'gui' ? g.sender : g.receiver, partner = role === 'gui' ? g.receiver : g.sender;
            const card = Object.fromEntries(CARD_KEYS.filter(k => g[k] !== undefined).map(k => [k, g[k]]));
            return Response.json({ role, me: me.name, partner: partner.name, sender: g.sender.name, receiver: g.receiver.name, title: CONFIG.title, notesTotal: (g.notes || []).length, cheats: !!CONFIG.cheats, card }, { headers: { 'Cache-Control': 'no-store' } });
        }
        if (parts[0] === 'api' && parts[1] === 'yt') { // tên bài YouTube cho radio (qua oEmbed, không cần khoá API)
            const id = parts[2] || '';
            if (!/^[\w-]{11}$/.test(id)) return Response.json({ error: 'mã video sai' }, { status: 400 });
            try {
                const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`, { cf: { cacheTtl: 86400, cacheEverything: true } });
                if (!r.ok) return Response.json({ title: '' }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
                const j = await r.json();
                return Response.json({ title: j.title || '', author: j.author_name || '' }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
            } catch { return Response.json({ title: '' }); }
        }
        if (parts[0] === 'ws') {
            const hit = SLUGS.get(parts[1]);
            if (!hit) return new Response('Không có khu vườn này', { status: 404 });
            if (req.headers.get('Upgrade') !== 'websocket') return new Response('Cần WebSocket', { status: 426 });
            const stub = env.GARDEN.get(env.GARDEN.idFromName(hit.garden.id));
            return stub.fetch(new Request(`https://garden/?role=${hit.role}&id=${encodeURIComponent(hit.garden.id)}`, req));
        }
        if (parts.length === 1 && SLUGS.has(parts[0])) return env.ASSETS.fetch(new Request(new URL('/play', url), req));
        const res = await env.ASSETS.fetch(req);
        if (res.status !== 404) return res;
        const home = await env.ASSETS.fetch(new Request(new URL('/', url), req));
        return new Response(home.body, { status: 404, headers: home.headers });
    }
};

// Một khu vườn = một Durable Object. Thời gian trong vườn được tính bù mỗi khi có tin nhắn (không cần chạy liên tục).
export class Garden extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        ctx.blockConcurrencyWhile(async () => { this.st = await ctx.storage.get('st'); this.gid = await ctx.storage.get('gid'); });
    }
    get garden() { return GARDENS.get(this.gid) || { mode: 'cam-on', notes: [] }; }
    rctx(online) { const g = this.garden; return { mode: g.mode || 'cam-on', notesTotal: (g.notes || []).length, online, cheats: !!CONFIG.cheats }; }
    online(except) { return [...new Set(this.ctx.getWebSockets().filter(ws => ws !== except).map(ws => ws.deserializeAttachment()?.role).filter(Boolean))]; }
    tick(online) { advance(this.st, Date.now(), online, this.rctx(online)); }
    msg(fx = [], online = this.online()) { return JSON.stringify({ type: 'state', st: this.st, now: Date.now(), online, fx, notes: (this.garden.notes || []).slice(0, this.st.notes) }); }
    broadcast(s, except) { for (const ws of this.ctx.getWebSockets()) if (ws !== except) try { ws.send(s); } catch { } }
    save() { return this.ctx.storage.put('st', this.st); }

    async fetch(req) {
        const url = new URL(req.url), role = url.searchParams.get('role');
        if (!this.gid) { this.gid = url.searchParams.get('id'); await this.ctx.storage.put('gid', this.gid); }
        if (!this.st || this.st.v !== V) this.st = freshState(+this.garden.seed || 1, this.st || {});
        this.tick(this.online()); // thời gian trôi tới giờ (với những người đang có mặt trước đó)
        const [client, server] = Object.values(new WebSocketPair());
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({ role });
        this.st.joined[role] = true;
        await this.save();
        this.broadcast(this.msg([{ k: 'join', role }]));
        return new Response(null, { status: 101, webSocket: client });
    }
    async webSocketMessage(ws, data) {
        if (typeof data !== 'string' || data.length > 12000) return;
        let m; try { m = JSON.parse(data); } catch { return; }
        if (m.type === 'ping') return ws.send('{"type":"pong"}');
        const role = ws.deserializeAttachment()?.role, online = this.online();
        if (m.type === 'sync') { this.tick(online); await this.save(); return ws.send(this.msg([], online)); }
        if (m.type === 'wind' || m.type === 'cur') { for (const o of apply(this.st, role, m, Date.now(), this.rctx(online)).others) this.broadcast(JSON.stringify(o), ws); return; }
        this.tick(online);
        const r = apply(this.st, role, m, Date.now(), this.rctx(online));
        await this.save();
        if (r.changed) this.broadcast(this.msg(r.fx, online));
    }
    async webSocketClose(ws) {
        try { ws.close(); } catch { }
        if (!this.st) return;
        this.tick([...this.online(), ws.deserializeAttachment()?.role].filter(Boolean)); // tính tới lúc rời đi với người vừa rời vẫn có mặt
        await this.save();
        this.broadcast(this.msg([{ k: 'leave', role: ws.deserializeAttachment()?.role }], this.online(ws)), ws);
    }
    webSocketError(ws) { return this.webSocketClose(ws); }
}
