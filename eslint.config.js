import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
    rules: {
      // CLAUDE.md rule 7: no per-frame allocations, so unused work should be loud.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    // CLAUDE.md rule 4: game logic must stay free of Three.js so it can be unit-tested.
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'three',
              message: 'src/game/ is pure logic — keep Three.js in src/render/.',
            },
          ],
          patterns: ['three/*'],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['*.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // The ESLint config itself is plain JS and lives outside the TS project.
    files: ['eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
