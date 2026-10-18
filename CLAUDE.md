# CLAUDE.md — Vườn hoa của hai người

Tài liệu cho AI (và người) làm việc với dự án này. Đọc hết trước khi sửa code.

## Dự án là gì
Một game nông trại hoa pixel art chạy trên trình duyệt (HTML/CSS/JS thuần, không build), cho **hai người chơi cùng một khu vườn từ xa**: người gửi (`gui`) và người nhận (`nhan`). Hai người cùng chăm vườn khoảng 1–2 giờ, có thể chia làm nhiều lần chơi. Phần kết ("Lễ hội hoa") là một lời cảm ơn hoặc lời tỏ tình viết sẵn trong `config.js`, kèm câu hỏi và câu trả lời nếu là tỏ tình. Toàn bộ chữ trong game là **tiếng Việt**.

Triển khai bằng **Cloudflare Workers + Static Assets + Durable Objects** (`wrangler.jsonc`). Mỗi khu vườn là một Durable Object giữ trạng thái chung và đồng bộ qua WebSocket.

## Lệnh
```
npm run dev        # wrangler dev -> http://localhost:8787/<slug>   (/play = chơi thử một mình, lưu localStorage)
npm run dev:fresh  # xoá dữ liệu vườn ở máy (.wrangler/state) rồi chạy dev; `npm run clean` chỉ xoá
                   # dữ liệu trong trình duyệt: thêm ?reset vào URL (vd /play?reset) — xoá localStorage, và vườn máy chủ nếu bật cheat
npm run deploy     # wrangler deploy (cần `npx wrangler login` một lần)
npm run links -- <url>   # in đường dẫn riêng của từng người
npm run balance    # bot chơi theo luật thật, đo thời lượng tới Lễ hội hoa (1 người / 2 người)
```
`?demo` sau URL: game tự chơi. Menu cheat: mã Konami ↑↑↓↓←→←→BA (điện thoại: vuốt theo thứ tự đó rồi chạm 2 lần). Cheat chỉ bật khi `cheats: true` trong `config.js`; trang `/play` luôn bật.

## Cấu trúc
```
config.js            title, cờ cheats và (không bắt buộc) các khu vườn khai báo sẵn (id, mode, sender/receiver {slug,name}, flowerText,
                     message, signature, question, notes[], palette, backdrop, flowerFont, textFont, seed). Vườn thường được tạo trên web.
src/worker.js        Worker: /<slug> -> play.html; /api/card/<slug> -> thông tin cho đúng người đó; /ws/<slug> -> Durable Object `Garden`;
                     POST /api/garden tạo vườn, GET|PUT /api/garden/<slug người gửi> đọc/sửa (cleanCfg kiểm tra dữ liệu).
                     DO `Registry` (một bản, tên 'registry'): slug -> {gid, role} | {gone}, đếm vườn, giới hạn tạo theo IP/giờ (`quota`);
                     worker đệm kết quả tra slug trong bộ nhớ (CACHE). Cấu hình vườn web lưu trong DO `Garden` (khoá 'cfg')
public/play.html     trang game (có màn chào logo) · public/img/logo.png logo + favicon
public/index.html    trang chủ: form tạo vườn, sửa vườn (`/?sua=<slug người gửi>`), danh sách vườn đã tạo (localStorage `vuon-hoa-mine`),
                     xem thử đoạn kết (ghi `vuon-hoa-preview` rồi mở `/play?thu`: game.js dùng card đó và chiếu đoạn kết ngay)
                     Form chia 5 bước (Hai người · Dịp · Lời nhắn · Lá thư · Màu sắc), mỗi lá thư một ô riêng. `/?tao` mở thẳng form. Mẫu gợi ý (cảm ơn mẹ, vợ/chồng, tỏ tình, chúc 20/10, cảm ơn tình yêu) ở public/js/lib/templates.js
                     ({nhan}/{gui} thay bằng tên; chưa sửa chữ mẫu thì đổi tên sẽ tự điền lại; gần 20/10 mặc định mẫu 20/10)
public/js/rules.js   ★ LUẬT CHƠI + NỘI DUNG (loài hoa, thời tiết, chợ, cấp gắn kết, đồi hoa, phạt/thưởng). Dùng chung máy chủ + trình duyệt
public/js/game.js    vòng lặp, bố cục, điều khiển, HUD, chợ/sổ tay, menu giữ tay, báo cáo vắng mặt, hướng dẫn, cheat, Lễ hội hoa
public/js/art.js     vẽ luống (cả ô chưa mua), 20 loài hoa (mầm → nụ → nở → héo/tàn, hoa lấp lánh), sâu, cỏ dại, trời, thời tiết,
                     sự kiện (`drawEvent`), sao băng (`drawStar`), ánh sáng ban đêm
public/js/yard.js    QUANH VƯỜN: hàng rào liền mạch, cây to hai góc + cây nhỏ trên đồi, thùng ủ, hòm thư, radio (`drawYard`, trả vùng chạm)
                     và con vật nhỏ trang trí (`drawCritters`: chim sẻ, sóc, thỏ, bướm, ong, cú đêm). Bộ dựng hình chung `build()`
                     (bảng màu chung, không viền, cache) + `blit()` (bóng đổ, tối về đêm phía trên chân trời)
public/js/radio.js   radio YouTube nghe chung: IFrame API, đồng bộ theo st.radio, trình phát (danh sách, thanh thời gian, phát/dừng, tua)
public/js/hill.js    đồi hoa 3D phía sau hàng rào (chuyển từ legacy/src/backgrounds/flowerfield.js: dò tia, phối cảnh, mật độ R2);
                     `buildHill(BW, H, seed)`: dáng đồi đổi theo seed + round (mỗi lần trồng lại vườn một dáng)
public/js/audio.js   nhạc lofi + âm thanh cảnh + hiệu ứng, tự tạo bằng Web Audio (không có file nhạc)
public/js/tour.js    hướng dẫn từng bước: vùng sáng + thẻ; mỗi bước chờ thao tác thật (`wait`), nhớ việc đã làm trước, tự ẩn khi đang mở bảng
public/js/ui.js      thông báo nổi (toast), bảng trượt (sheet), lá thư
public/js/net.js     WebSocket (tự nối lại, sync mỗi 30 s; vườn đã xoá -> /?het) hoặc "vườn ảo" trong trình duyệt cho /play
public/js/lib/       math (hash, fbm, mulberry32), draw (put/disc/line/heart), palettes, backdrops (12 nền trời đoạn kết),
                     flower-text (chữ xếp bằng hoa), fonts
scripts/balance.mjs  bot cân bằng · scripts/links.mjs in link
TODO.md              ý tưởng để phát triển sau (người dùng và Claude cùng ghi; ý mới thêm vào mục phù hợp, xong thì đánh [x])
legacy/              code cũ dựng đồi hoa (chỉ tham khảo, không triển khai)
```

