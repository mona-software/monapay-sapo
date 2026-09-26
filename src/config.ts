import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PUBLIC_BASE_URL: z.string().url().refine((value) => value.startsWith("https://"), "must use HTTPS"),
  DATA_FILE: z.string().default("./data/state.json"),
  SAPO_STORE: z.string().min(1),
  SAPO_API_KEY: z.string().min(1),
  SAPO_API_SECRET: z.string().min(1),
  SAPO_BANK_TRANSFER_GATEWAYS: z.string().min(1).default("Chuyển khoản qua ngân hàng,Bank Transfer"),
  MONAPAY_BASE_URL: z.string().url().default("https://api.monapay.vn"),
  MONAPAY_CLIENT_ID: z.string().min(1),
  MONAPAY_CLIENT_SECRET: z.string().min(1),
  MONAPAY_WEBHOOK_SECRET: z.string().min(16),
  MONAPAY_SANDBOX: booleanString,
  MONAPAY_CHECKOUT_EXPIRES_IN: z.coerce.number().int().min(60).max(86400).default(3600)
});

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = schema.parse(env);
  const store = parsed.SAPO_STORE.replace(/^https?:\/\//, "").replace(/\/$/, "");

  if (!/^[a-z0-9.-]+$/i.test(store)) {
    throw new Error("SAPO_STORE không hợp lệ");
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    publicBaseUrl: parsed.PUBLIC_BASE_URL.replace(/\/$/, ""),
    dataFile: parsed.DATA_FILE,
    sapo: {
      store,
      apiKey: parsed.SAPO_API_KEY,
      apiSecret: parsed.SAPO_API_SECRET,
      bankTransferGateways: parsed.SAPO_BANK_TRANSFER_GATEWAYS.split(",")
        .map((item) => item.trim().toLocaleLowerCase("vi"))
        .filter(Boolean)
    },
    monaPay: {
      baseUrl: parsed.MONAPAY_BASE_URL.replace(/\/$/, ""),
      clientId: parsed.MONAPAY_CLIENT_ID,
      clientSecret: parsed.MONAPAY_CLIENT_SECRET,
      webhookSecret: parsed.MONAPAY_WEBHOOK_SECRET,
      sandbox: parsed.MONAPAY_SANDBOX,
      checkoutExpiresIn: parsed.MONAPAY_CHECKOUT_EXPIRES_IN
    }
  };
}
