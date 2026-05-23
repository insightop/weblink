import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import KitWrapper from "../views/KitWrapper.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/:kitId", name: "kit", component: KitWrapper },
  ],
});

export default router;
