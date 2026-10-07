# ad-readiness

Store Ad-Readiness Grader - Tracking module (PoC). Quét URL store, báo TikTok Pixel và event có sẵn sàng chạy ads hay chưa.

## Cài đặt (một lần)
```bash
bash scripts/bootstrap.sh     # npm ci, Chromium, codegraph init (nếu có), npm run check
```
CodeGraph (`@colbymchenry/codegraph`): chạy `npx @colbymchenry/codegraph` một lần để cài vào agent, rồi `codegraph init` trong thư mục này.

## Dùng
```bash
npm run scan -- https://store.example.com --market PK
npm run poc -- run && npm run poc -- compare --out poc/results/<ngày>
npm run check
```
Tài liệu: `docs/ROADMAP.md`, `docs/POC-PLAN.md`, `docs/ARCHITECTURE.md`, `docs/TRACKING-RULES.md`. Quy tắc cho agent: `CLAUDE.md`.

## UI + API
Dev (không cần Redis, scan chạy ngay trong API):
```bash
npm run serve     # API :8787
npm run web       # UI (Vite), proxy /api -> :8787
```
Có Redis: `REDIS_URL=redis://127.0.0.1:6379 npm run serve` và `REDIS_URL=... npm run worker` (một hoặc nhiều worker). Job lưu ở Redis, worker chết giữa chừng thì job tự được worker khác nhận lại (~1 phút).

Production: `docker compose -f docker-compose.yml up -d --build` (bỏ qua `docker-compose.override.yml`, file này nâng hạn mức quét lên 100/giờ cho môi trường dev) -> nginx :8080 (UI + /api) -> api -> redis <- worker -> squid (chặn IP nội bộ) -> internet. Biến: `TRUSTED_PROXY_HOPS` (số reverse proxy phía trước API, mặc định 0), `SCAN_PROXY`, `SCAN_CONCURRENCY`, `CRUX_API_KEY`, `VITE_CTA_URL` (lúc build web).

Test Redis thật: `REDIS_TEST_URL=redis://127.0.0.1:6379/15 npm test` (dùng db riêng, không có thì bỏ qua).

## AI review (tùy chọn)
Đặt `GOOGLE_GENAI_API_KEY` (trong `.env`, git-ignored) để bật lớp AI soát claim và nhận diện link chính sách đa ngôn ngữ; tắt bằng `--no-llm`. Chi tiết, lý do chọn model và giới hạn: `docs/LLM-REVIEW.md`. Đo lại model: `npm run llm:eval -- --models gemini-3.1-flash-lite --repeat 3`.

Cùng key đó bật thêm **AI đọc website** (chọn link và đọc nội dung trang chính sách bằng mọi ngôn ngữ, `docs/SITE-AI.md`, đo lại bằng `npm run site:eval`) và **kế hoạch sửa lỗi bằng AI** (worker viết sau khi quét, web tự nhận sau vài giây): `docs/AI-ADVICE.md`. Đo lại model: `npm run advice:eval -- --models gemini-3.1-flash-lite --repeat 3`.
