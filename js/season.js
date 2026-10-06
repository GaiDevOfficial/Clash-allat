// Season Pass & Server Live Content System
// Provides seasonal trophy road, server-driven balance/content, and reward claiming.

let currentSeason = {
  id: 1,
  number: 1,
  name: '1. Szezon: Farm Lázadás',
  subtitle: 'A tanya állatai harcba szállnak! Gyűjts trófeákat és szerezz exkluzív jutalmakat!',
  badge: '🌾',
  themeColor: '#ffb03a',
  endsAt: Date.now() + 25 * 24 * 60 * 60 * 1000,
  boostedCard: 'rooster',
  boostedBonusText: 'Kakas: +15% sebzés a szezonban!',
  announcement: 'Üdv az 1. Szezonban! Érj el új szinteket a Szezon Passban!',
  version: '1.2.0',
  tiers: [
    { tier: 1, trophies: 20, rewardType: 'gold', amount: 150, title: '150 Arany' },
    { tier: 2, trophies: 50, rewardType: 'gems', amount: 25, title: '25 Drágakő' },
    { tier: 3, trophies: 100, rewardType: 'chest', chestType: 'small', amount: 1, title: 'Kis Aréna Láda' },
    { tier: 4, trophies: 200, rewardType: 'gold', amount: 350, title: '350 Arany' },
    { tier: 5, trophies: 350, rewardType: 'chest', chestType: 'medium', amount: 1, title: 'Közepes Aréna Láda' },
    { tier: 6, trophies: 500, rewardType: 'gems', amount: 60, title: '60 Drágakő' },
    { tier: 7, trophies: 750, rewardType: 'gold', amount: 800, title: '800 Arany' },
    { tier: 8, trophies: 1000, rewardType: 'chest', chestType: 'large', amount: 1, title: 'Nagy Aréna Láda' },
    { tier: 9, trophies: 1500, rewardType: 'gems', amount: 150, title: '150 Drágakő' },
    { tier: 10, trophies: 2000, rewardType: 'champion', title: 'Bajnok Ládája (1200 Arany + 150 Drágakő)' }
  ]
};

let seasonTimerInterval = null;

function initSeasonSystem() {
  // Sync season save data
  if (!save.claimedSeasonTiers) save.claimedSeasonTiers = [];
  if (save.seasonId === undefined) save.seasonId = currentSeason.id;

  // Render lobby banner
  renderSeasonLobbyCard();

  // Fetch updated season from server
  fetchSeasonFromServer();

  // Start countdown ticker
  if (seasonTimerInterval) clearInterval(seasonTimerInterval);
  seasonTimerInterval = setInterval(updateSeasonCountdownDisplay, 1000);
}

function fetchSeasonFromServer() {
  const httpUrl = typeof getServerHttpUrl === 'function' ? getServerHttpUrl() : 'https://allati-arena.onrender.com';
  fetch(httpUrl + '/api/season')
    .then(res => res.json())
    .then(data => {
      if (data && data.season) {
        applySeasonData(data.season);
      }
    })
    .catch(err => {
      // Offline fallback: continue using currentSeason
      console.log('Season fetch offline/cached, using local season.');
    });
}

function applySeasonData(season) {
  if (!season || !season.id) return;
  const isNewSeason = save.seasonId !== season.id;
  currentSeason = season;

  if (isNewSeason) {
    save.seasonId = season.id;
    save.claimedSeasonTiers = [];
    if (typeof saveGame === 'function') saveGame();
  }

  renderSeasonLobbyCard();
  updateSeasonCountdownDisplay();

  // Re-render modal if open
  const modal = document.getElementById('season-modal');
  if (modal && !modal.classList.contains('hidden')) {
    renderSeasonPassModalContent();
  }
}

