// Phần giao diện HTML: thông báo nổi, bảng trượt (chợ / hạt giống / sổ tay), lá thư.
const $ = id => document.getElementById(id);
export const ICON = { cuc: '🌼', huongduong: '🌻', tulip: '🌷', oaihuong: '🪻', camtucau: '💠', hong: '🌹', quynh: '🤍', songtam: '💞' };

const recent = new Map();
/** Thông báo ngắn. key: chống lặp cùng một thông báo trong `gap` ms. cls: '', 'good', 'bad', 'love' */
export function toast(text, cls = '', key = text, gap = 8000) {
    const now = Date.now();
    if (recent.has(key) && now - recent.get(key) < gap) return;
    recent.set(key, now);
    const box = $('toasts');
    while (box.children.length >= 3) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast ' + cls; el.textContent = text;
    box.appendChild(el);
    setTimeout(() => el.remove(), 3300);
}

let onSheetClick = null, sheetName = '', openedAt = 0;
export function openSheet(name, title, html, onClick) {
    sheetName = name; onSheetClick = onClick; openedAt = performance.now();
    $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html; $('sheet').hidden = false;
}
export const sheetOpen = name => !$('sheet').hidden && (!name || sheetName === name);
export function refreshSheet(html) { const b = $('sheetBody'), y = b.scrollTop; b.innerHTML = html; b.scrollTop = y; }
export function closeSheet() { $('sheet').hidden = true; sheetName = ''; }
$('sheetClose').onclick = closeSheet;
$('sheet').addEventListener('click', e => {
    // điện thoại: cú "click" theo sau lần chạm vừa mở bảng rơi vào nền mờ -> bỏ qua nửa giây đầu kẻo bảng tự đóng
    if (e.target === $('sheet')) { if (performance.now() - openedAt > 450) closeSheet(); return; }
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled && onSheetClick) onSheetClick(b.dataset.act, b.dataset);
});
for (const ev of ['pointerdown', 'pointermove', 'pointerup']) $('sheet').addEventListener(ev, e => e.stopPropagation());

const letters = [];
export function showLetter(from, text) {
    letters.push([from, text]);
    if ($('letter').hidden) nextLetter();
}
function nextLetter() {
    const l = letters.shift();
    if (!l) { $('letter').hidden = true; return; }
    $('letterFrom').textContent = l[0]; $('letterText').textContent = l[1]; $('letter').hidden = false;
}
$('letterClose').onclick = nextLetter;
for (const ev of ['pointerdown', 'pointermove', 'pointerup']) $('letter').addEventListener(ev, e => e.stopPropagation());
