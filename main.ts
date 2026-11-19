// Neon Sunset Cover Studio — entry program (Node 22, standard library only).
//
// The app itself is the static files in app/ (index.html plus its modules,
// fonts and sample photos — everything loads offline, nothing over the
// network). This program hands the app in: it copies app/ and screenshots/
// from beside this file into the output directory and writes
// dossier.json, the summary the judge reads, using the vendored make.fun
// library (vendor/makefun-app.ts, the kit's copy, unchanged).
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader MAKEFUN_OUTPUT_DIR is unset and /output is used.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });

mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The gate's caps: at most 4 screenshots of 256 KiB, app/ at most 993 files
// and 48 MiB, paths at most 1000 bytes. Keep the entry inside them.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
