// Font dùng trong game (file TTF trong public/fonts, đều có đủ dấu tiếng Việt, giấy phép OFL), khai báo ở css/fonts.css.
// FONT_FILES dùng để chờ font tải xong trước khi vẽ chữ bằng hoa.
export const FONT_FILES = [
    { family: 'Dancing Script', weight: 700, style: 'normal', file: 'DancingScript-700.ttf' },
    { family: 'Dancing Script', weight: 600, style: 'normal', file: 'DancingScript-600.ttf' },
    { family: 'Be Vietnam Pro', weight: 500, style: 'normal', file: 'BeVietnamPro-500.ttf' },
    { family: 'Be Vietnam Pro', weight: 800, style: 'normal', file: 'BeVietnamPro-800.ttf' },
    { family: 'Playfair Display', weight: 800, style: 'normal', file: 'PlayfairDisplay-800.ttf' },
    { family: 'Playfair Display', weight: 500, style: 'italic', file: 'PlayfairDisplay-500i.ttf' },
    { family: 'Pacifico', weight: 400, style: 'normal', file: 'Pacifico-400.ttf' },
    { family: 'Lora', weight: 500, style: 'italic', file: 'Lora-500i.ttf' },
    { family: 'Great Vibes', weight: 400, style: 'normal', file: 'GreatVibes-400.ttf' },
    { family: 'Pattaya', weight: 400, style: 'normal', file: 'Pattaya-400.ttf' }
];

// Kiểu chữ cho dòng chữ XẾP BẰNG HOA (nét càng đậm càng nhiều hoa, dễ đọc)
export const FLOWER_FONTS = {
    script: { label: 'Thư pháp mềm (Dancing Script)', font: '700 {px}px "Dancing Script"' },
    brush: { label: 'Bút lông đậm (Pattaya)', font: '400 {px}px Pattaya' },
    cute: { label: 'Tròn dễ thương (Pacifico)', font: '400 {px}px Pacifico' },
    serif: { label: 'Cổ điển (Playfair Display)', font: '800 {px}px "Playfair Display"' },
    round: { label: 'Hiện đại đậm (Be Vietnam Pro)', font: '800 {px}px "Be Vietnam Pro"' }
};

// Kiểu chữ cho lời thơ / lời chúc (chữ thường, mịn)
export const TEXT_FONTS = {
    lora: { label: 'Thơ nghiêng (Lora Italic)', font: 'italic 500 {px}px Lora', scale: 1 },
    playfair: { label: 'Cổ điển nghiêng (Playfair Italic)', font: 'italic 500 {px}px "Playfair Display"', scale: 1 },
    script: { label: 'Viết tay (Dancing Script)', font: '600 {px}px "Dancing Script"', scale: 1.22 },
    modern: { label: 'Hiện đại (Be Vietnam Pro)', font: '500 {px}px "Be Vietnam Pro"', scale: 0.92 }
};
export const SIGN_FONT = '400 {px}px "Great Vibes"';

export const fontAt = (tpl, px) => tpl.replace('{px}', px.toFixed(2));
