import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { i18n } from "./i18n";
import "@weblink/tokens/index.css";
import "./styles/app.css";

declare const __BUILD_TIME__: string;
document.title = `Weblink(${__BUILD_TIME__})`;

createApp(App).use(createPinia()).use(router).use(i18n).mount("#app");
