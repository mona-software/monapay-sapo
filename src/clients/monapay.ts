import type { MonaCheckout } from "../types.js";
import { HttpError, requestJson } from "./http.js";

interface TokenEnvelope {
  data?: { access_token?: string; expires_in?: number };
  access_token?: string;
  expires_in?: number;
}

interface CheckoutEnvelope {
  success?: boolean;
  message?: string;
  data?: MonaCheckout;
}

export class MonaPayClient {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;

    const result = await requestJson<TokenEnvelope>(`${this.baseUrl}/api/v1/oauth/token`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret
      })
    });
    const value = result.data?.access_token ?? result.access_token;
    const expiresIn = result.data?.expires_in ?? result.expires_in ?? 3600;
    if (!value) throw new Error("MONA Pay không trả access_token");
    this.token = { value, expiresAt: Date.now() + expiresIn * 1000 };
    return value;
  }

  async createCheckout(input: {
    amount: number;
    orderCode: string;
    description: string;
    returnUrl: string;
    payerEmail?: string;
    payerName?: string;
    expiresIn: number;
    sandbox: boolean;
    metadata: Record<string, unknown>;
  }): Promise<MonaCheckout> {
    const makeRequest = async () => {
      const token = await this.accessToken();
      return requestJson<CheckoutEnvelope>(`${this.baseUrl}/api/v1/checkouts`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Client-Secret": this.clientSecret,
          "Idempotency-Key": `sapo-order-${input.orderCode}`
        },
        body: JSON.stringify({
          amount: input.amount,
          order_code: input.orderCode,
          description: input.description,
          return_url: input.returnUrl,
          payer_email: input.payerEmail || undefined,
          payer_name: input.payerName || undefined,
          expires_in: input.expiresIn,
          sandbox: input.sandbox,
          metadata: input.metadata
        })
      });
    };

    let envelope: CheckoutEnvelope;
    try {
      envelope = await makeRequest();
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 401) throw error;
      this.token = null;
      envelope = await makeRequest();
    }

    if (envelope.success === false || !envelope.data?.checkout_url || !envelope.data.qr_image_url) {
      throw new Error(envelope.message || "MONA Pay trả checkout không hợp lệ");
    }
    return envelope.data;
  }
}
