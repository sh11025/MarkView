import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

/** HTML 내의 아이콘 링크를 data URL로 인라인하는 플러그인 (외부 파일 요청 방지) */
function inlineIconsPlugin(): Plugin {
  return {
    name: 'inline-icons',
    transformIndexHtml(html) {
      let result = html;
      try {
        const svgPath = path.resolve(__dirname, 'public/icon.svg');
        if (fs.existsSync(svgPath)) {
          const svgContent = fs.readFileSync(svgPath, 'utf-8');
          const svgBase64 = Buffer.from(svgContent).toString('base64');
          result = result.replace('./icon.svg', `data:image/svg+xml;base64,${svgBase64}`);
        }
        const pngPath = path.resolve(__dirname, 'public/apple-touch-icon.png');
        if (fs.existsSync(pngPath)) {
          const pngContent = fs.readFileSync(pngPath);
          const pngBase64 = pngContent.toString('base64');
          result = result.replace('./apple-touch-icon.png', `data:image/png;base64,${pngBase64}`);
        }
      } catch (err) {
        console.warn('아이콘 인라인 실패, 기본 경로 유지:', err);
      }
      return result;
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || '0.1.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    inlineIconsPlugin(),
    viteSingleFile({
      useRecommendedBuildConfig: true,
      removeViteModuleLoader: true,
    }),
  ],
  resolve: {
    alias: {
      'virtual:pwa-register': path.resolve(__dirname, 'src/app/pwaStub.ts'),
    },
  },
  build: {
    outDir: 'dist-portable',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000, // 100MB 이하 모든 에셋 인라인
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
