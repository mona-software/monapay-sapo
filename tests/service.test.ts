import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { loadConfig } from "../src/config.js";
import { ConnectorService } from "../src/service.js";
import { StateStore } from "../src/state-store.js";

const config = loadConfig({
  NODE_ENV: "test",
  PUBLIC_BASE_URL: "https://connector.example.com",
  SAPO_STORE: "demo.mysapo.net",
  SAPO_API_KEY: "key",
  SAPO_API_SECRET: "secret",
  SAPO_BANK_TRANSFER_GATEWAYS: "Chuyển khoản qua ngân hàng",
  MONAPAY_CLIENT_ID: "client",
  MONAPAY_CLIENT_SECRET: "client-secret",
  MONAPAY_WEBHOOK_SECRET: "webhook-secret-long"
});

describe("ConnectorService", () => {
  it("tạo checkout và ghi link/QR vào note cho đơn chuyển khoản", async () => {
    const folder = await mkdtemp(join(tmpdir(), "monapay-sapo-"));
    const sapo = {
      updateOrderNote: mock.fn(async (_order: unknown, _note: string) => undefined),
      getOrder: mock.fn(),
      listTransactions: mock.fn(),
      markPaid: mock.fn()
    };
    const monaPay = {
      createCheckout: mock.fn(async (_input: { orderCode: string; amount: number }) => ({
        id: "checkout-id",
        checkout_url: "https://pay.monapay.vn/c/token",
        qr_image_url: "https://api.monapay.vn/qr.png",
        order_code: "SAPO42",
        amount: 150000,
        status: "pending"
      }))
    };
    const service = new ConnectorService(config, sapo as never, monaPay as never, new StateStore(join(folder, "state.json")));
    const result = await service.handleSapoOrder({
      id: 42,
      name: "#1001",
      total_price: "150000",
      currency: "VND",
      financial_status: "pending",
      gateway: "Chuyển khoản qua ngân hàng"
    });
    assert.equal(result.status, "processed");
    assert.equal(monaPay.createCheckout.mock.callCount(), 1);
    const checkoutInput = monaPay.createCheckout.mock.calls[0]?.arguments[0];
    assert.equal(checkoutInput?.orderCode, "SAPO42");
    assert.equal(checkoutInput?.amount, 150000);
    assert.match(sapo.updateOrderNote.mock.calls[0]?.arguments[1] as string, /https:\/\/pay\.monapay\.vn\/c\/token/);
  });

  it("xử lý một transaction_code đúng một lần", async () => {
    const folder = await mkdtemp(join(tmpdir(), "monapay-sapo-"));
    const sapo = {
      getOrder: mock.fn(async () => ({ id: 42, total_price: 150000, currency: "VND" })),
      listTransactions: mock.fn(async () => []),
      markPaid: mock.fn(),
      updateOrderNote: mock.fn()
    };
    const service = new ConnectorService(config, sapo as never, {} as never, new StateStore(join(folder, "state.json")));
    const payload = {
      event: "CHECKOUT_PAID",
      status: "paid",
      order_code: "SAPO42",
      paid_amount: 150000,
      transaction_code: "TXN-42"
    };
    assert.equal((await service.handleMonaWebhook(payload)).status, "processed");
    assert.equal((await service.handleMonaWebhook(payload)).status, "duplicate");
    assert.equal(sapo.markPaid.mock.callCount(), 1);
  });
});
