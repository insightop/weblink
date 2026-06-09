/**
 * @weblink/vite-config - Shared Vite configuration factories for kits
 *
 * Provides reusable Vite configs that eliminate duplication across kit packages.
 * Each kit calls the factory function with its own root directory and gets a
 * complete Vite config that can be further customized with mergeConfig().
 */

import vue from "@vitejs/plugin-vue"
import { fileURLToPath, URL } from "node:url"
import type { UserConfig } from "vite"

/** Vite UserConfig extended with vitest test config */
type Config = UserConfig & { test?: Record<string, unknown> }

// ── kitBaseConfig ──────────────────────────────────────────────

export interface KitBaseOptions {
  /** Absolute path to the kit's root directory */
  kitRoot?: string
  /**
   * Test configuration.
   * true = use defaults, object = custom include patterns, false/omitted = no test config
   */
  test?:
    | boolean
    | {
        include?: string[]
      }
}

export function kitBaseConfig(options: KitBaseOptions = {}): Config {
  const { test } = options

  const config: Config = {
    plugins: [vue()],
    resolve: {
      alias: {},
    },
  }

  if (test !== undefined && test !== false) {
    const testConfig =
      test === true
        ? { environment: "node" as const, include: ["src/**/*.spec.ts"] }
        : {
            environment: "node" as const,
            include: test.include ?? ["src/**/*.spec.ts"],
          }
    config.test = testConfig
  }

  return config
}

// ── kitLibConfig ───────────────────────────────────────────────

export interface KitLibOptions {
  /** Absolute path to the kit's root directory */
  kitRoot: string
  /** Entry file relative to kitRoot, defaults to ./src/index.ts */
  entry?: string
}

export function kitLibConfig(options: KitLibOptions): Config {
  const { kitRoot, entry = "./src/index.ts" } = options
  const srcDir = fileURLToPath(new URL("./src", new URL(`file://${kitRoot}`)))

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        "@": srcDir,
      },
    },
    build: {
      lib: {
        entry: fileURLToPath(new URL(entry, new URL(`file://${kitRoot}`))),
        formats: ["es"],
        fileName: "index",
      },
      rollupOptions: {
        external: ["vue"],
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.spec.ts"],
    },
  }
}
