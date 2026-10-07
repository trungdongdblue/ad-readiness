# Store Ad-Readiness Grader

> Phiên bản cập nhật 2026-10-07. Trạng thái: PoC chạy được end-to-end (quét, chấm điểm, nguồn dẫn chứng, hướng sửa). Chưa hiệu chỉnh trên dữ liệu thật quy mô lớn (xem mục 6).

## 1. Vấn đề giải quyết

Nhiều shop bắt đầu chạy quảng cáo TikTok mà không biết website đã đủ điều kiện hay chưa. Hậu quả thường gặp:

- **Pixel thiếu hoặc sai.** TikTok không học được chuyển đổi, tiền quảng cáo bị lãng phí.
- **Trang chậm hoặc khó mua trên điện thoại.** Khách thoát trước khi mua.
- **Thiếu chính sách đổi trả, vận chuyển, thông tin liên hệ.** Quảng cáo dễ bị từ chối hoặc mất niềm tin.
- **Có câu có nguy cơ vi phạm chính sách quảng cáo.** Ví dụ claim y tế, giảm cân, kết quả phóng đại.

Người dùng chính là **chủ shop không rành kỹ thuật**, nên kết quả phải nói được: lỗi là gì, vì sao quan trọng, ai sửa, sửa thế nào.

## 2. Giải pháp

Người dùng nhập URL cửa hàng và chọn thị trường (PK, IQ, AE, SA, EG). Hệ thống quét tự động và trả về trong một lần:

- **Điểm sẵn sàng 0–100** kèm kết luận: Sẵn sàng (≥80), Cần sửa (50–79), Chưa sẵn sàng (<50).
- **Điểm theo 4 nhóm:** Tracking, Mobile, Thông tin (Trust), Rủi ro chính sách.
- **Danh sách lỗi.** Mỗi lỗi có: mức độ, bằng chứng cụ thể (request bắt được, đoạn chữ trích nguyên văn, hoặc ghi chú bước quét), **nguồn dẫn chứng** và hướng sửa.
- **Hướng sửa cho người không rành kỹ thuật** (mục 4): ai sửa được, các bước, câu gửi sẵn cho team dev.
- **Gợi ý ưu tiên do AI viết** (tối đa 5 việc nên sửa trước).

Công cụ chạy dưới dạng web (React) và API có hàng đợi (BullMQ/Redis). Giới hạn 5 lượt quét mỗi giờ cho mỗi IP (môi trường dev nâng lên 100). Kết quả lưu 30 phút. Nền tảng nhận diện được: Shopify, WooCommerce, Wix, Shoplazza. Toàn bộ chữ hiển thị cho khách hàng bằng tiếng Anh.

## 3. Kỹ thuật xử lý

### 3.1 Cách quét

Chromium giả lập điện thoại đi qua funnel như người mua thật: **trang chủ → sản phẩm → thêm giỏ → checkout**. Sau đó duyệt thêm các trang chính sách của shop (tối đa 16 trang hoặc 90 giây) và đo tốc độ.

Công cụ chỉ quan sát:

- Không đặt đơn, không nhập thông tin hay tài khoản.
- Mọi request Pixel bị chặn và ghi lại tại chỗ, không event nào tới TikTok thật, dữ liệu Pixel của khách không bị làm bẩn.
- Mọi URL do người dùng nhập đều qua kiểm tra chống SSRF. Khi chạy Docker, request quét đi qua proxy egress chặn IP nội bộ.

### 3.2 Xử lý nút "Thêm giỏ" bị chặn vì chưa chọn size/biến thể (mới)

Nhiều store không cho thêm giỏ nếu chưa chọn size hoặc màu. Trước đây bước này bị báo "không kiểm tra được" nên các bước sau (InitiateCheckout) cũng bị bỏ. Cách xử lý mới **không viết riêng cho từng store**:

