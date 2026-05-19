import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import KitWrapper from "../views/KitWrapper.vue";
import { KIT_REGISTRY } from "../config/kitRegistry";

const kitRoutes = KIT_REGISTRY.filter((k) => k.prodUrl).map((kit) => ({
  path: `/${kit.id}`,
  name: kit.id,
  component: KitWrapper,
}));

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "home", component: HomeView },
    ...kitRoutes,
  ],
});

export default router;
