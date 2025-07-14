import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

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
        {
          src: 'src/background.js',
          dest: 'assets'
        },
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