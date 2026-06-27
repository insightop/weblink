import react from "@vitejs/plugin-react-swc";
import type { UserConfig } from "vite";

/** Vite UserConfig extended with vitest test config */
type Config = UserConfig & { test?: Record<string, unknown> };

export interface KitReactBaseOptions {
  /**
   * Test configuration.
   * true = use defaults, object = custom include patterns, false/omitted = no test config
   */
  test?:
    | boolean
    | {
        include?: string[];
      };
}

/**
 * Vite config factory for React-based kits.
 * Similar to kitBaseConfig() but uses @vitejs/plugin-react-swc instead of Vue.
 */
export function kitReactBaseConfig(options: KitReactBaseOptions = {}): Config {
  const { test } = options;

  const config: Config = {
    plugins: [react()],
    resolve: {
      alias: {},
    },
  };

  if (test !== undefined && test !== false) {
    const testConfig =
      test === true
        ? { environment: "node" as const, include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"] }
        : {
            environment: "node" as const,
            include: test.include ?? ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
          };
    config.test = testConfig;
  }

  return config;
}
