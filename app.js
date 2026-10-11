/**
 * WLED Matrix Studio — Anamorphic 12x12
 * Specifically engineered for 12x12 LED matrices with 144mm x 84mm physical dimensions.
 */

// Application State
const state = {
  width: 12,
  height: 12,
  widthMm: 144,
  heightMm: 84,
  get pixelRatio() {
    // Physical aspect ratio of an individual LED cell (Width / Height)
    return (this.widthMm / this.width) / (this.heightMm / this.height); // (144/12) / (84/12) = 12 / 7 = 1.7142857
  },
  viewMode: 'physical', // 'physical' or 'square'
  activeTool: 'pencil',
  currentColor: '#FF0055',
  recentColors: ['#FF0055', '#FF7700', '#FFEA00', '#00FF66', '#00E5FF', '#7B2CBF', '#FFFFFF', '#000000'],
  
  // Multi-frame animation support
  frames: [],
  currentFrameIdx: 0,
  isPlaying: false,
  fps: 4,
  playTimer: null,

  // History stack for Undo/Redo
  history: [],
  historyStep: -1,
  maxHistory: 30,

  // Drag interaction state
  isPointerDown: false,
  lastCoord: null,
  startCoord: null,
  dragSnapshot: null,

  // WLED connection settings
  wledIp: localStorage.getItem('wled_ip') || '',
  wledAutoSync: false,
  wledSyncTimeout: null,
  wiring: {
    stripOrientation: 'vertical', // 'vertical' (12 strips along height) or 'horizontal'
    serpentine: true,
    startCorner: 'top-left' // 'top-left', 'bottom-left', 'top-right', 'bottom-right'
  }
};

// Canvas references
let paintCanvas, paintCtx;
let simCanvas, simCtx;
let importOriginalImg = null;

// Built-in LED Color Swatches
const PALETTES = [
  '#FF0000', '#FF4500', '#FFA500', '#FFD700', '#FFFF00', '#ADFF2F',
  '#00FF00', '#00FA9A', '#00FFFF', '#1E90FF', '#0000FF', '#8A2BE2',
  '#FF00FF', '#FF1493', '#FFFFFF', '#E0E0E0', '#707070', '#000000'
];

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  initCanvases();
  initFrames();
  initColorPickers();
  initTools();
  initCanvasEvents();
  initWledSettings();
  initModals();
  initTransforms();
  renderCanvas();
  renderSimulation();
  renderFramesStrip();
});

/* ==========================================================================
   Canvas & Frame Buffer Management
   ========================================================================== */

function createEmptyGrid() {
  const grid = [];
  for (let y = 0; y < state.height; y++) {
    const row = [];
    for (let x = 0; x < state.width; x++) {
      row.push('#000000');
    }
    grid.push(row);
  }
  return grid;
}

function cloneGrid(grid) {
  return grid.map(row => [...row]);
}

function initFrames() {
  state.frames = [createEmptyGrid()];
  state.currentFrameIdx = 0;
  pushHistory();
}

function getCurrentGrid() {
  return state.frames[state.currentFrameIdx];
}

function initCanvases() {
  paintCanvas = document.getElementById('paint-canvas');
  paintCtx = paintCanvas.getContext('2d');

  simCanvas = document.getElementById('sim-canvas');
  simCtx = simCanvas.getContext('2d');

  resizeCanvasView();
  window.addEventListener('resize', resizeCanvasView);
}

function resizeCanvasView() {
  const wrapper = document.getElementById('canvas-wrapper');
  const maxWidth = Math.min(window.innerWidth - 60, 480);
  const maxHeight = Math.min(window.innerHeight - 300, 440);

  let targetW, targetH;
  if (state.viewMode === 'physical') {
    // 144mm width x 84mm height aspect ratio = 144 / 84 ≈ 1.714
    const aspect = state.widthMm / state.heightMm;
    targetW = maxWidth;
    targetH = targetW / aspect;
    if (targetH > maxHeight) {
      targetH = maxHeight;
      targetW = targetH * aspect;
    }
  } else {
    // Square 1:1 aspect ratio
    const size = Math.min(maxWidth, maxHeight);
    targetW = size;
    targetH = size;
  }

  paintCanvas.width = Math.round(targetW);
  paintCanvas.height = Math.round(targetH);

  renderCanvas();
}

/* ==========================================================================
   Canvas Rendering
   ========================================================================== */

