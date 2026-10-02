// Shop page ("Bolt"): card bundles and card chests you can buy with gold.
// There are 6 offers and they change every hour (by the real clock):
//   - 3 offers are cards from your current deck
//   - 3 offers are other random cards
// You can also pay gold to roll new offers right away ("Frissítés"):
//   the first refresh in an hour costs 5 gold, then 10, 20, 40... (doubles every time).
// The current offers are kept in the save, so they survive a page reload:
//   save.shop = { hour, offers: [{ id, amount, price, bought }], refreshes }
// Below the offers there are 3 card chests (small, medium, large) that can be bought
// any time, as many times as you like. They open instantly and contain only cards.

// What one bundle contains and costs, by card rarity
const SHOP_BUNDLES = {
  common: { amount: 8, price: 16 },   // 8 cards for 16 gold
  rare:   { amount: 5, price: 20 },   // 5 cards for 20 gold
  epic:   { amount: 2, price: 30 },   // 2 cards for 30 gold
};

const SHOP_ROTATION_MS = 60 * 60 * 1000;   // new offers every hour
const SHOP_DECK_OFFERS = 3;                 // how many offers come from your deck
const SHOP_OTHER_OFFERS = 3;                // how many offers come from all the other cards
const SHOP_REFRESH_BASE_PRICE = 5;          // first refresh costs 5 gold, every next one costs double

// Price of the card chests (same card amounts as the chests in save.js -> CHESTS, but no gold inside).
//
// Why these prices? Buying cards from the offers above costs per card:
//   common 16 / 8 = 2 gold, rare 20 / 5 = 4 gold, epic 30 / 2 = 15 gold.
// A chest picks its cards with randomCardByRarity(): every card has a weight
// (common 4, rare 3, epic 2). With the Farm arena cards (5 common, 7 rare, 3 epic)
// that is about 43% common, 45% rare and 13% epic, so one chest card would cost
// about 4.5 gold if you bought it from the offers (about 4.0 gold once the Erdő cards join).
//   small:   24 cards -> worth ~97-109 gold in offers,  costs  45 gold = 1.9 gold/card
//   medium:  52 cards -> worth ~210-237 gold in offers, costs  90 gold = 1.7 gold/card
//   large:  120 cards -> worth ~484-546 gold in offers, costs 190 gold = 1.6 gold/card
// So a chest is less than half the price of the same cards from the offers
// (you can't choose the cards, that is the trade-off), and a bigger chest is a slightly better deal.
const SHOP_CHEST_PRICES = {
  small:  45,
  medium: 90,
  large:  190,
};

// ---------- Time ----------

// Number of the current one-hour rotation (it grows by 1 every hour)
function currentShopHour() {
  return Math.floor(Date.now() / SHOP_ROTATION_MS);
}

// Milliseconds left until the next rotation starts
function timeUntilNextShop() {
  return (currentShopHour() + 1) * SHOP_ROTATION_MS - Date.now();
}

// Turns milliseconds into "mm:ss", for example 23:41
function formatShopTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

// ---------- Offers ----------

// One offer for a card: the bundle size and price depend on its rarity
function createShopOffer(id) {
  const bundle = SHOP_BUNDLES[CARDS[id].rarity];
  return { id: id, amount: bundle.amount, price: bundle.price, bought: false };
}

// Picks the 6 new offers: 3 different cards from the deck, then 3 different other cards
function rollShopOffers() {
  // Deck cards (each only once, and only cards that still exist in the game)
  const deckIds = save.deck.filter((id, i) => CARDS[id] && save.deck.indexOf(id) === i);
  // shuffle() comes from battle.js and mixes the list in place, so we give it a copy
  const fromDeck = shuffle(deckIds.slice()).slice(0, SHOP_DECK_OFFERS);

  // Any other card that is not offered yet
  const otherIds = Object.keys(CARDS).filter(id => !fromDeck.includes(id) && isCardUnlocked(id));   // only cards you already found
  const fromOthers = shuffle(otherIds).slice(0, SHOP_OTHER_OFFERS);

  return fromDeck.concat(fromOthers).map(createShopOffer);
}