1. **Tìm nút mua chính** trên trang bằng quy tắc chung: phần tử bấm được, chữ khớp "add to cart/buy…", nằm gần tiêu đề sản phẩm, loại trừ thẻ sản phẩm gợi ý, header, footer, popup.
2. Bấm thử. Nếu có phản hồi thêm giỏ thành công (HTTP 2xx tới endpoint cart) thì xong.
3. **Tầng 1, luật chung:** đọc các ô chọn (radio, dropdown, nút size/màu), bỏ qua ô hết hàng (disabled, gạch ngang, chữ "sold out", mờ không bấm được), chọn **một lựa chọn còn hàng ở mỗi nhóm chưa chọn**, rồi bấm lại. Nút kiểu "Add to cart", "Size guide", "Checkout" không bao giờ bị coi là lựa chọn.
4. **Tầng 2, AI chỉ dẫn đường:** nếu tầng 1 không được và có khóa AI, AI nhận danh sách ô chọn đã làm sạch và trả về **số thứ tự** ô nên bấm (tối đa 3). Mã nguồn kiểm tra lại: chỉ nhận số thứ tự có trong danh sách, ô an toàn, không trùng.
5. **Kết luận chỉ dựa vào bằng chứng mạng** (có phản hồi thêm giỏ hay không), AI không được quyết kết luận.
6. Nếu vẫn không được: báo "không kiểm tra được" kèm lý do cụ thể (ví dụ "store yêu cầu chọn size, đã thử 'S', 'M' nhưng không thêm được"), **không** buộc tội shop.
7. Báo cáo ghi rõ điều kiện đã quét, ví dụ: `chose "18-24M" first, because the store would not add to cart without an option`.

Đã kiểm chứng trên outfitters.com.pk (mobile): chọn size, thêm giỏ thành công, vào được checkout. Có 5 kiểu trang thử trong bộ test (radio, dropdown, nút, size gạch ngang, hết hàng).

### 3.3 Bốn nhóm kiểm tra

- **Tracking**
  - Kiểm tra gì: Pixel có hay không, trùng hay im lặng. Event ViewContent / AddToCart / InitiateCheckout có đúng tên, bị trùng, bị đổi tên không. Tham số `content_ids`, `content_type`, `value`, `currency`. Có Events API phía server không.
  - Cách làm: Bắt request mạng tới TikTok và giải mã payload để biết event nào, tham số gì. Hook thêm vào `ttq` của trang để đối chiếu.
- **Mobile**
  - Kiểm tra gì: Tốc độ tải (LCP, INP, CLS). Nút mua (kích thước, độ tương phản, nằm trong màn hình đầu hay không). Số ô nhập và số bước ở checkout.
  - Cách làm: Ưu tiên dữ liệu người dùng thật từ Google CrUX (28 ngày, điện thoại). Nếu không có, chạy 3 lượt giả lập 4G chậm, lấy trung vị.
- **Thông tin (Trust)**
  - Kiểm tra gì: Đổi trả, điều khoản, bảo mật, vận chuyển, liên hệ, thông tin công ty, thanh toán, giá.
  - Cách làm: **Duyệt thật các trang chính sách** (≤16 trang / 90 giây), đọc nội dung từng trang, không chỉ nhìn link. AI duyệt site chọn link đáng đọc và đánh giá trang.
- **Rủi ro chính sách**
  - Kiểm tra gì: Claim y tế, giảm cân, kết quả cam kết, before/after, giảm giá cực đoan.
  - Cách làm: Quét cụm từ khoá và trích nguyên văn. AI đọc thêm để bắt trang đa ngôn ngữ.


Lưu ý: "Rủi ro chính sách" là **nhãn riêng của Ecomdy** (đối chiếu với chính sách quảng cáo TikTok), không phải một hạng mục của TikTok. Kết quả luôn là "tín hiệu rủi ro", không bao giờ là "TikTok sẽ từ chối".

**Mức độ lỗi chính (Tracking):**

- **Nghiêm trọng**: Không có Pixel
- **Lớn**: Pixel không gửi gì (silent); thiếu event ViewContent/AddToCart/InitiateCheckout dù funnel đã tới bước đó; sai `value`, `currency` hoặc cặp `value/currency`
- **Nhỏ**: Event chỉ có ở `ttq` mà không có request; sai `content_type`/`content_ids`; tên event lạ; event bị gửi trùng
- **Thông tin (không trừ điểm)**: Event bị đổi tên (alias), có Events API, nhiều Pixel, Purchase (không thể kiểm tra mà không đặt đơn), không kiểm tra được


**Mức độ lỗi chính (Trust):** thiếu chính sách hoặc link chết = Lớn; trang chính sách quá mỏng / không rõ = Nhỏ; thiếu liên hệ = Lớn hoặc Nhỏ tùy mức; thiếu giá = Nhỏ; thiếu thông tin công ty/thanh toán chỉ ghi nhận.

