// Desktop Keyboard Controls, PWA Install Banner, and Web Experience Enhancements
(() => {
  let deferredInstallPrompt = null;

  // ---------- Fullscreen API ----------
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  }

  // ---------- PWA Install Prompt ----------
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstallButton();
  });

  function showInstallButton() {
    let btn = document.getElementById('btn-pwa-install');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'btn-pwa-install';
      btn.className = 'pwa-install-pill';
      btn.innerHTML = '📲 <span>Alkalmazás Telepítése</span>';
      btn.addEventListener('click', () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          deferredInstallPrompt.userChoice.then((choice) => {
            if (choice.outcome === 'accepted') {
              btn.remove();
            }
            deferredInstallPrompt = null;
          });
        }
      });
      const topBar = document.querySelector('.top-bar');
      if (topBar) topBar.appendChild(btn);
    }
  }

  // ---------- Keyboard Shortcuts ----------
  window.addEventListener('keydown', (e) => {
    // Ignore input fields
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    const key = e.key.toUpperCase();

    // Sound toggle: M
    if (key === 'M') {
      if (window.SoundManager) window.SoundManager.toggleMute();
      return;
    }

    // Fullscreen toggle: F
    if (key === 'F') {
      toggleFullscreen();
      return;
    }

    // Escape: Close modals or deselect battle hand card
    if (e.key === 'Escape') {
      // Close active modals if any
      const cardModal = document.getElementById('card-modal');
      const arenaModal = document.getElementById('arena-modal');
      const seasonModal = document.getElementById('season-modal');
      const serverModal = document.getElementById('server-config-modal');
      const codeModal = document.getElementById('mp-code-modal');

      if (cardModal && !cardModal.classList.contains('hidden')) {
        if (typeof closeCardModal === 'function') closeCardModal();
        return;
      }
      if (arenaModal && !arenaModal.classList.contains('hidden')) {
        arenaModal.classList.add('hidden');
        return;
      }
      if (seasonModal && !seasonModal.classList.contains('hidden')) {
        seasonModal.classList.add('hidden');
        return;
      }
      if (serverModal && !serverModal.classList.contains('hidden')) {
        serverModal.classList.add('hidden');
        return;
      }
      if (codeModal && !codeModal.classList.contains('hidden')) {
        codeModal.classList.add('hidden');
        return;
      }

      // If in battle and has selected card: deselect
      if (typeof battle !== 'undefined' && battle && battle.selectedCardIndex !== -1) {
        battle.selectedCardIndex = -1;
        if (typeof renderHand === 'function') renderHand();
        if (window.SoundManager) window.SoundManager.playClick();
      }
      return;
    }

    // Battle hand hotkeys: 1, 2, 3, 4
    if (['1', '2', '3', '4'].includes(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      const battleScreen = document.getElementById('battle-screen');
      if (battleScreen && !battleScreen.classList.contains('hidden')) {
        const handCards = document.querySelectorAll('.hand-card');
        if (handCards[idx]) {
          handCards[idx].click();
        }
      }
      return;
    }

    // Navigation hotkeys: Q (Bolt), W (Pakli), E (Csata), R (Kihívás)
    if (typeof showTab === 'function') {
      const battleScreen = document.getElementById('battle-screen');
      if (!battleScreen || battleScreen.classList.contains('hidden')) {
        if (key === 'Q') showTab('shop');
        else if (key === 'W') showTab('deck');
        else if (key === 'E') showTab('battle');
        else if (key === 'R') showTab('challenge');
      }
    }
  });

  // ---------- Sound integration into UI interactions ----------
  document.addEventListener('click', (e) => {
    if (!window.SoundManager) return;
    const target = e.target.closest('button, .tab, .card-tile, .chest-slot');
    if (!target) return;

    if (target.id === 'btn-sound-toggle') return; // Handled by toggle itself

    // Special sound mappings
    if (target.classList.contains('chest-slot') || target.classList.contains('chest-box-wrap')) {
      window.SoundManager.playChestOpen();
    } else if (target.classList.contains('hand-card')) {
      window.SoundManager.playCardSelect();
    } else if (target.classList.contains('shop-buy') || target.classList.contains('bundle-buy-btn')) {
      window.SoundManager.playGold();
    } else {
      window.SoundManager.playClick();
    }
  }, true);

  // Hook sound into battle card drop
  window.addEventListener('load', () => {
    if (typeof SoundManager !== 'undefined') {
      SoundManager.updateMuteUI();
      const soundBtn = document.getElementById('btn-sound-toggle');
      if (soundBtn) soundBtn.addEventListener('click', () => SoundManager.toggleMute());

      const fsBtn = document.getElementById('btn-fullscreen-toggle');
      if (fsBtn) fsBtn.addEventListener('click', toggleFullscreen);
    }
  });
})();
