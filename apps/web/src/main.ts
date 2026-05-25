import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { i18n } from "./i18n";
import "@weblink/tokens/index.css";
import "./styles/app.css";

declare const __BUILD_TIME__: string;
{
  const dt = new Date(__BUILD_TIME__);
  const y = String(dt.getFullYear()).slice(2);
  const M = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const h = String(dt.getHours()).padStart(2, "0");
  const m = String(dt.getMinutes()).padStart(2, "0");
  document.title = `Weblink(${y}${M}${d}${h}${m})`;
}

createApp(App).use(createPinia()).use(router).use(i18n).mount("#app");
