import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import typescript from '@rollup/plugin-typescript';

// https://vitejs.dev/config/
export default defineConfig({
  css: {
    postcss: './postcss.config.cjs',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/main.tsx'),
        options: resolve(__dirname, 'src/options/main.tsx'),
        tab_list: resolve(__dirname, 'src/tab_list/main.tsx'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.html')) {
            return '[name].[ext]';
          }
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/style.css';
          }
          return `assets/[name].[ext]`;
        },
      },
    },
  },
  plugins: [
    react(),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: false,
      inlineSources: false
    }),
    viteStaticCopy({
      targets: [
        {
          src: 'src/manifest.json',
          dest: '.',
        },
        {
          src: 'src/icons',
          dest: '.',
        },
        // background.ts 将通过 rollup 编译，不需要静态复制
        {
          src: 'src/popup.html',
          dest: '.'
        },
        {
          src: 'src/options.html',
          dest: '.'
        },
        {
          src: 'src/tab_list.html',
          dest: '.'
        }
      ],
    }),
  ],
});