import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchMonaPayment, validateAmount } from "../src/payment-match.js";

describe("khớp giao dịch MONA Pay với đơn Sapo", () => {
  it("khớp CHECKOUT_PAID bằng mã đơn chính xác và đủ tiền", () => {
    const match = matchMonaPayment({
      event: "CHECKOUT_PAID",
      status: "paid",
      order_code: "SAPO12345",
      paid_amount: 250000,
      transaction_code: "ACB-001"
    });
    assert.deepEqual(match, { ok: true, orderId: 12345, paidAmount: 250000, transactionCode: "ACB-001" });
    if (match.ok) assert.equal(validateAmount(match, { id: 12345, total_price: "250000", currency: "VND" }), "matched");
  });

  it("không xác nhận khi nhận thiếu tiền", () => {
    const match = matchMonaPayment({
      event: "TRANSACTION_IN",
      type: "income",
      description: "Thanh toan SAPO 77",
      amount: 99000,
      transaction_code: "ACB-002"
    });
    assert.equal(match.ok, true);
    if (match.ok) assert.equal(validateAmount(match, { id: 77, total_price: 100000, currency: "VND" }), "underpaid");
  });

  it("từ chối nội dung không chứa mã SAPO", () => {
    assert.deepEqual(
      matchMonaPayment({
        event: "TRANSACTION_IN",
        type: "income",
        description: "Thanh toan don 77",
        amount: 100000,
        transaction_code: "ACB-003"
      }),
      { ok: false, reason: "order_not_found_in_description" }
    );
  });

  it("từ chối sự kiện tiền ra", () => {
    assert.deepEqual(
      matchMonaPayment({
        event: "TRANSACTION_IN",
        type: "outcome",
        description: "SAPO77",
        amount: 100000,
        transaction_code: "ACB-004"
      }),
      { ok: false, reason: "unsupported_event" }
    );
  });
});
