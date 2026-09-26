# MONA Pay cho Sapo Web

Connector tự động xác nhận chuyển khoản ngân hàng giữa Sapo Web và MONA Pay. Khi Sapo tạo một đơn thanh toán bằng chuyển khoản, connector tạo VietQR động/checkout MONA Pay và ghi link cùng ảnh QR vào ghi chú đơn. Khi tiền vào, webhook MONA Pay được đối chiếu mã đơn và số tiền trước khi connector tạo transaction `sale` trên Sapo.

MONA Pay là dịch vụ **xác nhận chuyển khoản ngân hàng tự động** (VietQR động, tài khoản ảo, webhook) — tiền vào thẳng tài khoản của bạn, MONA Pay không giữ tiền. Ngân hàng đang hỗ trợ xem tại [monapay.vn/ngan-hang](https://monapay.vn/ngan-hang).

## Luồng hoạt động

1. Sapo gửi webhook `orders/create` tới `POST /webhooks/sapo/orders-create`.
2. Connector xác minh `X-Sapo-Hmac-Sha256` trên raw body và chỉ nhận đơn VND, đang chờ, có phương thức chuyển khoản đã cấu hình.
3. Connector tạo hosted checkout MONA Pay với mã `SAPO{id}`, sau đó ghi `checkout_url` và `qr_image_url` vào note của đơn.
4. MONA Pay gửi payload phẳng `CHECKOUT_PAID` hoặc `TRANSACTION_IN` tới `POST /webhooks/monapay`.
5. Connector xác minh `X-Mona-Timestamp` + `X-Mona-Signature`, chống replay 5 phút, tải lại đơn Sapo và chỉ tạo transaction khi đúng mã, đủ tiền.
6. `transaction_code` được lưu để chống xử lý trùng. Connector cũng kiểm tra transaction đã có trên Sapo trước khi tạo mới.

## Cài đặt nhanh bằng Docker Compose

Yêu cầu: Docker + Compose, một domain HTTPS đã reverse proxy tới `127.0.0.1:3000`, Sapo Web Private App có quyền đọc/ghi Đơn hàng, và tài khoản MONA Pay đã cấu hình hồ sơ thanh toán.

```bash
cp .env.example .env
# Điền các giá trị trong .env, rồi:
docker compose up -d --build
curl https://connector.example.com/health
```

Compose chỉ publish connector trên `127.0.0.1` của máy chủ (process bên trong container lắng nghe mạng container), chạy bằng user non-root, filesystem read-only và bỏ toàn bộ Linux capabilities. Đặt nginx/Caddy phía trước để kết thúc TLS; không mở trực tiếp port 3000 ra Internet.

Ví dụ nginx tối thiểu:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Cấu hình

| Biến | Bắt buộc | Ý nghĩa |
|---|---:|---|
| `PUBLIC_BASE_URL` | Có | URL HTTPS công khai của connector |
| `SAPO_STORE` | Có | Host cửa hàng, ví dụ `shop.mysapo.net` |
| `SAPO_API_KEY` | Có | API key của Sapo Private App |
| `SAPO_API_SECRET` | Có | API secret; dùng Basic Auth và verify webhook |
| `SAPO_BANK_TRANSFER_GATEWAYS` | Có | Danh sách tên phương thức chuyển khoản, phân cách bằng dấu phẩy |
| `MONAPAY_CLIENT_ID` | Có | Client ID MONA Pay |
| `MONAPAY_CLIENT_SECRET` | Có | Client secret MONA Pay |
| `MONAPAY_WEBHOOK_SECRET` | Có | Secret HMAC cấu hình cho webhook MONA Pay |
| `MONAPAY_SANDBOX` | Không | `true` để tạo checkout sandbox |
| `MONAPAY_CHECKOUT_EXPIRES_IN` | Không | Thời hạn checkout, 60–86400 giây; mặc định 3600 |
| `DATA_FILE` | Không | File dedupe; trong Docker mặc định `/app/data/state.json` |

Không commit `.env`. Trên máy chủ, đặt quyền file secret là `chmod 600 .env`.

### 1. Tạo Sapo Private App

Trong quản trị Sapo: **Ứng dụng → Ứng dụng riêng → Tạo ứng dụng riêng**, cấp quyền **Đọc và ghi** cho Đơn hàng, giao dịch và vận chuyển. Lấy API key/secret rồi điền vào `.env`.

Đăng ký webhook `orders/create` sau khi domain HTTPS hoạt động:

```bash
docker compose run --rm connector node dist/scripts/register-sapo-webhook.js
```

Hoặc tạo thủ công với địa chỉ:

```text
https://connector.example.com/webhooks/sapo/orders-create
```

### 2. Cấu hình MONA Pay

Trong MONA Pay, tạo webhook HMAC-SHA256 trỏ tới:

```text
https://connector.example.com/webhooks/monapay
```

Dùng cùng giá trị secret trong `MONAPAY_WEBHOOK_SECRET`. Không chọn chế độ `NONE`. Tài liệu: [monapay.vn/docs](https://monapay.vn/docs).

## Chạy local và test

Node.js 20 trở lên:

```bash
npm ci
npm test
npm run typecheck
npm run build
```

Test không gọi API thật và bao phủ: chữ ký Sapo, chữ ký MONA Pay + cửa sổ chống replay, payload checkout/transaction phẳng, khớp số tiền/nội dung, bỏ tiền ra, chống webhook trùng.

## Vận hành và giới hạn

- Một volume bền vững lưu dedupe. Chạy **một replica** với file store hiện tại; nếu cần nhiều replica, thay store bằng DB dùng chung trước.
- MONA Pay hoặc Sapo trả lỗi thì endpoint trả 500 để nguồn webhook retry. Payload hợp lệ nhưng không tìm thấy đơn/thiếu tiền trả 200 và không đánh dấu paid.
- Checkout dùng mã cố định `SAPO{id}` và `Idempotency-Key`, nên retry webhook tạo đơn không sinh nhiều checkout.
- Ảnh chụp màn hình marketplace sẽ bổ sung tại `docs/screenshot-1.png`, `docs/screenshot-2.png` (TODO).

## English

This connector automatically reconciles bank transfers between Sapo Web and MONA Pay. A Sapo `orders/create` webhook creates a dynamic VietQR/hosted checkout and writes its payment and QR links to the order note. A signed MONA Pay webhook then marks the Sapo order paid through a `sale` transaction only after the order code and paid amount are revalidated.

MONA Pay provides automated bank-transfer confirmation through dynamic VietQR, virtual accounts, and signed webhooks. Funds go directly to the merchant's bank account; MONA Pay never holds the funds.

Quick start:

```bash
cp .env.example .env
# Fill in Sapo store/API credentials and MONA Pay client/webhook secrets.
docker compose up -d --build
docker compose run --rm connector node dist/scripts/register-sapo-webhook.js
```

Configure the MONA Pay webhook URL as `https://your-domain/webhooks/monapay`. Run `npm ci && npm test` for the test suite. See [MONA Pay](https://monapay.vn) and [API documentation](https://monapay.vn/docs).

## License

MIT
