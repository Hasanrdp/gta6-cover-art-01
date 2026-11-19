# Neon Sunset Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/Hasanrdp/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/Hasanrdp/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

**Neon Sunset Cover Studio** turns your photos and a caption into multi-panel poster cover art in the style of GTA 6's posters — bold lettering, a Vice City sunset or neon colour grade — and exports it as a PNG to share. Built for the [make.fun gta6-cover-art-01 bounty](https://make.fun/bounty/gta6-cover-art-01).

## How it works

1. **Add photos** — your own JPG/PNG files, or use the two built-in samples. Photos are read on your machine and never uploaded.
2. **Pick a layout** — Neon Quad, Sunset Strip, Comic Five or Full Bleed. Click a panel to select it, drag the photo inside it to move it, scroll to zoom, or use the panel sliders.
3. **Grade it** — Sunset, Neon, Vice or Noir, with a strength slider, a procedural setting sun, skyline and palm silhouettes, and film grain.
4. **Write the caption** — big condensed display lettering with a neon echo and outline, plus a tagline ribbon.
5. **Export** — one click writes a full-resolution PNG: 1080 × 1080 (feed), 1080 × 1350 (stories) or 1920 × 1080 (banner).

## Try it offline

Serve `app/` with any static server and open `index.html` in desktop Chrome:

```sh
cd app && python3 -m http.server 8080
# open http://localhost:8080
```

No build step, no network requests: every script, font and sample photo is a file under `app/`.

## Files

- `app/index.html` — the editor shell
- `app/style.css` — the editor chrome
- `app/src/cover.js` — the cover renderer (layouts, grades, sun + skyline, lettering, grain)
- `app/src/main.js` — the editor: photos, panels, controls, export
- `app/src/shots.js` — `?shot=cover` / `?shot=editor` demo modes used for the entry's screenshots
- `app/fonts/` — Anton and Bebas Neue (SIL Open Font License, see `app/fonts/OFL.txt`)
- `app/samples/` — two sample photos, made with an image model for make.fun and free to use
- `main.ts` — the entry program: copies `app/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — the app with a photo loaded, and covers it exported

## Originality

Everything on the cover is drawn by this app in code — no Rockstar Games logo, wordmark, official artwork, character or font. The fonts are OFL-licensed files shipped under `app/fonts/`.

## License

MIT — see [LICENSE](LICENSE).
