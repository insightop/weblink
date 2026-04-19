import { createRouter, createWebHistory } from "vue-router";
import { routes } from "@/router/routes";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? "IP Kit";
  document.title = `${title} · weblink-ipkit`;
});

export default router;
