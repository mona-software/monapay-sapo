import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifySapoWebhook(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  return safeEqual(expected, signature);
}

export function verifyMonaWebhook(
  rawBody: Buffer,
  timestamp: string | undefined,
  signature: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300
): boolean {
  if (!timestamp || !/^\d{1,12}$/.test(timestamp) || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature) || !secret) {
    return false;
  }

  if (Math.abs(nowSeconds - Number(timestamp)) > toleranceSeconds) return false;
  const digest = createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex");
  return safeEqual(`sha256=${digest}`, signature);
}
