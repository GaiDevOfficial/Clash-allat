// Procedural Web Audio Sound Synthesizer (0KB external assets, instant zero-latency feedback)
const SoundManager = (() => {
  let ctx = null;
  let muted = localStorage.getItem('animal_clash_muted') === 'true';

  function getContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function isMuted() {
    return muted;
  }

  function toggleMute() {
    muted = !muted;
    localStorage.setItem('animal_clash_muted', muted ? 'true' : 'false');
    updateMuteUI();
    if (!muted) playClick();
    return muted;
  }

  function updateMuteUI() {
    const btn = document.getElementById('btn-sound-toggle');
    if (!btn) return;
    const icon = btn.querySelector('.icon');
    if (icon) {
      icon.dataset.icon = muted ? 'sound_off' : 'sound_on';
      if (typeof applyIcons === 'function') applyIcons(btn);
    }
    btn.title = muted ? 'Hang bekapcsolása (M)' : 'Hang némítása (M)';
  }

  // Helper tone player
  function playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.12, pitchBend = 0) {
    if (muted) return;
    try {
      const audio = getContext();
      if (!audio) return;
      const osc = audio.createOscillator();
      const gain = audio.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audio.currentTime);
      if (pitchBend !== 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + pitchBend), audio.currentTime + duration);
      }

      gain.gain.setValueAtTime(gainVal, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);

      osc.connect(gain);
      gain.connect(audio.destination);

      osc.start();
      osc.stop(audio.currentTime + duration);
    } catch (e) {
      // AudioContext policy safe fallback
    }
  }

  function playClick() {
    playTone(520, 'triangle', 0.05, 0.08, -120);
  }

  function playCardSelect() {
    playTone(440, 'sine', 0.08, 0.1, 140);
  }

  function playCardDrop() {
    if (muted) return;
    try {
      const audio = getContext();
      if (!audio) return;
      // Low punch + pitch slide
      playTone(180, 'sine', 0.14, 0.16, -90);
      setTimeout(() => playTone(360, 'triangle', 0.1, 0.08, 0), 40);
    } catch (e) {}
  }

  function playSpell() {
    if (muted) return;
    try {
      [600, 750, 900, 1200].forEach((freq, i) => {
        setTimeout(() => playTone(freq, 'sine', 0.12, 0.08, 100), i * 35);
      });
    } catch (e) {}
  }

  function playGold() {
    if (muted) return;
    try {
      playTone(987.77, 'sine', 0.15, 0.1, 0); // B5
      setTimeout(() => playTone(1318.51, 'sine', 0.25, 0.12, 0), 60); // E6
    } catch (e) {}
  }

  function playGem() {
    if (muted) return;
    try {
      playTone(1046.5, 'triangle', 0.12, 0.1, 0); // C6
      setTimeout(() => playTone(1567.98, 'sine', 0.3, 0.14, 0), 70); // G6
    } catch (e) {}
  }

  function playChestOpen() {
    if (muted) return;
    try {
      const chords = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      chords.forEach((note, i) => {
        setTimeout(() => playTone(note, 'triangle', 0.35, 0.12, 0), i * 90);
      });
    } catch (e) {}
  }

  function playVictory() {
    if (muted) return;
    try {
      const fanfare = [
        { f: 523.25, d: 0.12 }, // C
        { f: 659.25, d: 0.12 }, // E
        { f: 783.99, d: 0.15 }, // G
        { f: 1046.5, d: 0.45 }, // High C
      ];
      let delay = 0;
      fanfare.forEach(item => {
        setTimeout(() => playTone(item.f, 'triangle', item.d, 0.18, 0), delay);
        delay += item.d * 1000 + 40;
      });
    } catch (e) {}
  }

  function playDefeat() {
    if (muted) return;
    try {
      const sad = [
        { f: 440.00, d: 0.2 },
        { f: 415.30, d: 0.22 },
        { f: 392.00, d: 0.4 },
      ];
      let delay = 0;
      sad.forEach(item => {
        setTimeout(() => playTone(item.f, 'sine', item.d, 0.12, -30), delay);
        delay += item.d * 1000 + 50;
      });
    } catch (e) {}
  }

  // Initialize on first user touch / click
  window.addEventListener('pointerdown', () => getContext(), { once: true });
  window.addEventListener('keydown', () => getContext(), { once: true });

  return {
    getContext,
    isMuted,
    toggleMute,
    updateMuteUI,
    playClick,
    playCardSelect,
    playCardDrop,
    playSpell,
    playGold,
    playGem,
    playChestOpen,
    playVictory,
    playDefeat,
  };
})();
