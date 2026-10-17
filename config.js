// ============================================================================================
//  CẤU HÌNH DUY NHẤT CỦA DỰ ÁN
//  Mỗi mục trong `gardens` là MỘT khu vườn chung cho HAI người chơi từ xa:
//    - sender   (người gửi lời cảm ơn / lời tỏ tình) và receiver (người nhận)
//    - mỗi người có một đường dẫn riêng:  https://<tên-miền>/<slug>
//      -> gửi đường dẫn của receiver cho người nhận, giữ đường dẫn của sender cho mình.
//  Hai người cùng chăm một nông trại hoa (khoảng 1–2 giờ chơi, có thể chơi nhiều lần, vườn được lưu lại):
//  khai hoang, gieo hạt, tưới, bón phân, bắt sâu, hái hoa... Đủ 14 loài + gắn kết cấp 3 -> sự kiện ẩn (10 bông cùng nở) -> "Lễ hội hoa":
//  hoa bay lên trời, xếp thành `flowerText` và hiện `message`.
//  `notes`: những lá thư nhỏ (bất ngờ!) mở dần khi hai người hái hoa Song Tâm và lên cấp gắn kết — viết 4–6 câu ngắn,
//    mỗi câu một chi tiết nhỏ có thật (một buổi chiều, một thói quen, một câu nói) sẽ chạm hơn những lời thật to.
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
            message: 'Có những điều anh cất giữ lâu lắm rồi,\nnhư hạt giống để quên trong túi áo,\nchờ một mùa đủ nắng mới dám gieo.\n\nCảm ơn em đã cùng anh chăm khu vườn này.\nNếu được, anh muốn cùng em\ntưới thêm thật nhiều mùa hoa nữa.',
            signature: 'Minh',
            question: 'Mình thử bắt đầu, em nhé?',
            notes: [
                'Hôm đó trời mưa, em đứng nép dưới hiên, tay cầm chiếc ô vàng mà mãi không bung. Anh đã định hỏi vì sao, rồi lại thôi.',
                'Mỗi lần nghĩ ngợi, em hay gõ nhẹ ngón tay lên bàn. Anh để ý từ lâu rồi, chỉ là chưa nói.',
                'Anh không giỏi trồng hoa. Nhưng anh biết bông nào cũng cần có người nhớ tới mỗi ngày.',
                'Có mấy lần em lặng lẽ tưới giúp cây của anh mà chẳng nói gì. Anh thấy hết đấy.',
                'Có những tối anh vào vườn chỉ để xem em đã ghé qua chưa.',
                'Bông hoa cuối cùng anh để dành, không phải để hái, mà để hỏi em một điều…'
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
            message: 'Mẹ chưa bao giờ nói mình mệt,\nchỉ có mái tóc là kể thay mẹ.\nNhững điều con chưa nói được thành lời,\ncon gửi vào từng luống hoa nhỏ này.\n\nCảm ơn mẹ, vì tất cả —\nkể cả những điều con chưa từng biết.',
            signature: 'Con của mẹ',
            notes: [
                'Con vẫn nhớ mùi khói bếp mỗi chiều đi học về, và tiếng mẹ gọi: "Rửa tay rồi vào ăn cơm con."',
                'Hồi con sốt, mẹ ngồi quạt cho con cả đêm. Sáng ra mẹ vẫn bảo: "Mẹ có thức đâu."',
                'Hoa trong vườn lớn chậm lắm. Con chợt nghĩ, mẹ đã chờ con lớn lâu hơn thế nhiều.',
                'Có những cuộc gọi con vội tắt máy vì bận. Con xin lỗi mẹ, từ giờ con sẽ gọi về nhiều hơn.',
                'Mẹ hay dặn con ăn uống cho đủ. Hôm nay con ăn đủ ba bữa rồi, mẹ yên tâm nhé.',
                'Con lớn rồi, mà về đến nhà vẫn chỉ mong được mẹ hỏi: "Đói chưa con?"'
            ],
            palette: 'hong-phan', backdrop: 'lanterns', flowerFont: 'script', textFont: 'lora', seed: 1020
        },
        {
            id: 'ban-than',
            mode: 'cam-on',
            sender: { slug: 'to-8w1e', name: 'Tớ' },
            receiver: { slug: 'cau-2p6r', name: 'Cậu' },
            flowerText: 'Gửi cậu',
            message: 'Có những người chẳng cần nhắn mỗi ngày,\nmà cứ mở lời là như chưa từng xa.\nCậu là một người như thế —\nvẫn ở đó, mỗi lần tớ chông chênh.\n\nCảm ơn cậu, vì đã luôn là cậu.',
            signature: 'Tớ',
            notes: [
                'Còn nhớ hôm hai đứa ngồi quán chè tới lúc người ta dọn hàng không? Tớ chẳng nhớ đã nói gì, chỉ nhớ là vui.',
                'Cậu là người đầu tiên tớ muốn kể mỗi khi có chuyện vui, và là người duy nhất tớ dám kể chuyện buồn.',
                'Có lần tớ bảo "tớ ổn", cậu không hỏi thêm, chỉ ngồi lại với tớ lâu hơn một chút. Tớ nhớ mãi.',
                'Giờ mỗi đứa một con đường, nhưng tớ biết lúc nào quay lại cũng vẫn có cậu.',
                'Khu vườn này đẹp vì có hai người cùng tưới. Tình bạn mình cũng vậy.'
            ],
            palette: 'oai-huong', backdrop: 'aurora', flowerFont: 'script', textFont: 'lora', seed: 4242
        }
    ]
};
