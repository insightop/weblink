import { createRouter, createWebHistory } from "vue-router";
import FlasherPage from "@/features/flasher/pages/FlasherPage.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/", name: "flasher", component: FlasherPage }],
});

export default router;
