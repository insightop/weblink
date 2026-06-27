/**
 * Vue bridge entry point for @weblink/web's KitWrapper.
 *
 * Renders AdminApp or DemoApp based on URL path:
 *   /streamkit       → AdminApp (运维端)
 *   /streamkit/demo  → DemoApp  (远端示例)
 */
import { defineComponent, h, onMounted, onUnmounted, ref } from "vue";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import AdminApp from "./admin/AdminApp";
import DemoApp from "./demo/DemoApp";

function resolveComponent(): React.ComponentType {
  return window.location.pathname.endsWith("/demo") ? DemoApp : AdminApp;
}

export const EmbeddedPage = defineComponent({
  name: "StreamKitEmbeddedPage",

  setup() {
    const container = ref<HTMLDivElement>();
    let root: Root | undefined;

    onMounted(() => {
      if (container.value) {
        root = createRoot(container.value);
        root.render(createElement(resolveComponent()));
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
