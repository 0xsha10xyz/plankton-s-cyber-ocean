import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
const API_TARGET = process.env.VITE_DEV_API_PROXY ?? "http://127.0.0.1:3000";
const CORBITS_TARGET = process.env.VITE_DEV_CORBITS_PROXY ?? "https://planktonomous.0xsha10-xyz.api.corbits.dev";

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    global: "globalThis",
  },
  // Faremeter packages use top-level await in some modules.
  // Target modern browsers during dev to avoid esbuild errors.
  esbuild: {
    target: "es2022",
  },
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
      },
      "/__corbits": {
        target: CORBITS_TARGET,
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/__corbits/, ""),
      },
    },
  },
  preview: {
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
      },
      "/__corbits": {
        target: CORBITS_TARGET,
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/__corbits/, ""),
      },
    },
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "solana": [
            "@solana/web3.js",
            "@solana/wallet-adapter-base",
            "@solana/wallet-adapter-react",
            "@solana/wallet-adapter-wallets",
          ],
          "charts": ["recharts"],
          "ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "framer-motion",
          ],
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: "buffer/",
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "ox", "@base-org/account"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "buffer", "ox"],
    esbuildOptions: {
      target: "es2022",
    },
  },
});
