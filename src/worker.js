// Cloudflare Worker: phục vụ game (public/) + mỗi khu vườn là một Durable Object giữ trạng thái chung của 2 người, đồng bộ qua WebSocket.
//   /<slug>               -> trang game (public/play.html) của người có slug đó
//   /api/card/<slug>      -> thông tin khu vườn dành cho người đó (không lộ khu vườn khác, không lộ thư chưa mở)
//   /ws/<slug>            -> WebSocket vào khu vườn chung
//   POST /api/garden      -> tạo khu vườn mới từ trang chủ (trả về đường dẫn của hai người)
//   GET|PUT /api/garden/<slug của người gửi> -> đọc / sửa lời nhắn, thư… (chỉ người gửi, chỉ vườn tạo trên web)
// Vườn tạo trên web: giới hạn tạo theo IP / theo giờ / tổng số (CONFIG.limits), không ai vào trong `idleHours` thì tự xoá
// (alarm của Durable Object; slug để lại "bia mộ" {gone} để báo người mở lại link). Trạng thái chỉ ghi xuống khi có thay đổi.
// Vườn có hai nguồn: vườn tạo trên web (cấu hình lưu trong Durable Object `Garden`, slug -> vườn tra ở Durable Object `Registry`)
// và vườn khai báo sẵn trong config.js (không bắt buộc).
import { DurableObject } from 'cloudflare:workers';
import CONFIG from '../config.js';
import { advance, apply, freshState, visit, viewFor, V } from '../public/js/rules.js';
import { PALETTES } from '../public/js/lib/palettes.js';
import { BACKDROPS } from '../public/js/lib/backdrops.js';
import { FLOWER_FONTS, TEXT_FONTS } from '../public/js/lib/fonts.js';

const SLUGS = new Map(), GARDENS = new Map();
for (const g of CONFIG.gardens || []) {
    if (GARDENS.has(g.id)) throw new Error(`config.js: id "${g.id}" bị trùng`);
    GARDENS.set(g.id, g);
    for (const [role, p] of [['gui', g.sender], ['nhan', g.receiver]]) {
        if (!/^[a-z0-9][a-z0-9-]*$/.test(p.slug)) throw new Error(`config.js: slug "${p.slug}" chỉ được gồm chữ thường không dấu, số, dấu gạch ngang`);
        if (SLUGS.has(p.slug)) throw new Error(`config.js: slug "${p.slug}" bị trùng`);
        SLUGS.set(p.slug, { garden: g, role });
    }
}
const CARD_KEYS = ['mode', 'flowerText', 'message', 'signature', 'question', 'palette', 'customColors', 'center', 'backdrop', 'flowerFont', 'textFont', 'textColor', 'seed'];
// Nội dung đoạn kết: người nhận chỉ nhận được khi Lễ hội hoa bắt đầu (gửi kèm state, khoá `ending`), không đọc trước qua DevTools.
const SECRET_KEYS = ['flowerText', 'message', 'signature', 'question'];
const ending = g => Object.fromEntries(SECRET_KEYS.filter(k => g[k] !== undefined).map(k => [k, g[k]]));
// header bảo mật cho mọi trang / API do worker trả
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "frame-ancestors 'none'", 'X-Robots-Tag': 'noindex, nofollow' };
const secure = res => { if (res.status === 101) return res; const r = new Response(res.body, res); for (const [k, v] of Object.entries(SEC)) r.headers.set(k, v); return r; };
const TITLE = CONFIG.title || 'Khu vườn của hai người';
const LIM = { perIpHour: 3, perIpDay: 6, perHour: 60, maxGardens: 300, maxSockets: 8, idleHours: 48, ...CONFIG.limits };
const IDLE_MS = LIM.idleHours * 3600e3, SAVE_MS = 60e3; // SAVE_MS: thời gian trôi (sync) ghi xuống ít nhất mỗi phút một lần

