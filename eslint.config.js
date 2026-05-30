import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        clearTimeout: 'readonly',
        Conflicts: 'readonly',
        DB: 'readonly',
        document: 'readonly',
        Drag: 'readonly',
        Employees: 'readonly',
        Export: 'readonly',
        Grid: 'readonly',
        idbKeyval: 'readonly',
        navigator: 'readonly',
        Promise: 'readonly',
        requestAnimationFrame: 'readonly',
        Settings: 'readonly',
        setTimeout: 'readonly',
        window: 'readonly',
      },
      sourceType: 'script',
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'no-unused-vars': 'error',
    },
  },
];