function formatSeasonTimeLeft(ms) {
  if (ms <= 0) return 'Lejárt!';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days} nap ${hours} óra`;
  return `${hours}ó ${mins}p ${secs}mp`;
}

function updateSeasonCountdownDisplay() {
  const el = document.getElementById('season-countdown-txt');
  if (el) {
    const left = Math.max(0, currentSeason.endsAt - Date.now());
    el.textContent = formatSeasonTimeLeft(left);
  }
}

function getUnclaimedSeasonRewardCount() {
  const currentCups = (save && save.trophies) || 0;
  const claimed = (save && save.claimedSeasonTiers) || [];
  return currentSeason.tiers.filter(t => currentCups >= t.trophies && !claimed.includes(t.tier)).length;
}

function renderSeasonLobbyCard() {
  let card = document.getElementById('season-lobby-card');
  const battlePage = document.getElementById('page-battle');
  if (!battlePage) return;

  if (!card) {
    card = document.createElement('div');
    card.id = 'season-lobby-card';
    card.className = 'season-lobby-card';
    const arenaCard = battlePage.querySelector('.arena-card');
    if (arenaCard) {
      battlePage.insertBefore(card, arenaCard);
    } else {
      battlePage.prepend(card);
    }
  }

  const unclaimedCount = getUnclaimedSeasonRewardCount();
  const nextTier = currentSeason.tiers.find(t => (save.trophies || 0) < t.trophies);
  const prevCups = 0;
  const targetCups = nextTier ? nextTier.trophies : 2000;
  const currentCups = save.trophies || 0;
  const progressPct = Math.min(100, Math.round((currentCups / targetCups) * 100));

  const boostedCardName = (typeof CARDS !== 'undefined' && CARDS[currentSeason.boostedCard])
    ? CARDS[currentSeason.boostedCard].name
    : 'Kakas';

  card.innerHTML = `
    <div class="season-banner-top">
      <div class="season-title-wrap">
        <span class="season-badge">${currentSeason.badge || '🌾'}</span>
        <div class="season-titles">
          <h3 class="season-name">${currentSeason.name}</h3>
          <span class="season-timer">⏳ <b id="season-countdown-txt">${formatSeasonTimeLeft(Math.max(0, currentSeason.endsAt - Date.now()))}</b></span>
        </div>
      </div>
      <button id="btn-open-season" class="season-pass-btn">
        <span>🎁 Szezon Pass</span>
        ${unclaimedCount > 0 ? `<span class="season-claim-dot">${unclaimedCount}</span>` : ''}
      </button>
    </div>
    <div class="season-banner-sub">
      <div class="season-boost-badge" title="${currentSeason.boostedBonusText || ''}">
        ⭐ Kiemelt: <b>${boostedCardName}</b> (+15% bónusz)
      </div>
      <div class="season-progress-bar-wrap">
        <div class="season-bar-track">
          <div class="season-bar-fill" style="width: ${progressPct}%"></div>
        </div>
        <span class="season-bar-text">🏆 ${currentCups} / ${targetCups}</span>
      </div>
    </div>
  `;

  const btnOpen = document.getElementById('btn-open-season');
  if (btnOpen) {
    btnOpen.onclick = openSeasonPassModal;
  }
}

function openSeasonPassModal() {
  let modal = document.getElementById('season-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'season-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-box season-modal-box">
        <button class="modal-close" id="btn-season-close">&times;</button>
        <div class="season-modal-head">
          <span class="season-modal-badge">${currentSeason.badge || '🌾'}</span>
          <div>
            <h3>${currentSeason.name}</h3>
            <p class="season-modal-sub">${currentSeason.subtitle}</p>
          </div>
        </div>
        <div class="season-cup-status">
          <span>Jelenlegi Trófeák:</span>
          <b>🏆 <span id="season-modal-cups">${save.trophies || 0}</span></b>
        </div>
        <div class="season-ladder-container" id="season-ladder-list"></div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-season-close').onclick = () => {
      modal.classList.add('hidden');
    };
  }

  renderSeasonPassModalContent();
  modal.classList.remove('hidden');
}

function renderSeasonPassModalContent() {
  const list = document.getElementById('season-ladder-list');
  const cupsEl = document.getElementById('season-modal-cups');
  if (cupsEl) cupsEl.textContent = save.trophies || 0;
  if (!list) return;

  const currentCups = save.trophies || 0;
  const claimed = save.claimedSeasonTiers || [];

  list.innerHTML = '';

  currentSeason.tiers.forEach((t) => {
    const isUnlocked = currentCups >= t.trophies;
    const isClaimed = claimed.includes(t.tier);

    let rewardIcon = 'gold';
    if (t.rewardType === 'gems') rewardIcon = 'gem';
    else if (t.rewardType === 'chest' || t.rewardType === 'champion') rewardIcon = 'chest_' + (t.chestType || 'large');

    const item = document.createElement('div');
    item.className = `season-tier-item ${isClaimed ? 'claimed' : (isUnlocked ? 'ready' : 'locked')}`;

    item.innerHTML = `
      <div class="season-tier-left">
        <div class="season-tier-badge">
          <span class="tier-num">${t.tier}. Szint</span>
          <span class="tier-cups">🏆 ${t.trophies}</span>
        </div>
      </div>
      <div class="season-tier-mid">
        <div class="season-reward-icon-wrap">
          <span class="icon" data-icon="${rewardIcon}"></span>
        </div>
        <div class="season-reward-info">
          <div class="reward-title">${t.title}</div>
          <div class="reward-desc">${isClaimed ? 'Már megszerezve' : (isUnlocked ? 'Kattints az átvételhez!' : `Még ${t.trophies - currentCups} kupa kell`)}</div>
        </div>
      </div>
      <div class="season-tier-right">
        ${isClaimed
          ? '<span class="season-status-claimed">✅ Átvéve</span>'
          : (isUnlocked
            ? `<button class="season-claim-btn" data-tier="${t.tier}">KIVÁLTÁS!</button>`
            : '<span class="season-status-locked">🔒 Zárolva</span>')
        }
      </div>
    `;

    const claimBtn = item.querySelector('.season-claim-btn');
    if (claimBtn) {
      claimBtn.onclick = () => claimSeasonReward(t);
    }

    list.appendChild(item);
  });

  if (typeof applyIcons === 'function') {
    applyIcons(list);
  }
}

function claimSeasonReward(tierDef) {
  if (!save.claimedSeasonTiers) save.claimedSeasonTiers = [];
  if (save.claimedSeasonTiers.includes(tierDef.tier)) return;
  if ((save.trophies || 0) < tierDef.trophies) {
    alert('Még nincs elég kupád ehhez a szinthez!');
    return;
  }

  save.claimedSeasonTiers.push(tierDef.tier);

  // Grant reward
  let rewardSummary = '';
  if (tierDef.rewardType === 'gold') {
    save.gold += tierDef.amount;
    rewardSummary = `+${tierDef.amount} Arany!`;
  } else if (tierDef.rewardType === 'gems') {
    save.gems = (save.gems || 0) + tierDef.amount;
    rewardSummary = `+${tierDef.amount} Drágakő!`;
  } else if (tierDef.rewardType === 'chest') {
    // Add free instant chest reward
    const rewardChest = {
      type: tierDef.chestType || 'small',
      arena: save.arena || 1,
      readyAt: 0
    };
    save.gold += tierDef.chestType === 'large' ? 300 : (tierDef.chestType === 'medium' ? 150 : 70);
    rewardSummary = `Megkaptad: ${tierDef.title}!`;
  } else if (tierDef.rewardType === 'champion') {
    save.gold += 1200;
    save.gems = (save.gems || 0) + 150;
    rewardSummary = `Bajnoki Jutalmak: +1200 Arany és +150 Drágakő!`;
  }

  if (typeof saveGame === 'function') saveGame();
  if (typeof updateGold === 'function') updateGold();

  // Notify server via WS or HTTP
  if (typeof mpSocket !== 'undefined' && mpSocket && mpSocket.readyState === WebSocket.OPEN) {
    mpSocket.send(JSON.stringify({
      type: 'claim_season_tier',
      playerId: save.playerId,
      tier: tierDef.tier
    }));
  }

  // Refresh UI
  renderSeasonPassModalContent();
  renderSeasonLobbyCard();

  // Visual celebration alert
  alert(`🎉 Gratulálunk a ${tierDef.tier}. szinthez!\n${rewardSummary}`);
}

// Boost calculation helper for cards during the current season
function getSeasonCardBoost(cardId) {
  if (currentSeason && currentSeason.boostedCard === cardId) {
    return { boosted: true, multiplier: 1.15 };
  }
  return { boosted: false, multiplier: 1.0 };
}
