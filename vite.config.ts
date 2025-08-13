import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SecretGarden',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'esm' : format}.js`
    },
    rollupOptions: {
      external: ['paper'],
      output: {
        globals: {
          paper: 'paper'
        }
      }
    },
    sourcemap: true
  },
  test: {
    environment: 'jsdom'
  }
})