// ============================================================================================
//  CẤU HÌNH DỰ ÁN
//  Thông thường KHÔNG cần sửa file này: khu vườn được tạo ngay trên trang chủ (/ -> "Tạo khu vườn mới").
//  `gardens` dưới đây là tuỳ chọn — các khu vườn khai báo sẵn bằng code (có thể để mảng rỗng).
//  Mỗi mục trong `gardens` là MỘT khu vườn chung cho HAI người chơi từ xa:
//    - sender   (người gửi lời cảm ơn / lời tỏ tình) và receiver (người nhận)
//    - mỗi người có một đường dẫn riêng:  https://<tên-miền>/<slug>
//      -> gửi đường dẫn của receiver cho người nhận, giữ đường dẫn của sender cho mình.
//  Hai người cùng chăm một nông trại hoa (khoảng 1–2 giờ chơi, có thể chơi nhiều lần, vườn được lưu lại):
//  khai hoang, gieo hạt, tưới, bón phân, bắt sâu, hái hoa... Đủ 14 loài + gắn kết cấp 3 + 10 bông cùng nở -> "Lễ hội hoa":
//  hoa bay lên trời, xếp thành `flowerText` và hiện `message`.
//  `notes`: những lá thư nhỏ (bất ngờ!) mở dần khi hai người hái hoa Song Tâm và lên cấp gắn kết — viết 4–6 câu ngắn.
//
//  Lưu ý:
//    - slug: chữ thường không dấu, số, dấu gạch ngang; nên thêm vài ký tự ngẫu nhiên để người khác không đoán được.
//    - id: mã khu vườn (lưu tiến trình chơi). Đổi id = khu vườn mới tinh.
//    - mode: 'cam-on' (lời cảm ơn) hoặc 'to-tinh' (sau lời nhắn, người nhận được hỏi `question` và trả lời; người gửi thấy câu trả lời).
//    - palette (bảng màu hoa): hong-phan, hong-do, oai-huong, cuc-hoa-mi, huong-duong, tulip, cam-tu-cau, hoa-dao, dong-noi
//      hoặc 'custom' + customColors: [{ rgb: '#ff8fab', weight: 3 }, ...] + center: '#ffd65c'
//    - backdrop (trời cuối game): sunset, night, dawn, golden, twilight, aurora, galaxy, rainbow, lanterns, sakura, bokeh, cotton
//    - flowerFont (chữ xếp bằng hoa): script, brush, cute, serif, round  ·  textFont (lời nhắn): lora, playfair, script, modern
//    - seed: số bất kỳ -> cách hoa mọc trong vườn
//  Sửa xong: `npm run dev` để thử, `npm run deploy` để đưa lên Cloudflare.
// ============================================================================================
export default {
    title: 'Khu vườn của hai người',
    // Menu cheat để test nhanh: gõ mã Konami ↑ ↑ ↓ ↓ ← → ← → B A (điện thoại: vuốt theo thứ tự đó rồi chạm 2 lần).
    // NHỚ ĐỔI THÀNH false trước khi gửi đường dẫn thật cho người khác. (Trang /play chơi thử luôn có cheat.)
    cheats: false,
    // Giới hạn cho khu vườn tạo trên web (vườn khai báo trong `gardens` không bị tính, không bị xoá):
    limits: {
        perIpHour: 3,      // mỗi địa chỉ IP tạo tối đa 3 vườn mỗi giờ…
        perIpDay: 6,       // …và 6 vườn mỗi ngày
        perHour: 60,       // cả trang tạo tối đa 60 vườn mỗi giờ
        maxGardens: 300,   // số vườn tồn tại cùng lúc tối đa (đủ cho 200 vườn đang chơi)
        maxSockets: 8,     // số kết nối cùng lúc vào một vườn (2 người, mỗi người vài thiết bị)
        idleHours: 48      // không ai vào vườn trong 48 giờ -> vườn tự xoá
    },
    gardens: []
    // Ví dụ một vườn khai báo sẵn (thường không cần — tạo vườn trên trang chủ tiện hơn):
    // {
    //     id: 'vuon-mau', mode: 'cam-on',
    //     sender: { slug: '<12-ky-tu-ngau-nhien>', name: 'Người gửi' },
    //     receiver: { slug: '<12-ky-tu-ngau-nhien-khac>', name: 'Người nhận' },
    //     flowerText: 'Cảm ơn', message: 'Dòng một\nDòng hai', signature: 'Người gửi',
    //     notes: ['Lá thư thứ nhất', 'Lá thư thứ hai'],
    //     palette: 'hong-phan', backdrop: 'sunset', flowerFont: 'script', textFont: 'lora', seed: 1234
    // }
    // Đừng commit vườn thật (tên, lời nhắn, slug) lên repo công khai.
};
