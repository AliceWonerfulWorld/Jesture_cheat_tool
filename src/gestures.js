import { refs, state } from './state.js';

let camera = null;

export async function initGestures({ onLandmarks }) {
  if (state.mediaPipeStarted) return;
  if (!window.Hands || !window.Camera) {
    refs.cameraStatus.textContent = 'MediaPipe unavailable';
    return;
  }

  refs.cameraStatus.textContent = 'Requesting camera';
  refs.debugCanvas.width = refs.debugCanvas.clientWidth;
  refs.debugCanvas.height = refs.debugCanvas.clientHeight;

  const hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.68,
    minTrackingConfidence: 0.62
  });

  hands.onResults((results) => {
    drawDebug(results);
    const landmarks = results.multiHandLandmarks?.[0] ?? null;
    onLandmarks(landmarks, { isFist: landmarks ? isFist(landmarks) : false });
    detectGlobalGesture(results.multiHandLandmarks);
    updateCameraStatus(results.multiHandLandmarks);
  });

  camera = new window.Camera(refs.camera, {
    onFrame: async () => hands.send({ image: refs.camera }),
    width: 960,
    height: 540
  });

  try {
    await camera.start();
    state.cameraStarted = true;
    state.mediaPipeStarted = true;
    refs.cameraStatus.textContent = 'Camera active';
  } catch (error) {
    refs.cameraStatus.textContent = 'Camera blocked';
    console.error(error);
  }
}

function isFist(landmarks) {
  const folded = [
    landmarks[8].y > landmarks[6].y,
    landmarks[12].y > landmarks[10].y,
    landmarks[16].y > landmarks[14].y,
    landmarks[20].y > landmarks[18].y
  ];

  const palm = landmarks[9];
  const closeToPalm = [8, 12, 16, 20].filter((index) => {
    const point = landmarks[index];
    const dx = point.x - palm.x;
    const dy = point.y - palm.y;
    return Math.hypot(dx, dy) < 0.22;
  }).length;

  return folded.filter(Boolean).length >= 3 && closeToPalm >= 3;
}

function detectGlobalGesture(hands) {
  if (state.currentScreen !== 'DETAIL') return;
  if (!hands || hands.length < 2) return;
  const distance = getHandsCloseDistance(hands[0], hands[1]);
  const now = performance.now();

  if (distance < 0.22 && now - state.lastGlobalGestureTime > 1400) {
    state.lastGlobalGestureTime = now;
    state.lastGestureStatusTime = now;
    refs.cameraStatus.textContent = '戻るモーション';
    document.querySelector('[data-action="back"]')?.click();
  }
}

function getHandsCloseDistance(a, b) {
  const palmDistance = getPointDistance(a[9], b[9]);
  const wristDistance = getPointDistance(a[0], b[0]);
  const indexTipDistance = getPointDistance(a[8], b[8]);
  return Math.min(palmDistance, wristDistance, indexTipDistance);
}

function getPointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function updateCameraStatus(hands) {
  const now = performance.now();
  if (now - state.lastGestureStatusTime < 900) return;

  if (!hands?.length) {
    refs.cameraStatus.textContent = '手を映してください';
  } else if (hands.length >= 2 && state.currentScreen === 'DETAIL') {
    refs.cameraStatus.textContent = '両手を近づけると戻る';
  } else {
    refs.cameraStatus.textContent = '手を検出中';
  }
}

function drawDebug(results) {
  const canvas = refs.debugCanvas;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.scale(-1, 1);
  context.translate(-canvas.width, 0);
  context.drawImage(results.image, 0, 0, canvas.width, canvas.height);

  if (results.multiHandLandmarks && window.drawConnectors && window.drawLandmarks) {
    results.multiHandLandmarks.forEach((landmarks) => {
      window.drawConnectors(context, landmarks, window.HAND_CONNECTIONS, { color: '#63d8ff', lineWidth: 3 });
      window.drawLandmarks(context, landmarks, { color: '#ffbf5e', lineWidth: 1, radius: 3 });
    });
  }

  context.restore();
}
