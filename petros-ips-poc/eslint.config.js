import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // S9 typography token system (AUDIT.md → Typography audit). Banned
      // arbitrary text sizes: text-[9px], text-[10px], text-[11px], etc.
      // Use the semantic tokens instead — text-caption (11px), text-numeric
      // (12px), text-body (14px), text-subtitle (16px), text-title (20px),
      // text-display (24px). Two selectors cover both Literal usage
      // (className="text-[10px]" / cn('text-[10px]', ...)) and template
      // literals (className={`text-[10px] ${cond}`}).
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/\\btext-\\[\\d+px\\]/]",
          message: 'Avoid arbitrary text-[Npx] sizes. Use semantic tokens: text-caption, text-numeric, text-body, text-subtitle, text-title, text-display (defined in src/index.css @theme block, see AUDIT.md → Typography audit).',
        },
        {
          selector: "TemplateElement[value.raw=/\\btext-\\[\\d+px\\]/]",
          message: 'Avoid arbitrary text-[Npx] sizes. Use semantic tokens: text-caption, text-numeric, text-body, text-subtitle, text-title, text-display (defined in src/index.css @theme block, see AUDIT.md → Typography audit).',
        },
      ],
    },
  },
])
