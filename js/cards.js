// Card rarities: rarer cards drop less often from chests
const RARITIES = {
  common: { name: 'Gyakori', color: '#6fa8dc', weight: 4 },
  rare:   { name: 'Ritka',   color: '#f0a030', weight: 3 },
  epic:   { name: 'Epikus',  color: '#a55ee0', weight: 2.5 },
};

// All cards in the game. "unit" holds the stats of ONE spawned animal (at level 1).
// arena: the card can only be found in chests from this arena or later.
// Spells have "spell" instead of "unit": radius, damage, towerDamage (multiplier vs towers),
// delay (seconds until it lands), pushback (pixels), slow: { amount, duration }
// targets: 'ground', 'both' (ground + air) or 'buildings' (towers + buildings only)
// airMultiplier: damage multiplier against flying targets
// projectile: null = melee, otherwise the thing it throws
// flying: air unit (ignores the river, only 'both' targeters can hit it)
// kamikaze: dies on its first hit; poison: { dps, duration } added on hit
// building: stands still; lifetime = seconds until its health runs out
// spawnOnDeath: how many "spawns" animals come out when it is destroyed
// chargeAfter: seconds of walking before it charges (double speed, next hit double damage)
// hpBarY: how high above the feet the health bar sits (default 24 * drawScale)
// bird: it is a bird (foxes bite birds harder); bonusVsBirds: damage multiplier against birds
// splashRadius: every hit also damages enemy ground units this close to the target
// jumpsRiver: doesn't need a bridge; guard: only fights on its own side, wanders otherwise
// lifetime (non-building): leaves the field after this many seconds
// leap: { minDist, maxDist, damage, cooldown } jumps at far targets, cone damage + pushback on landing
// jumpAttack: every attack is a jump, the damage lands when it comes down
// produce: { every, amount } gives feed to its owner; deathFeed: feed given when it is destroyed
const CARDS = {
  chickens: {
    id: 'chickens',
    rarity: 'common',
    arena: 1,
    name: 'Csirkék',
    cost: 3,
    count: 3,
    description: 'Három kicsi, fürge csirke. Rohannak, és mindent megcsipkednek, ami az útjukba kerül.',
    speedLabel: 'Nagyon gyors',
    typeLabel: 'Közelharc',
    targetLabel: 'Földi',
    unit: {
      draw: 'chicken', drawScale: 1,
      hp: 110, damage: 35, attackRate: 0.7,
      speed: 75, range: 6, radius: 7, sight: 110,
      targets: 'ground', airMultiplier: 1, projectile: null,
      bird: true,
    },
  },

  hen: {
    id: 'hen',
    rarity: 'common',
    arena: 1,
    name: 'Tyúk',
    cost: 3,
    count: 1,
    description: 'Messziről dobálja a tojásait, a földön járókat és a repülőket is eltalálja.',
    speedLabel: 'Közepes',
    typeLabel: 'Távolsági (tojás)',
    targetLabel: 'Földi és légi',
    unit: {
      draw: 'hen', drawScale: 1.2,
      hp: 300, damage: 60, attackRate: 1.1,
      speed: 50, range: 95, radius: 8, sight: 150,
      targets: 'both', airMultiplier: 1, projectile: 'egg',
      bird: true,
    },
  },

  rooster: {
    id: 'rooster',
    rarity: 'epic',
    arena: 1,
    name: 'Kakas',
    cost: 4,
    count: 1,
    description: 'Nagyot csíp! Ha kell, felröppen, és a repülőket is megcsipkedi, de csak fele akkora erővel.',
    speedLabel: 'Közepes',
    typeLabel: 'Közelharc',
    targetLabel: 'Földi (légi: 50%)',
    unit: {
      draw: 'rooster', drawScale: 1.35,
      hp: 480, damage: 130, attackRate: 1.4,
      speed: 55, range: 8, radius: 9, sight: 120,
      targets: 'both', airMultiplier: 0.5, projectile: null,
      bird: true,
    },
  },

  bees: {
    id: 'bees',
    rarity: 'common',
    arena: 1,
    name: 'Méhek',
    cost: 4,
    count: 6,
    description: 'Hat apró, gyors méh. Rárepülnek a célra, megcsípik és megmérgezik, de a csípés után elpusztulnak.',
    speedLabel: 'Nagyon gyors',
    typeLabel: 'Csípés + méreg (5 mp)',
    targetLabel: 'Földi és légi',
    unit: {
      draw: 'bee', drawScale: 1,
      hp: 30, damage: 25, attackRate: 0.5,
      speed: 90, range: 3, radius: 4, sight: 130,
      targets: 'both', airMultiplier: 1, projectile: null,
      flying: true, kamikaze: true,
      poison: { dps: 4, duration: 5 },
    },
  },

  beehive: {
    id: 'beehive',
    rarity: 'rare',
    arena: 1,
    name: 'Méhkaptár',
    cost: 3,
    count: 1,
    description: 'Épület. 40 másodpercig 4 másodpercenként kienged egy méhet, közben az életereje lassan elfogy. Ha elpusztul, 2 méh repül ki belőle.',
    speedLabel: 'Nem mozog',
    typeLabel: 'Épület, méheket enged ki',
    targetLabel: '-',
    unit: {
      draw: 'hive', drawScale: 1.3,
      hp: 450, damage: 0, attackRate: 0,
      speed: 0, range: 0, radius: 12, sight: 0,
      targets: 'none', airMultiplier: 1, projectile: null,
      building: true, lifetime: 40,
      spawns: 'bees', spawnEvery: 4, spawnOnDeath: 2,
    },
  },

  cow: {
    id: 'cow',
    rarity: 'rare',
    arena: 1,
    name: 'Tehén',
    cost: 4,
    count: 1,
    description: 'Hatalmas és szívós. Nem törődik az állatokkal, egyenesen az épületekre megy, és lefejeli őket.',
    speedLabel: 'Lassú',
    typeLabel: 'Közelharc (fejelés)',
    targetLabel: 'Csak épületek',
    unit: {
      draw: 'cow', drawScale: 1.2, hpBarY: 36,
      hp: 1200, damage: 80, attackRate: 1.5,
      speed: 35, range: 8, radius: 13, sight: 0,
      targets: 'buildings', airMultiplier: 1, projectile: null,
    },
  },

  bull: {
    id: 'bull',
    rarity: 'epic',
    arena: 1,
    name: 'Bika',
    cost: 5,
    count: 1,
    description: 'Ha egy ideig fut, rohamra indul: kétszer olyan gyors lesz, és az első öklelése dupla sebzést okoz. A repülőket nem éri el.',
    speedLabel: 'Közepes (roham: nagyon gyors)',
    typeLabel: 'Közelharc + roham',
    targetLabel: 'Földi',
    unit: {
      draw: 'bull', drawScale: 1.2, hpBarY: 40,
      hp: 1000, damage: 150, attackRate: 1.5,
      speed: 45, range: 8, radius: 13, sight: 130,
      targets: 'ground', airMultiplier: 1, projectile: null,
      chargeAfter: 1.5,
    },
  },

  piglet: {
    id: 'piglet',
    rarity: 'common',
    arena: 1,
    name: 'Malac',
    cost: 2,
    count: 1,
    description: 'Kicsi, fürge malac. Gyorsan rohan, és szapora harapásokkal támad, de nem bírja sokáig.',
    speedLabel: 'Gyors',
    typeLabel: 'Közelharc (gyors ütés)',
    targetLabel: 'Földi',
    unit: {
      draw: 'piglet', drawScale: 0.9, hpBarY: 28,
      hp: 220, damage: 30, attackRate: 0.6,
      speed: 70, range: 6, radius: 9, sight: 110,
      targets: 'ground', airMultiplier: 1, projectile: null,
    },
  },

  mangalica: {
    id: 'mangalica',
    rarity: 'rare',
    arena: 1,
    name: 'Mangalica',
    cost: 4,
    count: 1,
    description: 'A göndör szőrű magyar disznó. Ugyanolyan fürge, mint a malac, de erősebb és szívósabb.',
    speedLabel: 'Gyors',
    typeLabel: 'Közelharc (gyors ütés)',
    targetLabel: 'Földi',
    unit: {
      draw: 'mangalica', drawScale: 1.1, hpBarY: 33,
      hp: 560, damage: 65, attackRate: 0.6,
      speed: 70, range: 6, radius: 11, sight: 120,
      targets: 'ground', airMultiplier: 1, projectile: null,
    },
  },

  goose: {
    id: 'goose',
    rarity: 'rare',
    arena: 1,
    name: 'Liba',
    cost: 4,
    count: 1,
    description: 'Lassan repülő liba, amely a magasból hatalmas tojásokat hajít. Nagyot sebez, de hamar kidől.',
    speedLabel: 'Lassú',
    typeLabel: 'Távolsági (tojás), repül',
    targetLabel: 'Földi és légi',
    unit: {
      draw: 'goose', drawScale: 1.2, hpBarY: 52,
      hp: 260, damage: 110, attackRate: 1.6,
      speed: 35, range: 90, radius: 9, sight: 140,
      targets: 'both', airMultiplier: 1, projectile: 'egg',
      flying: true, bird: true,
    },
  },

  fox: {
    id: 'fox',
    rarity: 'common',
    arena: 1,
    name: 'Róka',
    cost: 3,
    count: 1,
    description: 'Fürge, ravasz róka. A madarakba 35%-kal nagyobbat harap, de nem bírja sokáig.',
    speedLabel: 'Gyors',
    typeLabel: 'Közelharc (+35% madarakra)',
    targetLabel: 'Földi',
    unit: {
      draw: 'fox', drawScale: 1, hpBarY: 31,
      hp: 260, damage: 45, attackRate: 0.8,
      speed: 75, range: 6, radius: 9, sight: 120,
      targets: 'ground', airMultiplier: 1, projectile: null,
      bonusVsBirds: 1.35,
    },
  },

  rabbit: {
    id: 'rabbit',
    rarity: 'common',
    arena: 1,
    name: 'Nyúl',
    cost: 2,
    count: 1,
    description: 'Nagyokat ugrál. Rá is ugrik a célpontjára, és landoláskor a körülötte állókat is megsebzi. Kevés az életereje.',
    speedLabel: 'Közepes',
    typeLabel: 'Ugrásos területi sebzés',
    targetLabel: 'Földi',
    unit: {
      draw: 'rabbit', drawScale: 0.9, hpBarY: 32,
      hp: 190, damage: 70, attackRate: 1.8,
      speed: 60, range: 6, radius: 8, sight: 110,
      targets: 'ground', airMultiplier: 1, projectile: null,
      splashRadius: 28, jumpAttack: true,
    },
  },

  horse: {
    id: 'horse',
    rarity: 'epic',
    arena: 1,
    name: 'Ló',
    cost: 7,
    count: 1,
    description: 'Gyors és rendkívül szívós. Átugratja a folyót, és egyenesen az épületekre vágtat.',
    speedLabel: 'Gyors',
    typeLabel: 'Közelharc (rúgás)',
    targetLabel: 'Csak épületek',
    unit: {
      draw: 'horse', drawScale: 1.3, hpBarY: 46,
      hp: 2400, damage: 120, attackRate: 1.4,
      speed: 65, range: 8, radius: 14, sight: 0,
      targets: 'buildings', airMultiplier: 1, projectile: null,
      jumpsRiver: true,
    },
  },

  dog: {
    id: 'dog',
    rarity: 'rare',
    arena: 1,
    name: 'Őrkutya',
    cost: 4,
    count: 1,
    description: 'Hűséges házőrző. 40 másodpercig járőrözik a saját térfeleden, és elkergeti a betolakodókat.',
    speedLabel: 'Gyors',
    typeLabel: 'Védekező, közelharc',
    targetLabel: 'Földi (saját térfél)',
    unit: {
      draw: 'dog', drawScale: 1, hpBarY: 28,
      hp: 420, damage: 40, attackRate: 0.7,
      speed: 70, range: 6, radius: 9, sight: 150,
      targets: 'ground', airMultiplier: 1, projectile: null,
      guard: true, lifetime: 40,
    },
  },

  goat: {
    id: 'goat',
    rarity: 'rare',
    arena: 1,
    name: 'Kecske',
    cost: 3,
    count: 1,
    description: 'Ha messze van a célpontja, nagyot ugrik felé: landoláskor maga előtt mindenkit megsebez és hátralök. Utána rendesen öklel.',
    speedLabel: 'Közepes',
    typeLabel: 'Közelharc + ugrás',
    targetLabel: 'Földi',
    unit: {
      draw: 'goat', drawScale: 1, hpBarY: 32,
      hp: 450, damage: 55, attackRate: 1.0,
      speed: 55, range: 7, radius: 10, sight: 130,
      targets: 'ground', airMultiplier: 1, projectile: null,
      leap: { minDist: 70, maxDist: 140, damage: 90, cooldown: 3 },
    },
  },

  cornRain: {
    id: 'cornRain',
    rarity: 'common',
    arena: 1,
    name: 'Kukoricaeső',
    cost: 3,
    count: 0,
    description: 'Kukoricaszemek záporoznak egy nagy területre. Kevés sebzés, de a csirkéket, méheket és más apró rajokat eltakarítja.',
    speedLabel: '-',
    typeLabel: 'Varázslat (nagy terület)',
    targetLabel: 'Földi és légi',
    spell: { kind: 'cornRain', radius: 60, damage: 115, towerDamage: 0.4, delay: 0.7, pushback: 0 },
  },

  hayBale: {
    id: 'hayBale',
    rarity: 'rare',
    arena: 1,
    name: 'Szalmabála',
    cost: 4,
    count: 0,
    description: 'Egy hatalmas szalmabála zuhan az égből egy kis területre. A legtöbb közepes állatot kiüti vagy nagyon megsebzi, és hátralöki őket.',
    speedLabel: '-',
    typeLabel: 'Varázslat (kis terület) + hátralökés',
    targetLabel: 'Földi és légi',
    spell: { kind: 'hayBale', radius: 30, damage: 380, towerDamage: 0.35, delay: 0.8, pushback: 28 },
  },

  mudBall: {
    id: 'mudBall',
    rarity: 'common',
    arena: 1,
    name: 'Sárgolyó',
    cost: 3,
    count: 0,
    description: 'Egy nagy sárgolyó csapódik be: megsebzi és hátralöki az ellenfeleket, és 5 másodpercre a felére lassítja őket.',
    speedLabel: '-',
    typeLabel: 'Varázslat + lassítás (50%, 5 mp)',
    targetLabel: 'Földi és légi',
    spell: { kind: 'mudBall', radius: 42, damage: 90, towerDamage: 0.4, delay: 0.8, pushback: 16, slow: { amount: 0.5, duration: 5 } },
  },

  wheatField: {
    id: 'wheatField',
    rarity: 'rare',
    arena: 1,
    name: 'Búzaföld',
    cost: 5,
    count: 1,
    description: 'Épület. 18 másodpercig 3 másodpercenként 1 tápot termel neked, és ha elpusztul, még 0,5 tápot ad. Összesen 6,5 tápot hozhat vissza.',
    speedLabel: 'Nem mozog',
    typeLabel: 'Épület, tápot termel',
    targetLabel: '-',
    unit: {
      draw: 'wheatfield', drawScale: 1.1, hpBarY: 26,
      hp: 520, damage: 0, attackRate: 0,
      speed: 0, range: 0, radius: 14, sight: 0,
      targets: 'none', airMultiplier: 1, projectile: null,
      building: true, lifetime: 18.2,
      produce: { every: 3, amount: 1 }, deathFeed: 0.5,
    },
  },
};
