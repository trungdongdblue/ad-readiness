# Roadmap - Tracking module (Store Ad-Readiness Grader)

Mỗi phase có **tiêu chí thoát**. Chỉ sang phase sau khi đạt, hoặc ghi rõ quyết định thu hẹp phạm vi.

| Phase | Mục tiêu | Trạng thái |
|---|---|---|
| 0. Harness | Công cụ quét + bộ test + PoC runner | **Xong** (2026-10-01, 56 test pass) |
| 1. PoC | Đo độ chính xác trên 20-30 store thật | Tiếp theo (3-4 ngày) |
| 2. v0.2 | Hoàn thiện phát hiện + điểm Tracking | Sau PoC |
| 3. v1 | Dịch vụ: API, queue, DB, email, CRM | |
| 4. v2 | Xác minh Purchase thật qua OAuth | |

## Phase 0 - Harness (xong)
- Capture-and-block: ghi lại request Pixel rồi trả 204 tại chỗ, **không event nào tới TikTok**.
- 3 bước funnel: landing -> product -> add-to-cart (xác nhận bằng response giỏ hàng).
- 8 nhóm rule, SSRF guard, PoC runner (`run` / `compare`).
- Recon 2 site thật: xác nhận định dạng beacon (xem `TRACKING-RULES.md`).

## Phase 1 - PoC (xem `POC-PLAN.md`)
**Việc:** chọn store, lấy đáp án đúng bằng Pixel Helper, chạy `poc run`, `poc compare`.
**Thoát:** mọi field đạt `poc/criteria.json`; field nào không đạt thì **bỏ khỏi điểm** hoặc hiển thị "không kiểm tra được".

## Phase 2 - v0.2 (~1-2 tuần)
- Bước checkout (dừng ở trang thanh toán, không đặt đơn) -> InitiateCheckout.
- Chọn variant/size trước khi bấm Add to cart (hiện đang cho kết quả "không kiểm tra được" với store cần chọn size).
- Proxy theo thị trường (PK, IQ, AE) cho store chặn theo vùng.
- Bước riêng cho landing page COD một trang.
- `engine/score.ts`: điểm Tracking, có **trần điểm** khi có lỗi blocker (không có Pixel).
- Mở rộng danh sách nút "thêm giỏ" cho tiếng Ả Rập/Urdu theo store thật.
**Thoát:** điểm ổn định khi quét lại cùng store 3 lần; sai lệch với Pixel Helper nằm trong ngưỡng PoC.

## Phase 3 - v1 (dịch vụ)
- API + hàng đợi (BullMQ/Redis), worker chạy container tách biệt, giới hạn tốc độ, cache kết quả theo domain.
- Chặn SSRF ở tầng mạng (egress proxy/firewall), không chỉ ở tầng ứng dụng.
- Postgres: scans, findings, leads. Gửi email kết quả, ghi lead vào CRM.
- Dùng chung `collectors/` + `scenarios/` cho module Ad Policy / Landing Page Compliance.

## Phase 4 - v2 (xác minh thật)
- Nút "Kết nối TikTok" (OAuth) -> `pixel/list`, `pixel/event/stats` để xác minh Purchase.
- **Chưa xác minh:** response của `pixel/event/stats` có số event theo từng loại không. Cần thử với token thật trước khi cam kết.
- Với tài khoản agency của Ecomdy có thể dùng nội bộ trước.

## Rủi ro đã biết
| Rủi ro | Xử lý |
|---|---|
| Store chặn bot / chặn theo vùng | Proxy theo thị trường; fallback "dán mã nguồn" |
| Pixel chỉ chạy sau khi đồng ý cookie | Tự bấm chấp nhận; nếu thấy banner mà chưa bấm thì trả "không kiểm tra được" |
| Định dạng beacon đổi | `--recon` để thu mẫu mới; decoder đếm beacon không giải mã được thay vì đoán |
| Quét làm bẩn dữ liệu Pixel của khách | Capture-and-block mặc định; cờ live cần `ADR_ALLOW_LIVE=1` |
