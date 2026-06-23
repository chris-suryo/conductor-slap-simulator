# APC brand assets — drop slot

The official APC Relay Engineering logo (from `APC Office Related Stationary/PNG/`, 3333×833
RGBA PNGs) lives here, referenced by `BRAND.logo` in `src/theme/brand.ts`:

- `apc-logo.png` — light-ink (white text) lockup, for the app's **dark** header →
  `BRAND.logo.src = '/brand/apc-logo.png'`
- `apc-logo-light.png` — dark-ink (navy text) lockup, for the app's **light** header →
  `BRAND.logo.srcLight = '/brand/apc-logo-light.png'`

Source naming is the inverse of the app's: the vendor files are named `_Light`/`_Dark` for the
ink color, not the background. `BRAND.logo.aspect` is the art's width ÷ height (3333/833).

Files in `public/` are served from the site root, so `public/brand/apc-logo.png` is referenced
as `/brand/apc-logo.png`. If no logo is set, the app falls back to a typographic wordmark.
