import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'include-design-notes',
    generateBundle() {
      for (const fileName of ['README.md', 'foundations/README.md', 'design-foundations.md', 'ui-design-roadmap.md', 'ui-design-coverage.md', 'ui-design-shared-plan.md', 'ui-design-production-plan.md', 'ui-design-training-plan.md', 'reviews/R01.md', 'reviews/R01-02.md', 'reviews/R02-01.md', 'reviews/R02-02.md', 'design-delivery-guide.md', 'reviews/F-responsive.md', 'reviews/F-theme.md', 'src/theme/README.md', 'src/theme/LICENSE.primereact-sass-theme', 'src/theme/vendor/primereact-sass-theme/UPSTREAM.json', '.impeccable/design.json']) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL(`./${fileName}`, import.meta.url), 'utf8') });
      }
    },
  }],
  build: {
    rollupOptions: {
      input: {
        foundations: fileURLToPath(new URL('./foundations/index.html', import.meta.url)),
        lists: fileURLToPath(new URL('./components/lists/index.html', import.meta.url)),
        organization: fileURLToPath(new URL('./components/organization/index.html', import.meta.url)),
        navigation: fileURLToPath(new URL('./shell/navigation/index.html', import.meta.url)),
        projectContext: fileURLToPath(new URL('./shell/project-context/index.html', import.meta.url)),
      },
    },
  },
});
