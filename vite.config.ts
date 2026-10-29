/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

declare const process: { env?: Record<string, string | undefined> };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('0.1.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // 상대 경로: GitHub Pages 하위 경로(/저장소명/) 또는 루트(/) 모두 지원
  base: process.env?.VITE_BASE_PATH || './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'MarkView',
        short_name: 'MarkView',
        description: '오프라인에서도 동작하는 마크다운 에디터 & 뷰어',
        lang: 'ko',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,ttf}'],
        // Mermaid 및 Elk 등 대용량 번들 청크(최대 ~2MB)를 온전히 캐시
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