## Nguyên tắc kiến trúc (bắt buộc giữ)
1. **Luật tất định, dùng chung.** `rules.js` chạy y hệt trên máy chủ và hai trình duyệt. Trong mô phỏng (`advance`/`stepSim`) chỉ dùng `+ - * /`, `Math.min/max/floor` và `ihash` (hash số nguyên). **Không** dùng `Math.random`, `Math.sin` hay `Date` bên trong mô phỏng. Ngẫu nhiên lấy từ `ihash(st.seed, st.step, i, k)`.
2. **Máy chủ có thẩm quyền.** Trình duyệt gửi hành động `{type, ...}`. Durable Object chạy `advance(st, now, online)` rồi `apply(...)`, lưu và broadcast `{type:'state', st, fx, notes, online, now}`. Trình duyệt thay toàn bộ `st` khi nhận, rồi tự `advance` mỗi khung hình để dự đoán mượt.
3. **Thời gian tính bù, không chạy nền.** Durable Object không có vòng lặp. Mỗi khi có tin nhắn hoặc kết nối, nó tính bù thời gian từ `st.real`. Khi **không ai online**, thời gian vườn trôi `SLEEP_RATE = 1/80` ("vườn ngủ": 4 giờ thật ≈ 3 phút vườn, đủ để cây vừa tưới không chết khô), bù tối đa 6 giờ vườn. Nhờ vậy vườn vẫn diễn biến khi cả hai vắng mặt, chỉ chậm hơn.
4. **Hiệu ứng `fx`.** `apply`/`advance` trả về danh sách sự kiện (`{k:'harvest', i, sp, dew, role}`, `bloom`, `die`, `weather`...). `game.js#onFx` biến chúng thành âm thanh, hạt bay và thông báo. Thông báo chống lặp bằng key, vì cùng một sự kiện có thể đến từ dự đoán và từ máy chủ.
5. **Tăng `V` của state khi đổi cấu trúc** (hằng `V` trong rules.js, hiện là 9). Worker và net.js reset vườn khi `st.v !== V`.
6. **Đừng ghi đè innerHTML liên tục** cho thứ bấm được (đồng hồ, bảng vật dụng…): dùng `setHTML` (chỉ ghi khi đổi), nếu không cú chạm sẽ mất.
7. **Vòng lặp không bao giờ được chết:** `loop` đặt `requestAnimationFrame` trước rồi mới gọi `frame` trong try/catch (một lỗi lẻ từng làm game "treo"). Quay lại sau khi tab bị ẩn (> 4 s) thì không phát hàng loạt thông báo mà xin `sync`. Máy yếu (vẽ > 13 ms) tự vẽ 30 khung/giây. `?perf` đo thời gian từng phần (`window.__perf`).
8. **Thư bí mật không gửi trước.** `/api/card` chỉ trả số lượng `notesTotal`; nội dung thư chỉ gửi kèm `state` khi đã mở (`st.notes` = số thư đã mở).
   Thư hẹn giờ cũng vậy: worker gửi **mỗi người một bản state** (`broadcastState` → `viewFor(st, role, now)`), chữ của thư người kia viết mà chưa tới ngày mở bị thay bằng `''`.
