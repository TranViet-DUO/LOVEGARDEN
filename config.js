// ============================================================================================
//  CẤU HÌNH DUY NHẤT CỦA DỰ ÁN
//  Mỗi mục trong `gardens` là MỘT khu vườn chung cho HAI người chơi từ xa:
//    - sender   (người gửi lời cảm ơn / lời tỏ tình) và receiver (người nhận)
//    - mỗi người có một đường dẫn riêng:  https://<tên-miền>/<slug>
//      -> gửi đường dẫn của receiver cho người nhận, giữ đường dẫn của sender cho mình.
//  Hai người cùng chăm một nông trại hoa (khoảng 1–2 giờ chơi, có thể chơi nhiều lần, vườn được lưu lại):
//  khai hoang, gieo hạt, tưới, bón phân, bắt sâu, hái hoa... Đủ 8 loài + gắn kết cấp 3 + vườn nở rộ -> "Lễ hội hoa":
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
    cheats: true,
    gardens: [
        {
            id: 'minh-lan',
            mode: 'to-tinh',
            sender: { slug: 'minh-7k2q', name: 'Minh' },
            receiver: { slug: 'lan-9x4m', name: 'Lan' },
            flowerText: 'Gửi em',
            message: 'Anh gom hết những đoá hoa\ncủa cả một mùa xuân để viết tên em.\nChẳng phải vì hôm nay là ngày đặc biệt,\nmà vì có em, ngày nào cũng thành đặc biệt.',
            signature: 'Minh',
            question: 'Làm người yêu anh nhé?',
            notes: [
                'Lần đầu gặp em là một chiều mưa. Anh nhớ mãi chiếc ô màu vàng.',
                'Mỗi lần em cười, anh lại thấy ngày hôm đó đáng nhớ hơn một chút.',
                'Anh không giỏi trồng hoa đâu. Nhưng vì em, anh muốn học.',
                'Cảm ơn em đã kiên nhẫn chăm khu vườn này cùng anh.',
                'Bông hoa cuối cùng, anh để dành cho câu hỏi sắp tới…'
            ],
            palette: 'custom', center: '#ffd65c',
            customColors: [{ rgb: '#ff8fab', weight: 4 }, { rgb: '#ffc2d1', weight: 3 }, { rgb: '#ffffff', weight: 2 }, { rgb: '#e5383b', weight: 1 }],
            backdrop: 'sunset', flowerFont: 'brush', textFont: 'playfair', seed: 1402
        },
        {
            id: 'con-me',
            mode: 'cam-on',
            sender: { slug: 'con-3h8d', name: 'Con' },
            receiver: { slug: 'me-yeu-5t2w', name: 'Mẹ' },
            flowerText: 'Mẹ yêu',
            message: 'Mẹ là nắng sớm hiên nhà\nLà câu hát ru, là hoa giữa đời\nBao mùa sương gió qua rồi\nTóc mẹ thêm bạc, mà lời vẫn êm.\n\nCảm ơn mẹ,\nngười phụ nữ con thương nhất đời.',
            signature: 'Con của mẹ',
            notes: [
                'Con vẫn nhớ mùi cơm mẹ nấu mỗi chiều đi học về.',
                'Hồi bé con hay giận dỗi, mẹ chưa bao giờ giận con quá một buổi.',
                'Những bông hoa này lớn chậm lắm — như con, mẹ đã chờ con lớn bao nhiêu năm.',
                'Con xin lỗi vì những lần bận quá mà quên gọi về.',
                'Mẹ ơi, con thương mẹ nhiều hơn những gì con nói được.'
            ],
            palette: 'hong-phan', backdrop: 'lanterns', flowerFont: 'script', textFont: 'lora', seed: 1020
        },
        {
            id: 'ban-than',
            mode: 'cam-on',
            sender: { slug: 'to-8w1e', name: 'Tớ' },
            receiver: { slug: 'cau-2p6r', name: 'Cậu' },
            flowerText: 'Gửi cậu',
            message: 'Có những người đi cùng ta\nkhông cần hứa hẹn, chẳng cần lời hay.\nCậu là một người như vậy,\nlặng lẽ ở đó, những ngày tớ chông chênh.\n\nCảm ơn cậu, vì đã luôn là cậu.',
            signature: 'Tớ',
            notes: [
                'Còn nhớ hôm hai đứa trốn tiết đi ăn chè không?',
                'Cậu là người đầu tiên tớ muốn kể mỗi khi có chuyện vui.',
                'Có cậu, những ngày chông chênh cũng thấy bớt chông chênh.',
                'Khu vườn này đẹp vì có hai người cùng tưới.'
            ],
            palette: 'oai-huong', backdrop: 'aurora', flowerFont: 'script', textFont: 'lora', seed: 4242
        }
    ]
};
