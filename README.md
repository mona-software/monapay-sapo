# MONA Pay for Sapo Web

Self-hosted Node.js connector for Sapo Web stores: it creates a MONA Pay VietQR checkout for each new bank-transfer order and marks the Sapo order paid when a signed MONA Pay webhook confirms the transfer.

## Requirements

- Docker with Compose, or Node.js 20 or later
- A public HTTPS domain reverse-proxied to the connector (port 3000)
- A Sapo Web private app with read/write access to orders
- A MONA Pay account with API client credentials and a webhook secret

## Install

```bash
git clone https://github.com/mona-software/monapay-sapo.git
cd monapay-sapo
cp .env.example .env
# Fill in the values in .env (see Configuration), then:
chmod 600 .env
docker compose up -d --build
curl https://connector.example.com/health
```

Compose publishes the connector only on `127.0.0.1` of the host, runs it as a non-root user with a read-only filesystem and all Linux capabilities dropped, and keeps the dedupe state in the `connector-data` volume. Put nginx or Caddy in front to terminate TLS; do not expose port 3000 directly. Minimal nginx example:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Configuration

| Variable | Required | Description |
| --- | :---: | --- |
| `PUBLIC_BASE_URL` | Yes | Public HTTPS URL of the connector |
| `SAPO_STORE` | Yes | Store host, e.g. `your-store.mysapo.net` |
| `SAPO_API_KEY` | Yes | Sapo private app API key |
| `SAPO_API_SECRET` | Yes | Sapo private app API secret; used for Basic Auth and Sapo webhook verification |
| `SAPO_BANK_TRANSFER_GATEWAYS` | No | Comma-separated payment method names treated as bank transfer; default `Chuyển khoản qua ngân hàng,Bank Transfer` |
| `MONAPAY_CLIENT_ID` | Yes | MONA Pay client ID |
| `MONAPAY_CLIENT_SECRET` | Yes | MONA Pay client secret |
| `MONAPAY_WEBHOOK_SECRET` | Yes | HMAC secret configured on the MONA Pay webhook, at least 16 characters |
| `MONAPAY_BASE_URL` | No | Default `https://api.monapay.vn` |
| `MONAPAY_SANDBOX` | No | `true` to create sandbox checkouts; default `false` |
| `MONAPAY_CHECKOUT_EXPIRES_IN` | No | Checkout lifetime in seconds, 60–86400; default 3600 |
| `DATA_FILE` | No | Dedupe state file; default `./data/state.json` (`/app/data/state.json` in `.env.example`) |
| `HOST`, `PORT` | No | Listen address; default `127.0.0.1:3000` (Compose sets `0.0.0.0` inside the container) |

Never commit `.env`.

### Sapo private app

In the Sapo admin, open **Ứng dụng → Ứng dụng riêng → Tạo ứng dụng riêng** (Apps → Private apps → Create private app), grant read and write access to orders, transactions and fulfillments, and copy the API key and secret into `.env`.

Once the HTTPS domain works, register the `orders/create` webhook:

```bash
docker compose run --rm connector node dist/scripts/register-sapo-webhook.js
```

Or create it manually with this address:

```text
https://connector.example.com/webhooks/sapo/orders-create
```

### MONA Pay webhook

In MONA Pay, create an HMAC-SHA256 webhook (not `NONE`) pointing to:

```text
https://connector.example.com/webhooks/monapay
```

Use the same secret as `MONAPAY_WEBHOOK_SECRET`. API reference: [monapay.vn/docs](https://monapay.vn/docs).

## Usage

1. Sapo sends `orders/create` to `POST /webhooks/sapo/orders-create`.
2. The connector verifies `X-Sapo-Hmac-Sha256` on the raw body and only handles pending VND orders whose payment method matches `SAPO_BANK_TRANSFER_GATEWAYS`.
3. It creates a MONA Pay hosted checkout with order code `SAPO{id}` and an `Idempotency-Key`, then appends the checkout link and VietQR image link to the Sapo order note.
4. MONA Pay posts a flat `CHECKOUT_PAID` or `TRANSACTION_IN` payload to `POST /webhooks/monapay`.
5. The connector verifies `X-Mona-Timestamp` and `X-Mona-Signature` with a five-minute replay window, ignores outgoing transactions, reloads the Sapo order and creates a `sale` transaction only when the order code matches and the amount is sufficient.
6. The `transaction_code` is stored to prevent double processing, and existing Sapo transactions are checked before creating a new one.

Operational notes:

- Run a single replica with the file-based state store. For multiple replicas, replace the store with a shared database first.
- If MONA Pay or Sapo returns an error, the endpoint responds with HTTP 500 so the webhook source retries. Valid payloads with no matching order or an insufficient amount get HTTP 200 and the order is not marked paid.
- `GET /health` returns `{"ok": true}` for health checks.

## Development

```bash
npm ci
npm test
npm run typecheck
npm run build
```

Tests do not call real APIs. They cover Sapo and MONA Pay signatures, the replay window, flat checkout and transaction payloads, amount and order-code matching, outgoing transactions and duplicate webhooks. CI runs them on Node.js 20 and 22 (`.github/workflows/test.yml`).

## License

MIT. See [LICENSE](LICENSE).

**MONA Pay is part of MONA Cloud by The MONA Group.**
