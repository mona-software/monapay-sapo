import type { SapoOrder, SapoTransaction } from "../types.js";
import { requestJson } from "./http.js";

export class SapoClient {
  private readonly baseUrl: string;
  private readonly authorization: string;

  constructor(store: string, apiKey: string, apiSecret: string) {
    this.baseUrl = `https://${store}/admin`;
    this.authorization = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
  }

  private request<T>(path: string, init: RequestInit = {}): Promise<T> {
    return requestJson<T>(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: this.authorization,
        ...init.headers
      }
    });
  }

  async getOrder(orderId: number): Promise<SapoOrder> {
    const result = await this.request<{ order: SapoOrder }>(`/orders/${orderId}.json`);
    return result.order;
  }

  async updateOrderNote(order: SapoOrder, note: string): Promise<void> {
    await this.request(`/orders/${order.id}.json`, {
      method: "PUT",
      body: JSON.stringify({ order: { id: order.id, note } })
    });
  }

  async listTransactions(orderId: number): Promise<SapoTransaction[]> {
    const result = await this.request<{ transactions: SapoTransaction[] }>(`/orders/${orderId}/transactions.json`);
    return result.transactions ?? [];
  }

  async markPaid(orderId: number, amount: number, transactionCode: string): Promise<void> {
    await this.request(`/orders/${orderId}/transactions.json`, {
      method: "POST",
      body: JSON.stringify({
        transaction: {
          kind: "sale",
          status: "success",
          amount: String(amount),
          gateway: "MONA Pay",
          authorization: transactionCode
        }
      })
    });
  }

  async registerWebhook(address: string): Promise<unknown> {
    return this.request("/webhooks.json", {
      method: "POST",
      body: JSON.stringify({ webhook: { topic: "orders/create", address, format: "json" } })
    });
  }
}
