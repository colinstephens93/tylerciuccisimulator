import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works under the GitHub Pages sub-path.
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  test: { include: ['tests/**/*.test.js'] },
});
