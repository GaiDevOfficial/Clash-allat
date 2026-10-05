// Real-time WebSocket Multiplayer client with 4-Digit Room Code support
let mpSocket = null;
let currentRoomCode = null;
let mpRole = null;          // 'host' or 'guest'
let isMultiplayerMatch = false;

// Smart Server URL resolution for both Web and Android Native APK
function getMultiplayerServerUrl() {
  const customUrl = localStorage.getItem('animal_clash_server_url');
  if (customUrl && customUrl.trim()) {
    let url = customUrl.trim();
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      if (url.startsWith('https://')) url = url.replace('https://', 'wss://');
      else if (url.startsWith('http://')) url = url.replace('http://', 'ws://');
      else url = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + url;
    }
    return url;
  }

  // Detect Android APK (Capacitor/Cordova/file protocol or empty host)
  const isApk = (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
                window.location.protocol === 'capacitor:' ||
                window.location.protocol === 'file:' ||
                !window.location.host ||
                window.location.host === 'localhost';

  if (isApk && window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
    // In Android APK, automatically connect to cloud backend
    return 'wss://allati-arena.onrender.com';
  }

  // Web fallback (relative to current domain or localhost:3000)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host || 'localhost:3000';
  return `${protocol}//${host}`;
}

function updateServerStatusUI(status, msg) {
  const dot = document.getElementById('mp-status-indicator');
  const text = document.getElementById('mp-status-text');
  if (!dot || !text) return;

  dot.className = `status-dot ${status}`;
  text.textContent = msg;
}

let mpReconnectTimer = null;

function initMultiplayerSocket() {
  if (mpSocket && (mpSocket.readyState === WebSocket.OPEN || mpSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsUrl = getMultiplayerServerUrl();
  updateServerStatusUI('connecting', 'Kapcsolódás szerverhez...');

  try {
    mpSocket = new WebSocket(wsUrl);
  } catch (err) {
    console.warn('Could not establish WebSocket connection:', err);
    updateServerStatusUI('offline', '🔴 Nincs kapcsolat (Szerver offline)');
    scheduleMpReconnect();
    return;
  }

  mpSocket.onopen = () => {
    console.log('Connected to Animal Clash multiplayer server at:', wsUrl);
    updateServerStatusUI('online', '🟢 Online szerver aktív');
    if (mpReconnectTimer) {
      clearTimeout(mpReconnectTimer);
      mpReconnectTimer = null;
    }
  };

  mpSocket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    } catch (e) {
      console.error('Error handling WS message:', e);
    }
  };

  mpSocket.onclose = () => {
    console.log('Disconnected from multiplayer server.');
    updateServerStatusUI('offline', '🔴 Nincs kapcsolat');
    scheduleMpReconnect();
  };

  mpSocket.onerror = (e) => {
    console.warn('WebSocket error:', e);
    updateServerStatusUI('offline', '🔴 Szerver hiba');
  };
}

function scheduleMpReconnect() {
  if (mpReconnectTimer) return;
  mpReconnectTimer = setTimeout(() => {
    mpReconnectTimer = null;
    if (!isMultiplayerMatch && (!mpSocket || mpSocket.readyState === WebSocket.CLOSED)) {
      initMultiplayerSocket();
    }
  }, 5000);
}

function handleServerMessage(data) {
  switch (data.type) {
    case 'room_created': {
      currentRoomCode = data.code;
      mpRole = 'host';
      showHostWaitingModal(data.code);
      break;
    }

    case 'join_error': {
      alert(data.message || 'Could not join room.');
      const joinBtn = document.getElementById('btn-mp-join-submit');
      if (joinBtn) joinBtn.disabled = false;
      break;
    }

    case 'match_start': {
      currentRoomCode = data.code;
      mpRole = data.role;
      closeMultiplayerModals();
      startMultiplayerBattle({
        role: mpRole,
        code: data.code,
        opponentName: data.opponentName,
        opponentDeck: data.opponentDeck,
        arena: data.arena || 1
      });
      break;
    }

    case 'opponent_deploy': {
      if (!battle || !isMultiplayerMatch) return;
      // Mirror deploy position from opponent's perspective
      const mirroredX = ARENA.W - data.x;
      const mirroredY = ARENA.H - data.y;
      playCard(data.cardId, ENEMY, mirroredX, mirroredY);
      break;
    }

    case 'opponent_disconnected': {
      if (battle && isMultiplayerMatch) {
        alert('Opponent disconnected! Victory by forfeit.');
        battle.crowns.player = 3;
        endBattle();
      }
      break;
    }

    case 'opponent_emote': {
      if (battle && isMultiplayerMatch) {
        showFloatingEmote(ENEMY, data.emote);
      }
      break;
    }
  }
}

