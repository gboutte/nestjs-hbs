import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    setupFiles: ['test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Barrel file: re-exports only, nothing to cover.
      exclude: ['src/index.ts'],
      reporter: ['text', 'lcov'],
    },
  },
  plugins: [
    // Nest relies on `emitDecoratorMetadata`, which esbuild (Vitest's default
    // transformer) does not implement. SWC does, and is what the NestJS docs
    // point to for this.
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
});