function renderCanvas() {
  if (!paintCtx) return;
  const grid = getCurrentGrid();
  const w = paintCanvas.width;
  const h = paintCanvas.height;

  const cellW = w / state.width;
  const cellH = h / state.height;

  paintCtx.fillStyle = '#05050a';
  paintCtx.fillRect(0, 0, w, h);

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const color = grid[y][x];
      const cx = x * cellW;
      const cy = y * cellH;

      // Draw LED Cell background
      const isBlack = color === '#000000' || color.toLowerCase() === '#000';
      
      // Cell bezel & rounded rectangle
      paintCtx.fillStyle = '#111827';
      paintCtx.fillRect(cx, cy, cellW, cellH);

      // Inner LED diode area
      const inset = Math.max(1.5, Math.min(cellW, cellH) * 0.08);
      paintCtx.fillStyle = isBlack ? '#1e293b' : color;
      
      // Draw rounded diode
      drawRoundedRect(paintCtx, cx + inset, cy + inset, cellW - inset * 2, cellH - inset * 2, 4);
      paintCtx.fill();

      // If active color, draw glowing core highlight
      if (!isBlack) {
        paintCtx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        paintCtx.beginPath();
        paintCtx.ellipse(
          cx + cellW / 2, 
          cy + cellH / 2, 
          Math.max(2, (cellW - inset * 2) * 0.25), 
          Math.max(2, (cellH - inset * 2) * 0.25), 
          0, 0, Math.PI * 2
        );
        paintCtx.fill();
      }

      // Subtle Grid line
      paintCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      paintCtx.lineWidth = 1;
      paintCtx.strokeRect(cx, cy, cellW, cellH);
    }
  }

  // Also update live physical simulation
  renderSimulation();
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Renders the realistic real-world simulation of the 144mm x 84mm LED matrix.
 * Accurately models the 12mm x 7mm pitch, round LED diodes, black PCB, and light diffusion.
 */
function renderSimulation(targetCanvas = simCanvas, targetCtx = simCtx) {
  if (!targetCtx) return;
  const grid = getCurrentGrid();
  const w = targetCanvas.width;
  const h = targetCanvas.height;

  // Clear dark PCB background
  targetCtx.fillStyle = '#05070d';
  targetCtx.fillRect(0, 0, w, h);

  const cellW = w / state.width;
  const cellH = h / state.height;

  // LED diode radius (physical WS2812B 5050 LED is ~5x5mm package)
  const ledRadius = Math.min(cellW, cellH) * 0.32;

  // Pass 1: LED Light Glow Diffusion (Additive blending)
  targetCtx.save();
  targetCtx.globalCompositeOperation = 'screen';

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const color = grid[y][x];
      if (color === '#000000' || color.toLowerCase() === '#000') continue;

      const cx = x * cellW + cellW / 2;
      const cy = y * cellH + cellH / 2;
      const glowRadius = ledRadius * 2.8;

      const grad = targetCtx.createRadialGradient(cx, cy, ledRadius * 0.5, cx, cy, glowRadius);
      grad.addColorStop(0, color);
      grad.addColorStop(0.5, hexToRgba(color, 0.45));
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      targetCtx.fillStyle = grad;
      targetCtx.beginPath();
      targetCtx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      targetCtx.fill();
    }
  }
  targetCtx.restore();

  // Pass 2: Physical LED Packages and Bright Cores
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const color = grid[y][x];
      const isBlack = color === '#000000' || color.toLowerCase() === '#000';
      const cx = x * cellW + cellW / 2;
      const cy = y * cellH + cellH / 2;

      // LED package base (dark grey 5050 SMD square)
      const smdSize = ledRadius * 1.6;
      targetCtx.fillStyle = '#151a24';
      targetCtx.fillRect(cx - smdSize / 2, cy - smdSize / 2, smdSize, smdSize);

      // LED circular lens / phosphor
      targetCtx.fillStyle = isBlack ? '#242b38' : color;
      targetCtx.beginPath();
      targetCtx.arc(cx, cy, ledRadius, 0, Math.PI * 2);
      targetCtx.fill();

      // White-hot center highlight for glowing LEDs
      if (!isBlack) {
        targetCtx.fillStyle = '#ffffff';
        targetCtx.beginPath();
        targetCtx.arc(cx, cy, ledRadius * 0.45, 0, Math.PI * 2);
        targetCtx.fill();
      }
    }
  }
}

/* ==========================================================================
   Interaction & Drawing Engine
   ========================================================================== */

function getCellCoord(e) {
  const rect = paintCanvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  const xPx = clientX - rect.left;
  const yPx = clientY - rect.top;

  const cellX = Math.floor((xPx / rect.width) * state.width);
  const cellY = Math.floor((yPx / rect.height) * state.height);

  return {
    x: Math.max(0, Math.min(state.width - 1, cellX)),
    y: Math.max(0, Math.min(state.height - 1, cellY))
  };
}