9. **Giờ thật chỉ dùng ngoài mô phỏng.** Cây kỷ niệm đếm ngày thật (`vnDay`, giờ Việt Nam) trong `visit(st, role, now)` — gọi khi kết nối, khi `sync` và đầu mỗi `apply`; không bao giờ trong `stepSim`.

## Luật chơi (tóm tắt — số liệu thật nằm trong rules.js)
- **Vườn:** lưới 5×5 = `MAX_PLOTS` 25 ô. Ban đầu chỉ có **2 luống ở giữa** (ô 7 và 12); các ô khác `st: 'locked'`.
  - **Mở rộng** (`{type:'expand', i}`): chỉ ô sát luống đã có (`canExpand`), giá `plotPrice` tăng dần (6, 10, 15… ✨). Đất mới là cỏ hoang (chạm 3 lần để khai hoang, +1 🍂).
  - **Bỏ trống sau khi hái** (hoặc dọn cây khô): luống có `left = LEAVE_GRACE` (45 giây vườn); hết thời gian mà chưa gieo thì thành cỏ hoang lại (`dig: 1`, còn 2 nhát). Cỏ lấn dần vào luống để báo trước.
- **Vòng chăm:** gieo → tưới (độ ẩm `w` giảm dần theo loài và thời tiết) → lớn (`g` 0→1) → nở → hái lấy ✨ (hạt sương = tiền). Hoa nở 6 phút không hái thì tàn, 4 phút sau nữa thì chết khô.
- **Phạt khi quên:**
  - `w = 0` thì máu `hp` giảm, dưới 0,6 là héo (chất lượng `q` −0,3), về 0 là chết khô (−2 💞, đồi mất hoa).
  - Sâu (`bug`) làm chậm lớn và hại máu.
  - Cỏ dại (`weed`) mọc, lan sang luống bên, làm chậm lớn và mau khô.
  - Giông quật cây chưa nở (mái che bảo vệ).
- **Thưởng:**
  - Hoa "hoàn hảo" (không khát, không sâu, `q ≥ 1.3`) được ×1,5 ✨.
  - **Cùng tưới** một cây trong 3 giây: +5 💞, +0,15 `q`, đồi thêm hoa.
  - Ở cùng nhau: cây lớn nhanh hơn 25%, hái được +10%.
  - Cầu vồng: hái +50%.
  - Sao băng ban đêm: chạm để được +25 ✨ hoặc hạt Song Tâm.
