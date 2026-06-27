import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import KitWrapper from "../views/KitWrapper.vue";
import { findKit } from "@/config/kitRegistry";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/:kitId", name: "kit", component: KitWrapper },
    { path: "/:kitId/:subPath+", name: "kit-sub", component: KitWrapper },
  ],
});

router.afterEach((to) => {
  if (to.name === "home") {
    document.title = "Weblink";
  } else if (to.params.kitId) {
    const kitId = to.params.kitId as string;
    const kit = findKit(kitId);
    document.title = kit ? `${kit.title} - Weblink` : "Weblink";
  }
});

export default router;