### 3.4 Nguyên tắc để không buộc tội oan

- Chỉ báo "thiếu" khi đã đi tới bước đó của funnel **và** giải mã dữ liệu đáng tin. Không thì kết luận "không kiểm tra được" và không tính vào điểm.
- Trang không đọc được (tường chặn bot, trang chọn quốc gia, quá ít chữ, dưới 30 link hoặc không có link footer) cũng là "không kiểm tra được".
- AI chỉ **bổ sung**: có thể hạ mức một lỗi Trust xuống nhỏ nhưng không bao giờ tạo ra lỗi "thiếu". Claim chỉ do AI thấy bị trừ tối đa mức Nhỏ.
- Mọi trích dẫn AI đưa ra phải có thật trên trang, nếu không bị loại.
- Dưới 60% mục kiểm tra được thì không cấp kết luận "Sẵn sàng".

### 3.5 Chấm điểm

- Mỗi lỗi bị trừ: Nghiêm trọng −60, Lớn −25, Nhỏ −10, Thông tin 0. Mỗi nhóm trừ tối đa theo mức sàn.
- Điểm tổng = trung bình các nhóm kiểm tra được. Nhóm không kiểm tra được thì bỏ khỏi trung bình.
- Thiếu Pixel: nhóm Tracking tối đa 30 điểm, tổng tối đa 40.
- Chỉ cấp điểm tổng khi kiểm tra được Tracking và ít nhất một nhóm khác.
- Các mức trừ do đội tự chọn, **chưa hiệu chỉnh** bằng dữ liệu thực (mục 6).

## 4. Nguồn dẫn chứng và hướng sửa (mới)

### 4.1 Mỗi đánh giá đều có nguồn

Mỗi lỗi mang theo danh sách nguồn, hiển thị trong khối "Source" của từng dòng kết quả. Ba loại:

- **TikTok**: Link tài liệu TikTok Business Help Center kèm ngày. Có cho Pixel, Test Events, Standard events, Event deduplication, parameters, chính sách nội dung bị cấm, y tế, giảm cân, thông tin gây hiểu lầm, trải nghiệm sau chuyển đổi, tối ưu tốc độ trang đích.
- **Bên thứ ba**: Google web.dev (Core Web Vitals), CrUX API, WCAG, Apple HIG (kích thước nút bấm)
- **Quan sát**: Điều chính scanner thấy: request bắt được, đoạn chữ trích nguyên văn, ghi chú bước quét


Mọi nguồn TikTok phải có link và ngày (test tự động kiểm tra). Một vài tài liệu TikTok không ghi ngày xuất bản thì ghi rõ "undated". Mục `mobile.checkout` hiện **chưa có nguồn** (cố ý để trống, chưa có tài liệu chính thức).

### 4.2 Thư viện hướng sửa (Fix library)

Với mỗi loại lỗi có một mục tiếng Anh gồm: **Impact** (ảnh hưởng gì), **Who fixes** (chủ shop tự sửa được hay cần team dev), **Evidence & source**, **What happened**, **Why it matters**, **Steps** (các bước theo nền tảng, ví dụ Shopify → Settings → Customer events), **Message for developer** (đoạn gửi nguyên văn cho dev khi chủ shop không tự sửa được).

AI gợi ý ưu tiên: nhận danh sách lỗi đã xác định (mã, mức độ, bằng chứng, nền tảng, thị trường), **không gửi nguyên trang**, trả về tối đa 5 việc nên sửa trước theo mức ảnh hưởng tới điểm, và câu viết lại an toàn cho claim vi phạm. AI lỗi hoặc quá thời gian thì hiển thị hướng dẫn cố định. Việc quét không phụ thuộc vào AI.

## 5. AI hiện có trong hệ thống

Model `gemini-3.1-flash-lite`, tắt được, lỗi thì tự quay về luật.

- **1**
  - Việc AI làm: Phát hiện claim vi phạm bằng mọi ngôn ngữ (kể cả Ả Rập, Urdu)
  - Ràng buộc: Chỉ bổ sung, trích dẫn phải có thật, tối đa mức Nhỏ
- **2**
  - Việc AI làm: Duyệt site: chọn link chính sách đáng đọc, đánh giá trang
  - Ràng buộc: Không tạo lỗi "thiếu", chỉ có thể hạ xuống Nhỏ
