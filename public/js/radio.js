// RADIO VƯỜN: phát nhạc YouTube làm nhạc nền, hai người nghe CHUNG một bài.
//  - Trạng thái chung nằm trong st.radio (rules.js, hành động {type:'radio', op}): hàng chờ q (mã video), bài i, play, pos (giây) đo lúc `at` (giờ máy chủ).
//    Vị trí đang phát = pos + (giờ máy chủ bây giờ − at) nếu đang phát. Mỗi trình duyệt tự chỉnh trình phát của mình theo đó (lệch > 2,5 giây thì tua lại).
//  - Danh sách phát YouTube: máy đầu tiên tải được danh sách gửi mã các bài lên (op 'items'), sau đó mọi máy phát theo hàng chờ chung.
//  - Khi radio đang phát ở máy mình: nhạc lofi tự tắt, tiếng mưa/gió/hiệu ứng giảm 50% (audio.duck).
//  - Âm lượng, "tắt ở máy mình" là cài đặt riêng từng máy (localStorage).
const $ = id => document.getElementById(id);
const KEY = 'vuon-hoa-radio';
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Tách mã video / danh sách phát từ link YouTube (youtu.be, watch?v=, shorts, embed, music.youtube, playlist?list=) */
export function parseYouTube(text) {
    const s = String(text || '').trim();
    if (/^[\w-]{11}$/.test(s)) return { v: s };
    let u; try { u = new URL(/^https?:/i.test(s) ? s : 'https://' + s); } catch { return null; }
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(u.hostname)) return null;
    let v = u.searchParams.get('v') || '', list = u.searchParams.get('list') || '';
    if (u.hostname.endsWith('youtu.be')) v = u.pathname.slice(1, 12);
    const m = u.pathname.match(/\/(shorts|embed|live|v)\/([\w-]{11})/); if (m) v = m[2];
    if (!/^[\w-]{11}$/.test(v)) v = '';
    if (!/^[\w-]{10,64}$/.test(list)) list = ''; // cả danh sách Mix tự sinh (RD…) — tải được thì lấy cả danh sách, không thì phát bài đầu
    return v || list ? { v, list } : null;
}

