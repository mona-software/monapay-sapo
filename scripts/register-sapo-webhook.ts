import { loadConfig } from "../src/config.js";
import { SapoClient } from "../src/clients/sapo.js";

const config = loadConfig();
const client = new SapoClient(config.sapo.store, config.sapo.apiKey, config.sapo.apiSecret);
const address = `${config.publicBaseUrl}/webhooks/sapo/orders-create`;
await client.registerWebhook(address);
console.log(`Đã đăng ký orders/create: ${address}`);
