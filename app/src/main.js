// Neon Sunset Cover Studio — editor.
// Wires the preview canvas, the photo strip, the panel controls and the
// export button to the cover renderer. Photos never leave the machine:
// uploads are read with FileReader and drawn straight onto the canvas.

import {
  renderCover, ensureCoverFonts, LAYOUTS, GRADES, EXPORT_SIZES,
  defaultState, hitPanel, spreadPhotos,
} from './cover.js';

const $ = (id) => document.getElementById(id);
const state = defaultState();
const photos = []; // { name, img } — sample photos first, uploads after them.
let selectedPanel = 0;
let activePhoto = 0;
let previewScale = 1;

const SAMPLE_PHOTOS = [
  { name: 'Boulevard', src: 'samples/boulevard.jpg' },
  { name: 'Pier', src: 'samples/pier.jpg' },
];

function currentSize() {
  return EXPORT_SIZES.find((s) => s.id === state.sizeId) || EXPORT_SIZES[0];
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + src));
    img.src = src;
  });
}

async function loadSamplePhotos() {
  for (const sample of SAMPLE_PHOTOS) {
    try {
      const img = await loadImage(sample.src);
      photos.push({ name: sample.name, img });
    } catch (e) {
      // A missing sample just leaves that panel gradient-filled.
    }
  }
  renderPhotoStrip();
  renderPreview();
}

function renderPhotoStrip() {
  const strip = $('photoStrip');
  strip.innerHTML = '';
  photos.forEach((photo, i) => {
    const button = document.createElement('button');
    button.className = 'thumb' + (i === activePhoto ? ' active' : '');
    button.type = 'button';
    button.title = photo.name + ' — click to use in the selected panel';
    const img = document.createElement('img');
    img.src = photo.img.src;
    img.alt = photo.name;
    button.appendChild(img);
    const label = document.createElement('span');
    label.textContent = photo.name;
    button.appendChild(label);
    button.addEventListener('click', () => {
      activePhoto = i;
      assignPhotoToPanel(selectedPanel, i);
      renderPhotoStrip();
    });
    strip.appendChild(button);
  });
  refreshPanelControls();
}

function assignPhotoToPanel(panelIndex, photoIndex) {
  const panel = state.panels[panelIndex];
  if (!panel || !photos[photoIndex]) return;
  panel.photo = photoIndex;
  renderPreview();
  setStatus(`Panel ${panelIndex + 1} now shows “${photos[photoIndex].name}”.`);
}

function renderPreview() {
  const canvas = $('previewCanvas');
  const size = currentSize();
  const maxSide = 1080;
  const scale = Math.min(1, maxSide / Math.max(size.w, size.h));
  const pw = Math.round(size.w * scale);
  const ph = Math.round(size.h * scale);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  previewScale = pw / size.w;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(pw / size.w, ph / size.h);
  renderCover(ctx, state, photos.map((p) => p.img), size.w, size.h);
  ctx.restore();
  refreshPanelControls();
}

function setStatus(text) {
  const el = $('statusLine');
  if (el) el.textContent = text;
}

