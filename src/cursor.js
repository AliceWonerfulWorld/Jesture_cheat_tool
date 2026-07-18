import { refs, state } from './state.js';

let onActivate = () => {};
let playSound = () => {};

export function initCursor(options) {
  onActivate = options.onActivate;
  playSound = options.playSound;
}

export function updateCursorFromLandmarks(landmarks, gesture) {
  const hand = state.hands[0];
  if (!landmarks) {
    hand.isDetected = false;
    hand.isGestureActive = false;
    hand.fistStartTime = null;
    hand.holdProgress = 0;
    return;
  }

  const palm = landmarks[9];
  hand.targetCursor.x = (1 - palm.x) * window.innerWidth;
  hand.targetCursor.y = palm.y * window.innerHeight;
  hand.isDetected = true;
  hand.isGestureActive = gesture.isFist;
}

export function startCursorLoop() {
  const tick = () => {
    const hand = state.hands[0];
    hand.cursor.x += (hand.targetCursor.x - hand.cursor.x) * state.settings.smoothing;
    hand.cursor.y += (hand.targetCursor.y - hand.cursor.y) * state.settings.smoothing;

    refs.cursor.style.left = `${hand.cursor.x}px`;
    refs.cursor.style.top = `${hand.cursor.y}px`;
    refs.cursor.classList.toggle('detected', hand.isDetected);
    refs.cursor.classList.toggle('active', hand.isGestureActive);

    updateHover(hand);
    updateGestureHold(hand);
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function updateHover(hand) {
  if (!hand.isDetected) {
    setHovered(hand, null);
    return;
  }

  refs.cursor.style.display = 'none';
  const target = document.elementFromPoint(hand.cursor.x, hand.cursor.y);
  refs.cursor.style.display = '';
  const interactive = target?.closest('.category-card, .word-card, button');
  setHovered(hand, interactive);
}

function setHovered(hand, element) {
  if (hand.hoveredElement === element) return;
  hand.hoveredElement?.classList.remove('hovered');
  hand.hoveredElement = element;
  hand.hoveredElement?.classList.add('hovered');
  if (element) playSound('hover');
}

function updateGestureHold(hand) {
  if (!hand.isDetected || !hand.hoveredElement || !hand.isGestureActive) {
    hand.fistStartTime = null;
    hand.isGestureTriggered = false;
    hand.holdProgress = 0;
    refs.cursor.style.setProperty('--progress', '0');
    return;
  }

  if (!hand.fistStartTime) hand.fistStartTime = performance.now();
  hand.holdProgress = Math.min((performance.now() - hand.fistStartTime) / state.settings.holdMs, 1);
  refs.cursor.style.setProperty('--progress', String(hand.holdProgress));

  if (hand.holdProgress >= 1 && !hand.isGestureTriggered) {
    hand.isGestureTriggered = true;
    activateElement(hand.hoveredElement);
  }
}

function activateElement(element) {
  const role = element.dataset.role;

  if (element.dataset.action || role) element.click();
  else if (element.classList.contains('category-card')) {
    onActivate('DETAIL', { categoryId: element.dataset.id });
  } else if (element.classList.contains('word-card')) {
    onActivate('TOGGLE_ITEM', { itemId: element.dataset.id });
  } else {
    element.click();
  }
}