function createMultiplayerRoom() {
  initMultiplayerSocket();
  const sendCreate = () => {
    mpSocket.send(JSON.stringify({
      type: 'create_room',
      name: 'Player (Host)',
      deck: [...save.deck],
      arena: save.arena
    }));
  };
  if (mpSocket.readyState === WebSocket.OPEN) {
    sendCreate();
  } else {
    mpSocket.addEventListener('open', sendCreate, { once: true });
  }
}

function joinMultiplayerRoom(code) {
  initMultiplayerSocket();
  const sendJoin = () => {
    mpSocket.send(JSON.stringify({
      type: 'join_room',
      code: String(code).trim(),
      name: 'Challenger',
      deck: [...save.deck]
    }));
  };
  if (mpSocket.readyState === WebSocket.OPEN) {
    sendJoin();
  } else {
    mpSocket.addEventListener('open', sendJoin, { once: true });
  }
}

function broadcastDeployCard(cardId, x, y) {
  if (!isMultiplayerMatch || !mpSocket || mpSocket.readyState !== WebSocket.OPEN) return;
  mpSocket.send(JSON.stringify({
    type: 'deploy_card',
    cardId,
    x,
    y,
    level: save.cards[cardId] ? save.cards[cardId].level : 1,
    timestamp: Date.now()
  }));
}

function broadcastEmote(emote) {
  if (!isMultiplayerMatch || !mpSocket || mpSocket.readyState !== WebSocket.OPEN) return;
  mpSocket.send(JSON.stringify({
    type: 'emote',
    emote
  }));
}

// Start live 1v1 battle
function startMultiplayerBattle(opts) {
  isMultiplayerMatch = true;
  document.getElementById('battle-screen').classList.remove('hidden');
  document.getElementById('result').classList.add('hidden');

  // Launch battle with opponent's actual deck and without local bot AI
  startBattle({
    multiplayer: true,
    role: opts.role,
    opponentName: opts.opponentName,
    enemyDeck: opts.opponentDeck && opts.opponentDeck.length === 8 ? opts.opponentDeck : null
  });
}

// Floating emote bubbles in battle
function showFloatingEmote(team, emoteText) {
  const x = team === PLAYER ? ARENA.centerX : ARENA.centerX;
  const y = team === PLAYER ? ARENA.H - 120 : 120;
  if (battle) {
    battle.popups.push({ x, y, text: emoteText, life: 2.2 });
  }
}