export function createRadio({ send, serverNow, audio, toast, names }) {
    let pref = { vol: 70, mute: false }; try { Object.assign(pref, JSON.parse(localStorage.getItem(KEY)) || {}); } catch { }
    const savePref = () => { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch { } };
    let openedAt = 0, errRun = 0, r = null, player = null, apiP = null, ready = false, curId = '', listTry = 0, blocked = false, seeking = false, titles = {}, lastFix = 0;

    const expected = () => !r ? 0 : r.play ? r.pos + (serverNow() - r.at) / 1000 : r.pos;
    const playing = () => !!(r && r.play && r.q.length);
    const loadApi = () => apiP ||= new Promise(res => {
        if (window.YT?.Player) return res();
        const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { prev?.(); res(); };
        const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => toast('Không tải được YouTube — kiểm tra mạng nhé 📻', 'bad', 'yterr'); document.head.appendChild(s);
    });
    async function ensurePlayer(firstSrc) {
        if (player) return;
        await loadApi(); if (player) return;
        const ifr = document.createElement('iframe'); // tự tạo iframe để cho phép tự phát (allow="autoplay")
        ifr.allow = 'autoplay; encrypted-media; picture-in-picture'; ifr.title = 'Radio';
        ifr.src = `https://www.youtube.com/embed/${firstSrc}${firstSrc.includes('?') ? '&' : '?'}enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(location.origin)}`;
        $('ytHost').appendChild(ifr);
        player = new YT.Player(ifr, {
            events: {
                onReady: () => { ready = true; player.setVolume(pref.vol); if (pref.mute) player.mute(); apply(true); },
                onStateChange: e => {
                    if (e.data === 0 && r && r.q.length) send({ type: 'radio', op: 'end', i: r.i }); // hết bài
                    if (e.data === 5 && r?.list && !r.q.length) grabList();
                    if (e.data === 1) { blocked = false; errRun = 0; const t = player.getVideoData?.()?.title; if (t && curId) titles[curId] = t; }
                    paint();
                },
                onError: () => { // bài bị chặn nhúng / đã xoá: chuyển bài; nếu cả danh sách đều lỗi thì dừng, không quay vòng mãi
                    if (!r || !r.q.length) return;
                    if (++errRun >= r.q.length) { errRun = 0; toast('Không bài nào trong danh sách phát được ở đây — thử link khác nhé 📻', 'bad', 'yterr2', 0); return send({ type: 'radio', op: 'pause', t: 0 }); }
                    toast('Bài này không cho phát trên trang khác — chuyển bài 📻', 'bad', 'yt' + r.i); send({ type: 'radio', op: 'end', i: r.i });
                }
            }
        });
    }
    function grabList() { // lấy mã các bài trong danh sách phát rồi gửi lên cho cả hai cùng dùng
        const ids = player?.getPlaylist?.();
        if (ids && ids.length) return send({ type: 'radio', op: 'items', ids: ids.slice(0, 200) });
        if (listTry++ < 8) return setTimeout(grabList, 800);
        if (r?.start) { toast('Không đọc được cả danh sách — phát bài đầu tiên 📻', '', 'ytlist'); return send({ type: 'radio', op: 'items', ids: [r.start] }); }
        toast('Không đọc được danh sách phát này (có thể đang để riêng tư) 📻', 'bad', 'ytlist');
    }
    // chỉnh trình phát của máy mình cho khớp trạng thái chung
    async function apply(force = false) {
        audio.duck(playing() && !pref.mute);
        if (!r || (!r.q.length && !r.list)) { if (ready && curId) { player.stopVideo(); curId = ''; } paint(); return; }
        if (!r.q.length && r.list) { // danh sách phát mới, chưa có mã bài
            if (!player) return ensurePlayer(r.start ? `${r.start}?list=${r.list}` : `videoseries?list=${r.list}`);
            if (ready && curId !== 'L' + r.list) { curId = 'L' + r.list; listTry = 0; player.cuePlaylist({ list: r.list, listType: 'playlist' }); setTimeout(() => { if (r?.list && !r.q.length && curId === 'L' + r.list) grabList(); }, 2500); }
            return;
        }
        const id = r.q[r.i];
        if (!player) return ensurePlayer(id);
        if (!ready) return;
        const exp = expected(), st = player.getPlayerState?.();
        if (curId !== id) { curId = id; r.play ? player.loadVideoById({ videoId: id, startSeconds: exp }) : player.cueVideoById({ videoId: id, startSeconds: exp }); fetchTitle(id); }
        else {
            if (force || Math.abs((player.getCurrentTime?.() || 0) - exp) > 2.5) player.seekTo(exp, true);
            if (r.play && st !== 1 && st !== 3) player.playVideo();
            if (!r.play && (st === 1 || st === 3)) player.pauseVideo();
        }
        if (r.play) setTimeout(() => { if (playing() && player?.getPlayerState?.() !== 1 && player?.getPlayerState?.() !== 3) { blocked = true; paint(); } }, 2500);
        paint();
    }
    async function fetchTitle(id) {
        if (titles[id] !== undefined) return; titles[id] = '';
        try { const j = await (await fetch('/api/yt/' + id)).json(); if (j.title) { titles[id] = j.title; paint(); } } catch { }
    }
    // ---------- giao diện trình phát ----------
    const open = () => !$('radio').classList.contains('closed');
    function paint() {
        if (!open()) return;
        const q = r?.q || [], cur = q[r?.i ?? 0], dur = ready ? player.getDuration?.() || 0 : 0, pos = ready && curId === cur ? player.getCurrentTime?.() || 0 : expected();
        $('rTitle').textContent = cur ? (titles[cur] || 'Đang tải tên bài…') : r?.list ? 'Đang tải danh sách phát…' : 'Chưa có bài nào — dán link YouTube bên dưới';
        $('rBy').textContent = r?.by ? `${names[r.by] || ''} vừa chỉnh radio${q.length ? ` · bài ${r.i + 1}/${q.length}` : ''}` : '';
        $('rPlay').textContent = playing() ? '⏸' : '▶'; $('rPlay').title = playing() ? 'Tạm dừng' : 'Phát';
        if (!seeking) { $('rSeek').max = Math.max(1, Math.floor(dur)); $('rSeek').value = Math.min(pos, dur || pos); }
        $('rCur').textContent = fmt(seeking ? +$('rSeek').value : pos); $('rDur').textContent = fmt(dur);
        $('rVol').value = pref.vol; $('rMute').textContent = pref.mute ? '🔇 Đang tắt ở máy mình' : '🔊 Tắt ở máy mình';
        $('rTap').hidden = !blocked;
        $('rEmpty').hidden = !!cur;
        const list = $('rList'), html = q.map((id, j) => `<li class="${j === r.i ? 'on' : ''}"><button data-r="go" data-i="${j}"><b>${j + 1}</b><span>${esc(titles[id] || id)}</span></button><button data-r="rm" data-i="${j}" title="Bỏ khỏi danh sách">✕</button></li>`).join('');
        if (list.dataset.h !== html) { list.innerHTML = html; list.dataset.h = html; }
        for (const id of q.slice(0, 60)) fetchTitle(id);
    }
    const cmd = (op, extra = {}) => send({ type: 'radio', op, ...extra });
    const curT = () => (ready && player.getCurrentTime?.()) || expected();
    $('radio').addEventListener('click', e => {
        const b = e.target.closest('[data-r]'); if (!b) { if (e.target === $('radio') && performance.now() - openedAt > 450) close(); return; } // bỏ cú click theo sau lần chạm vừa mở (điện thoại)
        const a = b.dataset.r;
        kick();
        if (a === 'close') close();
        else if (a === 'toggle') { if (!r?.q.length) return toast('Dán một link YouTube trước nhé 📻', '', 'rq'); cmd(playing() ? 'pause' : 'play', { t: curT() }); }
        else if (a === 'back' || a === 'fwd') cmd('seek', { t: Math.max(0, curT() + (a === 'fwd' ? 10 : -10)) });
        else if (a === 'prev' || a === 'next') cmd(a);
        else if (a === 'go') cmd('go', { i: +b.dataset.i });
        else if (a === 'rm') cmd('remove', { i: +b.dataset.i });
        else if (a === 'clear') { if (confirm('Xoá cả danh sách phát của radio (cho cả hai người)?')) cmd('clear'); }
        else if (a === 'mute') { pref.mute = !pref.mute; savePref(); if (ready) pref.mute ? player.mute() : player.unMute(); audio.duck(playing() && !pref.mute); paint(); }
        else if (a === 'tap') { blocked = false; apply(true); }
    });
    $('rSeek').addEventListener('input', () => { seeking = true; $('rCur').textContent = fmt(+$('rSeek').value); });
    $('rSeek').addEventListener('change', () => { seeking = false; cmd('seek', { t: +$('rSeek').value }); });
    $('rVol').addEventListener('input', () => { pref.vol = +$('rVol').value; savePref(); if (ready) player.setVolume(pref.vol); });
    $('rForm').addEventListener('submit', e => {
        e.preventDefault(); kick();
        const y = parseYouTube($('rLink').value);
        if (!y) return toast('Link chưa đúng — cần link YouTube (video hoặc danh sách phát) 📻', 'bad', 'rlink');
        if (y.list && (!r?.q.length || confirm('Thay cả danh sách đang phát bằng danh sách phát này?'))) cmd('list', { list: y.list, v: y.v });
        else if (y.v) cmd('add', { v: y.v, now: !r?.q.length });
        else return;
        $('rLink').value = '';
    });
    for (const ev of ['pointerdown', 'pointerup', 'pointermove']) $('radio').addEventListener(ev, e => e.stopPropagation());
    function close() { $('radio').classList.add('closed'); }
    // lần chạm đầu tiên trên trang: trình duyệt mới cho phát tiếng -> bắt nhịp lại radio
    function kick() { if (blocked || (playing() && ready && player.getPlayerState?.() !== 1)) { blocked = false; apply(true); } }
    setInterval(() => { if (!r) return; if (open()) paint(); if (ready && playing() && Date.now() - lastFix > 3000) { lastFix = Date.now(); apply(); } }, 500);
    return {
        /** gọi mỗi khi nhận trạng thái mới */
        update(rs) {
            const changed = !r || !rs || rs.rev !== r.rev; r = rs ? JSON.parse(JSON.stringify(rs)) : null;
            if (changed) apply(true);
        },
        open() { openedAt = performance.now(); $('radio').classList.remove('closed'); kick(); if (r?.q.length || r?.list) apply(); paint(); if (matchMedia('(pointer: fine)').matches) setTimeout(() => $('rLink').focus({ preventScroll: true }), 50); }, // điện thoại: không tự bật bàn phím
        close, kick,
        get shown() { return open(); },
        get playing() { return playing() && !pref.mute; },
        get title() { const id = r?.q[r.i]; return id ? titles[id] || '' : ''; }
    };
}
