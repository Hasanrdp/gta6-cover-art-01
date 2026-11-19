// Neon Sunset Cover Studio — screenshot modes.
// Reads ?shot=cover / ?shot=editor from the URL so the app's maker can take
// the entry's screenshots with the app itself:
//   ?shot=cover&photo=pier&caption=Sunset%20Heist&layout=quad&size=wide
//   ?shot=editor&photo=boulevard&caption=Boulevard%20Queen&layout=comic
// Loaded before main.js; main.js reads window.__shot for the editor mode.

import {
  renderCover, ensureCoverFonts, LAYOUTS, GRADES, EXPORT_SIZES, defaultState,
  spreadPhotos,
} from './cover.js';

function parseShotParams() {
  const q = new URLSearchParams(location.search);
  const shot = {
    mode: q.get('shot') || '',
    photo: (q.get('photo') || '').toLowerCase(),
    caption: q.get('caption') || '',
    subtitle: q.get('subtitle') || '',
    layout: q.get('layout') || '',
    grade: q.get('grade') || '',
    size: q.get('size') || '',
  };
  if (shot.layout && !LAYOUTS[shot.layout]) shot.layout = '';
  if (shot.grade && !GRADES[shot.grade]) shot.grade = '';
  if (shot.size && !EXPORT_SIZES.find((s) => s.id === shot.size)) shot.size = '';
  return shot;
}

window.__shot = parseShotParams();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + src));
    img.src = src;
  });
}

async function renderCoverShot(shot) {
  document.body.classList.add('shot-cover');
  const state = defaultState();
  if (shot.caption) state.title = shot.caption;
  if (shot.subtitle) state.subtitle = shot.subtitle;
  if (shot.layout) state.layoutId = shot.layout;
  if (shot.grade) state.gradeId = shot.grade;
  if (shot.size) state.sizeId = shot.size;
  const size = EXPORT_SIZES.find((s) => s.id === state.sizeId) || EXPORT_SIZES[0];

  const photos = [];
  const samples = { boulevard: 'samples/boulevard.jpg', pier: 'samples/pier.jpg' };
  for (const [name, src] of Object.entries(samples)) {
    try { photos.push({ name, img: await loadImage(src) }); } catch (e) { /* leave empty */ }
  }
  if (shot.photo === 'pier' && photos[1]) {
    state.panels[0].photo = 1;
  }
  spreadPhotos(state, photos.length);
  await ensureCoverFonts();

  const canvas = document.createElement('canvas');
  canvas.id = 'shotCanvas';
  canvas.width = size.w;
  canvas.height = size.h;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  renderCover(ctx, state, photos.map((p) => p.img), size.w, size.h);
  document.documentElement.dataset.ready = '1';
}

function waitForEditor() {
  if (window.__editorReady) {
    document.documentElement.dataset.ready = '1';
    return;
  }
  setTimeout(waitForEditor, 100);
}

if (window.__shot.mode === 'cover') {
  renderCoverShot(window.__shot);
} else if (window.__shot.mode === 'editor') {
  waitForEditor();
}