- **Gắn kết 💞 (không giới hạn cấp):** +2/phút khi cả hai online (chơi một mình khi người kia chưa từng vào: +1/phút), cộng thêm từ hái hoa, cùng tưới, sao băng, điều ước. Mốc `xpFor(n)`; quà `levelGift(n)`: cấp 1–5 cố định (Song Tâm, phân vàng + thư, ✨ + Song Tâm, thư, cầu vồng), sau đó xoay vòng (✨ + hoa trên đồi, phân vàng + Song Tâm + thư, 3 hạt quý).
- **Điều ước** (`st.wishes`, `WISHES`): luôn có 3 nhiệm vụ nhỏ (hái N bông, hái loài X, tưới, cùng tưới, hoàn hảo, gieo, dùng đồ, giúp sự kiện, bắt sâu, ước sao băng). Xong: ✨ + 3 💞 (sau Lễ hội: thêm 25 bông trên đồi). Mỗi bình minh vườn, điều ước đã xong được thay mới (`refreshWishes`); tiến độ cộng qua `wishTick`.
- **Hoa lấp lánh:** 5% hạt gieo xuống thành cây lấp lánh (`P.shiny`): hái ×2,5 ✨, +5 bông trên đồi, ghi vào `st.shiny` (bộ sưu tập riêng trong Sổ tay).
- **Sau Lễ hội hoa** (`st.done`): thư "Hành trình tiếp theo", điều ước làm đồi nở thêm, săn hoa lấp lánh, cấp gắn kết tiếp tục, đêm nào cũng có đèn trời bay lên, xem lại lễ hội và gửi bưu thiếp trong Sổ tay. Thao tác trong vườn chỉ bị khoá lúc chờ vuốt (`st.fw`); lúc chiếu đoạn kết thì trình duyệt tự chặn chạm (trước đây `liftAt` khoá vĩnh viễn — lỗi đã sửa). Thêm ba phần:
  - **Bốn mùa** (`SEASONS`, `seasonAt`): mỗi mùa `SEASON_DAYS = 3` ngày vườn tính từ `st.sf` (đầu ngày diễn ra lễ hội), thứ tự xuân → hạ → thu → đông. `WX_ODDS` đổi tỉ lệ thời tiết theo mùa; mùa đông mưa thành **tuyết** (`snow`: đất khô chậm ×0,4, không sâu, cây lớn ×0,7 trừ hoa mùa đông); xuân hay có cầu vồng. Mỗi mùa 4 loài hoa mùa (hái ×1,5 ✨); hái đủ `SEASON_GOAL = 12` → fx `seasonfest`: +80 ✨, +10 💞, hoa mùa lên đồi, 2 hạt mỗi loài của mùa sau. Mùa cũ ghi vào `st.seasons`. Hình: cỏ (`GRASS` + `buildGrass`), đồi (`HILL_TINT` → tham số `tint` của `drawHill`), tán cây (`SEASON_TINT` trong yard.js; hạ: cây hoa bên phải ra lá xanh), hạt rơi (`drawSeason` trong art.js: cánh hoa / chuồn chuồn / lá vàng / tuyết).
  - **Cây kỷ niệm** (`st.mem = {days, streak, best, last, seen}`, `visit`): mỗi ngày giờ Việt Nam mà cả hai đều ghé (không cần cùng lúc; người kia chưa từng vào thì một người là đủ) → `days++`, chuỗi ngày liền `streak`. `memStage` 0–6 (mầm → cây hoa hồng 30 ngày → hoa vàng 100 ngày), vẽ ở `memTreeSpot` (thay cây nhỏ bên trái trên đồi), ruy băng = số ngày, tim bay khi chuỗi ≥ 3. Quà `memGift` ở mốc `MEM_MARKS` (1, 3, 7, 14, 30, 50, 100, rồi mỗi 50 ngày); thư mốc ở `MEM_TEXT` (game.js). Chạm cây → bảng `memHTML`.
  - **Thư hẹn giờ** (`st.caps = [{id, r, to, tx, at, open, read}]`): `{type:'capsule', tx (≤600), days (1–730)}` mở lúc 00:00 giờ Việt Nam; mỗi người tối đa `CAP_MAX = 5` lá đang chờ. Tới ngày, game tự bật thư (`checkCaps`) và gửi `{type:'capread', id}`; hòm thư dựng cờ. Người kia chưa từng vào vườn thì thư quay về người viết (`capTo`).
  - `mem`, `caps`, `seasons` giữ lại khi trồng lại vườn. Cheat nhóm "Sau Lễ hội": sang mùa sau, còn 1 bông hoa mùa, +1 ngày cây kỷ niệm, mở mọi thư hẹn giờ, tuyết.
