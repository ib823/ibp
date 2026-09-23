import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Chunk all @ui5/* packages into a single bundle.
        // Splitting them apart causes a TDZ / circular-dependency error at
        // runtime ("Cannot access 'i' before initialization") because the
        // icon registry in @ui5/webcomponents-base is referenced by the
        // icons package before the base chunk has finished initializing.
        // Keeping them in one chunk ensures the init order is correct.
        // (Vite 8 / Rolldown: `codeSplitting.groups` replaces the deprecated
        // Rollup `manualChunks` function.)
        codeSplitting: {
          groups: [
            { name: 'ui5', test: /node_modules[\\/]@ui5[\\/]/ },
            { name: 'recharts', test: /node_modules[\\/]recharts/ },
          ],
        },
      },
    },
  },
})