function initCanvasEvents() {
  const startDraw = (e) => {
    e.preventDefault();
    state.isPointerDown = true;
    const coord = getCellCoord(e);
    state.startCoord = coord;
    state.lastCoord = coord;
    state.dragSnapshot = cloneGrid(getCurrentGrid());

    applyTool(coord.x, coord.y, false);
  };

  const moveDraw = (e) => {
    if (!state.isPointerDown) return;
    e.preventDefault();
    const coord = getCellCoord(e);

    if (state.activeTool === 'pencil' || state.activeTool === 'eraser') {
      if (!state.lastCoord || coord.x !== state.lastCoord.x || coord.y !== state.lastCoord.y) {
        applyTool(coord.x, coord.y, false);
        state.lastCoord = coord;
      }
    } else if (['line', 'rect', 'circle'].includes(state.activeTool)) {
      // Restore snapshot to render live preview while dragging
      state.frames[state.currentFrameIdx] = cloneGrid(state.dragSnapshot);
      applyDragShape(state.startCoord, coord);
      renderCanvas();
    }
  };

  const endDraw = (e) => {
    if (!state.isPointerDown) return;
    state.isPointerDown = false;
    pushHistory();
    triggerWledSyncDebounced();
    updateThumbnails();
  };

  paintCanvas.addEventListener('mousedown', startDraw);
  window.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);

  paintCanvas.addEventListener('touchstart', startDraw, { passive: false });
  window.addEventListener('touchmove', moveDraw, { passive: false });
  window.addEventListener('touchend', endDraw);
}

function applyTool(x, y, isFinished = true) {
  const grid = getCurrentGrid();

  switch (state.activeTool) {
    case 'pencil':
      grid[y][x] = state.currentColor;
      recordRecentColor(state.currentColor);
      renderCanvas();
      break;

    case 'eraser':
      grid[y][x] = '#000000';
      renderCanvas();
      break;

    case 'picker':
      const pickedColor = grid[y][x];
      if (pickedColor) {
        setColor(pickedColor);
        setActiveTool('pencil');
      }
      break;

    case 'fill':
      floodFill(x, y, state.currentColor);
      renderCanvas();
      break;
  }
}

function applyDragShape(start, end) {
  const grid = getCurrentGrid();

  if (state.activeTool === 'line') {
    drawLine(grid, start.x, start.y, end.x, end.y, state.currentColor);
  } else if (state.activeTool === 'rect') {
    const x0 = Math.min(start.x, end.x);
    const x1 = Math.max(start.x, end.x);
    const y0 = Math.min(start.y, end.y);
    const y1 = Math.max(start.y, end.y);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x === x0 || x === x1 || y === y0 || y === y1) {
          grid[y][x] = state.currentColor;
        }
      }
    }
  } else if (state.activeTool === 'circle') {
    drawAnamorphicCircle(grid, start.x, start.y, end.x, end.y, state.currentColor);
  }
}

/**
 * Bresenham's Line Algorithm
 */
