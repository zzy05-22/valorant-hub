// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://valorant-hub-five.vercel.app',
  integrations: [sitemap()],
});