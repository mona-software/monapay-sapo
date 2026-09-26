import type { Config } from "./config.js";
import type { MonaWebhookPayload, SapoOrder, SapoTransaction } from "./types.js";
import { expectedOrderAmount, matchMonaPayment, validateAmount } from "./payment-match.js";
import { SapoClient } from "./clients/sapo.js";
import { MonaPayClient } from "./clients/monapay.js";
import { StateStore } from "./state-store.js";

export type ServiceResult = { status: "processed" | "duplicate" | "skipped" | "underpaid"; message: string };

export class ConnectorService {
  private readonly inFlight = new Map<string, Promise<ServiceResult>>();

  constructor(
    private readonly config: Config,
    private readonly sapo: SapoClient,
    private readonly monaPay: MonaPayClient,
    private readonly state: StateStore
  ) {}

  isBankTransfer(order: SapoOrder): boolean {
    if (order.financial_status && order.financial_status !== "pending") return false;
    const gateways = [order.gateway, ...(order.payment_gateway_names ?? [])]
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.toLocaleLowerCase("vi"));
    return gateways.some((gateway) => this.config.sapo.bankTransferGateways.some((allowed) => gateway.includes(allowed)));
  }

  async handleSapoOrder(order: SapoOrder): Promise<ServiceResult> {
    if (!this.isBankTransfer(order)) return { status: "skipped", message: "Không phải đơn chuyển khoản đang chờ." };
    const amount = expectedOrderAmount(order);
    if (!amount || amount < 1000) return { status: "skipped", message: "Đơn không dùng VND hoặc số tiền không hợp lệ." };

    const orderCode = `SAPO${order.id}`;
    const checkout = await this.monaPay.createCheckout({
      amount,
      orderCode,
      description: `Thanh toan ${orderCode}`,
      returnUrl: order.order_status_url?.startsWith("https://") ? order.order_status_url : `${this.config.publicBaseUrl}/health`,
      payerEmail: order.email ?? undefined,
      expiresIn: this.config.monaPay.checkoutExpiresIn,
      sandbox: this.config.monaPay.sandbox,
      metadata: { sapo_order_id: order.id, sapo_order_name: order.name ?? null }
    });

    const block = [
      "[MONA Pay] Xác nhận chuyển khoản ngân hàng tự động",
      `Mã thanh toán: ${orderCode}`,
      `Link thanh toán: ${checkout.checkout_url}`,
      `Ảnh VietQR: ${checkout.qr_image_url}`
    ].join("\n");
    const existing = order.note?.trim() ?? "";
    const note = existing.includes(`[MONA Pay]`) ? existing : [existing, block].filter(Boolean).join("\n\n");
    await this.sapo.updateOrderNote(order, note);
    return { status: "processed", message: `Đã tạo checkout cho đơn ${order.id}.` };
  }

  private transactionExists(transactions: SapoTransaction[], code: string): boolean {
    return transactions.some(
      (transaction) =>
        transaction.authorization === code ||
        transaction.receipt?.monapay_transaction_code === code
    );
  }

  async handleMonaWebhook(payload: MonaWebhookPayload): Promise<ServiceResult> {
    const match = matchMonaPayment(payload);
    if (!match.ok) return { status: "skipped", message: match.reason };

    const current = this.inFlight.get(match.transactionCode);
    if (current) return current;
    const operation = this.applyMonaPayment(match);
    this.inFlight.set(match.transactionCode, operation);
    try {
      return await operation;
    } finally {
      this.inFlight.delete(match.transactionCode);
    }
  }

  private async applyMonaPayment(match: Extract<ReturnType<typeof matchMonaPayment>, { ok: true }>): Promise<ServiceResult> {
    if (await this.state.hasTransaction(match.transactionCode)) {
      return { status: "duplicate", message: "Giao dịch đã được xử lý." };
    }

    let order: SapoOrder;
    try {
      order = await this.sapo.getOrder(match.orderId);
    } catch {
      return { status: "skipped", message: "Không tìm thấy đơn Sapo khớp." };
    }

    const amountStatus = validateAmount(match, order);
    if (amountStatus === "underpaid") return { status: "underpaid", message: "Số tiền nhận thấp hơn tổng đơn." };
    if (amountStatus === "invalid_order") return { status: "skipped", message: "Đơn Sapo không dùng VND hoặc có tổng tiền không hợp lệ." };

    const transactions = await this.sapo.listTransactions(order.id);
    if (this.transactionExists(transactions, match.transactionCode)) {
      await this.state.rememberTransaction(match.transactionCode, order.id);
      return { status: "duplicate", message: "Giao dịch đã tồn tại trên Sapo." };
    }

    await this.sapo.markPaid(order.id, match.paidAmount, match.transactionCode);
    await this.state.rememberTransaction(match.transactionCode, order.id);
    return { status: "processed", message: `Đã xác nhận thanh toán đơn ${order.id}.` };
  }
}