// Makes sure save.shop holds the offers of the current hour.
// If it is missing, broken or from an older hour, new offers are rolled and saved
// (and the refresh price goes back to 5 gold).
function ensureShopRotation() {
  const hour = currentShopHour();
  const shop = save.shop;
  const upToDate = shop
    && shop.hour === hour
    && Array.isArray(shop.offers)
    && shop.offers.length > 0
    && shop.offers.every(offer => offer && CARDS[offer.id]);
  if (upToDate) return;

  save.shop = { hour: hour, offers: rollShopOffers(), refreshes: 0 };
  saveGame();
}

// Buys one offer: pay the gold, get the cards, mark it as bought
function buyShopOffer(index) {
  // The hour may have just changed: show the new offers instead of buying an old one
  if (!save.shop || save.shop.hour !== currentShopHour()) {
    renderShop();
    return;
  }
  const offer = save.shop.offers[index];
  if (!offer || offer.bought) return;         // already bought in this rotation
  if (save.gold < offer.price) return;        // not enough gold

  save.gold -= offer.price;
  save.cards[offer.id].count += offer.amount;
  offer.bought = true;
  saveGame();
  updateGold();    // refresh the gold number in the top bar (ui.js)
  renderShop();
}

// ---------- Paid refresh ----------

// What the next refresh costs: 5, 10, 20, 40... gold (doubles after every refresh this hour)
function shopRefreshPrice() {
  const done = (save.shop && save.shop.refreshes) || 0;   // older saves have no "refreshes" yet
  return SHOP_REFRESH_BASE_PRICE * Math.pow(2, done);
}

// Pays gold and rolls 6 new offers right now (the hourly timer does not change)
function refreshShopOffers() {
  // The hour may have just changed: then the new offers are free, just show them
  if (!save.shop || save.shop.hour !== currentShopHour()) {
    renderShop();
    return;
  }
  const price = shopRefreshPrice();
  if (save.gold < price) return;              // not enough gold

  save.gold -= price;
  save.shop.offers = rollShopOffers();         // same rules as the hourly rotation
  save.shop.refreshes = (save.shop.refreshes || 0) + 1;
  saveGame();
  updateGold();
  renderShop();
}

// ---------- Card chests ----------

// Buys a card chest and opens it right away.
// type: 'small', 'medium' or 'large' (the keys of CHESTS in save.js)
function buyShopChest(type) {
  const price = SHOP_CHEST_PRICES[type];
  if (save.gold < price) return;              // not enough gold

  const def = CHESTS[type];
  const arena = highestArena();               // cards come from every arena you have reached
  const cards = {};                           // id -> how many cards of it
  const newCards = [];                        // cards found for the very first time

  // Same draws as a victory chest (openChest in save.js): e.g. 3 draws x 8 cards = 24 cards
  const perDraw = Math.round(def.cards / def.draws);
  for (let i = 0; i < def.draws; i++) {
    const id = randomCardByRarity(arena);
    cards[id] = (cards[id] || 0) + perDraw;
  }

  // Add the cards to the collection
  for (const id in cards) {
    const card = save.cards[id];
    if (!card.unlocked) {
      card.unlocked = true;
      newCards.push(id);
    }
    card.count += cards[id];
  }

  save.gold -= price;
  saveGame();
  updateGold();

  // The chest-opening popup from ui.js (this chest has no gold inside)
  showChestRewards({ chest: { type: type, arena: arena }, gold: 0, cards: cards, newCards: newCards });
  renderShop();   // update the buttons (maybe you can't afford some things any more)
}

// ---------- Page ----------

