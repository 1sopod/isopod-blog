import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE } from './src/consts.ts';

// https://astro.build/config
export default defineConfig({
  site: SITE.url,
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      // Catppuccin matches the template's palette (#1e1e2e is Mocha's base)
      themes: { light: 'catppuccin-latte', dark: 'catppuccin-mocha' },
      defaultColor: 'dark',
      wrap: false,
    },
  },
});
