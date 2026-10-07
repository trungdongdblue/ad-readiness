# Architecture

## Layers (phụ thuộc chỉ đi một chiều)
```
cli ──> app ──> engine ──> rules ──> parsers ──> domain
          │                                        ▲
          └──> scenarios ──> collectors ───────────┘   (I/O: Playwright, DNS)
```
| Layer | Vai trò | Thuần? |
|---|---|---|
| `domain` | Kiểu dữ liệu: Capture, Observation, Finding, Report | Có |
| `parsers/tiktok` | Nhận diện host, giải mã beacon, chuẩn hoá tên event | Có |
| `rules/tracking` | Mỗi rule: `(Observation, ctx) -> Finding[]` | Có |
| `engine` | `observe` (Capture -> Observation), `analyze` (chạy rule -> Report) | Có |
| `collectors` | Phiên Chromium, hook `ttq`, SSRF guard | Không (I/O) |
| `scenarios` | Các bước funnel: landing, product, add-to-cart | Không (I/O) |
| `app` | `scanTarget` / `runScan`: ghép các lớp; dùng chung cho CLI, API, worker | Không |
| `cli` | `scan`, `poc` | Không |

## Luồng dữ liệu
`URL -> assertSafeUrl -> ScanSession.open -> steps (ghi request + lệnh ttq) -> Capture -> observe -> Observation -> rules -> Report`

## Quyết định thiết kế
1. **Capture-and-block.** Request tới host Pixel được ghi lại rồi trả 204 tại chỗ. Script thư viện vẫn được tải (để Pixel chạy), event thì không tới TikTok -> không làm bẩn dữ liệu của khách.
2. **Hai nguồn bằng chứng.** Lớp network (chính, nhìn được cả Pixel trong sandbox) và hook `ttq` (phụ, chỉ thấy lệnh gọi trong trang chính). Recon trên một store Shopify: hook bắt được 0 lệnh, network bắt đủ -> network là bắt buộc.
3. **Không buộc tội khi không chắc.** `missing` chỉ khi bước funnel đã tới được và dữ liệu giải mã đáng tin; còn lại `unverifiable`.
4. **Rule là hàm thuần.** Thêm rule = thêm file + đăng ký ở `rules/tracking/index.ts` + test. Không đụng browser.
5. **Step là plugin.** Thêm bước = thêm file ở `scenarios/` + đăng ký ở `scenarios/index.ts`.

## Đường lên production
- `scanTarget` đã tách khỏi CLI: bọc bằng job BullMQ là xong, không viết lại logic.
- Mỗi job một browser context riêng, worker chạy container không có đường vào mạng nội bộ.
- SSRF: `assertSafeUrl` chỉ là lớp 1 (DNS có thể đổi sau khi kiểm tra, redirect có thể ra ngoài). **Bắt buộc** thêm egress proxy chặn dải IP nội bộ trước khi mở cho người dùng ngoài.
- Cache kết quả theo domain + giới hạn lượt quét theo email/IP để chống lạm dụng.
- Lưu `Report` (nhỏ). `Capture` thô chỉ giữ khi debug (`--recon`), vì có thể chứa định danh người dùng của phiên quét.
