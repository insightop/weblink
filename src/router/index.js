import { createRouter, createWebHistory } from 'vue-router'
import KitWorkspaceView from '../features/kits/views/KitWorkspaceView.vue'

const routes = [
  { path: '/', component: KitWorkspaceView },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
