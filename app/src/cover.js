// Neon Sunset Cover Studio — cover renderer.
// Draws a multi-panel GTA-style poster cover on a canvas from the editor state:
// panel photos with per-panel crop/zoom, a sunset or neon colour grade, a
// procedural sun + skyline, bold caption lettering, film grain and a vignette.
// Everything is drawn in code: no borrowed artwork, no external files.
// Deterministic: the same state always renders the same pixels.

export const EXPORT_SIZES = [
  { id: 'square', label: 'Square 1080 x 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide 1920 x 1080', w: 1920, h: 1080 },
];

export const GRADES = {
  sunset: { label: 'Sunset', filter: 'saturate(1.28) contrast(1.08) brightness(1.03)' },
  neon: { label: 'Neon', filter: 'saturate(1.55) contrast(1.14) brightness(1.0)' },
  vice: { label: 'Vice', filter: 'saturate(1.35) contrast(1.1) sepia(0.18)' },
  noir: { label: 'Noir', filter: 'grayscale(1) contrast(1.22) brightness(1.06)' },
};

// Panel layouts: each slot is a polygon in normalised (0..1) cover coordinates.
// Neighbouring slots share edge points so the seams line up exactly.
export const LAYOUTS = {
  quad: {
    label: 'Neon Quad',
    slots: [
      { points: [[0, 0], [0.6, 0], [0.56, 1], [0, 1]] },
      { points: [[0.6, 0], [1, 0], [1, 0.52], [0.56, 0.52]] },
      { points: [[0.56, 0.52], [1, 0.52], [1, 1], [0.56, 1]] },
    ],
  },
  strip: {
    label: 'Sunset Strip',
    slots: [
      { points: [[0, 0], [1, 0], [1, 0.44], [0, 0.48]] },
      { points: [[0, 0.48], [1, 0.44], [1, 0.72], [0, 0.76]] },
      { points: [[0, 0.76], [1, 0.72], [1, 1], [0, 1]] },
    ],
  },
  comic: {
    label: 'Comic Five',
    slots: [
      { points: [[0, 0], [0.62, 0], [0.58, 0.62], [0, 0.62]] },
      { points: [[0.62, 0], [1, 0], [1, 0.32], [0.6, 0.32]] },
      { points: [[0.6, 0.32], [1, 0.32], [1, 0.62], [0.58, 0.62]] },
      { points: [[0, 0.62], [0.58, 0.62], [0.54, 1], [0, 1]] },
      { points: [[0.58, 0.62], [1, 0.62], [1, 1], [0.54, 1]] },
    ],
  },
  hero: {
    label: 'Full Bleed',
    slots: [{ points: [[0, 0], [1, 0], [1, 1], [0, 1]] }],
  },
};

export function defaultState() {
  return {
    sizeId: 'square',
    layoutId: 'quad',
    gradeId: 'sunset',
    gradeAmount: 0.9,
    title: 'SUNSET HEIST',
    subtitle: 'NEON BAY  •  EST. 2026',
    titleScale: 1,
    titleColor: '#ffffff',
    showSun: true,
    showSkyline: true,
    grain: true,
    // One panel setting per layout slot: which photo, zoom and pan.
    panels: [
      { photo: 0, zoom: 1, ox: 0, oy: 0, flip: false },
      { photo: 1, zoom: 1, ox: 0, oy: 0, flip: false },
      { photo: 0, zoom: 1, ox: 0, oy: 0, flip: false },
      { photo: 1, zoom: 1, ox: 0, oy: 0, flip: false },
      { photo: 0, zoom: 1, ox: 0, oy: 0, flip: false },
    ],
  };
}

// Small deterministic PRNG (mulberry32) so grain and decoration never change.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function polygonPath(ctx, points, w, h) {
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    const px = x * w, py = y * h;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

