// Bảng màu hoa có sẵn. Mỗi bảng: tên, màu nhuỵ (center) và danh sách màu kèm tỉ lệ xuất hiện (weight, số tương đối).
// Thiệp dùng `palette: "<id>"`, hoặc `palette: "custom"` + `customColors: [{ rgb: "#rrggbb", weight }]` (+ `center` tuỳ chọn).
export const PALETTES = {
    'hong-phan': {
        name: 'Hồng phấn dịu dàng', center: '#ffd45e',
        colors: [['#ffc2d6', 5], ['#ff9fbf', 3], ['#fff4f0', 3], ['#ffd9c2', 2], ['#f78fb3', 1]]
    },
    'hong-do': {
        name: 'Hồng nhung đỏ thắm', center: '#ffcf4d',
        colors: [['#e8344e', 5], ['#ff6b81', 3], ['#b81d3a', 2], ['#ffe6ea', 1]]
    },
    'oai-huong': {
        name: 'Oải hương mộng mơ', center: '#fff0a8',
        colors: [['#b79cf2', 5], ['#9479e0', 3], ['#e3d6ff', 2], ['#ffffff', 1], ['#a8c8ff', 1]]
    },
    'cuc-hoa-mi': {
        name: 'Cúc hoạ mi tinh khôi', center: '#ffc93c',
        colors: [['#ffffff', 6], ['#fff8e6', 2], ['#ffe9a8', 1]]
    },
    'huong-duong': {
        name: 'Nắng vàng hướng dương', center: '#7a4a1e',
        colors: [['#ffd23f', 5], ['#ffb627', 3], ['#fff1a8', 1], ['#ff9f43', 1]]
    },
    'tulip': {
        name: 'Tulip rực rỡ', center: '#ffe066',
        colors: [['#ff4d6d', 3], ['#ff9e40', 3], ['#ffd93d', 3], ['#ff85c0', 2], ['#a77bff', 2]]
    },
    'cam-tu-cau': {
        name: 'Cẩm tú cầu xanh tím', center: '#fff7c2',
        colors: [['#8ec5ff', 4], ['#a99cff', 4], ['#d6b8ff', 2], ['#ffc4e1', 1], ['#ffffff', 1]]
    },
    'hoa-dao': {
        name: 'Hoa đào ngày xuân', center: '#ff5c8a',
        colors: [['#ffd1dc', 5], ['#ffb3c6', 3], ['#ffeef2', 2], ['#ff8fab', 1]]
    },
    'dong-noi': {
        name: 'Đồng nội nhiều màu', center: '#ffd03c',
        colors: [['#fffffa', 1], ['#ffaacd', 1], ['#ffe45a', 1], ['#bea0f5', 1], ['#ff965a', 1], ['#ff6e78', 1], ['#8ccdff', 1]]
    }
};

export const hex2rgb = h => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgb2hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

// Từ cấu hình thiệp -> { colors: [{ rgb:[r,g,b], weight }], center:[r,g,b] } để truyền vào cảnh đồng hoa / chữ hoa
export function resolvePalette(card) {
    if (card.palette === 'custom' && card.customColors?.length) {
        return {
            colors: card.customColors.map(c => ({ rgb: hex2rgb(c.rgb), weight: Math.max(0, +c.weight || 0) })),
            center: hex2rgb(card.center || '#ffd03c')
        };
    }
    const p = PALETTES[card.palette] || PALETTES['hong-phan'];
    return { colors: p.colors.map(([h, w]) => ({ rgb: hex2rgb(h), weight: w })), center: hex2rgb(card.center || p.center) };
}
