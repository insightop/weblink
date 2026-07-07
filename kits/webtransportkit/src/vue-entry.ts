/**
 * Vue bridge entry point for @weblink/web 的 KitWrapper。
 *
 * 提供 EmbeddedPage 组件，在 Vue 应用内嵌入 React 页面。
 */
import { defineComponent, h, onMounted, onUnmounted, ref } from "vue";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WebTransportLabPage } from "./lab/WebTransportLabPage";

export const EmbeddedPage = defineComponent({
  name: "WebTransportKitEmbeddedPage",

  setup() {
    const container = ref<HTMLDivElement>();
    let root: Root | undefined;

    onMounted(() => {
      if (container.value) {
        root = createRoot(container.value);
        root.render(createElement(WebTransportLabPage));
      }
    });

    onUnmounted(() => {
      root?.unmount();
    });

    return () =>
      h("div", {
        ref: container,
        style: { width: "100%", height: "100%" },
      });
  },
});
