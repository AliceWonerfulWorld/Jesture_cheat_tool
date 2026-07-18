import { state, refs, setRefs } from './src/state.js';
import { categories } from './src/data.js';
import { initAudio, playSound } from './src/audio.js';
import { initCursor, updateCursorFromLandmarks, startCursorLoop } from './src/cursor.js';
import { initGestures } from './src/gestures.js';
import { applyRemoteState, broadcastState, initSync, setSyncRole } from './src/sync.js';
import { initUi, renderHome, transitionTo } from './src/ui.js';

window.addEventListener('DOMContentLoaded', () => {
  setRefs({
    stage: document.querySelector('#stage'),
    camera: document.querySelector('#camera'),
    debugCanvas: document.querySelector('#debug-canvas'),
    cursor: document.querySelector('#gesture-cursor'),
    cameraStatus: document.querySelector('#camera-status'),
    syncStatus: document.querySelector('#sync-status'),
    roomPanel: document.querySelector('#room-panel'),
    roomId: document.querySelector('#room-id'),
    viewerUrl: document.querySelector('#viewer-url'),
    holdRange: document.querySelector('#hold-range'),
    holdOutput: document.querySelector('#hold-output'),
    smoothRange: document.querySelector('#smooth-range'),
    smoothOutput: document.querySelector('#smooth-output'),
    cameraPreviewToggle: document.querySelector('#camera-preview-toggle'),
    homeTemplate: document.querySelector('#home-template'),
    detailTemplate: document.querySelector('#detail-template')
  });

  state.categories = categories;
  initUi({ onStateChange: broadcastState, playSound });
  initCursor({ onActivate: transitionTo, playSound });
  initSync({ onRemoteState: applyRemoteState });
  renderHome();
  startCursorLoop();
  bindSettings();
});

document.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-action]');
  const roleButton = event.target.closest('[data-role]');
  const categoryCard = event.target.closest('.category-card');
  const wordCard = event.target.closest('.word-card');

  if (actionButton) {
    handleAction(actionButton.dataset.action);
  } else if (roleButton) {
    setSyncRole(roleButton.dataset.role);
  } else if (categoryCard) {
    transitionTo('DETAIL', { categoryId: categoryCard.dataset.id });
  } else if (wordCard) {
    transitionTo('TOGGLE_ITEM', { itemId: wordCard.dataset.id });
  }
});

async function handleAction(action) {
  if (action === 'sound') {
    await initAudio();
    document.querySelector('[data-action="sound"]')?.classList.add('active');
    playSound('select');
    return;
  }

  if (action === 'camera') {
    await initGestures({ onLandmarks: updateCursorFromLandmarks });
    return;
  }

  if (action === 'fullscreen') {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
    return;
  }

  if (action === 'copy-room') {
    const url = refs.viewerUrl.textContent;
    try {
      if (url) await navigator.clipboard?.writeText(url);
      refs.syncStatus.textContent = 'Viewer URL copied';
      playSound('select');
    } catch {
      refs.syncStatus.textContent = 'Copy unavailable';
      playSound('reset');
    }
    return;
  }

  transitionTo(action.toUpperCase());
}

function bindSettings() {
  refs.holdRange.addEventListener('input', () => {
    state.settings.holdMs = Number(refs.holdRange.value);
    refs.holdOutput.textContent = `${(state.settings.holdMs / 1000).toFixed(1)}s`;
  });

  refs.smoothRange.addEventListener('input', () => {
    state.settings.smoothing = Number(refs.smoothRange.value) / 100;
    refs.smoothOutput.textContent = `${refs.smoothRange.value}%`;
  });

  refs.cameraPreviewToggle.addEventListener('change', () => {
    state.settings.showCameraPreview = refs.cameraPreviewToggle.checked;
    document.body.classList.toggle('hide-camera-preview', !state.settings.showCameraPreview);
  });
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') transitionTo('BACK');
  if (event.key.toLowerCase() === 'r') transitionTo('RESET');
});

window.addEventListener('resize', () => {
  refs.debugCanvas.width = refs.debugCanvas.clientWidth;
  refs.debugCanvas.height = refs.debugCanvas.clientHeight;
});
