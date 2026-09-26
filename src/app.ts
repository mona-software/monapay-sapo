import express, { type Request, type Response } from "express";
import type { Config } from "./config.js";
import type { MonaWebhookPayload, SapoOrder } from "./types.js";
import { verifyMonaWebhook, verifySapoWebhook } from "./signatures.js";
import { ConnectorService } from "./service.js";

function rawBody(request: Request): Buffer {
  if (!Buffer.isBuffer(request.body)) throw new Error("Request body phải là raw buffer");
  return request.body;
}

function jsonBody<T>(body: Buffer): T {
  return JSON.parse(body.toString("utf8")) as T;
}

export function createApp(config: Config, service: ConnectorService) {
  const app = express();
  const rawJson = express.raw({ type: "application/json", limit: "256kb" });

  app.disable("x-powered-by");
  app.get("/health", (_request, response) => response.json({ ok: true, service: "monapay-sapo" }));

  app.post("/webhooks/sapo/orders-create", rawJson, async (request: Request, response: Response) => {
    const body = rawBody(request);
    const signature = request.header("x-sapo-hmac-sha256");
    if (!verifySapoWebhook(body, signature, config.sapo.apiSecret)) {
      response.status(401).json({ ok: false, message: "Chữ ký Sapo không hợp lệ." });
      return;
    }

    try {
      const result = await service.handleSapoOrder(jsonBody<SapoOrder>(body));
      response.status(200).json({ ok: true, ...result });
    } catch (error) {
      console.error("sapo_webhook_failed", error instanceof Error ? error.message : "unknown_error");
      response.status(500).json({ ok: false, message: "Không thể xử lý đơn Sapo." });
    }
  });

  app.post("/webhooks/monapay", rawJson, async (request: Request, response: Response) => {
    const body = rawBody(request);
    if (
      !verifyMonaWebhook(
        body,
        request.header("x-mona-timestamp"),
        request.header("x-mona-signature"),
        config.monaPay.webhookSecret
      )
    ) {
      response.status(401).json({ ok: false, message: "Chữ ký MONA Pay không hợp lệ." });
      return;
    }

    try {
      const result = await service.handleMonaWebhook(jsonBody<MonaWebhookPayload>(body));
      response.status(200).json({ ok: true, ...result });
    } catch (error) {
      console.error("monapay_webhook_failed", error instanceof Error ? error.message : "unknown_error");
      response.status(500).json({ ok: false, message: "Không thể xử lý webhook MONA Pay." });
    }
  });

  app.use((_request, response) => response.status(404).json({ ok: false, message: "Not found" }));
  return app;
}
