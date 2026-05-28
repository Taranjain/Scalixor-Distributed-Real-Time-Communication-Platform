import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      name: 'CodeEditor',
      fileName: () => 'editor.bundle.js',
      formats: ['iife'],
    },
    outDir: './dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true,
        globals: {},
      },
    },
    cssCodeSplit: false,
  },
});
