import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { SapoClient } from "./clients/sapo.js";
import { MonaPayClient } from "./clients/monapay.js";
import { StateStore } from "./state-store.js";
import { ConnectorService } from "./service.js";

const config = loadConfig();
const sapo = new SapoClient(config.sapo.store, config.sapo.apiKey, config.sapo.apiSecret);
const monaPay = new MonaPayClient(config.monaPay.baseUrl, config.monaPay.clientId, config.monaPay.clientSecret);
const state = new StateStore(config.dataFile);
const service = new ConnectorService(config, sapo, monaPay, state);
const app = createApp(config, service);

app.listen(config.port, config.host, () => {
  console.log(`monapay-sapo listening on ${config.host}:${config.port}`);
});