function drawLine(grid, x0, y0, x1, y1, color) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (x0 >= 0 && x0 < state.width && y0 >= 0 && y0 < state.height) {
      grid[y0][x0] = color;
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/**
 * Anamorphically Corrected Circle:
 * Because each physical LED is 12mm wide x 7mm high (ratio 1.714),
 * a circle in real physical space requires radius_y = radius_x * (12 / 7) in pixel space!
 */
function drawAnamorphicCircle(grid, startX, startY, endX, endY, color) {
  const cx = (startX + endX) / 2;
  const cy = (startY + endY) / 2;
  const rx = Math.abs(endX - startX) / 2;
  
  // In physical space: rx_mm = rx * 12mm.
  // For physical circle: ry_mm must equal rx_mm.
  // Since each Y step is 7mm: ry_pixels = rx_mm / 7mm = rx * (12/7) ≈ rx * 1.714
  const ry = rx * state.pixelRatio;

  if (rx < 0.3) {
    if (Math.round(cx) >= 0 && Math.round(cx) < state.width && Math.round(cy) >= 0 && Math.round(cy) < state.height) {
      grid[Math.round(cy)][Math.round(cx)] = color;
    }
    return;
  }

  // Draw ellipse outline
  for (let angle = 0; angle < Math.PI * 2; angle += 0.05) {
    const px = Math.round(cx + Math.cos(angle) * rx);
    const py = Math.round(cy + Math.sin(angle) * ry);
    if (px >= 0 && px < state.width && py >= 0 && py < state.height) {
      grid[py][px] = color;
    }
  }
}

/**
 * Flood Fill (BFS)
 */
function floodFill(startX, startY, fillColor) {
  const grid = getCurrentGrid();
  const targetColor = grid[startY][startX];
  if (targetColor === fillColor) return;

  const queue = [[startX, startY]];
  const visited = new Set();

  while (queue.length > 0) {
    const [x, y] = queue.pop();
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (x < 0 || x >= state.width || y < 0 || y >= state.height) continue;
    if (grid[y][x] !== targetColor) continue;

    grid[y][x] = fillColor;

    queue.push([x + 1, y]);
    queue.push([x - 1, y]);
    queue.push([x, y + 1]);
    queue.push([x, y - 1]);
  }
}

/* ==========================================================================
   Transformations & History
   ========================================================================== */

function pushHistory() {
  state.historyStep++;
  state.history = state.history.slice(0, state.historyStep);
  state.history.push(cloneGrid(getCurrentGrid()));
  if (state.history.length > state.maxHistory) {
    state.history.shift();
    state.historyStep--;
  }
}

function undo() {
  if (state.historyStep > 0) {
    state.historyStep--;
    state.frames[state.currentFrameIdx] = cloneGrid(state.history[state.historyStep]);
    renderCanvas();
    triggerWledSyncDebounced();
  }
}

function redo() {
  if (state.historyStep < state.history.length - 1) {
    state.historyStep++;
    state.frames[state.currentFrameIdx] = cloneGrid(state.history[state.historyStep]);
    renderCanvas();
    triggerWledSyncDebounced();
  }
}

function initTransforms() {
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      redo();
    }
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    state.frames[state.currentFrameIdx] = createEmptyGrid();
    renderCanvas();
    pushHistory();
    triggerWledSyncDebounced();
    updateThumbnails();
  });

  // Shift & Flip
  const shift = (dx, dy) => {
    const oldGrid = getCurrentGrid();
    const newGrid = createEmptyGrid();
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const nx = (x + dx + state.width) % state.width;
        const ny = (y + dy + state.height) % state.height;
        newGrid[ny][nx] = oldGrid[y][x];
      }
    }
    state.frames[state.currentFrameIdx] = newGrid;
    renderCanvas();
    pushHistory();
    triggerWledSyncDebounced();
  };

  document.getElementById('shift-up').addEventListener('click', () => shift(0, -1));
  document.getElementById('shift-down').addEventListener('click', () => shift(0, 1));
  document.getElementById('shift-left').addEventListener('click', () => shift(-1, 0));
  document.getElementById('shift-right').addEventListener('click', () => shift(1, 0));

  document.getElementById('btn-flip-h').addEventListener('click', () => {
    const grid = getCurrentGrid();
    for (let y = 0; y < state.height; y++) {
      grid[y].reverse();
    }
    renderCanvas();
    pushHistory();
    triggerWledSyncDebounced();
  });

  document.getElementById('btn-flip-v').addEventListener('click', () => {
    const grid = getCurrentGrid();
    grid.reverse();
    renderCanvas();
    pushHistory();
    triggerWledSyncDebounced();
  });

  // View Mode Toggles
  document.getElementById('mode-physical').addEventListener('click', () => {
    state.viewMode = 'physical';
    document.getElementById('mode-physical').className = 'px-2.5 py-1 rounded-md bg-indigo-600 text-white shadow transition-all';
    document.getElementById('mode-square').className = 'px-2.5 py-1 rounded-md text-slate-400 hover:text-slate-200 transition-all';
    resizeCanvasView();
  });

  document.getElementById('mode-square').addEventListener('click', () => {
    state.viewMode = 'square';
    document.getElementById('mode-square').className = 'px-2.5 py-1 rounded-md bg-indigo-600 text-white shadow transition-all';
    document.getElementById('mode-physical').className = 'px-2.5 py-1 rounded-md text-slate-400 hover:text-slate-200 transition-all';
    resizeCanvasView();
  });
}

/* ==========================================================================
   Tools & Palette
   ========================================================================== */

function initTools() {
  const toolBtns = document.querySelectorAll('.tool-btn');
  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveTool(btn.dataset.tool);
    });
  });
}

function setActiveTool(tool) {
  state.activeTool = tool;
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
}

function initColorPickers() {
  const nativeColor = document.getElementById('native-color');
  const hexInput = document.getElementById('hex-input');
  const presetContainer = document.getElementById('preset-colors');

  nativeColor.addEventListener('input', (e) => setColor(e.target.value));
  hexInput.addEventListener('change', (e) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) setColor(val);
  });

  // Populate quick swatches
  presetContainer.innerHTML = '';
  PALETTES.forEach(col => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = col;
    swatch.addEventListener('click', () => setColor(col));
    presetContainer.appendChild(swatch);
  });

  renderRecentColors();
}

function setColor(hex) {
  state.currentColor = hex.toUpperCase();
  document.getElementById('native-color').value = state.currentColor;
  document.getElementById('hex-input').value = state.currentColor;
  document.getElementById('hex-label').textContent = state.currentColor;
  document.getElementById('current-color-preview').style.backgroundColor = state.currentColor;
}

