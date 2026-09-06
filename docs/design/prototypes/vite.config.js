import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'include-design-notes',
    generateBundle() {
      for (const fileName of ['README.md', 'foundations/README.md', 'design-foundations.md', '.impeccable/design.json']) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL(`./${fileName}`, import.meta.url), 'utf8') });
      }
    },
  }],
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL('./foundations/index.html', import.meta.url)),
    },
  },
});
