# APC brand assets — drop slot

Place the official APC Relay Engineering logo files here, then point `BRAND.logo` at them in
`src/theme/brand.ts`:

- `apc-logo.svg` — logo for **dark** backgrounds → `BRAND.logo.src = '/brand/apc-logo.svg'`
- `apc-logo-light.svg` — (optional) logo for **light** backgrounds → `BRAND.logo.srcLight = '/brand/apc-logo-light.svg'`

Also set `BRAND.logo.aspect` to the art's width ÷ height, and update the official brand
colors in `BRAND.colors` (accent / navy) and the favicon in `index.html`.

Files in `public/` are served from the site root, so `public/brand/apc-logo.svg` is referenced
as `/brand/apc-logo.svg`. Until a logo is provided, the app renders a typographic wordmark.