- **Lễ hội hoa** (`canFinale`): đủ `BOOK_GOAL = 14` trên 20 loài đã nở, gắn kết cấp ≥ 3, và **vườn nở rộ** (`bloomNow` ≥ `FULL_BLOOM = 10` bông cùng nở). Khi đủ hai điều kiện đầu thì vào **sự kiện ẩn** (`bloomQuest`; luôn có, kể cả khi vườn đã từng nở rộ trước đó — chỉ 10 bông cùng nở TRONG sự kiện mới đặt `st.rong` và mở Lễ hội, fx `quest`): hoa tươi lâu ×`QUEST_LIFE` = 3 (cả lúc tàn → khô), game.js hiện lá thư mời một lần mỗi vòng (localStorage `vuon-hoa-quest-<slug>`), dòng gợi ý đếm x/10, chạm vào hoa không hái (hái qua menu). Sau đó hai người vuốt tổng 6 lần (mỗi người ít nhất 1 lần nếu cả hai từng vào vườn). Hoa trong vườn và trên đồi bay lên trời, máy ngước theo, hoa xếp thành `flowerText`, rồi hiện `message`, `signature`, và `question` nếu là tỏ tình.
- **Đồi hoa** (`st.hill`): chuỗi mã loài, mỗi ký tự = 1 bông, tối đa `HILL_MAX = 1500`.
  - Mỗi bông hái được gieo **1 bông** lên đồi (bồ công anh, dã quỳ: 2). Cùng tưới +1, vườn nở rộ +2 mỗi bông đang nở.
  - **Tự sinh sôi:** khi có người trong vườn, mỗi bông trên đồi có xác suất `HILL_SEED_RATE`/phút sinh thêm 1–3 bông cùng loài (×1,5 khi hai người cùng ở đây) → đồi phủ nhanh dần về cuối.
  - Mất hoa: cây chết (−4), hoa tàn khô (−2).
  - **Vuốt màn hình** (`{type:'gust'}`, gửi khi thả tay sau một lần vuốt dài, tối đa 1 lần/1,5 s): cơn gió `GUST_TIME` = 20 giây vườn (`st.gust`), cộng thêm `HILL_GUST_LOSS` = 4%/phút vào xác suất gió thổi bay bên dưới (cả lúc trời lặng; fx `hillWind` với `w: 'gust'`). Không có tác dụng lúc chờ vuốt Lễ hội / đoạn kết.
  - **Gió thổi bay** (`HILL_WIND_LOSS`): khi có người trong vườn, mỗi bông trên đồi có xác suất 2%/phút (gió nhẹ) hoặc 4%/phút (giông) bị cuốn đi (bớt từ cuối chuỗi, fx `hillWind`: cánh hoa bay + thông báo một lần mỗi đợt thời tiết). Không tính lúc chạy đoạn kết.
  - `hill.js` vẽ `hillCount = tỉ lệ × số chỗ mọc` (~5400 chỗ).
- **Ngày/đêm:** 1 ngày = 12 phút (`DAY = 720` s; 05:00–21:00 là ngày = 8 phút).
- **Thời tiết** đổi mỗi 4 phút (`WEATHER`): nắng, mây, mưa, nắng gắt, gió nhẹ, sương mù, giông, cầu vồng (chỉ sau mưa hoặc giông), tuyết (chỉ mùa đông sau Lễ hội). Mỗi loại có thử thách và phần thưởng riêng; xem `stepSim`.

### 20 loài (`SPECIES`) — tất cả trồng trên đất (không có loài cần ao nước)
Cúc hoạ mi (dễ) · Hướng dương (chỉ lớn ban ngày) · Cúc vạn thọ (xua sâu cả 8 ô quanh) · Bồ công anh (thích gió; hái được hạt + đồi ×2) · Tulip ·
Hoa mười giờ (chịu nắng, nụ chỉ bung 10–14h) · Oải hương (xua sâu luống kề) · Xương rồng hoa (chịu hạn, thích nắng gắt) · Dã quỳ (thích gió/mây, đồi ×2) ·
Cẩm chướng (hoàn hảo ×2 ✨) · Cẩm tú cầu (khát) · Thược dược (ưa ẩm: chỉ lớn khi w > 0.5, mưa lớn nhanh) · Hoa ly (hương thơm: luống kề lớn nhanh 15%) ·
Hoa mai (chỉ bung 05–09h) · Hoa hồng (hay sâu) · Hoa giấy (bền: chịu khát, hoa giữ lâu gấp đôi) · Hoa lan (ưa mây/sương, nắng gắt làm yếu) ·
Hoa quỳnh (chỉ nở đêm, tàn nhanh) · Mẫu đơn (phải bón phân mới qua 60%) · **Song Tâm** (không bán; chỉ lớn khi cả hai online; hái mở một lá thư).

### Chợ (`SHOP`)
- **Dùng dần** (`use`): phân bón, phân vàng, túi hạt bí ẩn.
- **Dụng cụ** (`tool`): bình tưới lớn (tưới lan sang luống bên), kéo vàng (+20% ✨).
- **Mở khoá** (`unlock`, lưu trong `st.decor`): 📝 Giấy ghi chú & hòm thư (mở Lời nhắn), 🧺 Thùng ủ phân (mở Ủ phân: 3 🍂 → 1 🧪; 🍂 có từ nhổ cỏ, dọn cây khô, khai hoang).
  Đây là hai đồ dùng duy nhất trong vườn (các công trình khác đã bỏ, sẽ thiết kế lại). `ACTS` chỉ còn `thung`; `AUTO` rỗng.


