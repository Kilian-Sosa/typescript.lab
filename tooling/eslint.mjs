// Dependencies come from each package so the runner can be installed independently.
export function createConfig({ js, tseslint, globals, vue }) {
  return [
    {
      ignores: [
        '**/node_modules/**',
        '**/.pnpm-store/**',
        '**/.worktrees/**',
        '**/dist/**',
        '**/.dist/**',
        '**/.artifacts/**',
        '**/.vercel/**',
        '**/coverage/**',
        '**/test-results/**',
        '**/playwright-report/**',
        '**/output/**',
        '**/.nuxt/**',
        '**/.output/**',
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.{ts,vue}'] })),
    ...(vue ? vue.configs['flat/essential'] : []),
    {
      files: ['**/*.{js,mjs,cjs,ts,vue}'],
      languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.worker } },
      linterOptions: { reportUnusedDisableDirectives: 'error' },
      rules: {
        'no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true },
        ],
      },
    },
    {
      files: ['**/*.{ts,vue}'],
      rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true },
        ],
      },
    },
    ...(vue
      ? [
          {
            files: ['**/*.vue'],
            languageOptions: { parserOptions: { parser: tseslint.parser } },
          },
        ]
      : []),
  ];
}
