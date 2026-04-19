import { createApp } from "vue";
import { createPinia } from "pinia";
import naive from "naive-ui";
import App from "@/App.vue";
import router from "@/router";
import { registerBuiltinTools } from "@/tools/registerBuiltinTools";
import "@/styles/index.css";

registerBuiltinTools();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(naive);
app.mount("#app");
