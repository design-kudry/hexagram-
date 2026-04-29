const LINES = 6;
const COINS_PER_LINE = 3;
const COIN_IMAGE_CANDIDATES = {
  heads: ["орел.png", "heads.png", "head.png", "orel.png", "coin-heads.png", "coin_heads.png"],
  tails: ["решка.png", "tails.png", "tail.png", "reshka.png", "coin-tails.png", "coin_tails.png"],
};

const tossBtn = document.getElementById("tossBtn");
const hexagramEl = document.getElementById("hexagram");
const coinsEl = document.getElementById("coins");
const coinNodes = [...coinsEl.querySelectorAll(".coin")];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let coinAssets = null;

function tryLoadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function resolveCoinAssets() {
  async function firstExisting(names) {
    for (const name of names) {
      const loaded = await tryLoadImage(`./${name}`);
      if (loaded) return loaded;
    }
    return null;
  }

  const [heads, tails] = await Promise.all([
    firstExisting(COIN_IMAGE_CANDIDATES.heads),
    firstExisting(COIN_IMAGE_CANDIDATES.tails),
  ]);
  return heads && tails ? { heads, tails } : null;
}

function tossCoin() {
  // true = орёл (heads), false = решка (tails)
  return Math.random() < 0.5;
}

function makeLine() {
  const coinResults = [];
  let heads = 0;
  let tails = 0;

  for (let i = 0; i < COINS_PER_LINE; i++) {
    const isHeads = tossCoin();
    coinResults.push(isHeads);
    if (isHeads) heads++;
    else tails++;
  }

  // Для 3 монет всегда есть большинство (ничьей не будет):
  // больше орлов → цельная черта, больше решек → разорванная черта.
  const solid = heads > tails;

  return {
    heads,
    tails,
    coinResults,
    solid,
    segments: solid ? 1 : 2,
  };
}

function renderCoins(coinResults) {
  coinNodes.forEach((coin, idx) => {
    const isHeads = coinResults[idx];
    coin.dataset.state = isHeads ? "heads" : "tails";
    const marker = coin.querySelector("span");
    marker.textContent = isHeads ? "О" : "Р";

    if (coinAssets) {
      coin.classList.add("has-image");
      coin.style.backgroundImage = `url("${isHeads ? coinAssets.heads : coinAssets.tails}")`;
    } else {
      coin.classList.remove("has-image");
      coin.style.backgroundImage = "none";
    }
  });
}

async function animateCoins() {
  tossBtn.disabled = true;
  coinNodes.forEach((coin) => coin.classList.add("spinning"));
  await delay(900);

  const line = makeLine();
  coinNodes.forEach((coin) => coin.classList.remove("spinning"));
  renderCoins(line.coinResults);
  tossBtn.disabled = false;
  return line;
}

function renderHexagram(lines) {
  hexagramEl.innerHTML = "";

  // Стандартная нотация гексаграмм: 1-я линия снизу.
  for (let i = LINES - 1; i >= 0; i--) {
    const line = lines[i];

    const lineEl = document.createElement("div");
    lineEl.className = "line";

    if (!line) {
      lineEl.classList.add("empty");
      hexagramEl.appendChild(lineEl);
      continue;
    }

    if (line.solid) {
      const solidEl = document.createElement("div");
      solidEl.className = "solid";
      lineEl.appendChild(solidEl);
    } else {
      const brokenEl = document.createElement("div");
      brokenEl.className = "broken";

      const left = document.createElement("div");
      left.className = "segment";

      const right = document.createElement("div");
      right.className = "segment";

      brokenEl.appendChild(left);
      brokenEl.appendChild(right);
      lineEl.appendChild(brokenEl);
    }

    hexagramEl.appendChild(lineEl);
  }
}

let lines = [];

function reset() {
  lines = [];
  tossBtn.textContent = "Подкинуть";
  tossBtn.disabled = false;
  renderCoins([true, true, true]);
  renderHexagram(lines);
}

async function runToss() {
  // Каждое нажатие добавляет 1 линию (3 монеты по правилу большинства).
  if (lines.length >= LINES) return;

  const newLine = await animateCoins();
  lines.push(newLine);
  renderHexagram(lines);

  if (lines.length === LINES) tossBtn.textContent = "Сбросить";
}

tossBtn.addEventListener("click", async () => {
  if (tossBtn.disabled) return;
  if (tossBtn.textContent === "Сбросить") reset();
  else await runToss();
});

// Начальная отрисовка, чтобы было что смотреть сразу.
(async function init() {
  coinAssets = await resolveCoinAssets();
  reset();
})();

