# PoC Plan - đo độ chính xác phát hiện Tracking

**Câu hỏi PoC:** công cụ phát hiện Pixel và event trên store thật có khớp với Pixel Helper không, và phần nào đủ tin để đưa vào điểm?

## 1. Chọn 20-30 store
| Nhóm | Số lượng gợi ý |
|---|---|
| Shopify | 8-10 |
| WooCommerce | 5-6 |
| Landing page COD một trang | 5-6 |
| Web tuỳ biến / nền tảng khác | 3-4 |
| Store **không** có Pixel (để đo dương tính giả) | 3-4 |

Ưu tiên khách của Ecomdy ở Pakistan, Iraq, UAE. Chỉ quét store công khai hoặc có sự đồng ý của chủ store.

## 2. Lấy đáp án đúng (thủ công)
Với mỗi store, mở bằng Chrome + **TikTok Pixel Helper**, chấp nhận cookie, đi qua: trang chủ -> sản phẩm -> thêm giỏ -> (tuỳ chọn) checkout. Ghi vào `poc/ground-truth.csv` (mẫu: `poc/ground-truth.template.csv`):

| Cột | Giá trị |
|---|---|
| `platform` | shopify, woocommerce, wix, shoplazza, unknown |
| `pixel_id` | ID thật, hoặc `none` |
| `view_content`, `add_to_cart`, `initiate_checkout` | `yes` / `no` / `unknown` |

Ghi `unknown` thay vì đoán. Lưu ý Pixel Helper bản mới (3.x) có thể khác bảng lỗi trong tài liệu (viết cho 2.0).

## 3. Chạy
```bash
cp poc/stores.template.csv poc/stores.csv        # điền url,market
npm run poc -- run --concurrency 2               # quét, lưu poc/results/<ngày>/
npm run poc -- compare --out poc/results/<ngày>  # so với ground truth
```
Store nào kết quả lạ: `npm run scan -- <url> --recon` rồi tự mở file raw (không dán vào AI; file có định danh phiên quét).

## 4. Đọc kết quả
`compare` in precision / recall / coverage từng field và PASS/FAIL theo `poc/criteria.json` (ngưỡng **đề xuất**, chỉnh sau khi thấy dữ liệu thật).

| Kết quả | Quyết định |
|---|---|
| Field đạt ngưỡng | Đưa vào điểm Tracking |
| Precision đạt nhưng coverage thấp | Giữ, hiển thị "không kiểm tra được" cho phần còn lại |
| Precision thấp | **Bỏ khỏi điểm**, chỉ hiển thị dạng gợi ý |
| Pixel không đạt | Dừng, xem lại cách bắt request trước khi build tiếp |

## 5. Việc phải kiểm chứng trong PoC
| # | Câu hỏi | Dấu hiệu hiện có |
|---|---|---|
| 1 | Pixel trong sandbox của Shopify có bị bỏ sót? | Recon: hook 0 lệnh, network đủ -> OK với network |
| 2 | Chặn request (204) có làm Pixel ngừng bắn event? | Recon: vẫn thấy ViewContent/PageView -> cần xác nhận rộng hơn |
| 3 | Store tuỳ biến, landing COD, store Iraq | Chưa có mẫu |
| 4 | Pixel chỉ chạy sau cookie consent | Store B: không thấy Pixel dù bấm consent -> chưa rõ thật sự không có hay bị chặn |
| 5 | Add-to-cart cần chọn size/variant | Store A: bấm nút nhưng không thêm giỏ -> cần bước chọn variant (v0.2) |
| 6 | Phase gán cho event có lệch không (event gửi khi chuyển trang) | Quan sát 1 lần; kiểm tra thêm |
