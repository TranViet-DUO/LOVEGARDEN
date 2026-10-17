// Xoá dữ liệu khu vườn khi chạy thử ở máy (trạng thái Durable Object của `wrangler dev` nằm trong .wrangler/state).
//   npm run dev:fresh   -> xoá rồi chạy dev với khu vườn mới tinh
//   npm run clean       -> chỉ xoá
// Dữ liệu trong trình duyệt (hướng dẫn đã xem, vườn /play, báo cáo vắng mặt): mở trang với ?reset, ví dụ http://localhost:8787/play?reset
import fs from 'node:fs';
const dir = new URL('../.wrangler/state', import.meta.url);
try { fs.rmSync(dir, { recursive: true, force: true }); console.log('Đã xoá dữ liệu vườn ở máy (.wrangler/state).'); }
catch (e) { console.error('Không xoá được (hãy tắt `npm run dev` đang chạy rồi thử lại):', e.message); process.exit(1); }
