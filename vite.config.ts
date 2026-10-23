import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fontsource указывает рядом с woff2 запасной woff. Приложению нужен WebGL 2, а все такие
 * браузеры читают woff2, так что woff никогда не загрузится — но в однофайловой сборке он
 * встраивался бы в страницу (~240 КБ). Правка до обработки CSS Vite, пока url() ещё не встроены.
 */
function woff2Only(): Plugin {
  return {
    name: "woff2-only",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("@fontsource") || !id.endsWith(".css")) return null;
      return code.replace(/,\s*url\([^)]*\.woff\)\s*format\('woff'\)/g, "");
    },
  };
}

/**
 * Собранный index.html — единственный распространяемый файл, и лицензии встроенных в него
 * библиотек и шрифтов (MIT, ISC, OFL, BSD) требуют, чтобы их тексты шли вместе с ним.
 * Тексты — из THIRD_PARTY_NOTICES.md (tools/build-notices.mjs); «--» внутри HTML-комментария недопустимо.
 */
function thirdPartyNotices(): Plugin {
  return {
    name: "third-party-notices",
    apply: "build",
    transformIndexHtml(html) {
      const notices = readFileSync(path.resolve(__dirname, "THIRD_PARTY_NOTICES.md"), "utf8").replace(/-{2,}/g, match => match.split("").join(" "));
      return html.replace("<head>", `<head>
<!--
${notices}
-->`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [woff2Only(), react(), thirdPartyNotices(), viteSingleFile()],
  server: {
    // Без явного адреса Vite на Windows слушает только [::1], а браузер идёт на 127.0.0.1.
    host: "127.0.0.1",
    port: 5177,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
