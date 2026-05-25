import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { i18n } from "./i18n";
import { registerBuiltinPlugins } from "./plugins/builtin/registerBuiltinPlugins";
import "@weblink/tokens/index.css";
import "@/styles/index.css";
import "splitpanes/dist/splitpanes.css";

registerBuiltinPlugins();

declare const __BUILD_TIME__: string;
document.title = `downloadkit(${__BUILD_TIME__})`;

const app = createApp(App);
app.use(createPinia());
app.use(i18n);
app.use(router);
app.mount("#app");
