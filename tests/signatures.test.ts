import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyMonaWebhook, verifySapoWebhook } from "../src/signatures.js";

describe("webhook signatures", () => {
  const raw = Buffer.from('{"id":123,"total_price":"250000"}');

  it("xác minh chữ ký webhook Sapo trên raw body", () => {
    const secret = "sapo-secret";
    const signature = createHmac("sha256", secret).update(raw).digest("base64");
    assert.equal(verifySapoWebhook(raw, signature, secret), true);
    assert.equal(verifySapoWebhook(Buffer.from(`${raw} `), signature, secret), false);
  });

  it("xác minh chữ ký MONA Pay và cửa sổ chống replay 5 phút", () => {
    const secret = "monapay-webhook-secret";
    const timestamp = "1700000000";
    const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.`).update(raw).digest("hex")}`;
    assert.equal(verifyMonaWebhook(raw, timestamp, signature, secret, 1700000299), true);
    assert.equal(verifyMonaWebhook(raw, timestamp, signature, secret, 1700000301), false);
  });
});
