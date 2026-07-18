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
  state.selectedItemId = null;
  state.topicPage = 0;

  if (state.syncRole === 'viewer') {
    renderViewerState();
    notify();
    return;
  }

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

  if (state.syncRole === 'viewer') {
    renderViewerState();
    notify();
    return;
  }

  const fragment = refs.detailTemplate.content.cloneNode(true);
  const grid = fragment.querySelector('#item-grid');
  const selectionStrip = fragment.querySelector('#selection-strip');
  fragment.querySelector('#category-kicker').textContent = `${state.activeCategory.items.length} 個のお題`;
  fragment.querySelector('#category-title').textContent = state.activeCategory.title;
  fragment.querySelector('#selected-count').textContent = state.selectedItemId ? '1' : '0';

  const pageCount = getPageCount();
  const currentPage = Math.min(state.topicPage, pageCount - 1);
  const startIndex = currentPage * state.topicsPerPage;
  const pageItems = state.activeCategory.items.slice(startIndex, startIndex + state.topicsPerPage);

  state.topicPage = currentPage;
  pageItems.forEach((item, pageIndex) => {
    const index = startIndex + pageIndex;
    const itemId = `${state.activeCategory.id}-${index}`;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'word-card';
    card.dataset.id = itemId;
    card.style.setProperty('--accent', state.activeCategory.accent);
    card.textContent = item;
    if (state.selectedItemId === itemId) card.classList.add('selected');
    grid.append(card);
  });

  renderSelectionStrip(selectionStrip);
  renderPagination(grid, currentPage, pageCount);

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
    state.selectedItemId = null;
    state.topicPage = 0;
    playSound('select');
    renderDetail();
    return;
  }

  if (action === 'TOGGLE_ITEM') {
    if (!details.itemId) return;
    state.selectedItemId = details.itemId;
    playSound('select');
    renderDetail();
    return;
  }

  if (action === 'NEXT_PAGE') {
    if (state.currentScreen !== 'DETAIL') return;
    state.topicPage = Math.min(state.topicPage + 1, getPageCount() - 1);
    playSound('hover');
    renderDetail();
    return;
  }

  if (action === 'PREV_PAGE') {
    if (state.currentScreen !== 'DETAIL') return;
    state.topicPage = Math.max(state.topicPage - 1, 0);
    playSound('hover');
    renderDetail();
    return;
  }

  if (action === 'BACK') {
    if (state.currentScreen === 'DETAIL') renderHome();
    playSound('back');
    return;
  }

  if (action === 'RESET') {
    state.selectedItemId = null;
    playSound('reset');
    if (state.currentScreen === 'DETAIL') renderDetail();
    else renderHome();
  }
}

export function renderRemoteState() {
  if (state.syncRole === 'viewer') {
    renderViewerState();
    return;
  }

  if (state.currentScreen === 'DETAIL') renderDetail();
  else renderHome();
}

function replaceStage(fragment) {
  refs.stage.replaceChildren(fragment);
}

function renderPagination(grid, currentPage, pageCount) {
  const controls = document.createElement('div');
  controls.className = 'topic-pager';

  const prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.dataset.action = 'prev-page';
  prevButton.className = 'pager-button';
  prevButton.textContent = '← 前へ';
  prevButton.disabled = currentPage === 0;

  const pageLabel = document.createElement('span');
  pageLabel.className = 'page-label';
  pageLabel.textContent = `${currentPage + 1} / ${pageCount}`;

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.dataset.action = 'next-page';
  nextButton.className = 'pager-button';
  nextButton.textContent = '次へ →';
  nextButton.disabled = currentPage >= pageCount - 1;

  controls.append(prevButton, pageLabel, nextButton);
  grid.after(controls);
}

function getPageCount() {
  if (!state.activeCategory) return 1;
  return Math.max(1, Math.ceil(state.activeCategory.items.length / state.topicsPerPage));
}

function renderViewerState() {
  const wrapper = document.createElement('div');
  wrapper.className = 'viewer-screen';

  if (state.currentScreen === 'DETAIL' && state.activeCategory && state.selectedItemId) {
    const selectedLabel = getSelectedLabel();
    wrapper.classList.add('has-topic');
    wrapper.innerHTML = `
      <p class="eyebrow">Synced Topic</p>
      <div class="viewer-category">${state.activeCategory.title}</div>
      <strong class="viewer-topic">${selectedLabel}</strong>
      <p class="viewer-note">このお題をジェスチャーで伝えてください</p>
    `;
  } else if (state.currentScreen === 'DETAIL' && state.activeCategory) {
    wrapper.innerHTML = `
      <p class="eyebrow">Category Selected</p>
      <div class="viewer-category">${state.activeCategory.title}</div>
      <strong class="viewer-waiting">お題選択待ち</strong>
      <p class="viewer-note">出題側がお題を選ぶと、この画面に表示されます</p>
    `;
  } else {
    wrapper.innerHTML = `
      <p class="eyebrow">Waiting</p>
      <strong class="viewer-waiting">次のお題を待っています</strong>
      <p class="viewer-note">出題側がジャンルとお題を選ぶと自動で切り替わります</p>
    `;
  }

  replaceStage(wrapper);
}

function getSelectedLabel() {
  return state.activeCategory.items.find((item, index) => {
    return state.selectedItemId === `${state.activeCategory.id}-${index}`;
  }) ?? '';
}

function renderSelectionStrip(selectionStrip) {
  selectionStrip.replaceChildren();

  if (!state.selectedItemId) {
    selectionStrip.hidden = false;
    selectionStrip.className = 'motion-guide';
    selectionStrip.textContent = 'お題を1つ選んでください。次のお題へ進むときは、片手でチョキを作るとカテゴリー選択に戻ります。';
    return;
  }

  const selectedLabel = getSelectedLabel();

  selectionStrip.hidden = false;
  selectionStrip.className = 'selected-topic';
  selectionStrip.innerHTML = `
    <span class="topic-label">今回のお題</span>
    <strong>${selectedLabel}</strong>
    <span class="motion-label">回答後: チョキで戻る</span>
  `;
}

function notify() {
  onStateChange();
}
