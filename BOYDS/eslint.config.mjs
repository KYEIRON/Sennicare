import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  prettier,
  {
    rules: {
      // BOYD'S rules — see CLAUDE.md
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // The domain layer must stay framework-free and database-free so the
    // financial engine is testable without either. See ARCHITECTURE.md.
    files: ['src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/*', '@/components/*', '@/features/*', '@/database/*'],
              message:
                'src/services must stay pure: no framework, UI, or database imports. See ARCHITECTURE.md.',
            },
            {
              group: ['next', 'next/*', 'react', 'react-dom', '@supabase/*'],
              message:
                'src/services must stay framework-free and database-free. See ARCHITECTURE.md.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