function polygonBounds(points, w, h) {
  const xs = points.map((p) => p[0] * w);
  const ys = points.map((p) => p[1] * h);
  return {
    x: Math.min(...xs), y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

function pointInPolygon(px, py, points, w, h) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0] * w, yi = points[i][1] * h;
    const xj = points[j][0] * w, yj = points[j][1] * h;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function hitPanel(state, x, y, w, h) {
  const slots = LAYOUTS[state.layoutId].slots;
  for (let i = slots.length - 1; i >= 0; i--) {
    if (pointInPolygon(x, y, slots[i].points, w, h)) return i;
  }
  return -1;
}

function drawPanelPhoto(ctx, img, panel, bounds, gradeFilter) {
  const { x, y, w, h } = bounds;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const cover = Math.max(w / iw, h / ih) * panel.zoom;
  const dw = iw * cover, dh = ih * cover;
  const cx = x + w / 2 + panel.ox * w;
  // Bias a vertical crop toward the top of the photo: faces sit high, so
  // a wide panel keeps the subject's head instead of their chest.
  const cy = y + dh / 2 - Math.max(0, dh - h) * 0.12 + panel.oy * h;
  ctx.save();
  if (panel.flip) { ctx.translate(cx, cy); ctx.scale(-1, 1); ctx.translate(-cx, -cy); }
  ctx.filter = gradeFilter;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

function gradeOverlay(ctx, bounds, gradeId, amount) {
  const { x, y, w, h } = bounds;
  let g;
  if (gradeId === 'sunset') {
    g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, `rgba(255, 170, 60, ${0.26 * amount})`);
    g.addColorStop(0.55, `rgba(255, 90, 120, ${0.18 * amount})`);
    g.addColorStop(1, `rgba(120, 40, 160, ${0.34 * amount})`);
  } else if (gradeId === 'neon') {
    g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, `rgba(255, 0, 140, ${0.30 * amount})`);
    g.addColorStop(0.5, `rgba(120, 40, 200, ${0.12 * amount})`);
    g.addColorStop(1, `rgba(0, 220, 255, ${0.30 * amount})`);
  } else if (gradeId === 'vice') {
    g = ctx.createLinearGradient(x, y + h, x, y);
    g.addColorStop(0, `rgba(0, 190, 180, ${0.28 * amount})`);
    g.addColorStop(1, `rgba(255, 140, 40, ${0.24 * amount})`);
  } else {
    g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, `rgba(255, 255, 255, ${0.06 * amount})`);
    g.addColorStop(1, `rgba(0, 0, 0, ${0.22 * amount})`);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// The sun sets in the panel that touches the cover's bottom edge and has
// the most room for it — so the skyline sits on the poster's horizon,
// never across its middle. Returns -1 when no panel qualifies.
export function sunPanelIndex(state) {
  const slots = LAYOUTS[state.layoutId].slots;
  let best = -1, bestArea = 0;
  slots.forEach((slot, i) => {
    const maxY = Math.max(...slot.points.map((p) => p[1]));
    if (maxY < 0.99) return;
    const area = polygonBounds(slot.points, 1, 1).w * polygonBounds(slot.points, 1, 1).h;
    if (area > bestArea) { bestArea = area; best = i; }
  });
  return best;
}

// Spread the photos across the panels so two neighbours never show the
// same photo when another one is available.
export function spreadPhotos(state, photoCount) {
  if (photoCount < 2) return;
  const slots = LAYOUTS[state.layoutId].slots;
  for (let i = 1; i < slots.length; i++) {
    if (state.panels[i] && state.panels[i - 1]
      && state.panels[i].photo === state.panels[i - 1].photo) {
      state.panels[i].photo = (state.panels[i].photo + 1) % photoCount;
    }
  }
}

// A big setting sun with a skyline and palm silhouettes, drawn in code.
// Drawn low in its panel so the skyline sits on the poster's horizon.
function drawSunAndSkyline(ctx, bounds, seed, showSun, showSkyline) {
  const { x, y, w, h } = bounds;
  const rand = seededRandom(seed);
  const base = y + h;
  if (showSun) {
    const sunR = Math.min(w, h) * 0.17;
    const sunX = x + w * 0.64;
    const sunY = y + h * 0.8;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.1, sunX, sunY, sunR * 1.8);
    glow.addColorStop(0, 'rgba(255, 190, 90, 0.5)');
    glow.addColorStop(0.45, 'rgba(255, 110, 80, 0.25)');
    glow.addColorStop(1, 'rgba(255, 80, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    const disc = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
    disc.addColorStop(0, '#fff0b8');
    disc.addColorStop(0.55, '#ffcf5e');
    disc.addColorStop(1, '#ff7a4d');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (!showSkyline) return;

  // Skyline silhouette along the bottom of the panel: flat-topped blocks
  // with a few lit windows.
  ctx.save();
  ctx.fillStyle = 'rgba(16, 6, 32, 0.88)';
  const top = y + h * 0.86;
  const blocks = [];
  ctx.beginPath();
  ctx.moveTo(x, base);
  let cx = x;
  while (cx < x + w) {
    const bw = w * (0.05 + rand() * 0.08);
    const bh = top + rand() * (base - top) * 0.3;
    blocks.push({ x: cx, y: bh, w: bw });
    ctx.lineTo(cx, bh);
    ctx.lineTo(cx + bw, bh);
    ctx.lineTo(cx + bw, base);
    cx += bw;
  }
  ctx.lineTo(x + w, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 214, 90, 0.75)';
  blocks.forEach((b) => {
    const rows = Math.floor((base - b.y) / (h * 0.045));
    for (let r = 0; r < rows; r++) {
      if (rand() < 0.3) {
        const wx = b.x + b.w * (0.2 + rand() * 0.6);
        ctx.fillRect(wx, b.y + h * 0.02 + r * h * 0.045, Math.max(2, w * 0.006), Math.max(2, h * 0.014));
      }
    }
  });
  drawPalm(ctx, x + w * 0.14, base, h * 0.18, -0.15);
  drawPalm(ctx, x + w * 0.88, base, h * 0.16, 0.2);
  ctx.restore();
}

function drawPalm(ctx, bx, by, size, lean) {
  ctx.save();
  ctx.strokeStyle = 'rgba(16, 6, 32, 0.92)';
  ctx.fillStyle = 'rgba(16, 6, 32, 0.92)';
  ctx.lineWidth = Math.max(2, size * 0.03);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.quadraticCurveTo(bx + lean * size, by - size * 0.55, bx + lean * size * 1.4, by - size);
  ctx.stroke();
  const tx = bx + lean * size * 1.4, ty = by - size;
  // Fronds arc out from the crown and droop down, like a real palm.
  for (let i = 0; i < 7; i++) {
    const spread = -Math.PI * (0.08 + i * 0.135);
    const len = size * (0.4 + (i % 3) * 0.07);
    const tipX = tx + Math.cos(spread) * len;
    const tipY = ty + Math.sin(spread) * len * 0.45 + size * 0.22;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(
      tx + Math.cos(spread) * len * 0.55, ty - size * 0.14,
      tipX, tipY,
    );
    ctx.stroke();
  }
  ctx.restore();
}

let grainTile = null;
function filmGrain(ctx, w, h) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 180; grainTile.height = 180;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(180, 180);
    const rand = seededRandom(20261119);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 118 + Math.floor(rand() * 40);
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.globalCompositeOperation = 'overlay';
  const pattern = ctx.createPattern(grainTile, 'repeat');
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawTitleBlock(ctx, state, w, h) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim().toUpperCase();
  if (!title && !subtitle) return;
  const base = Math.min(w, h);
  const titlePx = base * 0.115 * state.titleScale;
  ctx.save();
  // Dark band behind the lettering so it reads over any photo.
  const band = ctx.createLinearGradient(0, h * 0.72, 0, h);
  band.addColorStop(0, 'rgba(10, 4, 24, 0)');
  band.addColorStop(1, 'rgba(10, 4, 24, 0.72)');
  ctx.fillStyle = band;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  ctx.translate(w / 2, h * 0.885);
  ctx.rotate(-0.022);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (title) {
    ctx.font = `${titlePx}px Anton, 'Arial Narrow', sans-serif`;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    // Neon echo behind the letters.
    ctx.save();
    ctx.translate(titlePx * 0.02, titlePx * 0.03);
    ctx.strokeStyle = 'rgba(255, 45, 149, 0.85)';
    ctx.lineWidth = titlePx * 0.16;
    ctx.strokeText(title, 0, 0);
    ctx.restore();
    ctx.strokeStyle = '#0d0616';
    ctx.lineWidth = titlePx * 0.17;
    ctx.strokeText(title, 0, 0);
    ctx.fillStyle = state.titleColor;
    ctx.fillText(title, 0, 0);
  }
  if (subtitle) {
    const subPx = Math.max(14, base * 0.032);
    ctx.font = `${subPx}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
    const y = title ? titlePx * 0.72 : 0;
    const text = subtitle.split('').join(' ');
    const tw = ctx.measureText(text).width;
    const pad = subPx * 0.9;
    ctx.fillStyle = 'rgba(13, 6, 22, 0.85)';
    ctx.fillRect(-tw / 2 - pad, y - subPx * 0.62, tw + pad * 2, subPx * 1.35);
    ctx.strokeStyle = 'rgba(255, 214, 90, 0.9)';
    ctx.lineWidth = Math.max(1.5, subPx * 0.06);
    ctx.strokeRect(-tw / 2 - pad, y - subPx * 0.62, tw + pad * 2, subPx * 1.35);
    ctx.fillStyle = '#ffd65a';
    ctx.fillText(text, 0, y + subPx * 0.08);
  }
  ctx.restore();
}

// Render the whole cover onto ctx at the cover's pixel size. photos is an
// array of loaded HTMLImageElements; a missing photo leaves a gradient panel.
export function renderCover(ctx, state, photos, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, w, h);
  const slots = LAYOUTS[state.layoutId].slots;
  const grade = GRADES[state.gradeId] || GRADES.sunset;
  const gap = Math.max(3, Math.round(Math.min(w, h) * 0.006));
  const sunPanel = sunPanelIndex(state);

  slots.forEach((slot, i) => {
    const panel = state.panels[i] || { photo: 0, zoom: 1, ox: 0, oy: 0, flip: false };
    const bounds = polygonBounds(slot.points, w, h);
    ctx.save();
    polygonPath(ctx, slot.points, w, h);
    ctx.clip();
    const img = photos[panel.photo];
    if (img) {
      drawPanelPhoto(ctx, img, panel, bounds, grade.filter);
    } else {
      const g = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x + bounds.w, bounds.y + bounds.h);
      g.addColorStop(0, '#3b1155');
      g.addColorStop(1, '#12081f');
      ctx.fillStyle = g;
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }
    if (i === sunPanel && state.gradeId !== 'noir') {
      drawSunAndSkyline(ctx, bounds, 7 + i, state.showSun, state.showSkyline);
    }
    gradeOverlay(ctx, bounds, state.gradeId, state.gradeAmount);
    ctx.restore();
    // Seam: dark gap line, then a faint neon hairline.
    ctx.save();
    polygonPath(ctx, slot.points, w, h);
    ctx.strokeStyle = '#12081f';
    ctx.lineWidth = gap;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = Math.max(1, gap * 0.22);
    ctx.stroke();
    ctx.restore();
  });

  // Outer frame.
  ctx.save();
  ctx.strokeStyle = '#0d0616';
  ctx.lineWidth = Math.max(6, Math.round(Math.min(w, h) * 0.012));
  ctx.strokeRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255, 45, 149, 0.55)';
  ctx.lineWidth = Math.max(1.5, Math.round(Math.min(w, h) * 0.002));
  ctx.strokeRect(ctx.lineWidth * 3, ctx.lineWidth * 3, w - ctx.lineWidth * 6, h - ctx.lineWidth * 6);
  ctx.restore();

  drawTitleBlock(ctx, state, w, h);

  // Vignette, then grain.
  const vg = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78,
  );
  vg.addColorStop(0, 'rgba(8, 3, 18, 0)');
  vg.addColorStop(1, 'rgba(8, 3, 18, 0.34)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  if (state.grain) filmGrain(ctx, w, h);
}

export async function ensureCoverFonts() {
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('40px "Bebas Neue"'),
      document.fonts.ready,
    ]);
  } catch (e) {
    // Fall back to system fonts; the cover still renders.
  }
}
