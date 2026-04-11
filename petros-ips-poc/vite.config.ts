import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Chunk all @ui5/* packages into a single bundle.
        // Splitting them apart causes a TDZ / circular-dependency error at
        // runtime ("Cannot access 'i' before initialization") because the
        // icon registry in @ui5/webcomponents-base is referenced by the
        // icons package before the base chunk has finished initializing.
        // Keeping them in one chunk ensures the init order is correct.
        manualChunks(id) {
          if (id.includes('node_modules/@ui5/')) return 'ui5';
          if (id.includes('node_modules/recharts')) return 'recharts';
          return undefined;
        },
      },
    },
  },
})
