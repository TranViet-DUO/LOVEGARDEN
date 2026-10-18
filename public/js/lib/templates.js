// Mẫu gợi ý cho form tạo vườn (trang chủ). {nhan} = tên người nhận, {gui} = tên người gửi.
// Lời văn: ẩn dụ nhẹ nhàng, tế nhị, không quá sâu. Tránh để {nhan} đứng đầu câu (khi chưa nhập tên sẽ thành "người ấy").
export const TEMPLATES = {
    'me-con': {
        icon: '💐', label: 'Cảm ơn mẹ', mode: 'cam-on', ph: { sender: 'Tên con', receiver: 'Mẹ' },
        flowerText: 'Mẹ yêu',
        message: 'Con lớn lên bằng những mùa mẹ lặng lẽ tưới,\nbằng bát canh ấm và ngọn đèn chờ cửa.\nHôm nay con trồng một khu vườn nhỏ,\nmỗi bông hoa là một lời cảm ơn con chưa kịp nói.\nMẹ cứ thong thả ngắm hoa thôi nhé —\nphần chăm vườn, để con.',
        notes: [
            'Hồi bé con cứ tưởng mẹ không bao giờ mệt. Lớn rồi mới biết, mẹ chỉ giấu mệt rất khéo.',
            'Bát canh mẹ nấu chẳng cầu kỳ gì, vậy mà đi đâu xa con cũng nhớ đúng vị ấy.',
            'Con từng mong mau lớn để đi thật xa. Giờ chỉ mong mỗi lần về, vẫn nghe mẹ gọi tên con từ trong bếp.',
            'Mẹ hay nhắc con mặc thêm áo. Con vẫn nhớ đấy, chỉ là ít khi nói ra thôi.',
            'Có những việc mẹ làm mỗi ngày, nhỏ đến mức con quên mất phải cảm ơn. Hôm nay con xin nói bù.',
            'Mẹ giống mái hiên nhà mình: mưa hay nắng cũng đứng đó, chẳng bao giờ kể công.',
            'Khu vườn này lớn chậm thôi, như cách mẹ đã kiên nhẫn chờ con lớn.',
            'Con không cần mẹ lo cho con nhiều nữa đâu. Mẹ cứ thong thả, phần còn lại để con.',
            'Hôm nào mẹ thấy buồn, cứ ghé vườn ngồi một lát. Hoa không biết nói, nên con nói hộ: con thương mẹ.',
            'Cảm ơn mẹ vì đã tưới cho con những năm tháng tốt lành nhất.'
        ],
        palette: 'hong-phan', backdrop: 'golden', flowerFont: 'script', textFont: 'lora'
    },
    'vo-chong': {
        icon: '🏡', label: 'Cảm ơn vợ/chồng', mode: 'cam-on', ph: { sender: 'Tên bạn', receiver: 'Tên vợ / chồng' },
        flowerText: '{nhan}',
        message: 'Nhà mình chẳng có gì lớn lao,\nchỉ có hai người cùng tưới một khoảnh vườn nhỏ.\nCó hôm nắng gắt, có hôm mưa dầm,\nnhưng chiều nào về cũng thấy hoa vẫn nở.\nCảm ơn {nhan} — vì đã ở lại,\nvà vẫn cùng mình chăm vườn, mỗi ngày.',
        notes: [
            'Có những buổi tối chẳng làm gì đặc biệt, chỉ ngồi cạnh {nhan} xem hết một bộ phim. Vậy mà thấy đủ.',
            'Nhà là nơi có người nhớ mình thích ăn gì, ghét ăn gì. Cảm ơn {nhan} đã nhớ giùm mình nhiều thứ đến thế.',
            'Hai đứa từng giận nhau vì những chuyện chẳng đâu vào đâu. Giờ nhớ lại, chỉ còn nhớ lúc làm lành.',
            'Cảm ơn {nhan} vì những lần nhường mình phần đúng, dù cả hai đều biết ai sai.',
            'Có hôm mình về muộn, cơm vẫn để phần trên bàn, nắp vung còn ấm. Chẳng cần ai nói gì thêm.',
            'Nhà mình không cần nhiều hoa. Chỉ cần mỗi mùa có một bông nở đúng lúc hai đứa cùng nhìn thấy.',
            'Mình không cần những ngày rực rỡ. Chỉ cần sáng thức dậy, quay sang, vẫn thấy {nhan} ở đó.',
            'Thương nhau lâu rồi, lời nói ít đi, nhưng ánh mắt thì vẫn biết đường tìm nhau.',
            'Mình mong được già đi cùng {nhan} thật chậm, như hai cái cây trồng cạnh nhau, rễ đan vào nhau lúc nào chẳng biết.',
            'Nếu được chọn lại, mình vẫn chọn {nhan} — lần nào cũng vậy.'
        ],
        palette: 'hoa-dao', backdrop: 'lanterns', flowerFont: 'script', textFont: 'playfair'
    },
    'to-tinh': {
        icon: '💗', label: 'Tỏ tình', mode: 'to-tinh', ph: { sender: 'Tên bạn', receiver: 'Tên người ấy' },
        flowerText: '{nhan}',
        message: 'Mình vốn không giỏi gọi tên cảm xúc,\nnên đành gieo nó xuống đất, chờ ngày hoa nở.\nMỗi lần {nhan} ghé vườn, nắng như dịu hơn một chút,\ngió cũng biết đi khẽ hơn một chút.\nHôm nay hoa đã nở đủ rồi —\nmình nghĩ, đến lúc nói thật lòng.',
        question: 'Mình có thể là người cùng {nhan} tưới những mùa hoa sau không?',
        notes: [
            'Có một hạt giống mình giữ trong lòng khá lâu rồi. Hôm nay mới dám gieo xuống đây.',
            'Mình hay để ý những điều nhỏ: {nhan} thích uống gì, cười thì nghiêng đầu về bên nào. Chắc vì để ý nhiều quá nên thành thương.',
            'Người ta tưới cây bằng nước. Còn mình, hình như tưới bằng những lần nghĩ về {nhan}.',
            'Mỗi khi thấy {nhan} vào vườn, mình lại mong hoa nở nhanh hơn một chút, để {nhan} có thêm thứ để ngắm.',
            'Hôm nay trời mưa. Mưa tưới giúp cả vườn, chỉ riêng nỗi nhớ là mình phải tự mang.',
            'Có những câu mình định nói mấy lần rồi lại thôi. Thôi thì để hoa nói trước vậy.',
            'Mình không hứa những điều to tát. Chỉ mong được làm người nhắc {nhan} uống đủ nước, ngủ đủ giấc.',
            'Đêm nay có sao băng. Mình đã kịp ước, và điều ước ấy nghe hơi giống tên {nhan}.',
            'Nếu mọi thứ còn sớm quá, cũng không sao. Hoa vẫn nở, và mình vẫn ở đây tưới cây.',
            'Lá thư cuối rồi. Còn một điều nữa, mình để dành nói khi cả vườn cùng nở.'
        ],
        palette: 'hong-do', backdrop: 'twilight', flowerFont: 'script', textFont: 'playfair'
    },
    'chuc-2010': {
        icon: '🌷', label: 'Chúc 20/10', mode: 'cam-on', ph: { sender: 'Tên bạn', receiver: 'Tên người nhận' },
        flowerText: '20/10',
        message: 'Tháng Mười, trời vừa chớm se,\nkhu vườn nhỏ này xin nở thay một lời chúc.\nChúc {nhan} luôn được dịu dàng với chính mình,\nđược thương nhiều như cách {nhan} vẫn thương mọi người.\nHôm nay là ngày của {nhan} —\nmong những ngày sau cũng nhiều hoa như thế.',
        notes: [
            'Chúc {nhan} một ngày có nắng vừa đủ ấm, gió vừa đủ mát, và chẳng có việc gì phải vội.',
            'Mỗi bông hoa một hương, một mùa nở riêng. Chúc {nhan} cứ nở theo cách của mình nhé.',
            'Cảm ơn {nhan} vì đã làm những ngày bình thường quanh đây dễ chịu hơn.',
            'Hôm nay {nhan} được phép lười một chút, cười nhiều một chút, và nhận hoa mà không cần lý do.',
            'Chúc {nhan} luôn có một góc riêng để nghỉ ngơi, như khu vườn này, lúc nào cũng mở cửa.',
            'Có những người chăm chút cho mọi người mà quên chăm cho mình. Hôm nay để vườn chăm giúp {nhan} nhé.',
            'Mong {nhan} gặp toàn chuyện vui, còn chuyện buồn thì như mưa bóng mây — đến nhanh, đi cũng nhanh.',
            'Hoa trong vườn không phải để hái hết, mà để {nhan} nhớ rằng mình xứng đáng được ngắm hoa.',
            'Chúc {nhan} giữ mãi nụ cười của hôm nay, cả vào những ngày chẳng phải dịp lễ.',
            'Ngày 20 tháng 10 rồi sẽ qua, nhưng lời chúc thì mình gửi lại đây, mở lúc nào cũng được.'
        ],
        palette: 'tulip', backdrop: 'sakura', flowerFont: 'cute', textFont: 'lora'
    },
    'tinh-yeu': {
        icon: '💞', label: 'Cảm ơn tình yêu', mode: 'cam-on', ph: { sender: 'Tên bạn', receiver: 'Tên người yêu' },
        flowerText: '{nhan}',
        message: 'Cảm ơn {nhan} đã đến, nhẹ như cơn mưa đầu mùa —\nkhông ồn ào, mà đất bỗng mềm, cây bỗng xanh.\nTừ khi có {nhan}, ngày thường cũng có hoa để ngắm,\nđêm dài cũng có sao để ước.\nVườn này nhỏ thôi,\nnhưng mỗi bông hoa là một ngày mình được ở cạnh nhau.',
        notes: [
            'Có {nhan} rồi, mình mới biết chờ một tin nhắn cũng là một kiểu vui.',
            'Mình thích những buổi đi cạnh nhau chẳng cần nói gì nhiều. Im lặng bên {nhan} cũng thấy dễ chịu.',
            'Cảm ơn {nhan} vì đã kiên nhẫn với những lúc mình vụng về, nói chưa tròn câu.',
            'Mỗi người có một mùa đẹp nhất. Mùa của mình, hình như bắt đầu từ hôm gặp {nhan}.',
            'Có hôm mệt, chỉ cần nghe giọng {nhan} là ngày dài cũng ngắn lại.',
            'Mình không biết mai sau thế nào. Chỉ biết trong đó, mình muốn có {nhan}.',
            'Hoa nở rồi tàn, nhưng hạt thì còn. Thương {nhan} cũng vậy, mùa nào cũng gieo lại được.',
            'Cảm ơn {nhan} vì những lần giận xong vẫn là người nắm tay trước.',
            'Hôm nào thấy mình chưa đủ tốt, cứ nói với mình nhé. Mình sẽ chăm chút hơn, như chăm khu vườn này.',
            'Hai đứa mình cứ chậm rãi thôi, như cây lớn từng chút một. Miễn là cùng nhau.'
        ],
        palette: 'oai-huong', backdrop: 'bokeh', flowerFont: 'script', textFont: 'script'
    }
};

// mẫu mặc định khi mở form: gần 20/10 thì gợi ý lời chúc 20/10
export function defaultTemplate(d = new Date()) { return d.getMonth() === 9 && d.getDate() <= 20 ? 'chuc-2010' : 'tinh-yeu'; }

// điền tên vào mẫu -> { flowerText, message, question, notes (mỗi dòng một lá) }
export function fillTemplate(t, { gui, nhan }) {
    const sub = s => String(s || '').replace(/\{nhan\}/g, nhan || 'người ấy').replace(/\{gui\}/g, gui || 'mình');
    const ft = sub(t.flowerText);
    return { flowerText: ft.charAt(0).toUpperCase() + ft.slice(1), message: sub(t.message), question: t.question ? sub(t.question) : '', notes: t.notes.map(sub).join('\n') };
}