function recordRecentColor(color) {
  if (color === '#000000') return;
  state.recentColors = [color, ...state.recentColors.filter(c => c !== color)].slice(0, 10);
  renderRecentColors();
}

function renderRecentColors() {
  const container = document.getElementById('recent-colors');
  container.innerHTML = '';
  state.recentColors.forEach(col => {
    const swatch = document.createElement('div');
    swatch.className = 'w-5 h-5 rounded-md cursor-pointer border border-white/20 hover:scale-110 transition-transform';
    swatch.style.backgroundColor = col;
    swatch.addEventListener('click', () => setColor(col));
    container.appendChild(swatch);
  });
}

/* ==========================================================================
   Animation Frames
   ========================================================================== */

function renderFramesStrip() {
  const container = document.getElementById('frames-strip');
  container.innerHTML = '';

  state.frames.forEach((frame, idx) => {
    const thumb = document.createElement('div');
    thumb.className = `frame-thumb ${idx === state.currentFrameIdx ? 'active' : ''}`;
    
    // Mini canvas for thumbnail
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 12;
    thumbCanvas.height = 12;
    thumbCanvas.className = 'w-8 h-8 image-pixelated rounded';
    const ctx = thumbCanvas.getContext('2d');

    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) {
        ctx.fillStyle = frame[y][x];
        ctx.fillRect(x, y, 1, 1);
      }
    }

    thumb.appendChild(thumbCanvas);
    thumb.addEventListener('click', () => {
      state.currentFrameIdx = idx;
      renderCanvas();
      renderFramesStrip();
    });

    container.appendChild(thumb);
  });
}

function updateThumbnails() {
  renderFramesStrip();
}

document.getElementById('btn-add-frame').addEventListener('click', () => {
  // Duplicate current frame
  state.frames.push(cloneGrid(getCurrentGrid()));
  state.currentFrameIdx = state.frames.length - 1;
  renderCanvas();
  renderFramesStrip();
  pushHistory();
});

document.getElementById('anim-fps').addEventListener('input', (e) => {
  state.fps = parseInt(e.target.value);
  document.getElementById('fps-label').textContent = `${state.fps} fps`;
  if (state.isPlaying) {
    stopAnimation();
    startAnimation();
  }
});

document.getElementById('btn-play-anim').addEventListener('click', () => {
  if (state.isPlaying) stopAnimation(); else startAnimation();
});

function startAnimation() {
  if (state.frames.length <= 1) return;
  state.isPlaying = true;
  document.getElementById('play-icon').textContent = '⏹';
  document.getElementById('play-text').textContent = 'Stop';

  state.playTimer = setInterval(() => {
    state.currentFrameIdx = (state.currentFrameIdx + 1) % state.frames.length;
    renderCanvas();
    renderFramesStrip();
    triggerWledSyncDebounced();
  }, 1000 / state.fps);
}

function stopAnimation() {
  state.isPlaying = false;
  clearInterval(state.playTimer);
  document.getElementById('play-icon').textContent = '▶';
  document.getElementById('play-text').textContent = 'Play';
}

/* ==========================================================================
   Anamorphic Image Importer Engine
   ========================================================================== */

let importMode = 'anamorphic'; // 'anamorphic' or 'stretch'

function initModals() {
  const modalImport = document.getElementById('modal-import');
  const modalExport = document.getElementById('modal-export');
  const modalSettings = document.getElementById('modal-settings');

  document.getElementById('btn-open-import').addEventListener('click', () => modalImport.classList.remove('hidden'));
  document.getElementById('btn-open-export').addEventListener('click', () => {
    modalExport.classList.remove('hidden');
    updateExportCodeBox();
  });
  document.getElementById('btn-open-settings').addEventListener('click', () => modalSettings.classList.remove('hidden'));

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      modalImport.classList.add('hidden');
      modalExport.classList.add('hidden');
      modalSettings.classList.add('hidden');
    });
  });

  // Dropzone handling
  const dropzone = document.getElementById('import-dropzone');
  const fileInput = document.getElementById('import-file-input');

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) processImportFile(e.target.files[0]);
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-indigo-500');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('border-indigo-500'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-indigo-500');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImportFile(e.dataTransfer.files[0]);
    }
  });

  // Importer Mode Toggles
  const btnAnamorphic = document.getElementById('import-mode-anamorphic');
  const btnStretch = document.getElementById('import-mode-stretch');

  btnAnamorphic.addEventListener('click', () => {
    importMode = 'anamorphic';
    btnAnamorphic.className = 'p-2 rounded-lg bg-indigo-600 text-white font-medium border border-indigo-500 text-left';
    btnStretch.className = 'p-2 rounded-lg bg-slate-800 text-slate-300 font-medium border border-slate-700 text-left';
    updateImportPreview();
  });

  btnStretch.addEventListener('click', () => {
    importMode = 'stretch';
    btnStretch.className = 'p-2 rounded-lg bg-indigo-600 text-white font-medium border border-indigo-500 text-left';
    btnAnamorphic.className = 'p-2 rounded-lg bg-slate-800 text-slate-300 font-medium border border-slate-700 text-left';
    updateImportPreview();
  });

  document.getElementById('import-dither').addEventListener('change', updateImportPreview);
  document.getElementById('import-brightness').addEventListener('input', (e) => {
    document.getElementById('val-brightness').textContent = `${e.target.value}%`;
    updateImportPreview();
  });

  document.getElementById('btn-commit-import').addEventListener('click', () => {
    const previewCanvas = document.getElementById('import-matrix-preview');
    const pCtx = previewCanvas.getContext('2d');
    const imgData = pCtx.getImageData(0, 0, 12, 12).data;

    const grid = getCurrentGrid();
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) {
        const idx = (y * 12 + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const a = imgData[idx + 3];
        grid[y][x] = a < 30 ? '#000000' : rgbToHex(r, g, b);
      }
    }

    renderCanvas();
    pushHistory();
    triggerWledSyncDebounced();
    updateThumbnails();
    modalImport.classList.add('hidden');
  });
}

function processImportFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      importOriginalImg = img;
      updateImportPreview();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Anamorphic Resampling & Dithering
 */
function updateImportPreview() {
  if (!importOriginalImg) return;

  const matrixCanvas = document.getElementById('import-matrix-preview');
  const mCtx = matrixCanvas.getContext('2d');
  const ditherMode = document.getElementById('import-dither').value;
  const brightness = parseInt(document.getElementById('import-brightness').value) / 100;

  // Offscreen sampling canvas
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 12;
  sampleCanvas.height = 12;
  const sCtx = sampleCanvas.getContext('2d');

  sCtx.fillStyle = '#000000';
  sCtx.fillRect(0, 0, 12, 12);

  if (importMode === 'anamorphic') {
    /**
     * Anamorphic Correction:
     * Display physically stretches width by 1.714 (12mm wide vs 7mm high).
     * To prevent shapes from being stretched on the LEDs, we compress the input horizontally
     * by (7 / 12) before mapping to the 12x12 grid, so when the matrix displays it, it expands back to 1:1!
     */
    const srcW = importOriginalImg.width;
    const srcH = importOriginalImg.height;
    
    // Fit image preserving true physical aspect ratio
    const physicalAspect = state.widthMm / state.heightMm; // 1.714
    const imgAspect = srcW / srcH;

    let drawW, drawH;
    if (imgAspect > physicalAspect) {
      drawW = 12;
      drawH = 12 * (physicalAspect / imgAspect);
    } else {
      drawH = 12;
      drawW = 12 * (imgAspect / physicalAspect);
    }

    const ox = (12 - drawW) / 2;
    const oy = (12 - drawH) / 2;
    sCtx.drawImage(importOriginalImg, ox, oy, drawW, drawH);
  } else {
    // Direct 1:1 Stretch to 12x12
    sCtx.drawImage(importOriginalImg, 0, 0, 12, 12);
  }

  // Apply brightness & dithering
  const imgData = sCtx.getImageData(0, 0, 12, 12);
  const data = imgData.data;

  // Brightness adjustment
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i] * brightness));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * brightness));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * brightness));
  }

  // Dither if selected
  if (ditherMode === 'floyd') {
    applyFloydSteinbergDithering(data, 12, 12);
  } else if (ditherMode === 'bayer') {
    applyBayerDithering(data, 12, 12);
  }

  mCtx.putImageData(imgData, 0, 0);

  // Render physical simulation preview in modal
  const physCanvas = document.getElementById('import-physical-preview');
  const physCtx = physCanvas.getContext('2d');
  
  // Create temporary grid from preview canvas
  const tempGrid = createEmptyGrid();
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const idx = (y * 12 + x) * 4;
      tempGrid[y][x] = rgbToHex(data[idx], data[idx + 1], data[idx + 2]);
    }
  }

  // Render on physical preview
  physCtx.fillStyle = '#05070d';
  physCtx.fillRect(0, 0, physCanvas.width, physCanvas.height);
  const cellW = physCanvas.width / 12;
  const cellH = physCanvas.height / 12;
  const radius = Math.min(cellW, cellH) * 0.35;

  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const col = tempGrid[y][x];
      const cx = x * cellW + cellW / 2;
      const cy = y * cellH + cellH / 2;
      physCtx.fillStyle = col;
      physCtx.beginPath();
      physCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      physCtx.fill();
    }
  }
}

