// Deck page: your 8-card deck, the rest of the collection, card details, upgrading and swapping
let swapCardId = null;   // a collection card waiting to be swapped into the deck

function renderDeckPage() {
  const deckGrid = document.getElementById('deck-grid');
  const collectionGrid = document.getElementById('collection-grid');
  deckGrid.innerHTML = '';
  collectionGrid.innerHTML = '';

  // The deck: 8 framed slots (4 x 2)
  for (let i = 0; i < DECK_SIZE; i++) {
    const slot = document.createElement('div');
    slot.className = 'deck-slot';
    const id = save.deck[i];
    if (id) slot.appendChild(createCardTile(id, true));
    else slot.innerHTML = '<span class="deck-slot-empty">Üres</span>';
    deckGrid.appendChild(slot);
  }
  // Collection: found cards first, then the locked ones ordered by the arena they come from
  Object.keys(CARDS)
    .filter(id => !save.deck.includes(id))
    .sort((a, b) => (isCardUnlocked(b) - isCardUnlocked(a)) || (CARDS[a].arena - CARDS[b].arena))
    .forEach(id => collectionGrid.appendChild(createCardTile(id, false)));

  // While swapping, the deck cards are highlighted as targets
  document.getElementById('swap-banner').classList.toggle('hidden', !swapCardId);
  deckGrid.classList.toggle('swapping', !!swapCardId);
}

// Small static card: portrait, name, level and card progress toward the next level
function createCardTile(id, inDeck) {
  const card = CARDS[id];
  const p = save.cards[id];
  const maxed = p.level >= MAX_LEVEL;
  const need = upgradeCost(p.level).cards;
  const dpr = window.devicePixelRatio || 1;
  const unlocked = isCardUnlocked(id);

  const tile = document.createElement('button');
  tile.className = 'card-tile' + (unlocked ? '' : ' locked');
  tile.style.borderColor = RARITIES[card.rarity].color;
  // Locked cards show where they can be found instead of their level
  tile.innerHTML = `
    <span class="cost-badge">${card.cost}</span>
    <canvas width="${64 * dpr}" height="${64 * dpr}"></canvas>
    <span class="tile-name">${card.name}</span>
    ${unlocked ? `
    <span class="tile-level">${maxed ? 'Max. szint' : p.level + '. szint'}</span>
    <div class="tile-bar ${canUpgrade(id) ? 'ready' : ''}">
      <div style="width: ${maxed ? 100 : Math.min(100, (p.count / need) * 100)}%"></div>
      <span>${maxed ? 'MAX' : p.count + ' / ' + need}</span>
    </div>` : `
    <span class="tile-lock"><span class="icon" data-icon="lock"></span>${card.arena}. Aréna</span>`}`;
  applyIcons(tile);
  drawCardPortrait(tile.querySelector('canvas'), id);

  tile.addEventListener('click', () => {
    if (swapCardId && inDeck) {
      // Put the waiting card in this card's place
      save.deck[save.deck.indexOf(id)] = swapCardId;
      swapCardId = null;
      saveGame();
      renderDeckPage();
      return;
    }
    openCardModal(id);
  });
  return tile;
}

// Card details popup with the animated preview
function openCardModal(id) {
  const card = CARDS[id];
  const p = save.cards[id];
  const rarity = RARITIES[card.rarity];
  const maxed = p.level >= MAX_LEVEL;
  const cost = upgradeCost(p.level);
  const inDeck = save.deck.includes(id);
  const unlocked = isCardUnlocked(id);
  const arena = ARENAS[card.arena - 1];

  // Buttons at the bottom: locked cards only say where to find them
  const actions = !unlocked
    ? `<p class="upgrade-need"><span class="icon" data-icon="lock"></span> Még nem találtad meg. ${arena.id}. Aréna (${arena.name}) vagy későbbi ládákban lehet.</p>`
    : `${maxed ? '' : `<p class="upgrade-need">Fejlesztéshez: ${p.count} / ${cost.cards} kártya, ${cost.gold} arany</p>`}
    <div class="modal-actions">
      <button id="btn-upgrade" class="action-btn" ${canUpgrade(id) ? '' : 'disabled'}>
        ${maxed ? 'Maximális szint' : `Fejlesztés <span class="icon" data-icon="gold"></span> ${cost.gold}`}
      </button>
      ${inDeck ? '<span class="in-deck">A pakliban van</span>' : '<button id="btn-use" class="action-btn use">Pakliba</button>'}
    </div>`;

  const body = document.getElementById('card-modal-body');
  body.innerHTML = `
    <div class="modal-head">
      <h3>${card.name}</h3>
      <span class="rarity-chip" style="background: ${rarity.color}">${rarity.name}</span>
    </div>
    <div class="modal-sub">${unlocked ? p.level + '. szint &middot; ' : ''}<span class="icon" data-icon="feed"></span> ${card.cost} táp &middot; ${arena.id}. Aréna</div>
    <canvas class="preview"></canvas>
    <p class="desc">${card.description}</p>
    <ul class="stats">${statsHtml(card, p.level)}</ul>
    ${actions}`;
  applyIcons(body);
  setPreview(body.querySelector('canvas.preview'), id);
  if (!unlocked) {
    document.getElementById('card-modal').classList.remove('hidden');
    return;
  }

  document.getElementById('btn-upgrade').addEventListener('click', () => {
    upgradeCard(id);
    updateGold();
    renderDeckPage();
    openCardModal(id);   // refresh the numbers
  });
  const useBtn = document.getElementById('btn-use');
  if (useBtn) {
    useBtn.addEventListener('click', () => {
      swapCardId = id;
      closeCardModal();
      renderDeckPage();
    });
  }

  document.getElementById('card-modal').classList.remove('hidden');
}

// Stat lines for the popup (spells and animals show different things)
function statsHtml(card, level) {
  const mult = levelMultiplier(level);
  const line = (label, value) => `<li><span>${label}</span><b>${value}</b></li>`;
  if (card.spell) {
    const sp = card.spell;
    return line('Sebzés', Math.round(sp.damage * mult)) +
      line('Toronyra', Math.round(sp.damage * mult * sp.towerDamage)) +
      line('Terület', sp.radius < 35 ? 'Kicsi' : sp.radius < 50 ? 'Közepes' : 'Nagy') +
      line('Hátralökés', sp.pushback ? 'Igen' : 'Nem') +
      line('Hatás', card.typeLabel) +
      line('Célpont', card.targetLabel);
  }
  const u = card.unit;
  return line('Életerő', Math.round(u.hp * mult)) +
    line('Sebzés', u.damage ? Math.round(u.damage * mult) : '-') +
    line('Sebesség', card.speedLabel) +
    line('Darab', card.count) +
    line('Támadás', card.typeLabel) +
    line('Célpont', card.targetLabel);
}

function closeCardModal() {
  document.getElementById('card-modal').classList.add('hidden');
  setPreview(null);
}

document.getElementById('btn-card-close').addEventListener('click', closeCardModal);
document.getElementById('btn-swap-cancel').addEventListener('click', () => {
  swapCardId = null;
  renderDeckPage();
});
