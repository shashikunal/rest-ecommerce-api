import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': join(__dirname, 'src'),
      '@shared': join(__dirname, 'src/shared'),
      '@config': join(__dirname, 'src/config'),
      '@infrastructure': join(__dirname, 'src/infrastructure'),
      '@modules': join(__dirname, 'src/modules'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/index.ts']
    }
  }
});