function refreshPanelControls() {
  const layout = LAYOUTS[state.layoutId];
  const panel = state.panels[selectedPanel];
  const box = $('panelControls');
  if (!panel || selectedPanel >= layout.slots.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  $('panelLabel').textContent = `Panel ${selectedPanel + 1} of ${layout.slots.length}`;
  const select = $('panelPhotoSelect');
  select.innerHTML = '';
  photos.forEach((photo, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = photo.name;
    if (i === panel.photo) option.selected = true;
    select.appendChild(option);
  });
  $('panelZoom').value = String(panel.zoom);
  $('panelZoomVal').textContent = `${Math.round(panel.zoom * 100)}%`;
  $('panelX').value = String(panel.ox);
  $('panelY').value = String(panel.oy);
  $('flipBtn').textContent = panel.flip ? 'Unflip photo' : 'Flip photo';
}

function exportCover() {
  const size = currentSize();
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  renderCover(ctx, state, photos.map((p) => p.img), size.w, size.h);
  canvas.toBlob((blob) => {
    if (!blob) { setStatus('Export failed — the browser refused the PNG.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neon-sunset-cover-${size.w}x${size.h}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus(`Exported ${size.w} x ${size.h} PNG — check your downloads.`);
  }, 'image/png');
}

function addUploadedFiles(files) {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  if (!images.length) { setStatus('That file is not an image — try a JPG or PNG.'); return; }
  let loaded = 0;
  images.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        photos.push({ name: file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'Photo', img });
        loaded += 1;
        activePhoto = photos.length - 1;
        if (loaded === images.length) {
          renderPhotoStrip();
          renderPreview();
          setStatus(`${images.length} photo${images.length > 1 ? 's' : ''} added — click a thumbnail, then a panel, to place it.`);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function shuffleCover() {
  const layoutIds = Object.keys(LAYOUTS);
  const gradeIds = Object.keys(GRADES);
  state.layoutId = layoutIds[Math.floor(Math.random() * layoutIds.length)];
  state.gradeId = gradeIds[Math.floor(Math.random() * gradeIds.length)];
  state.panels.forEach((panel) => {
    panel.photo = Math.floor(Math.random() * photos.length);
    panel.zoom = 1 + Math.random() * 0.3;
    panel.ox = (Math.random() - 0.5) * 0.2;
    panel.oy = (Math.random() - 0.5) * 0.2;
  });
  selectedPanel = 0;
  syncControlStates();
  renderPreview();
  setStatus('Shuffled the layout, grade and photos — tweak anything you like.');
}

function syncControlStates() {
  document.querySelectorAll('.layout-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layoutId);
  });
  document.querySelectorAll('.grade-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.gradeId);
  });
  document.querySelectorAll('.size-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.sizeId);
  });
  document.querySelectorAll('.color-swatch').forEach((b) => {
    b.classList.toggle('active', b.dataset.color === state.titleColor);
  });
  $('gradeAmount').value = String(state.gradeAmount);
  $('gradeAmountVal').textContent = `${Math.round(state.gradeAmount * 100)}%`;
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('titleScale').value = String(state.titleScale);
  $('titleScaleVal').textContent = `${Math.round(state.titleScale * 100)}%`;
  $('sunToggle').checked = state.showSun;
  $('skylineToggle').checked = state.showSkyline;
  $('grainToggle').checked = state.grain;
}

function wireControls() {
  document.querySelectorAll('.layout-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.layoutId = button.dataset.layout;
      selectedPanel = 0;
      syncControlStates();
      renderPreview();
      setStatus(`Layout: ${LAYOUTS[state.layoutId].label}.`);
    });
  });
  document.querySelectorAll('.grade-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.gradeId = button.dataset.grade;
      syncControlStates();
      renderPreview();
      setStatus(`Colour grade: ${GRADES[state.gradeId].label}.`);
    });
  });
  document.querySelectorAll('.size-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.sizeId = button.dataset.size;
      syncControlStates();
      renderPreview();
      setStatus(`Export size: ${currentSize().label}.`);
    });
  });
  document.querySelectorAll('.color-swatch').forEach((button) => {
    button.addEventListener('click', () => {
      state.titleColor = button.dataset.color;
      syncControlStates();
      renderPreview();
    });
  });
  $('gradeAmount').addEventListener('input', (e) => {
    state.gradeAmount = Number(e.target.value);
    $('gradeAmountVal').textContent = `${Math.round(state.gradeAmount * 100)}%`;
    renderPreview();
  });
  $('titleInput').addEventListener('input', (e) => {
    state.title = e.target.value;
    renderPreview();
  });
  $('subtitleInput').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    renderPreview();
  });
  $('titleScale').addEventListener('input', (e) => {
    state.titleScale = Number(e.target.value);
    $('titleScaleVal').textContent = `${Math.round(state.titleScale * 100)}%`;
    renderPreview();
  });
  $('sunToggle').addEventListener('change', (e) => {
    state.showSun = e.target.checked;
    renderPreview();
  });
  $('skylineToggle').addEventListener('change', (e) => {
    state.showSkyline = e.target.checked;
    renderPreview();
  });
  $('grainToggle').addEventListener('change', (e) => {
    state.grain = e.target.checked;
    renderPreview();
  });
  $('panelPhotoSelect').addEventListener('change', (e) => {
    assignPhotoToPanel(selectedPanel, Number(e.target.value));
    renderPhotoStrip();
  });
  $('panelZoom').addEventListener('input', (e) => {
    state.panels[selectedPanel].zoom = Number(e.target.value);
    $('panelZoomVal').textContent = `${Math.round(state.panels[selectedPanel].zoom * 100)}%`;
    renderPreview();
  });
  $('panelX').addEventListener('input', (e) => {
    state.panels[selectedPanel].ox = Number(e.target.value);
    renderPreview();
  });
  $('panelY').addEventListener('input', (e) => {
    state.panels[selectedPanel].oy = Number(e.target.value);
    renderPreview();
  });
  $('flipBtn').addEventListener('click', () => {
    const panel = state.panels[selectedPanel];
    panel.flip = !panel.flip;
    renderPreview();
    refreshPanelControls();
  });
  $('exportBtn').addEventListener('click', exportCover);
  $('shuffleBtn').addEventListener('click', shuffleCover);
  $('fillAllBtn').addEventListener('click', () => {
    state.panels.forEach((panel) => { panel.photo = activePhoto; });
    renderPreview();
    setStatus(`All panels now show “${photos[activePhoto].name}”.`);
  });
  $('addPhotosBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => {
    addUploadedFiles(e.target.files);
    e.target.value = '';
  });
  const canvas = $('previewCanvas');
  let dragging = false;
  let dragMoved = false;
  let lastX = 0, lastY = 0;
  let dragPanel = -1;

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / previewScale,
      y: (e.clientY - rect.top) / previewScale,
    };
  }
  canvas.addEventListener('pointerdown', (e) => {
    const p = canvasPoint(e);
    dragPanel = hitPanel(state, p.x, p.y, currentSize().w, currentSize().h);
    if (dragPanel < 0) return;
    dragging = true;
    dragMoved = false;
    lastX = p.x; lastY = p.y;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || dragPanel < 0) return;
    const p = canvasPoint(e);
    const dx = p.x - lastX, dy = p.y - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
    const panel = state.panels[dragPanel];
    const size = currentSize();
    panel.ox += dx / size.w;
    panel.oy += dy / size.h;
    panel.ox = Math.max(-0.6, Math.min(0.6, panel.ox));
    panel.oy = Math.max(-0.6, Math.min(0.6, panel.oy));
    lastX = p.x; lastY = p.y;
    renderPreview();
  });
  canvas.addEventListener('pointerup', (e) => {
    if (dragging && dragPanel >= 0 && !dragMoved) {
      selectedPanel = dragPanel;
      if (photos[activePhoto]) assignPhotoToPanel(dragPanel, activePhoto);
      refreshPanelControls();
    }
    dragging = false;
    dragPanel = -1;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = canvasPoint(e);
    const panelIndex = hitPanel(state, p.x, p.y, currentSize().w, currentSize().h);
    if (panelIndex < 0) return;
    const panel = state.panels[panelIndex];
    panel.zoom = Math.max(0.6, Math.min(3, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
    selectedPanel = panelIndex;
    renderPreview();
  }, { passive: false });
  canvas.addEventListener('dragover', (e) => e.preventDefault());
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    addUploadedFiles(e.dataTransfer.files);
  });
}

function applyShotParams() {
  const shot = window.__shot;
  if (!shot) return;
  if (shot.caption) state.title = shot.caption;
  if (shot.subtitle) state.subtitle = shot.subtitle;
  if (shot.layout) state.layoutId = shot.layout;
  if (shot.grade) state.gradeId = shot.grade;
  if (shot.size) state.sizeId = shot.size;
  if (shot.photo === 'pier') {
    activePhoto = 1;
    state.panels[0].photo = 1;
  }
  spreadPhotos(state, 2);
}

export async function startEditor() {
  applyShotParams();
  wireControls();
  syncControlStates();
  await ensureCoverFonts();
  await loadSamplePhotos();
  renderPreview();
  window.__editorReady = true;
  document.documentElement.dataset.ready = '1';
  setStatus('Two sample photos are loaded — add your own, pick a layout, then export.');
}

startEditor();
