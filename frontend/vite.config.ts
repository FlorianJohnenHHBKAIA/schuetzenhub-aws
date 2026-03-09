import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
    // Proxy: API-Anfragen werden im Entwicklungsmodus an das Backend weitergeleitet
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-icon-192.png", "pwa-icon-512.png"],
      manifest: {
        name: "Schützenportal",
        short_name: "Portal",
        description: "Das digitale Portal für Schützenvereine",
        start_url: "/portal",
        display: "standalone",
        background_color: "#1a3a2a",
        theme_color: "#1a3a2a",
        orientation: "portrait-primary",
        icons: [
          { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        categories: ["productivity", "utilities"],
        lang: "de",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 31536000 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: "NetworkFirst",
            method: "GET",
            options: { cacheName: "api-cache", expiration: { maxEntries: 100, maxAgeSeconds: 86400 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: /\/uploads\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "uploads-cache", expiration: { maxEntries: 50, maxAgeSeconds: 604800 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: { cacheName: "images-cache", expiration: { maxEntries: 60, maxAgeSeconds: 2592000 } },
          },
        ],
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
