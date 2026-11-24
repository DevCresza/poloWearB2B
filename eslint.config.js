import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// eslint-plugin-react-hooks 7 trouxe para o "recommended" as regras do React
// Compiler (immutability, set-state-in-effect, static-components, purity, refs...).
// Elas apontam padroes reais, mas o codigo atual tem dezenas de ocorrencias:
// ficam como aviso ate serem corrigidas aos poucos. As duas regras classicas
// mantem o nivel de antes (rules-of-hooks erro, exhaustive-deps aviso).
const reactHooksRules = Object.fromEntries(
  Object.entries(reactHooks.configs.recommended.rules).map(([regra, nivel]) => [
    regra,
    regra === 'react-hooks/rules-of-hooks' ? nivel : 'warn',
  ])
)

export default [
  {
    ignores: [
      'dist',
      'scripts/**',
      'node_modules/**',
      '*.config.js',
      'tailwind.config.js',
      'vite.config.js',
      'postcss.config.js'
    ]
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.es2020,
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooksRules,
      'react/jsx-no-target-blank': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Relaxar regras não críticas
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',
      'react/no-unknown-property': ['error', {
        ignore: ['cmdk-input-wrapper', 'toast-close', 'vaul-drawer-wrapper']
      }],
      'no-useless-catch': 'warn',
      'no-prototype-builtins': 'warn',
    },
  },
]