function applyFloydSteinbergDithering(data, width, height) {
  // Quantize to 5-bit color (32 levels per channel, realistic for LED smooth perception)
  const quant = (val) => Math.round(val / 32) * 32;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const oldVal = data[idx + c];
        const newVal = quant(oldVal);
        data[idx + c] = Math.min(255, Math.max(0, newVal));
        const err = oldVal - newVal;

        if (x + 1 < width) data[(y * width + (x + 1)) * 4 + c] += (err * 7) >> 4;
        if (x - 1 >= 0 && y + 1 < height) data[((y + 1) * width + (x - 1)) * 4 + c] += (err * 3) >> 4;
        if (y + 1 < height) data[((y + 1) * width + x) * 4 + c] += (err * 5) >> 4;
        if (x + 1 < width && y + 1 < height) data[((y + 1) * width + (x + 1)) * 4 + c] += (err * 1) >> 4;
      }
    }
  }
}

function applyBayerDithering(data, width, height) {
  const bayer4x4 = [
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const threshold = (bayer4x4[y % 4][x % 4] / 16 - 0.5) * 45;
      for (let c = 0; c < 3; c++) {
        data[idx + c] = Math.min(255, Math.max(0, Math.round((data[idx + c] + threshold) / 32) * 32));
      }
    }
  }
}

/* ==========================================================================
   WLED Connectivity & LED Index Mapping
   ========================================================================== */

function initWledSettings() {
  const ipInput = document.getElementById('wled-ip-input');
  if (state.wledIp) ipInput.value = state.wledIp;

  ipInput.addEventListener('change', (e) => {
    state.wledIp = e.target.value.trim();
    localStorage.setItem('wled_ip', state.wledIp);
  });

  document.getElementById('btn-sync-wled').addEventListener('click', () => sendToWled());
  document.getElementById('btn-open-wled').addEventListener('click', () => {
    const ip = prompt('Enter your WLED IP Address (e.g. 192.168.1.120):', state.wledIp);
    if (ip !== null) {
      state.wledIp = ip.trim();
      localStorage.setItem('wled_ip', state.wledIp);
      ipInput.value = state.wledIp;
      sendToWled();
    }
  });

  const autoSyncCheck = document.getElementById('wled-auto-sync');
  autoSyncCheck.addEventListener('change', (e) => {
    state.wledAutoSync = e.target.checked;
  });

  // Settings Modal Inputs
  document.getElementById('setting-width-mm').addEventListener('change', (e) => {
    state.widthMm = parseFloat(e.target.value) || 144;
    resizeCanvasView();
  });
  document.getElementById('setting-height-mm').addEventListener('change', (e) => {
    state.heightMm = parseFloat(e.target.value) || 84;
    resizeCanvasView();
  });
  document.getElementById('setting-wiring-dir').addEventListener('change', (e) => {
    state.wiring.stripOrientation = e.target.value;
  });
  document.getElementById('setting-serpentine').addEventListener('change', (e) => {
    state.wiring.serpentine = e.target.value === 'true';
  });
  document.getElementById('setting-start-corner').addEventListener('change', (e) => {
    state.wiring.startCorner = e.target.value;
  });
}

function triggerWledSyncDebounced() {
  if (!state.wledAutoSync || !state.wledIp) return;
  clearTimeout(state.wledSyncTimeout);
  state.wledSyncTimeout = setTimeout(() => {
    sendToWled();
  }, 120);
}

/**
 * Maps 2D Matrix (x, y) to the linear LED index (0..143)
 * taking into account Serpentine, Vertical vs Horizontal strips, and starting corner.
 */
function getLinearLedIndex(x, y) {
  let col = x;
  let row = y;

  if (state.wiring.startCorner.includes('right')) col = state.width - 1 - col;
  if (state.wiring.startCorner.includes('bottom')) row = state.height - 1 - row;

  if (state.wiring.stripOrientation === 'vertical') {
    // 12 strips along height (Y axis). Each strip has 12 LEDs.
    const isReversed = state.wiring.serpentine && (col % 2 === 1);
    const stripRow = isReversed ? (state.height - 1 - row) : row;
    return col * state.height + stripRow;
  } else {
    // 12 strips along width (X axis).
    const isReversed = state.wiring.serpentine && (row % 2 === 1);
    const stripCol = isReversed ? (state.width - 1 - col) : col;
    return row * state.width + stripCol;
  }
}

/**
 * Sends current 12x12 frame to WLED via HTTP JSON API (/json/state)
 */
