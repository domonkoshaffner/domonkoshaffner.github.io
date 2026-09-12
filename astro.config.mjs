// @ts-check
import { defineConfig } from 'astro/config';

// User site on GitHub Pages: https://<username>.github.io, so no `base` is needed.
// If you host under a project repo instead, add `base: '/<repo-name>'`.
export default defineConfig({
  site: 'https://domonkoshaffner.github.io',
  // `public/` is the owner's local reference folder. Only curated website
  // assets in `static/` are served and copied into the published build.
  publicDir: './static',
  vite: {
    server: {
      fs: {
        // Setting deny replaces Vite's defaults, so retain its credential and
        // Git protections as well as blocking this project's private folders.
        deny: [
          '.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}',
          '.npmrc', '.yarnrc.yml', '**/.git/**',
          '**/public/**', '**/.local/**',
        ],
      },
    },
  },
});
