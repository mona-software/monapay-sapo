import type { MonaWebhookPayload, PaymentMatch, SapoOrder } from "./types.js";

const ORDER_CODE = /^SAPO([1-9]\d*)$/;
const DESCRIPTION_CODE = /(?:^|[^A-Z0-9])SAPO\s*#?\s*([1-9]\d*)(?:$|[^0-9])/i;

function positiveInteger(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function expectedOrderAmount(order: SapoOrder): number | null {
  if (order.currency && order.currency.toUpperCase() !== "VND") return null;
  return positiveInteger(Math.round(Number(order.total_price)));
}

export function matchMonaPayment(payload: MonaWebhookPayload): PaymentMatch {
  const event = payload.event ?? payload.event_type ?? "TRANSACTION_IN";
  const transactionCode = typeof payload.transaction_code === "string" ? payload.transaction_code.trim() : "";
  if (!transactionCode) return { ok: false, reason: "missing_transaction_code" };

  if (event === "CHECKOUT_PAID") {
    if (payload.status !== undefined && payload.status !== "paid") return { ok: false, reason: "checkout_not_paid" };
    const match = typeof payload.order_code === "string" ? ORDER_CODE.exec(payload.order_code) : null;
    const paidAmount = positiveInteger(payload.paid_amount);
    if (!match || !match[1]) return { ok: false, reason: "invalid_order_code" };
    if (!paidAmount) return { ok: false, reason: "invalid_amount" };
    return { ok: true, orderId: Number(match[1]), paidAmount, transactionCode };
  }

  if (event !== "TRANSACTION_IN" || (payload.type !== undefined && payload.type !== "income")) {
    return { ok: false, reason: "unsupported_event" };
  }

  const match = typeof payload.description === "string" ? DESCRIPTION_CODE.exec(payload.description) : null;
  const paidAmount = positiveInteger(payload.amount);
  if (!match || !match[1]) return { ok: false, reason: "order_not_found_in_description" };
  if (!paidAmount) return { ok: false, reason: "invalid_amount" };
  return { ok: true, orderId: Number(match[1]), paidAmount, transactionCode };
}

export function validateAmount(match: Extract<PaymentMatch, { ok: true }>, order: SapoOrder): "matched" | "underpaid" | "invalid_order" {
  const expected = expectedOrderAmount(order);
  if (!expected) return "invalid_order";
  return match.paidAmount >= expected ? "matched" : "underpaid";
}