- **3**
  - Việc AI làm: Gợi ý ưu tiên sửa và hướng dẫn theo nền tảng
  - Ràng buộc: Không thêm kết luận mới, không bịa endpoint/event của TikTok
- **4**
  - Việc AI làm: **(Mới)** Chọn ô size/biến thể khi luật chung thất bại
  - Ràng buộc: Chỉ trả số thứ tự, mã nguồn kiểm lại; kết luận vẫn từ bằng chứng mạng


Đánh giá nội bộ cho việc 1: tìm đúng 48/48 claim, 0 báo nhầm, 33/33 link. Đây là bộ thử mô phỏng, chưa phải đo trên store thật.

## 6. Mức độ tin cậy và hạn chế đã biết

- **Độ chính xác Tracking**: Đối chiếu với TikTok Pixel Helper trên **1 store** (asimjofa.com) cho kết quả khớp. Cỡ mẫu n=1, cần thêm store để kết luận.
- **InitiateCheckout**: Trên vài store Shopify (Outfitters, asimjofa) scanner báo "chưa thấy event" ở bước checkout. Cần xác nhận bằng Pixel Helper / Test Events: có thể event chạy trong môi trường sandbox của checkout hoặc bắn muộn. Đang theo dõi để tránh báo oan.
- **Mức trừ điểm**: Tự chọn, chưa hiệu chỉnh. Hiện nhóm Chính sách có thể ra 100 điểm chỉ vì "không tìm thấy từ khoá", và các nhóm có trọng số bằng nhau.
- **Purchase**: Không kiểm tra được vì không đặt đơn (cố ý).
- **Nguồn TikTok**: Một số tài liệu không có ngày; TikTok có thể đổi tài liệu bất cứ lúc nào.
- **Câu viết lại do AI**: Hiện theo ngôn ngữ của trang; chưa ép tiếng Anh.


## 7. Chi phí (đo thật 2026-10-07, 16 store trong poc/stores.csv)

Giá Gemini 3.1 Flash-Lite: 0,25 USD / 1M token vào, 1,50 USD / 1M token ra. Mỗi lượt quét chạy cả luồng: quét, AI duyệt site, AI gợi ý sửa.

- **AI trung bình mỗi lượt quét đọc được store: ~0,0031 USD** (~3,1 USD / 1.000 lượt), dao động 0,0022–0,0040. Trung bình cả 16 store (kể cả 3 store bị chặn bot, gần như không tốn AI): ~0,0026 USD.
- **Phân rã (mỗi lượt):** AI claim ~0,0007 (2.750 token vào), AI chọn link ~0,00055 (1.300 vào, 150 ra), AI duyệt trang ~0,0012 (3.200 vào, 270 ra), AI gợi ý sửa ~0,00055 (590 vào, 270 ra). AI chọn ô size không chạy lần nào, vì luật chung đã xử lý được.
- **Thời gian:** 13 store đọc được mất 25–81 giây, trung vị 69 giây. 3 store (khaadi, namshi, ebuy) kết thúc sau 4–7 giây vì trang không tải như một store, kết quả "không kiểm tra được".
- **Hạ tầng (Chromium, proxy, Redis):** chưa đo được tiền thật. Bản trước ghi "0,6–0,9 USD / 1.000 lượt" là số cũ chưa kiểm chứng và **không còn được dùng**. Cần giá máy chủ thực tế để tính. Ví dụ giả định, không phải số đo: máy 2 vCPU giá 40 USD/tháng, 2 lượt song song, 69 giây mỗi lượt, tối đa ~100 lượt/giờ; dùng 10% công suất thì ~0,006 USD/lượt.

## 8. Việc tiếp theo đề xuất

1. Xác nhận bằng Pixel Helper cho Outfitters và asimjofa, thêm vào bộ ground truth để tăng cỡ mẫu.
2. Hiệu chỉnh mức trừ điểm và trọng số nhóm trên 20–30 store có kết quả thật.
3. Hiển thị lý do khi "không kiểm tra được" rõ hơn trên giao diện.
4. Quyết định ép câu viết lại của AI sang tiếng Anh; gộp thư viện hướng sửa với chuỗi hiển thị trên web.
5. Đo lại chi phí thực tế sau khi chạy vài trăm lượt.
