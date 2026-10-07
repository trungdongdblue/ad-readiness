# Tracking rules - nguồn và mức tin cậy

Mọi dữ kiện về TikTok phải có nguồn + ngày. Khi nguồn đổi, cập nhật file này **trước** khi sửa code.

## A. Từ tài liệu chính thức (ads.tiktok.com/help/article/...)
| Dữ kiện | Bài | Cập nhật |
|---|---|---|
| Event chuẩn dùng `Purchase`; `PlaceAnOrder`, `PageView` là đích alias | `standard-events-parameters` | 2026-04 |
| `CompletePayment` -> `Purchase`, `StartCheckout` -> `InitiateCheckout`, `Browse` -> `PageView` (và 11 alias khác) | `reserved-events` | 2025-09 |
| `value` là số (bắt buộc cho ROAS/VBO), `currency` ISO (bắt buộc cho ROAS), `content_type` = `product`/`product_group`, dùng `content_ids` (có chữ s) | `about-parameters` | 2026-03 |
| Danh sách tiền tệ hỗ trợ **không có IQD, JOD** | `about-parameters` | 2026-03 |
| Dedup Pixel + Events API cần `event_id` ở cả hai, cửa sổ 48 giờ | `event-deduplication` | 2025-05 |
| Event Builder đặt event bằng quy tắc nút/URL, không cần code | `create-events` | 2025-03 |
| Pixel đo pageview khi URL đổi trong SPA (mặc định) | `about-single-page-application-pageview-measurement...` | 2024-06 |
| Shopify app vẫn liệt kê "Complete Payment" | `supported-events-shopify` | 2025-02 |
| Một website có thể cài nhiều Pixel, nhưng TikTok khuyên **1 Pixel cho mỗi website** (nhiều Pixel có thể làm chậm trang); thêm event vào Pixel có sẵn thay vì tạo Pixel mới. Đọc qua bản tóm tắt tìm kiếm, cần mở lại bài gốc trước khi trích nguyên văn | `get-started-pixel`, `About Pixel FAQs` (aid=12119) | 2026-10-05 |
| Pixel Helper: lỗi cấp Pixel/Event/Parameter (tài liệu viết cho 2.0, extension hiện 3.0.4) | `tiktok-pixel-helper-2.0` | 2025-02 |
| Test Events: mở web trực tiếp, không cần QR | `tiktok-events-manager-monitor-and-diagnose` | 2025-11 |
| API: `GET /open_api/v1.3/pixel/list/`, `GET /open_api/v1.3/pixel/event/stats/` (cần token advertiser) | SDK chính thức `tiktok/tiktok-business-api-sdk` | 2026 |

## B. Quan sát thực tế (recon, 2026-10-01, 2 store Shopify công khai)
| Quan sát | Hệ quả trong code |
|---|---|
| Beacon: `POST https://analytics.tiktok.com/api/v2/pixel`, JSON `{event, event_id, context.pixel.code, page.url, properties{value,currency,content_type,content_id,...}}` | `parsers/tiktok/payload.ts` |
| Beacon GET: `.../api/v2/pixel?analytics_message=<base64 JSON>` (Pageview) | decoder xử lý `analytics_message` |
| Thư viện: `/i18n/pixel/events.js?sdkid=<PIXEL_ID>` + `static/main.*.js` | Pixel ID lấy từ `sdkid` |
| `LandingPageView`, `EngagedSession` do chính Pixel phát | coi là nội bộ, không gắn cờ "event lạ" (suy luận, cần xác nhận) |
| Store Shopify: hook `ttq` bắt 0 lệnh, network bắt đủ | network là nguồn chính |
| 1 trong 2 store không thấy Pixel dù đã bấm consent | chưa kết luận thiếu Pixel; đưa vào PoC |

## C. Rule hiện có
| Rule id | Kiểm tra | Trạng thái có thể trả |
|---|---|---|
| `pixel.present` | Có Pixel ID (network > static) | verified / detected / unverifiable (banner chưa chấp nhận) / missing |
| `pixel.multiple` | Nhiều Pixel TikTok. Chỉ là ghi chú (severity info, không trừ điểm): hai Pixel hợp lệ (chủ store + agency, nhiều tài khoản) và từ ngoài không biết chúng có cùng tài khoản hay không. Pixel Meta/Google không được đếm | detected |
| `pixel.silent` | Có Pixel nhưng không event | detected |
| `event.ViewContent / AddToCart / InitiateCheckout` | Thấy trên network | verified / detected / missing / unverifiable |
| `event.Purchase` | Không xác minh được từ ngoài | unverifiable |
| `params.*` | value, cặp value+currency, currency hỗ trợ, content_type, content_ids | detected |
| `event.unknown_name`, `event.alias`, `event.duplicate` | Tên event, alias, bắn trùng (gom theo từng Pixel ID: hai Pixel khác nhau không bị coi là trùng) | detected |
| `serverside.events_api` | Chỉ báo có `event_id` hay không | detected / unverifiable |

Nguyên tắc: tham số từ network chỉ bị đánh giá khi giải mã ra khác rỗng; rỗng = "không biết", không phải "thiếu".
