import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SerialView from '../views/SerialView.vue'
import CameraView from '../views/CameraView.vue'
import MicrophoneView from '../views/MicrophoneView.vue'
import BluetoothView from '../views/BluetoothView.vue'
import StLinkView from '../views/StLinkView.vue'
import DapLinkView from '../views/DapLinkView.vue'
import UsbDfuView from '../views/UsbDfuView.vue'
import HidView from '../views/HidView.vue'

const routes = [
  { path: '/', redirect: '/serial' },
  { path: '/serial', component: SerialView },
  { path: '/camera', component: CameraView },
  { path: '/microphone', component: MicrophoneView },
  { path: '/bluetooth', component: BluetoothView },
  { path: '/st-link', component: StLinkView },
  { path: '/dap-link', component: DapLinkView },
  { path: '/usb-dfu', component: UsbDfuView },
  { path: '/hid', component: HidView },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
