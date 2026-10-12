// WLED Matrix Studio - External app.js module (synced with index.html)
function createBlankGrid(w = 12, h = 12) {
  return Array.from({ length: h }, () => Array(w).fill('#000000'));
}

const state = {
  width: parseInt(localStorage.getItem('panel_width')) || 12,
  height: parseInt(localStorage.getItem('panel_height')) || 12,
  widthMm: parseFloat(localStorage.getItem('panel_width_mm')) || 144,
  heightMm: parseFloat(localStorage.getItem('panel_height_mm')) || 84,
  get pixelRatio() {
    return (this.widthMm / this.width) / (this.heightMm / this.height);
  },
  viewMode: 'physical',
  activeTool: 'pencil',
  currentColor: '#0088CA',
  recentColors: ['#0088CA', '#A4B47C', '#1A1C1E', '#56B4E9', '#C2CF9E', '#2C2F33', '#FFFFFF', '#000000'],
  frames: [createBlankGrid(12, 12)],
  currentFrameIdx: 0,
  isPlaying: false,
  fps: 4,
  playTimer: null,
  history: [createBlankGrid(12, 12)],
  historyStep: 0,
  isPointerDown: false,
  lastCoord: null,
  startCoord: null,
  dragSnapshot: null,
  wledIp: localStorage.getItem('wled_ip') || '',
  wledAutoSync: false,
  wiring: {
    stripOrientation: localStorage.getItem('panel_wiring_dir') || 'vertical',
    serpentine: localStorage.getItem('panel_serpentine') !== 'false',
    startCorner: localStorage.getItem('panel_start_corner') || 'top-left'
  }
};
