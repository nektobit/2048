import { effect } from "./signals.js";
import { BOARD_SIZE } from "./engine.js";
import { createGameStore } from "./store.js";

const store = createGameStore();

const scoreEl = document.querySelector("#score");
const bestScoreEl = document.querySelector("#best-score");
const boardEl = document.querySelector("#board");
const gridBgEl = document.querySelector("#grid-background");
const tileLayerEl = document.querySelector("#tile-layer");
const overlayEl = document.querySelector("#overlay");
const overlayTitleEl = document.querySelector("#overlay-title");
const newGameBtn = document.querySelector("#new-game");
const retryBtn = document.querySelector("#retry");
const keepGoingBtn = document.querySelector("#keep-going");

const renderedTiles = new Map();

createGridBackground();
bindControls();

effect(() => {
  scoreEl.textContent = String(store.score());
});

effect(() => {
  bestScoreEl.textContent = String(store.bestScore());
});

effect(() => {
  renderTiles(store.board());
});

effect(() => {
  const status = store.gameStatus();
  if (status === "won") {
    overlayTitleEl.textContent = "You Win";
    keepGoingBtn.classList.remove("hidden");
    overlayEl.classList.remove("hidden");
  } else if (status === "over") {
    overlayTitleEl.textContent = "Game Over";
    keepGoingBtn.classList.add("hidden");
    overlayEl.classList.remove("hidden");
  } else {
    overlayEl.classList.add("hidden");
  }
});

function createGridBackground() {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      cell.style.setProperty("--row", String(row));
      cell.style.setProperty("--col", String(col));
      gridBgEl.appendChild(cell);
    }
  }
}

function renderTiles(board) {
  const nextKeys = new Set();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const value = board[row][col];
      if (!value) continue;

      const key = `${row},${col}`;
      nextKeys.add(key);
      const existing = renderedTiles.get(key);
      if (existing) {
        updateTile(existing, value, row, col);
        continue;
      }

      const tile = document.createElement("div");
      tile.className = `tile tile-${Math.min(value, 4096)} tile-pop`;
      tile.innerHTML = `<span>${value}</span>`;
      positionTile(tile, row, col);
      tileLayerEl.appendChild(tile);
      renderedTiles.set(key, tile);

      requestAnimationFrame(() => tile.classList.remove("tile-pop"));
    }
  }

  for (const [key, element] of renderedTiles.entries()) {
    if (!nextKeys.has(key)) {
      element.remove();
      renderedTiles.delete(key);
    }
  }
}

function updateTile(tile, value, row, col) {
  const expected = `tile tile-${Math.min(value, 4096)}`;
  if (tile.className !== expected) tile.className = expected;
  const valueLabel = tile.firstElementChild;
  if (valueLabel && valueLabel.textContent !== String(value)) {
    valueLabel.textContent = String(value);
  }
  positionTile(tile, row, col);
}

function positionTile(tile, row, col) {
  tile.style.setProperty("--row", String(row));
  tile.style.setProperty("--col", String(col));
}

function bindControls() {
  const keyMap = {
    ArrowUp: "up",
    ArrowRight: "right",
    ArrowDown: "down",
    ArrowLeft: "left"
  };

  document.addEventListener("keydown", (event) => {
    const direction = keyMap[event.key];
    if (!direction) return;

    const modifiers = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    if (modifiers) return;

    event.preventDefault();
    store.move(direction);
  });

  newGameBtn.addEventListener("click", () => store.newGame());
  retryBtn.addEventListener("click", () => store.newGame());
  keepGoingBtn.addEventListener("click", () => store.keepPlaying());

  let startX = 0;
  let startY = 0;

  boardEl.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      event.preventDefault();
    },
    { passive: false }
  );

  boardEl.addEventListener(
    "touchmove",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  boardEl.addEventListener(
    "touchend",
    (event) => {
      if (!event.changedTouches.length) return;
      const endX = event.changedTouches[0].clientX;
      const endY = event.changedTouches[0].clientY;
      const dx = endX - startX;
      const dy = endY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (Math.max(absX, absY) <= 10) return;

      const direction = absX > absY ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      store.move(direction);
      event.preventDefault();
    },
    { passive: false }
  );
}
