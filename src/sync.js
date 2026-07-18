import { getCategoryById, refs, serializeState, state } from './state.js';
import { renderRemoteState } from './ui.js';

let remoteHandler = () => {};

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
  document.querySelectorAll('[data-role]').forEach((button) => {
    button.classList.toggle('active', button.dataset.role === role);
  });

  if (role === 'solo') {
    closePeer();
    refs.syncStatus.textContent = 'Solo';
    updateRoomPanel();
    return;
  }

  if (!window.Peer) {
    refs.syncStatus.textContent = 'PeerJS unavailable';
    return;
  }

  state.roomId = state.roomId || createRoomId();
  closePeer();
  if (role === 'sender') startSender();
  if (role === 'viewer') startViewer();
  updateRoomPanel();
}

export function broadcastState() {
  if (state.syncRole !== 'sender') return;
  const payload = serializeState();
  state.connections.forEach((connection) => {
    if (connection.open) connection.send(payload);
  });
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
  refs.syncStatus.textContent = 'Opening room';

  state.peer = new window.Peer(peerId);
  state.peer.on('open', () => {
    refs.syncStatus.textContent = `Sender ${state.roomId}`;
  });

  state.peer.on('connection', (connection) => {
    state.connections.add(connection);
    connection.on('open', () => connection.send(serializeState()));
    connection.on('close', () => state.connections.delete(connection));
    connection.on('error', () => state.connections.delete(connection));
  });

  state.peer.on('error', (error) => {
    refs.syncStatus.textContent = error.type === 'unavailable-id' ? 'Room already active' : 'Sync error';
  });
}

function startViewer() {
  refs.syncStatus.textContent = 'Connecting';
  state.peer = new window.Peer();
  state.peer.on('open', () => {
    const connection = state.peer.connect(`gesture-room-${state.roomId}`);
    state.connections.add(connection);
    connection.on('open', () => {
      refs.syncStatus.textContent = `Viewer ${state.roomId}`;
    });
    connection.on('data', remoteHandler);
    connection.on('close', () => {
      state.connections.delete(connection);
      refs.syncStatus.textContent = 'Disconnected';
    });
  });

  state.peer.on('error', () => {
    refs.syncStatus.textContent = 'Sync error';
  });
}

function closePeer() {
  state.connections.forEach((connection) => connection.close());
  state.connections.clear();
  if (state.peer) state.peer.destroy();
  state.peer = null;
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
}
