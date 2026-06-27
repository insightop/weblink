import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import KitWrapper from "../views/KitWrapper.vue";
import { findKit } from "@/config/kitRegistry";
import { BUILD_VERSION, SITE_TITLE } from "@/utils/buildVersion";

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
    document.title = SITE_TITLE;
  } else if (to.params.kitId) {
    const kitId = to.params.kitId as string;
    const kit = findKit(kitId);
    document.title = kit ? `${kit.title} - ${SITE_TITLE}` : SITE_TITLE;
  }
});

export default router;
