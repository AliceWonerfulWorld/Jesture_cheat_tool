import { getCategoryById, refs, serializeState, state } from './state.js';
import { renderRemoteState } from './ui.js';

let remoteHandler = () => {};
let senderRestartCount = 0;

export function initSync({ onRemoteState }) {
  remoteHandler = onRemoteState;
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room');
  const role = params.get('role');

  if (room) state.roomId = room;
  if (role === 'viewer' || role === 'sender') setSyncRole(role);
  updateRoomPanel();
}

export function setSyncRole(role) {
  state.syncRole = role;
  document.body.classList.toggle('viewer-mode', role === 'viewer');
  document.body.classList.toggle('sender-mode', role === 'sender');
  document.querySelectorAll('[data-role]').forEach((button) => {
    button.classList.toggle('active', button.dataset.role === role);
  });

  if (role === 'solo') {
    closePeer();
    senderRestartCount = 0;
    refs.syncStatus.textContent = 'Solo';
    updateRoomPanel();
    renderRemoteState();
    return;
  }

  if (!window.Peer) {
    refs.syncStatus.textContent = 'PeerJS unavailable';
    return;
  }

  state.roomId = state.roomId || createRoomId();
  senderRestartCount = 0;
  closePeer();
  if (role === 'sender') startSender();
  if (role === 'viewer') startViewer();
  updateRoomPanel();
  renderRemoteState();
}

export function broadcastState() {
  if (state.syncRole !== 'sender') return;
  const payload = serializeState();
  let sentCount = 0;
  state.connections.forEach((connection) => {
    if (connection.open) {
      connection.send(payload);
      sentCount += 1;
    }
  });
  updateSenderStatus(sentCount);
}

export function applyRemoteState(payload) {
  if (payload?.type !== 'STATE_UPDATE') return;
  state.currentScreen = payload.currentScreen === 'DETAIL' ? 'DETAIL' : 'HOME';
  state.activeCategory = getCategoryById(payload.activeCategoryId);
  state.selectedItemId = payload.selectedItemId ?? null;
  renderRemoteState();
}

function startSender() {
  const peerId = `gesture-room-${state.roomId}`;
  refs.syncStatus.textContent = `ルーム準備中 ${state.roomId}`;

  state.peer = new window.Peer(peerId);
  state.peer.on('open', () => {
    refs.syncStatus.textContent = `操作 ${state.roomId}`;
    broadcastState();
  });

  state.peer.on('connection', (connection) => {
    state.connections.add(connection);
    connection.on('open', () => {
      connection.send(serializeState());
      updateSenderStatus();
    });
    connection.on('close', () => {
      state.connections.delete(connection);
      updateSenderStatus();
    });
    connection.on('error', () => {
      state.connections.delete(connection);
      updateSenderStatus();
    });
  });

  state.peer.on('error', (error) => {
    if (error.type === 'unavailable-id' && senderRestartCount < 3) {
      senderRestartCount += 1;
      state.roomId = createRoomId();
      refs.syncStatus.textContent = 'ルーム再作成中';
      updateRoomPanel();
      closePeer();
      startSender();
      return;
    }

    refs.syncStatus.textContent = getPeerErrorLabel(error);
  });
}

function startViewer() {
  refs.syncStatus.textContent = `接続中 ${state.roomId}`;
  state.peer = new window.Peer();
  state.peer.on('open', () => {
    connectViewer();
  });

  state.peer.on('error', (error) => {
    refs.syncStatus.textContent = getPeerErrorLabel(error);
    scheduleViewerReconnect();
  });
}

function connectViewer() {
  if (!state.peer || state.peer.destroyed) return;

  closeConnectionsOnly();
  const connection = state.peer.connect(`gesture-room-${state.roomId}`, { reliable: true });
  state.connections.add(connection);

  connection.on('open', () => {
    clearRetryTimer();
    refs.syncStatus.textContent = `表示 ${state.roomId}`;
  });
  connection.on('data', remoteHandler);
  connection.on('close', () => {
    state.connections.delete(connection);
    refs.syncStatus.textContent = '再接続中';
    scheduleViewerReconnect();
  });
  connection.on('error', () => {
    state.connections.delete(connection);
    refs.syncStatus.textContent = '再接続中';
    scheduleViewerReconnect();
  });

  window.setTimeout(() => {
    if (state.syncRole === 'viewer' && !connection.open) {
      refs.syncStatus.textContent = '送信側待ち';
      scheduleViewerReconnect();
    }
  }, 1800);
}

function scheduleViewerReconnect() {
  if (state.syncRole !== 'viewer') return;
  if (state.syncRetryTimer) return;
  state.syncRetryTimer = window.setTimeout(() => {
    state.syncRetryTimer = null;
    connectViewer();
  }, 1600);
}

function closePeer() {
  clearRetryTimer();
  closeConnectionsOnly();
  if (state.peer) state.peer.destroy();
  state.peer = null;
}

function closeConnectionsOnly() {
  state.connections.forEach((connection) => connection.close());
  state.connections.clear();
}

function clearRetryTimer() {
  if (!state.syncRetryTimer) return;
  window.clearTimeout(state.syncRetryTimer);
  state.syncRetryTimer = null;
}

function createRoomId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function updateRoomPanel() {
  const isSynced = state.syncRole !== 'solo';
  refs.roomPanel.hidden = !isSynced;
  if (!isSynced) return;

  refs.roomId.textContent = state.roomId;
  const url = new URL(window.location.href);
  url.searchParams.set('room', state.roomId);
  url.searchParams.set('role', 'viewer');
  refs.viewerUrl.textContent = url.toString();
  refs.networkHint.textContent = isLocalhost(url.hostname)
    ? 'スマホで開く場合は 127.0.0.1 / localhost をこのPCの同一Wi-Fi上のIPアドレスに置き換えてください。'
    : '';
}

function updateSenderStatus(sentCount = state.connections.size) {
  if (state.syncRole !== 'sender') return;
  refs.syncStatus.textContent = sentCount > 0 ? `操作 ${state.roomId} / ${sentCount}台接続` : `操作 ${state.roomId}`;
}

function getPeerErrorLabel(error) {
  const type = error?.type ?? 'unknown';
  if (type === 'network') return '同期ネットワークエラー';
  if (type === 'peer-unavailable') return '送信側待ち';
  if (type === 'unavailable-id') return 'ルーム使用中';
  if (type === 'server-error') return '同期サーバーエラー';
  return `Sync error: ${type}`;
}

function isLocalhost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}
