import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import typescript from '@rollup/plugin-typescript';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  css: {
    postcss: './postcss.config.cjs',
  },
  // 开发模式配置
  esbuild: {
    // 保持更多原始代码结构
    keepNames: true,
    minifyIdentifiers: false,
    minifySyntax: false,
    minifyWhitespace: false,
  },
  build: {
    // 开发模式启用 source map
    sourcemap: mode === 'development' ? 'inline' : false,
    // 开发模式减少代码压缩
    minify: mode === 'development' ? false : 'esbuild',
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
      // 开发模式启用 source map
      sourceMap: mode === 'development',
      inlineSources: mode === 'development'
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
}));