### Sự kiện ngẫu nhiên (`EVENTS`, `rollEvent`)
Mỗi phút vườn (khi có người, sau phút thứ 2,5) có 30% xảy ra một sự kiện, chọn theo hoàn cảnh: 🦋 đàn bướm (lớn nhanh 30%), 🐦‍⬛ quạ rình cây non
(chạm để đuổi, không thì mất cây), 🎁 gói quà, 🐱 mèo nằm trên luống (chạm vuốt ve +💞), 🍀 cỏ bốn lá (lần hái tới ×2), ✨ đom đóm (đêm),
🐛 sâu kéo đến, 🌬️ hạt lạ, 🌦️ mưa bóng mây. Sự kiện đang diễn ra: `st.ev = {k, i, end, id}`; chạm: `{type:'ev'}`.

## Giấy ghi chú (lời nhắn)
Phải mua 📝 trước. Mỗi người một tờ đang gửi: `st.mail[người viết] = {tx, at, read}`. `{type:'letter', tx}` (≤240 ký tự) chỉ được khi tờ trước
của mình đã được đọc; người kia mở hòm thư thì gửi `{type:'read'}`. Các tờ đã gửi lưu ở `st.msgs` (30 tờ, giữ khi trồng lại vườn).
Hòm thư trong sân dựng cờ đỏ khi có tờ chưa đọc; nút 💌 có huy hiệu; báo cáo vắng mặt nhắc tờ mới.

## Chơi đôi
- **Hoa ghép đôi** (`st.lastPlant`, `HYBRID_MS = 5000`): hai người (khác vai) gieo vào hai luống kề nhau (4 hướng) trong 5 giây, cây trước còn non
  → cả hai cây có `P.hy = hybridKey(a, b)`. Hoa lai: hình của loài mình, màu của loài kia (`spColor` trong art.js), có trái tim nhỏ khi đang lớn;
  hái được ×1,5 ✨ và gieo cả loài kia lên đồi. Nở lần đầu ghi vào `st.hybrids` (bộ sưu tập giống lai trong Sổ tay, tên `hybridName`).
- **Tưới nối tiếp** (`st.chain`, `CHAIN_MS = 3000`): hai người thay phiên tưới các luống kề nhau, mỗi lần cách lần trước dưới 3 giây → chuỗi n tăng:
  +min(12, 2n) ✨, từ n ≥ 3 thêm 💞, từ n ≥ 4 thêm hoa trên đồi, mỗi 5 nhịp thưởng thêm. Vẽ chuỗi trái tim nối hai luống (`links`).

## Radio 📻 (radio.js)
Radio ngồi trên đỉnh hàng rào (giữa), mở từ radio, từ 🧰 Vật dụng hoặc dòng "🎵 đang phát" dưới thanh trên. Dán link YouTube: một bài (thêm vào
hàng chờ) hoặc danh sách phát, kể cả danh sách Mix `RD…` (thay cả hàng chờ; máy đầu tiên tải được danh sách gửi mã bài qua op `items`, không đọc được thì phát bài đầu). Trạng thái chung `st.radio = {q, i, play,
pos, at, list, rev, by}` đổi qua `{type:'radio', op}` (add, list, items, play, pause, seek, go, next, prev, end, remove, clear). Vị trí đang phát =
`pos + (giờ máy chủ − at)`; mỗi máy tự tua lại khi lệch > 2,5 s → hai người nghe chung một bài. Hết bài → `end` (chỉ nhận khi `i` khớp) → bài sau, quay vòng;
bài lỗi nhúng thì bỏ qua, cả danh sách lỗi thì dừng. Trình phát: tên bài (worker `/api/yt/<id>` lấy qua oEmbed), thanh thời gian, ⏮ ⏪10s ▶/⏸ 10s⏩ ⏭,
danh sách (chạm để chuyển, ✕ để bỏ). Âm lượng và "tắt ở máy mình" lưu riêng (localStorage). Radio phát → `audio.duck(true)`: nhạc lofi tắt, âm thanh
cảnh (mưa, gió, dế) và hiệu ứng còn 50%. Iframe YouTube luôn nằm trong `#radio` (khi đóng chỉ trượt ra ngoài) để nhạc không dừng; trình duyệt chặn tự phát
thì hiện "Chạm để nghe cùng" và lần chạm đầu trên trang sẽ bắt nhịp lại (`radio.kick`).

## Bưu thiếp 📸 (Sổ tay)
`makePostcard()` vẽ khung hình vườn hiện tại (phóng to kiểu pixel) lên tấm thiệp 1080×1440 kèm logo, tên hai người, ngày, thành tích → tải về hoặc chia sẻ (Web Share).

