import { kitLibConfig } from "@weblink/vite-config";
import { fileURLToPath, URL } from "node:url";

export default kitLibConfig({
  kitRoot: fileURLToPath(new URL(".", import.meta.url)),
});
