rootDir: .
env:
  - .env

extends:
  - eslint:recommended
  - plugin:@typescript-eslint/recommended
  - plugin:@typescript-eslint/recommended-requiring-type-checking
  - plugin:import/recommended
  - plugin:import/typescript
  - prettier

parser: '@typescript-eslint/parser'
parserOptions:
  project: ./tsconfig.json
  sourceType: module

plugins:
  - @typescript-eslint
  - import
  - prettier

rules:
  prettier/prettier: 'error'
  @typescript-eslint/no-explicit-any: 'error'
  @typescript-eslint/no-unused-vars: ['error', { argsIgnorePattern: '^_' }]
  @typescript-eslint/explicit-function-return-type: 'off'
  @typescript-eslint/explicit-module-boundary-types: 'off'
  @typescript-eslint/no-non-null-assertion: 'warn'
  @typescript-eslint/strict-boolean-expressions: 'off'
  @typescript-eslint/no-unsafe-assignment: 'warn'
  @typescript-eslint/no-unsafe-call: 'warn'
  @typescript-eslint/no-unsafe-member-access: 'warn'
  import/order: ['error', {
    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
    'newlines-between': 'always',
    alphabetize: { order: 'asc', caseInsensitive: true }
  }]
  import/no-unresolved: 'error'
  no-console: ['warn', { allow: ['warn', 'error'] }]
  no-process-env: 'off'

ignorePatterns:
  - dist/
  - node_modules/
  - coverage/
  - *.config.js
  - *.config.ts