// UI Modals for 4-Digit Room Code
function showHostWaitingModal(code) {
  let modal = document.getElementById('mp-host-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mp-host-modal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="modal-box mp-box">
      <button class="modal-close" id="btn-close-host-modal">&times;</button>
      <div class="mp-head">
        <span class="icon" data-icon="battle"></span>
        <h3>Online Szoba / Lobby</h3>
      </div>
      <p class="mp-sub">Oszd meg ezt a 4 számjegyű kódot az ellenfeleddel:</p>
      <div class="mp-code-display">${code}</div>
      <div class="mp-waiting-dots">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        <span>Várakozás az ellenfélre...</span>
      </div>
      <div class="mp-modal-actions">
        <button class="action-btn" id="btn-copy-code">Kód Másolása (Copy)</button>
        <button class="action-btn cancel" id="btn-cancel-host">Mégse (Cancel)</button>
      </div>
    </div>
  `;
  applyIcons(modal);
  modal.classList.remove('hidden');

  document.getElementById('btn-close-host-modal').addEventListener('click', closeMultiplayerModals);
  document.getElementById('btn-cancel-host').addEventListener('click', closeMultiplayerModals);
  document.getElementById('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard.writeText(code).then(() => {
      document.getElementById('btn-copy-code').textContent = 'Másolva! (Copied)';
      setTimeout(() => {
        const btn = document.getElementById('btn-copy-code');
        if (btn) btn.textContent = 'Kód Másolása (Copy)';
      }, 2000);
    });
  });
}

function showJoinInputModal() {
  let modal = document.getElementById('mp-join-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mp-join-modal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="modal-box mp-box">
      <button class="modal-close" id="btn-close-join-modal">&times;</button>
      <div class="mp-head">
        <span class="icon" data-icon="users"></span>
        <h3>Csatlakozás Szobához</h3>
      </div>
      <p class="mp-sub">Add meg a szoba 4 számjegyű kódját:</p>
      <div class="mp-input-wrap">
        <input type="text" id="mp-room-input" maxlength="4" placeholder="4821" autofocus />
      </div>
      <div class="mp-modal-actions">
        <button class="big-btn mp-connect-btn" id="btn-mp-join-submit">Csatlakozás & Csata!</button>
        <button class="action-btn cancel" id="btn-cancel-join">Mégse</button>
      </div>
    </div>
  `;
  applyIcons(modal);
  modal.classList.remove('hidden');

  const input = document.getElementById('mp-room-input');
  input.focus();

  document.getElementById('btn-close-join-modal').addEventListener('click', closeMultiplayerModals);
  document.getElementById('btn-cancel-join').addEventListener('click', closeMultiplayerModals);
  document.getElementById('btn-mp-join-submit').addEventListener('click', () => {
    const val = input.value.trim();
    if (val.length !== 4 || isNaN(val)) {
      alert('Kérlek 4 számjegyet adj meg! / Please enter a 4-digit code.');
      return;
    }
    document.getElementById('btn-mp-join-submit').disabled = true;
    document.getElementById('btn-mp-join-submit').textContent = 'Csatlakozás...';
    joinMultiplayerRoom(val);
  });
}

function closeMultiplayerModals() {
  const hostModal = document.getElementById('mp-host-modal');
  if (hostModal) hostModal.classList.add('hidden');
  const joinModal = document.getElementById('mp-join-modal');
  if (joinModal) joinModal.classList.add('hidden');
  const serverModal = document.getElementById('server-config-modal');
  if (serverModal) serverModal.classList.add('hidden');
}

function showServerConfigModal() {
  const modal = document.getElementById('server-config-modal');
  if (!modal) return;
  const input = document.getElementById('mp-server-url-input');
  const resultDiv = document.getElementById('mp-test-result');
  if (resultDiv) resultDiv.textContent = '';

  const currentUrl = localStorage.getItem('animal_clash_server_url') || getMultiplayerServerUrl();
  if (input) input.value = currentUrl;

  modal.classList.remove('hidden');
}

function setupServerConfigListeners() {
  const btnCfg = document.getElementById('btn-mp-server-cfg');
  if (btnCfg) btnCfg.onclick = showServerConfigModal;

  const btnClose = document.getElementById('btn-server-close');
  if (btnClose) btnClose.onclick = closeMultiplayerModals;

  const btnCancel = document.getElementById('btn-server-cancel');
  if (btnCancel) btnCancel.onclick = closeMultiplayerModals;

  const presets = document.querySelectorAll('.preset-btn');
  presets.forEach(btn => {
    btn.onclick = () => {
      const input = document.getElementById('mp-server-url-input');
      if (input && btn.dataset.url) {
        input.value = btn.dataset.url;
      }
    };
  });

  const btnSave = document.getElementById('btn-server-save');
  if (btnSave) {
    btnSave.onclick = () => {
      const input = document.getElementById('mp-server-url-input');
      const val = input ? input.value.trim() : '';
      if (val) {
        localStorage.setItem('animal_clash_server_url', val);
      } else {
        localStorage.removeItem('animal_clash_server_url');
      }
      closeMultiplayerModals();
      if (mpSocket) {
        mpSocket.close();
      }
      initMultiplayerSocket();
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupServerConfigListeners);
} else {
  setupServerConfigListeners();
}

// Auto initialize on load
initMultiplayerSocket();