## Giao diện & điều khiển (game.js)
- **Khung game `#app`**: điện thoại = toàn màn hình; máy tính = khung dọc ~9:14 ở giữa (CSS `transform` trên #app nên mọi phần tử
  `position: fixed` bên trong neo theo khung). Trong JS luôn dùng `VW()/VH()` (kích thước khung) và `ex(e)/ey(e)` (toạ độ chuột trong khung),
  KHÔNG dùng innerWidth/innerHeight/clientX trực tiếp.
- Thanh dưới: Hạt · Chợ · 💌 Lời nhắn · Sổ tay · ❓ Hướng dẫn (xong hướng dẫn thì thành **🧰 Vật dụng**: bảng thả xuống `#tools` với nút to: Ủ phân, Radio, Hòm thư; huy hiệu = số việc sẵn sàng). **Thanh gắn kết 💞** là dải mảnh ngay trên thanh dưới.
  Cài đặt âm thanh ở cuối Sổ tay. Chạm đồng hồ = xem thời tiết + dự báo; chạm 💞 = xem tiến độ gắn kết.
- **Quanh vườn** (yard.js): hàng rào cọc liền mạch; cây lá to góc trái, cây hoa hồng góc phải (đứng trước hàng rào, tán phủ lên đồi), hai cây nhỏ
  nhạt màu trên đồi; thùng ủ phân dưới gốc cây trái, hòm thư dưới gốc cây phải (cờ đỏ khi có thư chưa đọc); radio trên hàng rào. Vườn 5×5 thu vào giữa
  (`gw = 0,85·BW`) để chừa hai bên cho cây. Con vật chỉ để trang trí, vẽ theo thời gian (không vào luật chơi).
- Nhạc (audio.js) tự soạn theo đoạn 8 ô nhịp: đổi vòng hợp âm (5 vòng), kiểu đoạn (intro/groove/melody/break/arp), nhịp độ, trống, motif giai điệu; ban đêm nhẹ hơn.

- **Chạm** luống: `tapPlot` tự chọn việc theo thứ tự: khai hoang/dọn, bắt sâu, hái, nhổ cỏ, bón mẫu đơn, tưới, gieo hạt đang chọn. **Giữ tay** (420 ms), **chạm 2 lần** (< 350 ms, trừ bãi cỏ hoang) hoặc chuột phải: `openMenu`, gồm chi tiết cây và mọi thao tác (chạm 1 lần vào cây đủ nước chỉ hiện gợi ý, không mở menu). Khi đang mở bảng/lá thư/báo cáo/radio (`popupUp`), menu cây hoặc 🧰 thì chạm không xuyên xuống vườn (chạm ra ngoài chỉ để đóng). **Vuốt**: làn gió nhẹ (đã giảm cố ý, đừng tăng mạnh), gửi cho người kia qua `wind`.
- **Bố cục màn dọc:** trời ~19% trên cùng, đồi hoa 19–45% (sau hàng rào), 5 hàng luống, rồi dòng gợi ý, thanh gắn kết, thanh 5 nút. Màn thấp (xoay ngang) tự bớt trời để luống còn ≥ 30%.
- **HUD trên:** ✨/🧪/🍂 · giờ + thời tiết → dự báo.
- **Hướng dẫn** (14 bước, có bước mở rộng vườn và radio) chạy ở lần mở đầu tiên (localStorage `vuon-hoa-tour-v3`), xem lại trong Sổ tay.
- **Báo cáo "Trong lúc bạn vắng mặt"**: so `st.cnt` (bộ đếm cộng dồn) với ảnh chụp lưu ở localStorage (`vuon-hoa-seen-<slug>`) khi vắng hơn 90 giây.
- **Âm thanh** bật sau lần chạm đầu (chính sách trình duyệt). `audio.scene()` mỗi khung chỉnh tiếng mưa, gió, dế theo thời tiết.

## Làm các việc thường gặp
- **Thêm loài hoa:**
  1. Thêm vào `SPECIES` (và `HILL_CODE`, mã 1 ký tự chưa dùng) trong rules.js.
  2. Thêm màu `SP_COL` và chiều cao `HEIGHT` trong art.js, cùng `case` vẽ đầu hoa trong `drawPlant`.
  3. Thêm `ICON` trong game.js.
  4. Chạy `npm run balance`.
