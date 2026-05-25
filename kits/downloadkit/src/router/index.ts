import { createRouter, createWebHistory, createMemoryHistory } from "vue-router";
import FlasherPage from "../features/flasher/pages/FlasherPage.vue";

const isEmbedded = import.meta.env.VITE_EMBEDDED === "true";

const router = createRouter({
  history: isEmbedded ? createMemoryHistory() : createWebHistory(import.meta.env.BASE_URL),
  routes: [{ path: "/", name: "flasher", component: FlasherPage }],
});

export default router;
