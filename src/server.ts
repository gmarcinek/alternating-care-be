import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { waitForCouch } from "./utils/waitForCouch.js";

const app = buildApp();
app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => app.log.info(`API on :${env.PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
