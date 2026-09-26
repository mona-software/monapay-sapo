export interface SapoOrder {
  id: number;
  name?: string;
  note?: string | null;
  email?: string | null;
  total_price: string | number;
  currency?: string;
  financial_status?: string;
  gateway?: string;
  payment_gateway_names?: string[];
  order_status_url?: string;
}

export interface SapoTransaction {
  id?: number;
  amount?: string;
  authorization?: string | null;
  gateway?: string;
  status?: string;
  receipt?: Record<string, unknown>;
}

export interface MonaCheckout {
  id: string;
  checkout_url: string;
  qr_image_url: string;
  order_code: string;
  amount: number;
  status: string;
}

export interface MonaWebhookPayload {
  event?: string;
  event_type?: string;
  type?: string;
  status?: string;
  order_code?: string;
  checkout_id?: string;
  transaction_code?: string;
  paid_amount?: number | string;
  amount?: number | string;
  description?: string;
  account_number?: string;
}

export type PaymentMatch =
  | { ok: true; orderId: number; paidAmount: number; transactionCode: string }
  | { ok: false; reason: string };