// One offer tile: portrait, name, "+N kártya", deck marker and the buy button
function createShopTile(offer, index) {
  const card = CARDS[offer.id];
  const inDeck = save.deck.includes(offer.id);
  const canAfford = save.gold >= offer.price;
  const dpr = window.devicePixelRatio || 1;
  const size = Math.round(64 * dpr);   // sharp drawing on high-resolution screens

  // Text inside the buy button
  let buttonHtml;
  if (offer.bought) {
    buttonHtml = `<button class="action-btn shop-buy is-bought" disabled>Megvéve</button>`;
  } else {
    buttonHtml = `
      <button class="action-btn shop-buy" ${canAfford ? '' : 'disabled title="Nincs elég aranyad"'}>
        <span class="icon" data-icon="gold"></span> ${offer.price}
      </button>`;
  }

  const tile = document.createElement('div');
  tile.className = 'card-tile shop-offer' + (offer.bought ? ' bought' : '');
  tile.style.borderColor = RARITIES[card.rarity].color;
  tile.innerHTML = `
    ${inDeck ? '<span class="shop-in-deck">A paklidban</span>' : ''}
    <canvas width="${size}" height="${size}"></canvas>
    <span class="tile-name">${card.name}</span>
    <span class="shop-amount">+${offer.amount} kártya</span>
    ${buttonHtml}`;
  drawCardPortrait(tile.querySelector('canvas'), offer.id);

  tile.querySelector('.shop-buy').addEventListener('click', () => buyShopOffer(index));
  return tile;
}

// One chest tile: chest picture, name, "~N kártya" and the buy button
function createShopChestTile(type) {
  const price = SHOP_CHEST_PRICES[type];
  const canAfford = save.gold >= price;

  const tile = document.createElement('div');
  tile.className = 'card-tile shop-chest';
  tile.innerHTML = `
    <span class="icon shop-chest-icon" data-icon="chest_${type}"></span>
    <span class="shop-chest-name">${chestName({ type: type, arena: highestArena() })}</span>
    <span class="shop-amount">~${CHESTS[type].cards} kártya</span>
    <button class="action-btn shop-buy" ${canAfford ? '' : 'disabled title="Nincs elég aranyad"'}>
      <span class="icon" data-icon="gold"></span> ${price}
    </button>`;

  tile.querySelector('.shop-buy').addEventListener('click', () => buyShopChest(type));
  return tile;
}

// Entry point: draws the whole shop into <div id="shop-page">
function renderShop() {
  const root = document.getElementById('shop-page');
  if (!root) return;
  ensureShopRotation();

  const refreshPrice = shopRefreshPrice();
  const canRefresh = save.gold >= refreshPrice;

  root.innerHTML = `
    <h2 class="page-title">Bolt</h2>
    <div class="shop-timer-row">
      <p class="shop-timer">Új ajánlatok: <b id="shop-countdown">${formatShopTime(timeUntilNextShop())}</b></p>
      <button class="action-btn shop-refresh" ${canRefresh ? '' : 'disabled title="Nincs elég aranyad"'}>
        Frissítés <span class="icon" data-icon="gold"></span> ${refreshPrice}
      </button>
    </div>
    <div class="card-grid shop-grid"></div>

    <h3 class="chest-title">Kártyaládák</h3>
    <p class="shop-chest-hint">Azonnal kinyílnak, csak kártyák vannak bennük.</p>
    <div class="card-grid shop-chest-grid"></div>`;

  root.querySelector('.shop-refresh').addEventListener('click', refreshShopOffers);

  const grid = root.querySelector('.shop-grid');
  save.shop.offers.forEach((offer, index) => grid.appendChild(createShopTile(offer, index)));

  const chestGrid = root.querySelector('.shop-chest-grid');
  Object.keys(SHOP_CHEST_PRICES).forEach(type => chestGrid.appendChild(createShopChestTile(type)));

  applyIcons(root);   // put the SVG icons (gold coin, chests) into the page
}

// Every second: count down the timer, but only while the shop tab is open.
// When a new hour starts, the whole shop is redrawn with the new offers.
function tickShop() {
  const page = document.getElementById('page-shop');
  if (!page || !page.classList.contains('active')) return;

  if (!save.shop || save.shop.hour !== currentShopHour()) {
    renderShop();
    return;
  }
  const countdown = document.getElementById('shop-countdown');
  if (countdown) countdown.textContent = formatShopTime(timeUntilNextShop());
}

setInterval(tickShop, 1000);
