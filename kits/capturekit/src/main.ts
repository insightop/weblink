import { createApp } from "vue";
import "@weblink/tokens/index.css";
import App from "./App.vue";
import "./styles/base.css";
import { logger } from "./infrastructure/logging/logger";

const app = createApp(App);
app.config.errorHandler = (err, _instance, info) => {
  logger.error("[vue]", info, err);
};
app.mount("#app");