async function sendToWled() {
  if (!state.wledIp) {
    alert('Please enter your WLED device IP address first!');
    return;
  }

  const pill = document.getElementById('wled-pill-status');
  const dot = document.getElementById('wled-status-dot');
  pill.textContent = 'Sending...';
  pill.className = 'text-[10px] px-2 py-0.5 rounded font-mono bg-amber-500/20 text-amber-300';

  const grid = getCurrentGrid();
  const ledColors = new Array(state.width * state.height);

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const idx = getLinearLedIndex(x, y);
      ledColors[idx] = grid[y][x].replace('#', '');
    }
  }

  // Format WLED /json/state segment payload
  // Format: "i": [0, "RRGGBB", 1, "RRGGBB", ...]
  const iPayload = [];
  for (let i = 0; i < ledColors.length; i++) {
    iPayload.push(i, ledColors[i] || '000000');
  }

  const payload = {
    on: true,
    seg: [
      {
        id: 0,
        i: iPayload
      }
    ]
  };

  try {
    const url = `http://${state.wledIp}/json/state`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      pill.textContent = 'Synced';
      pill.className = 'text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-400';
      dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    console.error('WLED push error:', err);
    pill.textContent = 'Err/Check CORS';
    pill.className = 'text-[10px] px-2 py-0.5 rounded font-mono bg-rose-500/20 text-rose-400';
    dot.className = 'w-2 h-2 rounded-full bg-rose-400';
  }
}

/* ==========================================================================
   Exports (PNG, WLED JSON, FastLED C++)
   ========================================================================== */

function getWledJsonString() {
  const grid = getCurrentGrid();
  const ledColors = new Array(144);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const idx = getLinearLedIndex(x, y);
      ledColors[idx] = grid[y][x].replace('#', '');
    }
  }

  const iArray = [];
  for (let i = 0; i < 144; i++) {
    iArray.push(i, ledColors[i]);
  }

  return JSON.stringify({
    on: true,
    bri: 128,
    seg: [{ id: 0, i: iArray }]
  }, null, 2);
}

function getFastLedHeaderString() {
  const grid = getCurrentGrid();
  const ledColors = new Array(144);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const idx = getLinearLedIndex(x, y);
      ledColors[idx] = '0x' + grid[y][x].replace('#', '');
    }
  }

  let code = `// FastLED / NeoMatrix 12x12 Frame (Physical 144mm x 84mm)\n`;
  code += `// Total LEDs: 144 | Orientation: ${state.wiring.stripOrientation} | Serpentine: ${state.wiring.serpentine}\n`;
  code += `const uint32_t PROGMEM matrix_art_12x12[144] = {\n  `;

  for (let i = 0; i < 144; i++) {
    code += ledColors[i] + (i < 143 ? ', ' : '');
    if ((i + 1) % 12 === 0 && i < 143) code += '\n  ';
  }
  code += '\n};\n';
  return code;
}

function updateExportCodeBox() {
  const box = document.getElementById('export-code-box');
  box.value = getWledJsonString();
}

// Download 12x12 Pixel-Perfect PNG
document.getElementById('btn-quick-png').addEventListener('click', download12x12Png);
document.getElementById('export-png-12').addEventListener('click', download12x12Png);

function download12x12Png() {
  const c = document.createElement('canvas');
  c.width = 12;
  c.height = 12;
  const ctx = c.getContext('2d');
  const grid = getCurrentGrid();

  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      ctx.fillStyle = grid[y][x];
      ctx.fillRect(x, y, 1, 1);
    }
  }

  triggerDownload(c.toDataURL('image/png'), 'wled_12x12_pixel_art.png');
}

// Download High-Resolution Glowing Render (1440x840 px)
document.getElementById('btn-quick-glow-png').addEventListener('click', downloadPhysicalGlowPng);
document.getElementById('export-png-glow').addEventListener('click', downloadPhysicalGlowPng);

function downloadPhysicalGlowPng() {
  const c = document.createElement('canvas');
  c.width = 1440;
  c.height = 840;
  const ctx = c.getContext('2d');
  renderSimulation(c, ctx);
  triggerDownload(c.toDataURL('image/png'), 'wled_144x84mm_physical_render.png');
}

document.getElementById('export-wled-json').addEventListener('click', () => {
  const jsonStr = getWledJsonString();
  document.getElementById('export-code-box').value = jsonStr;
  triggerDownload('data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr), 'wled_12x12_preset.json');
});

document.getElementById('export-fastled-c').addEventListener('click', () => {
  const cStr = getFastLedHeaderString();
  document.getElementById('export-code-box').value = cStr;
  triggerDownload('data:text/plain;charset=utf-8,' + encodeURIComponent(cStr), 'matrix_art_12x12.h');
});

document.getElementById('btn-copy-code').addEventListener('click', () => {
  const box = document.getElementById('export-code-box');
  navigator.clipboard.writeText(box.value);
  alert('Copied to clipboard!');
});

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ==========================================================================
   Utilities
   ========================================================================== */

function hexToRgba(hex, alpha = 1) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.min(255, Math.max(0, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}
