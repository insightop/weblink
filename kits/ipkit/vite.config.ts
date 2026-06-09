import { kitBaseConfig } from "@weblink/vite-config";
import { fileURLToPath, URL } from "node:url";

export default kitBaseConfig({
  kitRoot: fileURLToPath(new URL(".", import.meta.url)),
  test: true,
});
