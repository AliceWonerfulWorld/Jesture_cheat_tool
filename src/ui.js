import { getCategoryById, refs, state } from './state.js';

let onStateChange = () => {};
let playSound = () => {};

export function initUi(options) {
  onStateChange = options.onStateChange;
  playSound = options.playSound;
  state.notifyStateChange = notify;
}

export function renderHome() {
  state.currentScreen = 'HOME';
  state.activeCategory = null;
  state.selectedItems.clear();

  const fragment = refs.homeTemplate.content.cloneNode(true);
  const grid = fragment.querySelector('#category-grid');

  state.categories.forEach((category) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'category-card';
    card.dataset.id = category.id;
    card.style.setProperty('--accent', category.accent);
    card.innerHTML = `
      <div>
        <p class="eyebrow">${category.items.length} お題</p>
        <h3>${category.title}</h3>
        <p>${category.description}</p>
      </div>
      <div class="card-meta">
        <span>選ぶ</span>
        <span>→</span>
      </div>
    `;
    grid.append(card);
  });

  replaceStage(fragment);
  notify();
}

export function renderDetail() {
  if (!state.activeCategory) {
    renderHome();
    return;
  }

  const fragment = refs.detailTemplate.content.cloneNode(true);
  const grid = fragment.querySelector('#item-grid');
  const selectionStrip = fragment.querySelector('#selection-strip');
  fragment.querySelector('#category-kicker').textContent = `${state.activeCategory.items.length} 個のお題`;
  fragment.querySelector('#category-title').textContent = state.activeCategory.title;
  fragment.querySelector('#selected-count').textContent = String(state.selectedItems.size);

  state.activeCategory.items.forEach((item, index) => {
    const itemId = `${state.activeCategory.id}-${index}`;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'word-card';
    card.dataset.id = itemId;
    card.style.setProperty('--accent', state.activeCategory.accent);
    card.textContent = item;
    if (state.selectedItems.has(itemId)) card.classList.add('selected');
    grid.append(card);
  });

  renderSelectionStrip(selectionStrip);

  replaceStage(fragment);
  notify();
}

export function transitionTo(action, details = {}) {
  if (action === 'HOME') {
    playSound('back');
    renderHome();
    return;
  }

  if (action === 'DETAIL') {
    const category = getCategoryById(details.categoryId);
    if (!category) return;
    state.currentScreen = 'DETAIL';
    state.activeCategory = category;
    state.selectedItems.clear();
    playSound('select');
    renderDetail();
    return;
  }

  if (action === 'TOGGLE_ITEM') {
    if (!details.itemId) return;
    if (state.selectedItems.has(details.itemId)) {
      state.selectedItems.delete(details.itemId);
      playSound('reset');
    } else {
      state.selectedItems.add(details.itemId);
      playSound('select');
    }
    renderDetail();
    return;
  }

  if (action === 'BACK') {
    if (state.currentScreen === 'DETAIL') renderHome();
    playSound('back');
    return;
  }

  if (action === 'RESET') {
    state.selectedItems.clear();
    playSound('reset');
    if (state.currentScreen === 'DETAIL') renderDetail();
    else renderHome();
  }
}

export function renderRemoteState() {
  if (state.currentScreen === 'DETAIL') renderDetail();
  else renderHome();
}

function replaceStage(fragment) {
  refs.stage.replaceChildren(fragment);
}

function renderSelectionStrip(selectionStrip) {
  const selectedLabels = state.activeCategory.items
    .map((item, index) => ({ item, id: `${state.activeCategory.id}-${index}` }))
    .filter(({ id }) => state.selectedItems.has(id))
    .map(({ item }) => item);

  selectionStrip.hidden = selectedLabels.length === 0;
  selectionStrip.replaceChildren();

  selectedLabels.forEach((label) => {
    const chip = document.createElement('span');
    chip.textContent = label;
    selectionStrip.append(chip);
  });
}

function notify() {
  onStateChange();
}
