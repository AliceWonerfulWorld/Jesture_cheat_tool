export const refs = {};

export const state = {
  currentScreen: 'HOME',
  activeCategory: null,
  categories: [],
  selectedItemId: null,
  syncRole: 'solo',
  roomId: null,
  peer: null,
  connections: new Set(),
  hands: [
    {
      cursor: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      targetCursor: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      isDetected: false,
      hoveredElement: null,
      isGestureActive: false,
      isGestureTriggered: false,
      fistStartTime: null,
      holdProgress: 0
    }
  ],
  lastGlobalGestureTime: 0,
  lastGestureStatusTime: 0,
  audioContext: null,
  cameraStarted: false,
  mediaPipeStarted: false,
  settings: {
    holdMs: 700,
    smoothing: 0.28,
    showCameraPreview: true
  },
  notifyStateChange: () => {}
};

export function setRefs(nextRefs) {
  Object.assign(refs, nextRefs);
}

export function getCategoryById(id) {
  return state.categories.find((category) => category.id === id) ?? null;
}

export function serializeState() {
  return {
    type: 'STATE_UPDATE',
    currentScreen: state.currentScreen,
    activeCategoryId: state.activeCategory?.id ?? null,
    selectedItemId: state.selectedItemId
  };
}
