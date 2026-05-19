import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type IndexHtmlTransformResult, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";
import pkg from "./package.json" with { type: "json" };

const isDeployment = Boolean(process.env.VITE_GH_PAGES);
const siteURL = "https://modbuswebui.dev/"
const githubURL = "https://github.com/anttikotajarvi/modbus-webui";

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
    "import.meta.env.VITE_GH_PAGES": JSON.stringify(process.env.VITE_GH_PAGES ?? ""),
  },
  plugins: [
    tailwindcss(),
    svelte({
      compilerOptions: {
        customElement: true, // enable custom elements
      },
      onwarn(warning, handler) {
        if (warning.code === "custom_element_props_identifier") return;
        handler(warning);
      },
    }), // Svelte 5 compiler

    // Inject static SEO tags into <head> at build time
    isDeployment ? createSeoHeadInjector() : null,
    
    createHtmlTokenReplace({ // This is mainly used for the footer.
      APP_VERSION: pkg.version,
      SITE_URL: siteURL,
      GITHUB_URL: githubURL
    }),
    

    viteSingleFile(), // inline JS & CSS → one HTML file
  ],
  build: {
    cssCodeSplit: false, // make sure CSS isn’t split out
    assetsInlineLimit: 1_000_000, // inline even large images/fonts
    sourcemap: false, // smaller output
    emptyOutDir: true,
    rollupOptions: {
      input: { app: path.resolve(__dirname, "modbus-webui.html") },
    },
  },
  server: { open: "/modbus-webui.html" },
  preview: { open: "/modbus-webui.html" },
  // keeps relative URLs working when you open the file directly
  base: "./",
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
      "@": path.resolve("./src"),
    },
  },
});

// SEO head injector (build-time)
function createSeoHeadInjector(): Plugin {
  return {
    name: "seo-head-injector",
    transformIndexHtml(html): IndexHtmlTransformResult {
      const SITE_URL = process.env.VITE_SITE_URL || siteURL;
      const GA_ID = process.env.VITE_GA_ID || "G-0HFN4G088N";

      const withSlash = SITE_URL.replace(/\/?$/, "/");
      const asset = (p: string) => `${withSlash}${p}`.replace(/([^:]\/)\/+/g, "$1");

      const KEYWORDS =
        "modbus,webui,automation,modbus rtu,rs-485,rs485,web serial,usb-to-rs485,modbus client,modbus master,serial";

      const tags = [
        // Canonical + icons + PWA
        { tag: "link", attrs: { rel: "canonical", href: SITE_URL } },
        { tag: "link", attrs: { rel: "icon", type: "image/svg+xml", href: asset("favicon.svg") } },
        { tag: "link", attrs: { rel: "apple-touch-icon", href: asset("icon-192.png") } },
        { tag: "link", attrs: { rel: "manifest", href: asset("manifest.webmanifest") } },

        // Core meta
        { tag: "meta", attrs: { name: "description", content: "Single-file Modbus Web UI with profiles, name tables, and shortcuts" } },
        { tag: "meta", attrs: { name: "robots", content: "index,follow" } },
        { tag: "meta", attrs: { name: "keywords", content: KEYWORDS } },
        { tag: "meta", attrs: { name: "author", content: "github.com/anttikotajarvi" } },
        { tag: "meta", attrs: { name: "theme-color", content: "#ffffff" } },

        // Open Graph
        { tag: "meta", attrs: { property: "og:site_name", content: "Modbus WebUI" } },
        { tag: "meta", attrs: { property: "og:locale", content: "en_US" } },
        { tag: "meta", attrs: { property: "og:title", content: "Modbus WebUI" } },
        { tag: "meta", attrs: { property: "og:description", content: "Single-file Modbus Web UI with profiles, name tables, and shortcuts" } },
        { tag: "meta", attrs: { property: "og:url", content: SITE_URL } },
        { tag: "meta", attrs: { property: "og:type", content: "website" } },

        // Twitter
        { tag: "meta", attrs: { name: "twitter:card", content: "summary" } },
        { tag: "meta", attrs: { name: "twitter:title", content: "Modbus WebUI" } },
        { tag: "meta", attrs: { name: "twitter:description", content: "Single-file Modbus Web UI with profiles, name tables, and shortcuts" } },
        { tag: "meta", attrs: { name: "twitter:site", content: "@anttikotajarvi" } },
        { tag: "meta", attrs: { name: "twitter:creator", content: "@anttikotajarvi" } },

        // JSON-LD
        {
          tag: "script",
          attrs: { type: "application/ld+json" },
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Modbus WebUI",
            url: SITE_URL,
            keywords: KEYWORDS,
          }),
        },

        // Google Analytics
        { tag: "script", attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID}` } },
        {
          tag: "script",
          children: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `.trim(),
        },
      ];

      // Return unchanged HTML plus injected tags
      return { html, tags };
    },
  };
}


/**
 * Replace %TOKENS% inside index.html at build time.
 * Usage: createHtmlTokenReplace({ APP_VERSION: "1.0.2" })
 * By default it looks for %KEY% (e.g., %APP_VERSION%), but you can change the delimiters.
 */
function createHtmlTokenReplace(
  tokens: Record<string, string>,
  opts: { delimStart?: string; delimEnd?: string } = {}
): Plugin {
  const { delimStart = "%", delimEnd = "%" } = opts;

  // Escape for RegExp
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Build a single regex like /%(APP_VERSION|SITE_URL)%/g
  const keys = Object.keys(tokens);
  const pattern =
    keys.length > 0
      ? new RegExp(
          `${esc(delimStart)}(${keys.map(esc).join("|")})${esc(delimEnd)}`,
          "g"
        )
      : null;

  return {
    name: "html-token-replace",
    apply: "build",
    transformIndexHtml(html) {
      if (!pattern) return html;
      return html.replace(pattern, (_m, key: string) => tokens[key] ?? _m);
    },
  };
}