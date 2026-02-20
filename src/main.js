import { effect } from "./signals.js";
import { BOARD_SIZE, cloneBoard } from "./engine.js";
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

const MOVE_MS = 150;
let nextTileId = 1;
let tiles = [];
let removeTimers = [];

createGridBackground();
bindControls();

effect(() => {
  scoreEl.textContent = String(store.score());
});

effect(() => {
  bestScoreEl.textContent = String(store.bestScore());
});

effect(() => {
  renderTiles(store.board(), store.lastMoveMeta());
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

function renderTiles(board, moveMeta) {
  clearRemovalTimers();

  if (!tiles.length || !moveMeta?.direction || !moveMeta?.previousBoard) {
    hardRender(board);
    return;
  }

  const movementTarget = cloneBoard(board);
  if (moveMeta.spawned) {
    movementTarget[moveMeta.spawned.row][moveMeta.spawned.col] = 0;
  }

  const tileByCoord = new Map(tiles.map((tile) => [coordKey(tile.row, tile.col), tile]));
  const consumed = new Set();
  const survivors = [];
  const merges = [];

  for (let index = 0; index < BOARD_SIZE; index += 1) {
    const coords = getLineCoords(moveMeta.direction, index);
    const source = coords
      .map((cell) => ({ ...cell, value: moveMeta.previousBoard[cell.row][cell.col] }))
      .filter((cell) => cell.value);

    const groups = [];
    for (const cell of source) {
      const last = groups[groups.length - 1];
      if (last && last.value === cell.value && !last.merged) {
        last.value *= 2;
        last.from.push(cell);
        last.merged = true;
      } else {
        groups.push({ value: cell.value, from: [cell], merged: false });
      }
    }

    for (let i = 0; i < groups.length; i += 1) {
      const group = groups[i];
      const destination = coords[i];
      const destinationValue = movementTarget[destination.row][destination.col];
      if (!destinationValue) continue;

      const firstCell = group.from[0];
      const firstTile = tileByCoord.get(coordKey(firstCell.row, firstCell.col));
      if (!firstTile) continue;

      consumed.add(firstTile.id);
      moveTile(firstTile, destination.row, destination.col);

      if (group.from.length === 2) {
        const secondCell = group.from[1];
        const secondTile = tileByCoord.get(coordKey(secondCell.row, secondCell.col));
        if (secondTile) {
          consumed.add(secondTile.id);
          moveTile(secondTile, destination.row, destination.col);
          secondTile.el.classList.add("tile-merge-fade");
          merges.push({ primary: firstTile, secondary: secondTile, value: group.value });
        }
        survivors.push({ ...firstTile, value: group.value, row: destination.row, col: destination.col });
      } else {
        setTileValue(firstTile, destinationValue);
        survivors.push({ ...firstTile, value: destinationValue, row: destination.row, col: destination.col });
      }
    }
  }

  for (const tile of tiles) {
    if (consumed.has(tile.id)) continue;
    tile.el.remove();
  }

  tiles = survivors;

  for (const merge of merges) {
    const timer = setTimeout(() => {
      merge.secondary.el.remove();
      setTileValue(merge.primary, merge.value);
      merge.primary.el.classList.add("tile-pop");
      requestAnimationFrame(() => merge.primary.el.classList.remove("tile-pop"));
    }, MOVE_MS);
    removeTimers.push(timer);
  }

  if (moveMeta.spawned) {
    const created = createTile(
      moveMeta.spawned.row,
      moveMeta.spawned.col,
      moveMeta.spawned.value,
      true
    );
    tiles.push(created);
  }
}

function hardRender(board) {
  clearRemovalTimers();
  tiles.forEach((tile) => tile.el.remove());
  tiles = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (!board[row][col]) continue;
      tiles.push(createTile(row, col, board[row][col], false));
    }
  }
}

function createTile(row, col, value, pop) {
  const el = document.createElement("div");
  el.className = `tile tile-${Math.min(value, 4096)}${pop ? " tile-pop" : ""}`;
  el.innerHTML = `<span>${value}</span>`;
  setPosition(el, row, col);
  tileLayerEl.appendChild(el);

  if (pop) {
    requestAnimationFrame(() => el.classList.remove("tile-pop"));
  }

  return { id: nextTileId++, row, col, value, el };
}

function moveTile(tile, row, col) {
  tile.row = row;
  tile.col = col;
  setPosition(tile.el, row, col);
}

function setTileValue(tile, value) {
  tile.value = value;
  const className = `tile tile-${Math.min(value, 4096)}`;
  tile.el.className = className;
  const text = tile.el.firstElementChild;
  if (text) text.textContent = String(value);
}

function setPosition(tileEl, row, col) {
  tileEl.style.setProperty("--row", String(row));
  tileEl.style.setProperty("--col", String(col));
}

function coordKey(row, col) {
  return `${row},${col}`;
}

function getLineCoords(direction, index) {
  if (direction === "left") {
    return [0, 1, 2, 3].map((col) => ({ row: index, col }));
  }

  if (direction === "right") {
    return [3, 2, 1, 0].map((col) => ({ row: index, col }));
  }

  if (direction === "up") {
    return [0, 1, 2, 3].map((row) => ({ row, col: index }));
  }

  return [3, 2, 1, 0].map((row) => ({ row, col: index }));
}

function clearRemovalTimers() {
  for (const timer of removeTimers) {
    clearTimeout(timer);
  }
  removeTimers = [];
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