- **Thêm món trong chợ:** thêm vào `SHOP` (`kind`: `use`/`tool`/`unlock`/`decor`) và cài tác dụng thụ động trong `stepSim`. Đồ dùng mới trong vườn: thêm việc bấm-để-dùng vào `ACTS` + `useItem`, chỗ đứng vào `SPOTS` (yard.js), hình dựng bằng `build()` trong `SPR` (bảng màu chung) và vẽ trong `drawYard` (đẩy vùng chạm vào `hits`), thông báo trong `onUse` (game.js).
- **Thêm sự kiện:** thêm vào `EVENTS`, điều kiện + tác dụng trong `rollEvent`/`endEvent`/`apply case 'ev'`, hình trong `drawEvent`, thông báo trong `onEvent`.
- **Thêm thời tiết:** thêm vào `WEATHER` và `baseWeather`, cài tác dụng trong `stepSim`, rồi phần hình ở `drawSky`/`drawWeatherFx` và âm thanh ở `audio.scene`.
- **Đổi cân bằng:** sửa số trong rules.js rồi `npm run balance`. Mục tiêu: bot 2 người khoảng 40–50 phút, 1 người khoảng 60–90 phút, đồi phủ ~50–90% lúc mở Lễ hội (người thật chậm hơn bot khoảng 1,5 lần nên ra khoảng 1–2 giờ). Hiện tại (bot giữ hoa khi có sự kiện ẩn): 2 người 55–57 phút, 1 người 77–99 phút.
- **Kiểm tra giao diện:** `npm run dev`, mở `/play` (một mình) hoặc tạo một vườn ở trang chủ rồi mở hai đường dẫn ở hai cửa sổ, dùng menu cheat để tua thời gian, đổi thời tiết, cho mọi cây nở.

## Lưu ý
- **Bảo mật / riêng tư:** slug vườn web là 12 ký tự ngẫu nhiên (không chứa tên, không đoán được); không có API liệt kê vườn hay số vườn. Người nhận không nhận `flowerText/message/signature/question` qua `/api/card` (`SECRET_KEYS`) — chỉ nhận trong state (`m.ending`) khi `st.liftAt`/`st.done`. Chữ người dùng nhập bị lọc `< >` (tên, chữ ngắn: cả nháy) trong `cleanCfg`. Header bảo mật: `secure()` trong worker + `public/_headers`. `config.js`: `gardens: []` (đừng commit vườn thật vì repo GitHub công khai). Tài khoản Cloudflare ghim bằng `CLOUDFLARE_ACCOUNT_ID` trong `.env` (không lên git).
- **Giới hạn & tự xoá** (`limits` trong config.js): mỗi IP 3 vườn/giờ, 6/ngày; cả trang 60/giờ; tối đa 300 vườn; 8 kết nối/vườn. Vườn web không ai vào trong `idleHours` = 48 giờ thì alarm của `Garden` xoá sạch, slug thành bia mộ `{gone}` (card/ws/sửa trả 410, mở link -> `/?het`). Vườn trong config.js không bị xoá. Lưu ý: thư hẹn giờ, cây kỷ niệm cũng mất theo vườn.
- **Ghi trạng thái:** `save()` khi `apply` đổi gì đó, khi vào/rời vườn; `sync` chỉ `lazySave()` (tối đa mỗi 60 s) vì `advance` tính bù được từ `st.real`. Con trỏ (`cur`) chỉ gửi khi người kia online, 120 ms/lần.
- **Tạo vườn:** trang chủ `/` → form → hai đường dẫn. Người gửi sửa được (`/api/card` trả `edit: true` → nút ✏️ trong Sổ tay); sửa xong áp dụng khi mở lại game. id, slug, seed không đổi khi sửa.
- Trước khi gửi link thật: tắt menu thử nghiệm (ô "Nâng cao" của vườn web; `cheats: false` trong `config.js` cho vườn khai báo sẵn).
- Đổi `id` khu vườn trong config là tạo vườn mới (mất tiến trình cũ). Đổi `slug` là đổi đường dẫn.
- Không có mật khẩu: đường dẫn `/<slug>` chính là chìa khoá. Tiến trình lưu ở máy chủ, mở lại đúng đường dẫn (máy nào cũng được) là vào lại vườn. Trang chào `/` nhớ khu vườn đã vào trên máy đó (localStorage `vuon-hoa-last`) và hiện nút quay lại.
- Canvas game vẽ ở lưới pixel nhỏ (`px` = kích thước một ô pixel, khoảng min(màn hình)/190) rồi phóng to với `image-rendering: pixelated`. Bộ đệm cao thêm 1 hàng (`BH1`) để máy quay trượt mịn ở đoạn kết.
