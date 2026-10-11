// WLED Matrix Studio - External app.js module (synced with index.html)
// Standalone engine logic for 12x12 anamorphic matrix
function createBlankGrid(w = 12, h = 12) {
  return Array.from({ length: h }, () => Array(w).fill('#000000'));
}

const state = {
  width: 12,
  height: 12,
  widthMm: 144,
  heightMm: 84,
  get pixelRatio() {
    return (this.widthMm / this.width) / (this.heightMm / this.height);
  },
  viewMode: 'physical',
  activeTool: 'pencil',
  currentColor: '#FF0055',
  recentColors: ['#FF0055', '#FF7700', '#FFEA00', '#00FF66', '#00E5FF', '#7B2CBF', '#FFFFFF', '#000000'],
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
    stripOrientation: 'vertical',
    serpentine: true,
    startCorner: 'top-left'
  }
};
