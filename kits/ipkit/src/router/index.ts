import { createRouter, createWebHistory, createMemoryHistory } from "vue-router";
import { routes } from "@/router/routes";

const isEmbedded = import.meta.env.VITE_EMBEDDED === "true";

export const router = createRouter({
  history: isEmbedded ? createMemoryHistory() : createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? "IP Kit";
  document.title = `${title} · weblink-ipkit`;
});

export default router;
