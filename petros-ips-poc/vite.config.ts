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
        //
        // The JSON assets (CLDR locale data, i18n bundles, theme parameters)
        // that `@ui5/webcomponents-react/dist/Assets.js` registers are loaded
        // on demand via dynamic import() and are leaf modules, so leave them
        // out of the group: they become small lazy chunks and only the active
        // locale/theme is downloaded, instead of ~12 MB of every locale being
        // inlined into the eagerly-loaded ui5 chunk.
        codeSplitting: {
          groups: [
            {
              name: 'ui5',
              test: (id) =>
                /node_modules[\\/]@ui5[\\/]/.test(id) && !/[\\/]assets[\\/].+\.json$/.test(id),
            },
            { name: 'recharts', test: /node_modules[\\/]recharts/ },
          ],
        },
      },
    },
  },
})
