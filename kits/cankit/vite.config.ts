import { kitBaseConfig } from "@weblink/vite-config";

export default kitBaseConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