// ---------- tạo / sửa vườn trên web ----------
const rand = (n, abc = 'abcdefghijkmnpqrstuvwxyz23456789') => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => abc[b % abc.length]).join('');
const HEX = /^#[0-9a-f]{6}$/i;
// Chữ người dùng nhập: bỏ ký tự điều khiển và < > (chống chèn HTML); tên / chữ ngắn bỏ thêm dấu nháy, backtick.
const str = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f<>]/g, '').trim().slice(0, max);
const line = (v, max) => str(v, max).replace(/[\n"'`]/g, ' ').trim();
// Kiểm tra dữ liệu từ form. Trả về { cfg } (các trường người dùng được sửa) hoặc { error }.
function cleanCfg(b) {
    if (!b || typeof b !== 'object') return { error: 'Dữ liệu không hợp lệ' };
    const sender = line(b.sender, 30), receiver = line(b.receiver, 30);
    if (!sender || !receiver) return { error: 'Cần điền tên của hai người' };
    const mode = b.mode === 'to-tinh' ? 'to-tinh' : 'cam-on';
    const cfg = {
        sender, receiver, mode,
        flowerText: line(b.flowerText, 24) || receiver,
        message: str(b.message, 1200),
        signature: line(b.signature, 40),
        question: mode === 'to-tinh' ? line(b.question, 120) || 'Làm người yêu mình nhé?' : '',
        notes: (Array.isArray(b.notes) ? b.notes : []).map(n => str(n, 300)).filter(Boolean).slice(0, 30),
        palette: PALETTES[b.palette] || b.palette === 'custom' ? b.palette : 'hong-phan',
        backdrop: BACKDROPS[b.backdrop] ? b.backdrop : 'sunset',
        flowerFont: FLOWER_FONTS[b.flowerFont] ? b.flowerFont : 'script',
        textFont: TEXT_FONTS[b.textFont] ? b.textFont : 'lora',
        cheats: !!b.cheats
    };
    if (!cfg.message) return { error: 'Hãy viết lời nhắn cho đoạn kết' };
    if (cfg.palette === 'custom') {
        cfg.customColors = (Array.isArray(b.customColors) ? b.customColors : []).filter(c => HEX.test(c?.rgb)).slice(0, 6).map(c => ({ rgb: c.rgb.toLowerCase(), weight: Math.max(1, Math.min(9, Math.round(+c.weight) || 1)) }));
        if (!cfg.customColors.length) cfg.palette = 'hong-phan', delete cfg.customColors;
        if (HEX.test(b.center)) cfg.center = b.center.toLowerCase();
    }
    return { cfg };
}
// cấu hình lưu trong Durable Object -> dạng giống một mục của config.js
const asGarden = c => ({ ...c, sender: { slug: c.slugs.gui, name: c.sender }, receiver: { slug: c.slugs.nhan, name: c.receiver } });

const registry = env => env.REGISTRY.get(env.REGISTRY.idFromName('registry'));
const gardenStub = (env, gid) => env.GARDEN.get(env.GARDEN.idFromName(gid));
// Bộ nhớ đệm slug trong worker: Registry chỉ là MỘT Durable Object, đừng hỏi nó mỗi lần mở trang / nối lại.
// Slug không bao giờ đổi vườn; vườn bị xoá thì Garden tự trả 410 nên đệm lâu cũng không sao.
const CACHE = new Map();
async function lookup(env, slug) {
    const c = CACHE.get(slug), now = Date.now();
    if (c && c.until > now) return c.v;
    const v = await registry(env).lookup(slug);
    if (CACHE.size > 5000) CACHE.clear();
    CACHE.set(slug, { v, until: now + (v && !v.gone ? 600e3 : 20e3) });
    return v;
}
// slug -> { gid, role, garden (đủ cấu hình nếu là vườn config.js) } | { gone } | null
async function resolve(env, slug) {
    const hit = SLUGS.get(slug);
    if (hit) return { gid: hit.garden.id, role: hit.role, garden: hit.garden, cheats: !!CONFIG.cheats, web: false };
    if (!/^[a-z0-9][a-z0-9-]{5,40}$/.test(slug || '')) return null;
    const r = await lookup(env, slug);
    return r && (r.gone ? { gone: r.gone } : { ...r, web: true });
}
const GONE = 'Khu vườn này đã được dọn vì lâu không ai ghé chăm';
// IPv6: tính theo /64 (nhà mạng cấp cả dải cho một máy)
const ipKey = req => { const ip = req.headers.get('CF-Connecting-IP') || 'local'; return ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip; };
async function readJson(req) { const t = await req.text(); if (t.length > 30000) return null; try { return JSON.parse(t); } catch { return null; } }
const json = (o, status = 200) => Response.json(o, { status, headers: { 'Cache-Control': 'no-store' } });

export default {
    async fetch(req, env) { return secure(await route(req, env)); }
};
async function route(req, env) {
    {
        const url = new URL(req.url), parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
        if (parts[0] === 'api' && parts[1] === 'garden') {
            if (!parts[2] && req.method === 'POST') { // tạo vườn mới
                const { cfg, error } = cleanCfg(await readJson(req));
                if (error) return json({ error }, 400);
                const quota = await registry(env).quota(ipKey(req), LIM);
                if (quota) return json({ error: quota }, 429);
                const gid = 'w-' + rand(14);
                for (let k = 0; k < 5; k++) {
                    // đường dẫn ngẫu nhiên hoàn toàn (32^12 khả năng), không chứa tên -> không đoán được, không lộ ai với ai
                    const slugs = { gui: rand(12), nhan: rand(12) };
                    if (SLUGS.has(slugs.gui) || SLUGS.has(slugs.nhan) || slugs.gui === slugs.nhan) continue;
                    const full = { ...cfg, id: gid, slugs, seed: 1 + Math.floor(Math.random() * 9999), created: Date.now() };
                    await gardenStub(env, gid).init(full); // lưu cấu hình trước, rồi mới mở đường dẫn
                    if (await registry(env).claim({ [slugs.gui]: { gid, role: 'gui' }, [slugs.nhan]: { gid, role: 'nhan' } })) return json({ ok: true, ...slugs });
                }
                return json({ error: 'Không tạo được đường dẫn, thử lại nhé' }, 500);
            }
            const hit = await resolve(env, parts[2]);
            if (!hit) return json({ error: 'không có khu vườn này' }, 404);
            if (hit.gone) return json({ error: GONE, gone: true }, 410);
            if (!hit.web) return json({ error: 'Khu vườn này được cấu hình trong config.js' }, 403);
            if (hit.role !== 'gui') return json({ error: 'Chỉ người tạo vườn mới sửa được' }, 403);
            const stub = gardenStub(env, hit.gid);
            if (req.method === 'GET') { const c = await stub.getCfg(); return c ? json(c) : json({ error: GONE, gone: true }, 410); }
            if (req.method === 'PUT') {
                const { cfg, error } = cleanCfg(await readJson(req));
                if (error) return json({ error }, 400);
                const c = await stub.setCfg(cfg);
                return c ? json({ ok: true, ...c.slugs }) : json({ error: GONE, gone: true }, 410);
            }
            return json({ error: 'Không hỗ trợ' }, 405);
        }
        if (parts[0] === 'api' && parts[1] === 'card') {
            const hit = await resolve(env, parts[2]);
            if (!hit) return json({ error: 'không có khu vườn này' }, 404);
            const c = hit.garden || (!hit.gone && await gardenStub(env, hit.gid).getCfg());
            if (!c) return json({ error: GONE, gone: true }, 410);
            const g = hit.garden || asGarden(c), role = hit.role;
            const me = role === 'gui' ? g.sender : g.receiver, partner = role === 'gui' ? g.receiver : g.sender;
            const card = Object.fromEntries(CARD_KEYS.filter(k => g[k] !== undefined && (role === 'gui' || !SECRET_KEYS.includes(k))).map(k => [k, g[k]]));
            return json({ role, me: me.name, partner: partner.name, sender: g.sender.name, receiver: g.receiver.name, title: TITLE, notesTotal: (g.notes || []).length, cheats: hit.web ? !!g.cheats : hit.cheats, edit: hit.web && role === 'gui', card });
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
            const hit = await resolve(env, parts[1]);
            if (!hit) return new Response('Không có khu vườn này', { status: 404 });
            if (hit.gone) return new Response(GONE, { status: 410 });
            if (req.headers.get('Upgrade') !== 'websocket') return new Response('Cần WebSocket', { status: 426 });
            return gardenStub(env, hit.gid).fetch(new Request(`https://garden/?role=${hit.role}&id=${encodeURIComponent(hit.gid)}`, req));
        }
        if (parts.length === 1 && SLUGS.has(parts[0])) return env.ASSETS.fetch(new Request(new URL('/play', url), req));
        const res = await env.ASSETS.fetch(req);
        if (res.status !== 404) return res;
        if (parts.length === 1) {
            const hit = await resolve(env, parts[0]);
            if (hit?.gone) return Response.redirect(new URL('/?het', url), 302);
            if (hit) return env.ASSETS.fetch(new Request(new URL('/play', url), req));
        }
        const home = await env.ASSETS.fetch(new Request(new URL('/', url), req));
        return new Response(home.body, { status: 404, headers: home.headers });
    }
}

// Sổ đăng ký (một Durable Object duy nhất) cho các vườn tạo trên web:
//   's:<slug>' -> { gid, role } hoặc { gone: lúc xoá }   ·   'count' = số vườn đang có
//   'ip:<ip>' -> [lúc tạo…] (24 giờ gần nhất)            ·   'recent' = [lúc tạo…] toàn trang (1 giờ gần nhất)
export class Registry extends DurableObject {
    async lookup(slug) { return (await this.ctx.storage.get('s:' + slug)) || null; }
    // còn được tạo vườn không? (null = được; chuỗi = lý do từ chối). Được thì ghi luôn lượt tạo này.
    async quota(ip, lim) {
        const S = this.ctx.storage, now = Date.now(), H = 3600e3;
        const [count = 0, recent = [], mine = []] = await Promise.all([S.get('count'), S.get('recent'), S.get('ip:' + ip)]);
        const rc = recent.filter(t => now - t < H), mn = mine.filter(t => now - t < 24 * H);
        if (count >= lim.maxGardens) return 'Vườn đang kín chỗ, bạn thử lại sau nhé 🌱';
        if (rc.length >= lim.perHour) return 'Đang có nhiều người tạo vườn quá, thử lại sau ít phút nhé';
        if (mn.filter(t => now - t < H).length >= lim.perIpHour || mn.length >= lim.perIpDay) return 'Bạn đã tạo nhiều vườn rồi, nghỉ một lát rồi thử lại nhé 🌷';
        await S.put({ recent: [...rc, now], ['ip:' + ip]: [...mn, now] });
        if (now - ((await S.get('swept')) || 0) > 24 * H) await this.sweep(now);
        return null;
    }
    async sweep(now) { // dọn bộ đếm IP cũ (một lần mỗi ngày)
        const old = [...(await this.ctx.storage.list({ prefix: 'ip:' }))].filter(([, ts]) => !ts.some(t => now - t < 24 * 3600e3)).map(([k]) => k);
        for (let i = 0; i < old.length; i += 128) await this.ctx.storage.delete(old.slice(i, i + 128));
        await this.ctx.storage.put('swept', now);
    }
    async claim(map) { // ghi cả hai slug cùng lúc, chỉ khi chưa có slug nào bị dùng
        const keys = Object.keys(map).map(s => 's:' + s);
        if ((await this.ctx.storage.get(keys)).size) return false;
        await this.ctx.storage.put({ ...Object.fromEntries(Object.entries(map).map(([s, v]) => ['s:' + s, v])), count: ((await this.ctx.storage.get('count')) || 0) + 1 });
        return true;
    }
    async release(slugs) { // vườn bị xoá: để lại bia mộ cho slug, bớt bộ đếm
        const got = await this.ctx.storage.get(slugs.map(s => 's:' + s));
        if (![...got.values()].some(v => v && !v.gone)) return;
        await this.ctx.storage.put({ ...Object.fromEntries(slugs.map(s => ['s:' + s, { gone: Date.now() }])), count: Math.max(0, ((await this.ctx.storage.get('count')) || 1) - 1) });
    }
}

// Một khu vườn = một Durable Object. Thời gian trong vườn được tính bù mỗi khi có tin nhắn (không cần chạy liên tục).
export class Garden extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        ctx.blockConcurrencyWhile(async () => { this.st = await ctx.storage.get('st'); this.gid = await ctx.storage.get('gid'); this.cfg = await ctx.storage.get('cfg'); });
    }
    get garden() { return GARDENS.get(this.gid) || (this.cfg && asGarden(this.cfg)) || { mode: 'cam-on', notes: [] }; }
    get cheats() { return GARDENS.has(this.gid) ? !!CONFIG.cheats : !!this.cfg?.cheats; }
    // vườn tạo trên web: lưu / đọc / sửa cấu hình (gọi từ worker qua RPC)
    async init(cfg) { this.gid = cfg.id; this.cfg = cfg; await this.ctx.storage.put({ gid: cfg.id, cfg }); await this.touch(); }
    getCfg() { return this.cfg || null; }
    // hẹn giờ tự xoá: `idleHours` sau lần cuối có người trong vườn (vườn config.js không có cfg nên không bị xoá)
    async touch() { if (this.cfg) await this.ctx.storage.setAlarm(Date.now() + IDLE_MS); }
    async alarm() {
        if (!this.cfg) return;
        if (this.ctx.getWebSockets().length) return this.touch(); // vẫn có người đang chơi
        await registry(this.env).release(Object.values(this.cfg.slugs)); // lỗi ở đây thì alarm tự chạy lại
        await this.ctx.storage.deleteAll();
        this.st = this.cfg = null;
    }
    async setCfg(patch) { // id, slug, seed giữ nguyên; lời nhắn, thư, màu… thay mới (áp dụng khi mở lại game)
        if (!this.cfg) return null;
        this.cfg = { ...this.cfg, ...patch, id: this.cfg.id, slugs: this.cfg.slugs, seed: this.cfg.seed, edited: Date.now() };
        if (this.cfg.palette !== 'custom') delete this.cfg.customColors, delete this.cfg.center;
        await this.ctx.storage.put('cfg', this.cfg);
        if (this.st) this.broadcastState([]); // số lá thư có thể đã đổi
        return this.cfg;
    }
    rctx(online) { const g = this.garden; return { mode: g.mode || 'cam-on', notesTotal: (g.notes || []).length, online, cheats: this.cheats }; }
    online(except) { return [...new Set(this.ctx.getWebSockets().filter(ws => ws !== except).map(ws => ws.deserializeAttachment()?.role).filter(Boolean))]; }
    tick(online) { advance(this.st, Date.now(), online, this.rctx(online)); }
    // mỗi người nhận một bản riêng: thư hẹn giờ của người kia chưa tới ngày thì không gửi chữ
    msg(fx = [], online = this.online(), role = null) { const now = Date.now(); return JSON.stringify({ type: 'state', st: role ? viewFor(this.st, role, now) : this.st, now, online, fx, notes: (this.garden.notes || []).slice(0, this.st.notes), ending: this.st.liftAt || this.st.done ? ending(this.garden) : undefined }); }
    broadcast(s, except) { for (const ws of this.ctx.getWebSockets()) if (ws !== except) try { ws.send(s); } catch { } }
    broadcastState(fx, online, except) { const cache = {}; for (const ws of this.ctx.getWebSockets()) if (ws !== except) { const role = ws.deserializeAttachment()?.role; try { ws.send(cache[role] ??= this.msg(fx, online, role)); } catch { } } }
    save() { this.savedAt = Date.now(); return this.ctx.storage.put('st', this.st); }
    // chỉ có thời gian trôi (không ai làm gì): ghi thưa thôi. Mất phần chưa ghi (DO ngủ / khởi động lại) cũng không sao:
    // `advance` tính bù lại từ st.real theo đúng luật tất định.
    lazySave() { return Date.now() - (this.savedAt || 0) > SAVE_MS ? this.save() : null; }

    async fetch(req) {
        const url = new URL(req.url), role = url.searchParams.get('role'), id = url.searchParams.get('id');
        if (!GARDENS.has(id) && !this.cfg) return new Response(GONE, { status: 410 }); // vườn web đã bị xoá
        if (this.ctx.getWebSockets().length >= LIM.maxSockets) return new Response('Quá nhiều kết nối', { status: 429 });
        if (!this.gid) { this.gid = id; await this.ctx.storage.put('gid', this.gid); }
        if (!this.st || this.st.v !== V) this.st = freshState(+this.garden.seed || 1, this.st || {});
        this.tick(this.online()); // thời gian trôi tới giờ (với những người đang có mặt trước đó)
        const [client, server] = Object.values(new WebSocketPair());
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({ role });
        this.st.joined[role] = true;
        const fx = [{ k: 'join', role }, ...visit(this.st, role, Date.now())]; // cây kỷ niệm: ghé vườn hôm nay
        await this.save(); await this.touch();
        this.broadcastState(fx);
        return new Response(null, { status: 101, webSocket: client });
    }
    async webSocketMessage(ws, data) {
        if (typeof data !== 'string' || data.length > 12000) return;
        let m; try { m = JSON.parse(data); } catch { return; }
        if (m.type === 'ping') return ws.send('{"type":"pong"}');
        const role = ws.deserializeAttachment()?.role, online = this.online();
        if (m.type === 'sync') { // sang ngày mới khi đang mở game cũng tính là ghé vườn
            this.tick(online); const fx = visit(this.st, role, Date.now());
            await (fx.length ? this.save() : this.lazySave());
            return fx.length ? this.broadcastState(fx, online) : ws.send(this.msg([], online, role));
        }
        if (m.type === 'wind' || m.type === 'cur') { for (const o of apply(this.st, role, m, Date.now(), this.rctx(online)).others) this.broadcast(JSON.stringify(o), ws); return; }
        this.tick(online);
        const r = apply(this.st, role, m, Date.now(), this.rctx(online));
        await (r.changed ? this.save() : this.lazySave());
        if (r.changed) this.broadcastState(r.fx, online);
    }
    async webSocketClose(ws) {
        try { ws.close(); } catch { }
        if (!this.st) return;
        this.tick([...this.online(), ws.deserializeAttachment()?.role].filter(Boolean)); // tính tới lúc rời đi với người vừa rời vẫn có mặt
        await this.save(); await this.touch(); // đếm giờ tự xoá từ lúc người cuối cùng rời vườn
        this.broadcastState([{ k: 'leave', role: ws.deserializeAttachment()?.role }], this.online(ws), ws);
    }
    webSocketError(ws) { return this.webSocketClose(ws); }
}
