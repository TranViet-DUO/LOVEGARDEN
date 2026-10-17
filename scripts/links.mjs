// In đường dẫn riêng của từng người trong config.js:  npm run links -- https://vuon-hoa.<tài-khoản>.workers.dev
import CONFIG from '../config.js';
const base = (process.argv[2] || 'http://localhost:8787').replace(/\/$/, '');
for (const g of CONFIG.gardens) {
    console.log(`\n🌸 ${g.id}  (${g.mode === 'to-tinh' ? 'tỏ tình' : 'cảm ơn'})`);
    console.log(`   Gửi cho ${g.receiver.name}:`.padEnd(22), `${base}/${g.receiver.slug}`);
    console.log(`   Của ${g.sender.name} (bạn giữ):`.padEnd(22), `${base}/${g.sender.slug}`);
}
