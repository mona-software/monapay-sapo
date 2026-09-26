# AGENTS.md

Đây là connector Sapo Web ↔ MONA Pay. Trước khi sửa:

1. Đọc `BRIEF-CHUNG.md`, `BRIEF.md`, `README.md` và tài liệu trong `ref/`.
2. Không bịa endpoint MONA Pay; đối chiếu `ref/openapi.json` và luồng webhook WooCommerce mẫu.
3. Luôn verify raw-body HMAC của cả Sapo và MONA Pay. Payload MONA Pay là payload phẳng.
4. Không đánh dấu paid nếu mã đơn không khớp hoặc số tiền nhận thấp hơn tổng đơn Sapo.
5. Không commit `.env`, secret, log hay dữ liệu runtime.
6. Chạy `npm test`, `npm run typecheck`, `npm run build` trước khi bàn giao.

MONA Pay là dịch vụ xác nhận chuyển khoản tự động; tiền vào thẳng tài khoản của người bán, MONA Pay không giữ tiền.
